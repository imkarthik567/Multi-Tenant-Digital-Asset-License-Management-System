-- Serialize per-tenant quota checks with the tenant row lock so concurrent inserts
-- cannot both pass a stale count and exceed the active plan limits.

CREATE OR REPLACE FUNCTION fn_plan_asset_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_assets INT;
    v_current_assets INT;
BEGIN
    -- Concurrent asset inserts for one tenant must observe each other's commits
    -- before checking the quota. Locking the parent tenant serializes this check.
    SELECT p.max_assets INTO v_max_assets
    FROM tenants t
    JOIN plans p ON p.id = t.plan_id
    WHERE t.id = NEW.tenant_id
    FOR UPDATE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % does not exist', NEW.tenant_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT COUNT(*) INTO v_current_assets
    FROM assets
    WHERE tenant_id = NEW.tenant_id
      AND deleted_at IS NULL;

    IF v_current_assets >= v_max_assets THEN
        RAISE EXCEPTION 'Tenant asset limit of % exceeded for current subscription plan', v_max_assets
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_plan_user_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_users INT;
    v_current_users INT;
BEGIN
    IF NEW.tenant_id IS NOT NULL THEN
        -- Keep user creation and tenant plan changes in the same serialized
        -- quota domain, matching the asset limit trigger.
        SELECT p.max_users INTO v_max_users
        FROM tenants t
        JOIN plans p ON p.id = t.plan_id
        WHERE t.id = NEW.tenant_id
        FOR UPDATE OF t;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tenant % does not exist', NEW.tenant_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        SELECT COUNT(*) INTO v_current_users
        FROM users
        WHERE tenant_id = NEW.tenant_id;

        IF v_current_users >= v_max_users THEN
            RAISE EXCEPTION 'Tenant user limit of % exceeded for current subscription plan', v_max_users
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
