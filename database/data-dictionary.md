# Comprehensive Data Dictionary & Indexing Rationale

**Course:** VIT, BCSE307L Database Systems (Fall 2026-27)  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  
**Database Engine:** PostgreSQL 16  

---

## Table of Contents
1. [tenants](#1-tenants)
2. [roles](#2-roles)
3. [users](#3-users)
4. [refresh_tokens](#4-refresh_tokens)
5. [vendors](#5-vendors)
6. [categories](#6-categories)
7. [tags](#7-tags)
8. [assets](#8-assets)
9. [asset_tags](#9-asset_tags)
10. [licenses](#10-licenses)
11. [asset_licenses](#11-asset_licenses)
12. [license_allocations](#12-license_allocations)
13. [asset_access_logs](#13-asset_access_logs)
14. [audit_logs](#14-audit_logs)
15. [notifications](#15-notifications)
16. [Comprehensive Index Strategy Summary](#16-comprehensive-index-strategy-summary)

---

### 1. `tenants`
Stores independent customer organizations. Top-level scoping entity.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique tenant identifier. |
| `name` | `VARCHAR(100)` | No | — | Organization name. |
| `slug` | `VARCHAR(50)` | No | `UNIQUE` | URL-safe slug for tenant identification. |
| `status` | `VARCHAR(20)` | No | `DEFAULT 'active'`, `CHECK (status IN ('active', 'suspended', 'trial'))` | Tenant lifecycle status. |
| `subscription_tier` | `VARCHAR(20)` | No | `DEFAULT 'standard'`, `CHECK (subscription_tier IN ('free', 'standard', 'enterprise'))` | Tenant billing/feature tier. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Last update timestamp. |

**Indexes & Rationale:**
- `idx_tenants_slug` (`slug` UNIQUE B-tree): Rapid $O(\log N)$ lookup during tenant resolution via subdomain/slug.
- `idx_tenants_status` (`status` B-tree): Filtering active vs suspended tenants during administrative audits.

---

### 2. `roles`
System-wide lookup table defining access roles.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `SERIAL` | No | PK | Small integer sequence identifier. |
| `name` | `VARCHAR(50)` | No | `UNIQUE` | Unique role name (`super_admin`, `tenant_admin`, `asset_manager`, `member`, `auditor`). |
| `description` | `TEXT` | Yes | — | Human-readable role description. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Record creation timestamp. |

**Indexes & Rationale:**
- `idx_roles_name` (`name` UNIQUE B-tree): Fast verification during role assignment and authorization checks.

---

### 3. `users`
Unified table for all user accounts across all roles. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique user identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Scoping organization identifier. |
| `role_id` | `INT` | No | FK `roles(id)` | User permission role. |
| `email` | `VARCHAR(255)` | No | — | User email address. |
| `password_hash` | `VARCHAR(255)` | Yes | — | BCrypt cost 12 hash. Nullable for OAuth-only users. |
| `full_name` | `VARCHAR(100)` | No | — | Full display name. |
| `avatar_url` | `TEXT` | Yes | — | Profile picture URL. |
| `google_id` | `VARCHAR(255)` | Yes | `UNIQUE` | Google OAuth subject identifier. |
| `is_active` | `BOOLEAN` | No | `DEFAULT true` | Account active status. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Account creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Profile last updated. |

**Constraints:**
- Composite Unique: `UNIQUE (tenant_id, email)` guarantees email uniqueness per tenant.

**Indexes & Rationale:**
- `idx_users_tenant_id` (`tenant_id` B-tree): Critical foreign key index for tenant isolation filtering.
- `idx_users_tenant_email` (`tenant_id, email` UNIQUE B-tree): Accelerated credential login query.
- `idx_users_role_id` (`role_id` B-tree): Filter users by role in tenant admin member listings.
- `idx_users_google_id` (`google_id` B-tree): Fast $O(\log N)$ lookup during Google OAuth callback.

---

### 4. `refresh_tokens`
Hashed refresh tokens for JWT session rotation. Child of `users`.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Session token identifier. |
| `user_id` | `UUID` | No | FK `users(id) ON DELETE CASCADE` | Associated user. Inherits tenancy. |
| `token_hash` | `VARCHAR(64)` | No | — | SHA-256 cryptographic hash of refresh token. |
| `expires_at` | `TIMESTAMPTZ` | No | — | Expiration timestamp. |
| `revoked_at` | `TIMESTAMPTZ` | Yes | — | Timestamp if manually invalidated/logged out. |
| `ip_address` | `VARCHAR(45)` | Yes | — | Client IPv4 / IPv6 address. |
| `user_agent` | `TEXT` | Yes | — | Client browser / device user agent. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Token creation timestamp. |

**Indexes & Rationale:**
- `idx_refresh_tokens_hash` (`token_hash` B-tree): Instant verification during `/auth/refresh` API calls.
- `idx_refresh_tokens_user_id` (`user_id` B-tree): Facilitates revoking all sessions for a specific user on logout/password reset.

---

### 5. `vendors`
Commercial software & asset vendors. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique vendor identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Owning tenant identifier. |
| `name` | `VARCHAR(150)` | No | — | Vendor company name. |
| `contact_email` | `VARCHAR(255)` | Yes | — | Account representative email. |
| `contact_phone` | `VARCHAR(50)` | Yes | — | Vendor phone contact. |
| `website_url` | `TEXT` | Yes | — | Vendor home website. |
| `address` | `TEXT` | Yes | — | Physical / billing address. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Vendor record creation. |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Last update timestamp. |

**Constraints:**
- Composite Unique: `UNIQUE (tenant_id, name)` prevents duplicate vendor names within a tenant.

**Indexes & Rationale:**
- `idx_vendors_tenant_id` (`tenant_id` B-tree): Fast tenant-scoped filtering on vendor directory.
- `idx_vendors_tenant_name` (`tenant_id, name` B-tree): Alphabetical sorting and prefix search on vendor lists.

---

### 6. `categories`
Hierarchical asset classification taxonomy. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique category identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Owning tenant identifier. |
| `name` | `VARCHAR(100)` | No | — | Category name (e.g., "Fonts", "Datasets"). |
| `description` | `TEXT` | Yes | — | Category details. |
| `parent_category_id` | `UUID` | Yes | FK `categories(id) ON DELETE SET NULL` | Self-referencing FK for sub-categories. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Last update timestamp. |

**Constraints:**
- Composite Unique: `UNIQUE (tenant_id, name)` avoids duplicate categories per tenant.

**Indexes & Rationale:**
- `idx_categories_tenant_id` (`tenant_id` B-tree): Scope categories to active tenant.
- `idx_categories_parent_id` (`parent_category_id` B-tree): Recursive tree traversal when querying subcategories.

---

### 7. `tags`
Flexible labeling taxonomy for assets. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique tag identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Owning tenant identifier. |
| `name` | `VARCHAR(50)` | No | — | Tag label (e.g., "production", "ai-model"). |
| `color_hex` | `VARCHAR(7)` | No | `DEFAULT '#6B7280'` | Hexadecimal display color code. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Tag creation timestamp. |

**Constraints:**
- Composite Unique: `UNIQUE (tenant_id, name)` ensures tag label uniqueness within each tenant.

**Indexes & Rationale:**
- `idx_tags_tenant_id` (`tenant_id` B-tree): Fast retrieval of tenant tag vocabulary.

---

### 8. `assets`
Digital assets (fonts, datasets, software, videos, etc.). Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique asset identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Owning tenant identifier. |
| `category_id` | `UUID` | No | FK `categories(id)` | Classification category. |
| `name` | `VARCHAR(200)` | No | — | Asset title. |
| `asset_type` | `VARCHAR(30)` | No | `CHECK (asset_type IN ('font', 'image', 'software', 'dataset', 'video', 'document', 'other'))` | Digital asset category type. |
| `description` | `TEXT` | Yes | — | Asset technical or usage description. |
| `file_url` | `TEXT` | Yes | — | Cloud or local storage URI. |
| `file_size_bytes` | `BIGINT` | Yes | `CHECK (file_size_bytes >= 0)` | File payload size in bytes. |
| `mime_type` | `VARCHAR(100)` | Yes | — | Standard IANA media type. |
| `version` | `VARCHAR(50)` | No | `DEFAULT '1.0.0'` | Semantic or release version string. |
| `metadata` | `JSONB` | No | `DEFAULT '{}'` | Flexible JSON attributes (resolution, dimensions, etc.). |
| `deleted_at` | `TIMESTAMPTZ` | Yes | — | Soft-delete timestamp. |
| `created_by_user_id`| `UUID` | Yes | FK `users(id) ON DELETE SET NULL` | Creator / uploader user. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Asset creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Last modified timestamp. |

**Indexes & Rationale:**
- `idx_assets_tenant_id` (`tenant_id` B-tree): Tenant isolation filter.
- `idx_assets_category_id` (`category_id` B-tree): Filter catalog by category.
- `idx_assets_asset_type` (`tenant_id, asset_type` B-tree): Filter assets by type within tenant.
- `idx_assets_deleted_at` (`tenant_id, deleted_at` B-tree): Soft-delete exclusion filter (`WHERE deleted_at IS NULL`).
- `idx_assets_name_trgm` (`name gin_trgm_ops` GIN Index): Enables lightning-fast ILIKE text search (`?q=query`).
- `idx_assets_created_at` (`tenant_id, created_at DESC` B-tree): Catalog pagination and chronological sorting.

---

### 9. `asset_tags`
Many-to-many associative join table linking assets to tags. Child table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Association identifier. |
| `asset_id` | `UUID` | No | FK `assets(id) ON DELETE CASCADE` | Linked asset. Inherits tenancy. |
| `tag_id` | `UUID` | No | FK `tags(id) ON DELETE CASCADE` | Linked tag. Inherits tenancy. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Association creation timestamp. |

**Constraints:**
- Composite Unique: `UNIQUE (asset_id, tag_id)` prevents assigning duplicate tags to the same asset.

**Indexes & Rationale:**
- `idx_asset_tags_asset_id` (`asset_id` B-tree): Rapid retrieval of all tags on an asset detail card.
- `idx_asset_tags_tag_id` (`tag_id` B-tree): Rapid retrieval of all assets bearing a given tag.

---

### 10. `licenses`
Commercial and open-source licenses covering assets. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Unique license identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Owning tenant identifier. |
| `vendor_id` | `UUID` | No | FK `vendors(id) ON DELETE RESTRICT`| Commercial vendor. |
| `name` | `VARCHAR(200)` | No | — | License name (e.g., "JetBrains All Products Pack"). |
| `license_key` | `TEXT` | Yes | — | Software activation key / credential. |
| `license_type` | `VARCHAR(30)` | No | `CHECK (license_type IN ('per_seat', 'site', 'subscription', 'perpetual', 'open_source'))` | License licensing model. |
| `total_seats` | `INT` | No | `DEFAULT 1, CHECK (total_seats >= 0)` | Maximum allowed simultaneous seats. |
| `cost` | `NUMERIC(12,2)` | No | `DEFAULT 0.00, CHECK (cost >= 0)` | Financial cost. |
| `currency` | `VARCHAR(3)` | No | `DEFAULT 'USD'` | ISO 4217 currency code. |
| `starts_at` | `TIMESTAMPTZ` | No | — | License validity start date. |
| `expires_at` | `TIMESTAMPTZ` | Yes | — | License expiration date. Null for perpetual. |
| `is_auto_renew` | `BOOLEAN` | No | `DEFAULT false` | Flag if auto-renewal contract is active. |
| `renewal_reminder_days` | `INT` | No | `DEFAULT 30, CHECK (renewal_reminder_days >= 0)` | Alert threshold before expiry. |
| `status` | `VARCHAR(20)` | No | `DEFAULT 'active', CHECK (status IN ('active', 'expired', 'suspended', 'pending_renewal'))` | License validity status. |
| `deleted_at` | `TIMESTAMPTZ` | Yes | — | Soft delete timestamp. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | License record creation. |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Last update timestamp. |

**Indexes & Rationale:**
- `idx_licenses_tenant_id` (`tenant_id` B-tree): Tenant scope filter.
- `idx_licenses_vendor_id` (`vendor_id` B-tree): Filter licenses by vendor.
- `idx_licenses_status` (`tenant_id, status` B-tree): Filter active vs expired licenses.
- `idx_licenses_expires_at` (`tenant_id, expires_at` B-tree): Optimizes cron jobs and views identifying impending expirations.
- `idx_licenses_deleted_at` (`tenant_id, deleted_at` B-tree): Exclude soft-deleted licenses.

---

### 11. `asset_licenses`
Associative join table mapping assets to licenses. Child table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Association identifier. |
| `asset_id` | `UUID` | No | FK `assets(id) ON DELETE CASCADE` | Covered asset. Inherits tenancy. |
| `license_id` | `UUID` | No | FK `licenses(id) ON DELETE CASCADE` | Covering license. Inherits tenancy. |
| `notes` | `TEXT` | Yes | — | Terms or usage notes. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Association creation timestamp. |

**Constraints:**
- Composite Unique: `UNIQUE (asset_id, license_id)` ensures an asset is linked to a license at most once.

**Indexes & Rationale:**
- `idx_asset_licenses_asset_id` (`asset_id` B-tree): Find licenses protecting an asset.
- `idx_asset_licenses_license_id` (`license_id` B-tree): Find all assets covered by a license.

---

### 12. `license_allocations`
Tracks assignment of license seats to specific users. Child table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Allocation record identifier. |
| `license_id` | `UUID` | No | FK `licenses(id) ON DELETE CASCADE` | Allocated license. Inherits tenancy. |
| `user_id` | `UUID` | No | FK `users(id) ON DELETE CASCADE` | Assigned user. Inherits tenancy. |
| `allocated_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Assignment timestamp. |
| `revoked_at` | `TIMESTAMPTZ` | Yes | — | Revocation timestamp if reclaimed. |
| `notes` | `TEXT` | Yes | — | Assignment reasoning or workstation ID. |

**Indexes & Rationale:**
- `idx_allocations_active_unique` (`license_id, user_id` Partial Unique B-tree `WHERE revoked_at IS NULL`): Enforces that a user cannot occupy two simultaneous active seats of the exact same license.
- `idx_allocations_license_id` (`license_id` B-tree): Computes active seat counts (`COUNT(*) WHERE revoked_at IS NULL`).
- `idx_allocations_user_id` (`user_id` B-tree): Shows all software licenses assigned to an employee.

---

### 13. `asset_access_logs`
High-throughput audit log of asset views, downloads, checkouts. Child table of `assets`.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Access log identifier. |
| `asset_id` | `UUID` | No | FK `assets(id) ON DELETE CASCADE` | Accessed asset. Inherits tenancy. |
| `user_id` | `UUID` | Yes | FK `users(id) ON DELETE SET NULL` | Performing user (null for public download). |
| `action` | `VARCHAR(50)` | No | `CHECK (action IN ('view', 'download', 'checkout', 'checkin'))` | Operation performed. |
| `ip_address` | `VARCHAR(45)` | Yes | — | Client IP address. |
| `user_agent` | `TEXT` | Yes | — | Client user-agent. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Access event timestamp. |

**Indexes & Rationale:**
- `idx_access_logs_asset_id` (`asset_id, created_at DESC` B-tree): Fast asset download history timeline.
- `idx_access_logs_user_id` (`user_id, created_at DESC` B-tree): Employee usage audit trail.

---

### 14. `audit_logs`
Immutable compliance log recording all system entity mutations. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Audit record identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Scoping tenant identifier. |
| `user_id` | `UUID` | Yes | FK `users(id) ON DELETE SET NULL` | Actor user identifier. |
| `entity_type` | `VARCHAR(50)` | No | — | Mutated entity name (e.g., `Asset`, `License`). |
| `entity_id` | `UUID` | No | — | Mutated record primary key. |
| `action` | `VARCHAR(30)` | No | `CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'ALLOCATE', 'REVOKE', 'LOGIN', 'LOGOUT'))` | Action type. |
| `old_values` | `JSONB` | Yes | — | Pre-mutation JSON snapshot. |
| `new_values` | `JSONB` | Yes | — | Post-mutation JSON snapshot. |
| `ip_address` | `VARCHAR(45)` | Yes | — | Actor IP address. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Immutable audit timestamp. |

**Indexes & Rationale:**
- `idx_audit_logs_tenant_created` (`tenant_id, created_at DESC` B-tree): Compliance log viewer chronological pagination.
- `idx_audit_logs_entity` (`tenant_id, entity_type, entity_id` B-tree): Deep history trace for an individual asset or license.
- `idx_audit_logs_action` (`tenant_id, action` B-tree): Filter audit logs by security action (e.g., all `DELETE` events).

---

### 15. `notifications`
Alerts and reminders for license expiry, renewals, and system warnings. Top-level tenant table.

| Column Name | PostgreSQL Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | PK, `DEFAULT gen_random_uuid()` | Notification identifier. |
| `tenant_id` | `UUID` | No | FK `tenants(id) ON DELETE CASCADE` | Scoping tenant identifier. |
| `user_id` | `UUID` | No | FK `users(id) ON DELETE CASCADE` | Recipient user identifier. |
| `title` | `VARCHAR(150)` | No | — | Short alert headline. |
| `message` | `TEXT` | No | — | Full alert text. |
| `type` | `VARCHAR(30)` | No | `CHECK (type IN ('license_expiry', 'renewal_due', 'seat_exhaustion', 'system'))` | Alert classification. |
| `is_read` | `BOOLEAN` | No | `DEFAULT false` | Read status flag. |
| `read_at` | `TIMESTAMPTZ` | Yes | — | Read acknowledgement timestamp. |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT now()` | Notification creation timestamp. |

**Indexes & Rationale:**
- `idx_notifications_user_unread` (`user_id, is_read, created_at DESC` B-tree): Powers top navigation unread alert badge and dropdown queries with minimal I/O.

---

## 16. Comprehensive Index Strategy Summary

All indexes are designed based on the following relational query access patterns:
1. **Foreign Key Performance:** Every FK column is indexed with B-tree to eliminate full table scans during joins and cascade deletions.
2. **Multi-Tenant Filter Efficiency:** Leading columns in composite indexes are set to `tenant_id` to enforce partition-like index filtering.
3. **Text Search Acceleration:** `pg_trgm` GIN indexes are deployed on `assets.name` for fast partial substring match (`ILIKE '%word%'`) queries.
4. **Soft Delete Filtering:** Partial indexes or composite keys with `deleted_at` prevent scanning deleted rows.
5. **Partial Uniqueness:** `idx_allocations_active_unique` enforces business invariants at the database level without requiring heavy locking logic in application code.
