-- ==============================================================================
-- AssetVault: Database Schema DDL (PostgreSQL 16)
-- Course: VIT, BCSE307L Database Systems (Fall 2026-27)
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- 1. Table: tenants
-- Top-level organization entity for multi-tenancy scoping
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (subscription_tier IN ('free', 'standard', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. Table: roles
-- Global lookup table for Role-Based Access Control (RBAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. Table: users
-- Single unified table for all system users across all roles (Rule 4)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

-- ------------------------------------------------------------------------------
-- 4. Table: refresh_tokens
-- Child of users: stores SHA-256 hashed refresh tokens. Inherits tenancy via users.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. Table: vendors
-- Commercial and open-source asset/software suppliers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    website_url TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vendors_tenant_name UNIQUE (tenant_id, name)
);

-- ------------------------------------------------------------------------------
-- 6. Table: categories
-- Hierarchical categorization for digital assets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_categories_tenant_name UNIQUE (tenant_id, name)
);

-- ------------------------------------------------------------------------------
-- 7. Table: tags
-- Flexible labeling taxonomy for digital assets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color_hex VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tags_tenant_name UNIQUE (tenant_id, name)
);

-- ------------------------------------------------------------------------------
-- 8. Table: assets
-- Digital assets catalog (fonts, datasets, software, images, videos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN ('font', 'image', 'software', 'dataset', 'video', 'document', 'other')),
    description TEXT,
    file_url TEXT,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0),
    mime_type VARCHAR(100),
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 9. Table: asset_tags
-- Associative entity linking assets and tags. Inherits tenancy via assets/tags.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_asset_tags UNIQUE (asset_id, tag_id)
);

-- ------------------------------------------------------------------------------
-- 10. Table: licenses
-- License contracts, subscriptions, and seat entitlements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    license_key TEXT,
    license_type VARCHAR(30) NOT NULL CHECK (license_type IN ('per_seat', 'site', 'subscription', 'perpetual', 'open_source')),
    total_seats INT NOT NULL DEFAULT 1 CHECK (total_seats >= 0),
    cost NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0.00),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    is_auto_renew BOOLEAN NOT NULL DEFAULT false,
    renewal_reminder_days INT NOT NULL DEFAULT 30 CHECK (renewal_reminder_days >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'pending_renewal')),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 11. Table: asset_licenses
-- Associative entity mapping assets to licenses. Inherits tenancy via parents.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_asset_licenses UNIQUE (asset_id, license_id)
);

-- ------------------------------------------------------------------------------
-- 12. Table: license_allocations
-- Tracks user seat assignments. Inherits tenancy via licenses & users.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS license_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    notes TEXT
);

-- ------------------------------------------------------------------------------
-- 13. Table: asset_access_logs
-- High-throughput usage audit log. Inherits tenancy via assets.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('view', 'download', 'checkout', 'checkin')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 14. Table: audit_logs
-- Immutable compliance mutation audit log. Top-level tenant table.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'ALLOCATE', 'REVOKE', 'LOGIN', 'LOGOUT')),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 15. Table: notifications
-- System and renewal notifications. Top-level tenant table.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('license_expiry', 'renewal_due', 'seat_exhaustion', 'system')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
