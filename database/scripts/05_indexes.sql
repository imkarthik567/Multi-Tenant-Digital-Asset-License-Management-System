-- ==============================================================================
-- AssetVault: Database Indexes (05_indexes.sql)
-- Course: VIT, BCSE307L Database Systems (Fall 2026-27)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Tenants & Roles Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ------------------------------------------------------------------------------
-- 2. Users & Refresh Tokens Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ------------------------------------------------------------------------------
-- 3. Vendors, Categories & Tags Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_name ON vendors(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags(tenant_id);

-- ------------------------------------------------------------------------------
-- 4. Assets & Tag Associations Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(tenant_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(tenant_id, created_at DESC);

-- GIN Trigram index for ultra-fast full text / fuzzy asset search
CREATE INDEX IF NOT EXISTS idx_assets_name_trgm ON assets USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);

-- ------------------------------------------------------------------------------
-- 5. Licenses & Allocation Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_vendor_id ON licenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(tenant_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_deleted_at ON licenses(tenant_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_asset_licenses_asset_id ON asset_licenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_licenses_license_id ON asset_licenses(license_id);

-- Partial Unique Index: Guarantees a user cannot hold two active seats of same license
CREATE UNIQUE INDEX IF NOT EXISTS idx_allocations_active_unique 
    ON license_allocations(license_id, user_id) 
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_allocations_license_id ON license_allocations(license_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user_id ON license_allocations(user_id);

-- ------------------------------------------------------------------------------
-- 6. Access Logs, Audit Logs & Notifications Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_access_logs_asset_id ON asset_access_logs(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON asset_access_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(tenant_id, action);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON notifications(user_id, is_read, created_at DESC);
