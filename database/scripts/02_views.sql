-- ==============================================================================
-- AssetVault: Database Views (02_views.sql)
-- Course: VIT, BCSE307L Database Systems (Fall 2026-27)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- View 1: v_license_utilization_summary
-- Analyzes license seat capacity, active allocations, utilization percentage,
-- and financial cost per seat across all tenant licenses.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_license_utilization_summary AS
SELECT 
    l.id AS license_id,
    l.tenant_id,
    t.name AS tenant_name,
    l.vendor_id,
    v.name AS vendor_name,
    l.name AS license_name,
    l.license_type,
    l.total_seats,
    COUNT(la.id) FILTER (WHERE la.revoked_at IS NULL) AS allocated_seats,
    GREATEST(0, l.total_seats - COUNT(la.id) FILTER (WHERE la.revoked_at IS NULL)) AS available_seats,
    CASE 
        WHEN l.total_seats > 0 THEN 
            ROUND((COUNT(la.id) FILTER (WHERE la.revoked_at IS NULL)::numeric / l.total_seats::numeric) * 100, 2)
        ELSE 100.00
    END AS utilization_pct,
    l.cost,
    l.currency,
    CASE 
        WHEN l.total_seats > 0 THEN ROUND(l.cost / l.total_seats, 2)
        ELSE l.cost
    END AS cost_per_seat,
    l.starts_at,
    l.expires_at,
    l.status,
    l.is_auto_renew
FROM licenses l
JOIN tenants t ON l.tenant_id = t.id
JOIN vendors v ON l.vendor_id = v.id
LEFT JOIN license_allocations la ON l.id = la.license_id
WHERE l.deleted_at IS NULL
GROUP BY l.id, t.name, v.name;

-- ------------------------------------------------------------------------------
-- View 2: v_asset_catalog_detail
-- Complete asset view joining category, creator, and aggregated tags array.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_asset_catalog_detail AS
SELECT 
    a.id AS asset_id,
    a.tenant_id,
    t.name AS tenant_name,
    a.name AS asset_name,
    a.asset_type,
    a.description,
    a.file_url,
    a.file_size_bytes,
    ROUND((a.file_size_bytes::numeric / (1024 * 1024)), 2) AS file_size_mb,
    a.mime_type,
    a.version,
    a.category_id,
    c.name AS category_name,
    a.created_by_user_id,
    u.full_name AS creator_name,
    u.email AS creator_email,
    COALESCE(
        jsonb_agg(
            jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color_hex)
        ) FILTER (WHERE tg.id IS NOT NULL), 
        '[]'::jsonb
    ) AS tags,
    COUNT(DISTINCT al.license_id) AS linked_license_count,
    a.created_at,
    a.updated_at
FROM assets a
JOIN tenants t ON a.tenant_id = t.id
JOIN categories c ON a.category_id = c.id
LEFT JOIN users u ON a.created_by_user_id = u.id
LEFT JOIN asset_tags at ON a.id = at.asset_id
LEFT JOIN tags tg ON at.tag_id = tg.id
LEFT JOIN asset_licenses al ON a.id = al.asset_id
WHERE a.deleted_at IS NULL
GROUP BY a.id, t.name, c.name, u.full_name, u.email;

-- ------------------------------------------------------------------------------
-- View 3: v_expiring_licenses_30d
-- Identifies licenses expiring within 30 days requiring renewal intervention.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_expiring_licenses_30d AS
SELECT 
    l.id AS license_id,
    l.tenant_id,
    t.name AS tenant_name,
    l.name AS license_name,
    v.name AS vendor_name,
    v.contact_email AS vendor_email,
    l.expires_at,
    DATE_PART('day', l.expires_at - now())::int AS days_remaining,
    l.cost,
    l.currency,
    l.is_auto_renew,
    l.status
FROM licenses l
JOIN tenants t ON l.tenant_id = t.id
JOIN vendors v ON l.vendor_id = v.id
WHERE l.deleted_at IS NULL 
  AND l.status = 'active'
  AND l.expires_at IS NOT NULL
  AND l.expires_at > now()
  AND l.expires_at <= (now() + INTERVAL '30 days');

-- ------------------------------------------------------------------------------
-- View 4: v_tenant_storage_stats
-- High-level resource consumption overview per tenant organization.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tenant_storage_stats AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.subscription_tier,
    COUNT(a.id) AS total_assets,
    COALESCE(SUM(a.file_size_bytes), 0) AS total_storage_bytes,
    ROUND((COALESCE(SUM(a.file_size_bytes), 0)::numeric / (1024 * 1024 * 1024)), 3) AS total_storage_gb,
    COUNT(a.id) FILTER (WHERE a.asset_type = 'software') AS software_count,
    COUNT(a.id) FILTER (WHERE a.asset_type = 'dataset') AS dataset_count,
    COUNT(a.id) FILTER (WHERE a.asset_type = 'font') AS font_count,
    COUNT(a.id) FILTER (WHERE a.asset_type = 'image') AS image_count,
    COUNT(a.id) FILTER (WHERE a.asset_type = 'video') AS video_count
FROM tenants t
LEFT JOIN assets a ON t.id = a.tenant_id AND a.deleted_at IS NULL
GROUP BY t.id, t.name, t.subscription_tier;
