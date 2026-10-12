-- ==============================================================================
-- AssetVault: Stored Procedures, Functions & Triggers (03_procedures_triggers.sql)
-- Course: VIT, BCSE307L Database Systems (Fall 2026-27)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Function: fn_set_updated_at
-- Standard trigger function to auto-update updated_at timestamp on row mutation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach fn_set_updated_at triggers to entities with updated_at
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Function & Trigger: fn_validate_seat_allocation_limit
-- Business Rule Integrity: Ensures allocations cannot exceed total_seats
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_seat_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_total_seats INT;
    v_active_seats INT;
    v_license_name VARCHAR;
    v_license_type VARCHAR;
BEGIN
    -- Only evaluate if allocation is active (revoked_at IS NULL)
    IF NEW.revoked_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch license seat limit and type
    SELECT total_seats, name, license_type 
    INTO v_total_seats, v_license_name, v_license_type
    FROM licenses
    WHERE id = NEW.license_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'License % not found or has been soft-deleted', NEW.license_id;
    END IF;

    -- Site and open_source licenses have unlimited seats
    IF v_license_type IN ('site', 'open_source') THEN
        RETURN NEW;
    END IF;

    -- Count existing active allocations excluding current record in case of update
    SELECT COUNT(*) INTO v_active_seats
    FROM license_allocations
    WHERE license_id = NEW.license_id 
      AND revoked_at IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF (v_active_seats + 1) > v_total_seats THEN
        RAISE EXCEPTION 'Cannot allocate seat: License "%" has reached maximum seat capacity of % (Current active: %)', 
            v_license_name, v_total_seats, v_active_seats
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_seat_limit ON license_allocations;
CREATE TRIGGER trg_check_seat_limit
    BEFORE INSERT OR UPDATE ON license_allocations
    FOR EACH ROW EXECUTE FUNCTION fn_validate_seat_allocation_limit();

-- ------------------------------------------------------------------------------
-- 3. Function & Trigger: fn_audit_log_mutation
-- Captures row modifications on critical entities into audit_logs table
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_action VARCHAR(30);
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_entity_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_entity_id := NEW.id;
        v_tenant_id := NEW.tenant_id;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_entity_id := NEW.id;
        v_tenant_id := NEW.tenant_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_entity_id := OLD.id;
        v_tenant_id := OLD.tenant_id;
        v_old_data := to_jsonb(OLD);
    END IF;

    INSERT INTO audit_logs (
        id,
        tenant_id,
        user_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        ip_address,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        NULL, -- Application will populate user_id for API initiated events
        TG_TABLE_NAME,
        v_entity_id,
        v_action,
        v_old_data,
        v_new_data,
        NULL,
        now()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_assets ON assets;
CREATE TRIGGER trg_audit_assets
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_licenses ON licenses;
CREATE TRIGGER trg_audit_licenses
    AFTER INSERT OR UPDATE OR DELETE ON licenses
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_mutation();

-- ------------------------------------------------------------------------------
-- 4. Stored Procedure: sp_expire_overdue_licenses
-- Batch job procedure that flags overdue licenses as 'expired'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_expire_overdue_licenses()
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE licenses
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Expired % overdue license contracts successfully.', v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Stored Procedure: sp_generate_renewal_notifications
-- Automatically creates alerts for impending license renewals
-- ------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_generate_renewal_notifications()
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    v_admin RECORD;
    v_alert_count INT := 0;
BEGIN
    FOR r IN 
        SELECT l.id, l.name, l.tenant_id, l.expires_at, l.renewal_reminder_days
        FROM licenses l
        WHERE l.status = 'active'
          AND l.expires_at IS NOT NULL
          AND l.expires_at > now()
          AND l.expires_at <= (now() + (l.renewal_reminder_days || ' days')::interval)
          AND l.deleted_at IS NULL
    LOOP
        -- Notify tenant admins
        FOR v_admin IN 
            SELECT u.id 
            FROM users u
            JOIN roles ro ON u.role_id = ro.id
            WHERE u.tenant_id = r.tenant_id 
              AND ro.name IN ('tenant_admin', 'asset_manager')
              AND u.is_active = true
        LOOP
            -- Check if an unread notification for this license already exists in last 7 days
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.user_id = v_admin.id
                  AND n.type = 'renewal_due'
                  AND n.title LIKE '%' || r.name || '%'
                  AND n.created_at >= (now() - INTERVAL '7 days')
            ) THEN
                INSERT INTO notifications (
                    id, tenant_id, user_id, title, message, type, is_read, created_at
                ) VALUES (
                    gen_random_uuid(),
                    r.tenant_id,
                    v_admin.id,
                    'Renewal Notice: ' || r.name,
                    'The license "' || r.name || '" is scheduled to expire on ' || to_char(r.expires_at, 'YYYY-MM-DD') || '. Please review renewal options.',
                    'renewal_due',
                    false,
                    now()
                );
                v_alert_count := v_alert_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Dispatched % renewal notification alerts.', v_alert_count;
END;
$$;
