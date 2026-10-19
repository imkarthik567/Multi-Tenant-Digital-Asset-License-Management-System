-- Serialize allocation's active-user check with concurrent account deactivation.
CREATE OR REPLACE PROCEDURE sp_allocate_license_seat(
    p_license_id UUID,
    p_user_id UUID,
    p_allocated_by UUID,
    INOUT p_allocation_id UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_license RECORD;
    v_user RECORD;
    v_used_seats INT;
    v_existing_alloc INT;
BEGIN
    -- Ensure session context for actor so audit triggers capture user_id
    IF p_allocated_by IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_allocated_by::TEXT, true);
    END IF;

    -- 1. Lock the license row to guarantee serialized seat counter checks
    SELECT id, tenant_id, name, total_seats, status, end_date, deleted_at
    INTO v_license
    FROM licenses
    WHERE id = p_license_id
    FOR UPDATE;

    IF NOT FOUND OR v_license.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'License % does not exist or has been deleted', p_license_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- 2. Verify license is ACTIVE and not expired
    IF v_license.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'License % is not ACTIVE (current status: %)', v_license.name, v_license.status
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_license.end_date IS NOT NULL AND v_license.end_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'License % expired on %', v_license.name, v_license.end_date
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3. Verify user exists, is active, and shares the same tenant
    -- Serialize against account deactivation so the active-state check and
    -- allocation insert cannot straddle a concurrent user status change.
    SELECT id, tenant_id, full_name, is_active
    INTO v_user
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NOT v_user.is_active THEN
        RAISE EXCEPTION 'User % (%) is inactive', v_user.full_name, p_user_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_user.tenant_id IS DISTINCT FROM v_license.tenant_id THEN
        RAISE EXCEPTION 'Tenant mismatch: License belongs to tenant % but user belongs to tenant %',
            v_license.tenant_id, v_user.tenant_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- 4. Verify user does not already hold an ACTIVE allocation for this license
    SELECT COUNT(*)
    INTO v_existing_alloc
    FROM license_allocations
    WHERE license_id = p_license_id
      AND user_id = p_user_id
      AND status = 'ACTIVE';

    IF v_existing_alloc > 0 THEN
        RAISE EXCEPTION 'User % already holds an active seat for license %', v_user.full_name, v_license.name
            USING ERRCODE = 'unique_violation';
    END IF;

    -- 5. Count current active seats and enforce total_seats limit
    SELECT COUNT(*)
    INTO v_used_seats
    FROM license_allocations
    WHERE license_id = p_license_id
      AND status = 'ACTIVE';

    IF v_used_seats >= v_license.total_seats THEN
        RAISE EXCEPTION 'License seats exhausted'
            USING ERRCODE = 'check_violation';
    END IF;

    -- 6. Insert new allocation
    INSERT INTO license_allocations (
        id,
        license_id,
        user_id,
        allocated_by,
        allocated_at,
        status
    )
    VALUES (
        gen_random_uuid(),
        p_license_id,
        p_user_id,
        p_allocated_by,
        NOW(),
        'ACTIVE'
    )
    RETURNING id INTO p_allocation_id;
END;
$$;
