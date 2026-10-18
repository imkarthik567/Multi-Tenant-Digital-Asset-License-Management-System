-- Redact password hashes and software license keys from immutable audit snapshots.
-- Replacing the function in a forward-only migration also applies the fix to deployed databases.
CREATE OR REPLACE FUNCTION fn_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_record_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    -- 1. Extract JSON representations
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_data := to_jsonb(NEW);
    END IF;

    -- 2. Strip sensitive credentials (passwords, hashes)
    IF TG_TABLE_NAME = 'users' THEN
        IF v_old_data IS NOT NULL THEN
            v_old_data := v_old_data - 'password_hash';
        END IF;
        IF v_new_data IS NOT NULL THEN
            v_new_data := v_new_data - 'password_hash';
        END IF;
    ELSIF TG_TABLE_NAME = 'licenses' THEN
        -- Software license keys are secrets; never persist them in immutable audit snapshots.
        IF v_old_data IS NOT NULL THEN
            v_old_data := v_old_data - 'license_key';
        END IF;
        IF v_new_data IS NOT NULL THEN
            v_new_data := v_new_data - 'license_key';
        END IF;
    END IF;

    -- 3. Determine record ID
    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
    ELSE
        v_record_id := NEW.id;
    END IF;

    -- 4. Determine tenant_id context
    IF TG_TABLE_NAME = 'tenants' THEN
        IF TG_OP = 'DELETE' THEN
            v_tenant_id := NULL;
        ELSE
            v_tenant_id := v_record_id;
        END IF;
    ELSIF TG_TABLE_NAME IN ('users', 'assets', 'licenses', 'vendors') THEN
        IF TG_OP = 'DELETE' THEN
            v_tenant_id := OLD.tenant_id;
        ELSE
            v_tenant_id := NEW.tenant_id;
        END IF;
    ELSIF TG_TABLE_NAME IN ('license_allocations', 'license_renewals') THEN
        IF TG_OP = 'DELETE' THEN
            SELECT tenant_id INTO v_tenant_id FROM licenses WHERE id = OLD.license_id;
        ELSE
            SELECT tenant_id INTO v_tenant_id FROM licenses WHERE id = NEW.license_id;
        END IF;
    END IF;

    -- 5. Extract active user from session variable if set, otherwise fallback
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Fallback to row fields if app.current_user_id not configured
    IF v_user_id IS NULL THEN
        IF TG_TABLE_NAME = 'license_allocations' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.allocated_by ELSE NEW.allocated_by END;
        ELSIF TG_TABLE_NAME = 'assets' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_id ELSE NEW.owner_id END;
        ELSIF TG_TABLE_NAME = 'license_renewals' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.renewed_by ELSE NEW.renewed_by END;
        END IF;
    END IF;

    -- 6. Insert audit trail record
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        performed_at
    )
    VALUES (
        v_tenant_id,
        v_user_id,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP::audit_action,
        v_old_data,
        v_new_data,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
