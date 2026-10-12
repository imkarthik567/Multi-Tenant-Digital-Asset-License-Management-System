-- ==============================================================================
-- AssetVault: Row-Level Security (RLS) Multi-Tenant Policies (04_rls.sql)
-- Course: VIT, BCSE307L Database Systems (Fall 2026-27)
-- ==============================================================================

-- Helper function to extract current session tenant context safely
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if session is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_super_admin', true) = 'true', false);
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on Top-Level Tenant Tables
-- ------------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Top-Level Policies: tenant_id must match current_tenant_id() OR session is super admin
CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_vendors ON vendors
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_categories ON categories
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_tags ON tags
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_assets ON assets
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_licenses ON licenses
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- ------------------------------------------------------------------------------
-- 2. Enable RLS on Child Tables (Inheriting Tenancy via Parent FK)
-- Preserves 3NF: No redundant tenant_id column
-- ------------------------------------------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
    FOR ALL
    USING (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = refresh_tokens.user_id AND u.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY tenant_isolation_asset_tags ON asset_tags
    FOR ALL
    USING (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM assets a 
            WHERE a.id = asset_tags.asset_id AND a.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY tenant_isolation_asset_licenses ON asset_licenses
    FOR ALL
    USING (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM assets a 
            WHERE a.id = asset_licenses.asset_id AND a.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY tenant_isolation_license_allocations ON license_allocations
    FOR ALL
    USING (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM licenses l 
            WHERE l.id = license_allocations.license_id AND l.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY tenant_isolation_asset_access_logs ON asset_access_logs
    FOR ALL
    USING (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM assets a 
            WHERE a.id = asset_access_logs.asset_id AND a.tenant_id = current_tenant_id()
        )
    );
