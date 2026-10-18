-- ==============================================================================
-- AssetVault: RLS-safe reporting views
-- Keep ordinary views subject to the caller's PostgreSQL RLS policies.
-- The monthly access materialized view aggregates all tenants and is exposed to
-- the runtime role only through an explicit tenant-filtered security-barrier view.
-- ==============================================================================

ALTER VIEW v_license_utilization SET (security_invoker = true);
ALTER VIEW v_expiring_licenses SET (security_invoker = true);
ALTER VIEW v_asset_catalog SET (security_invoker = true);
ALTER VIEW v_vendor_spend SET (security_invoker = true);
ALTER VIEW v_tenant_summary SET (security_invoker = true);

CREATE OR REPLACE VIEW v_monthly_access_stats_tenant
WITH (security_barrier = true) AS
SELECT
    tenant_id,
    month_year,
    download_count,
    checkout_count,
    view_count,
    checkin_count,
    total_access_events,
    active_accessing_users,
    distinct_assets_accessed
FROM mv_monthly_access_stats
WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
   OR COALESCE(current_setting('app.is_super_admin', true) = 'true', FALSE);

-- The raw materialized view has rows from every tenant and does not apply RLS.
-- The runtime API must only read the tenant-filtered wrapper above.
REVOKE ALL PRIVILEGES ON TABLE mv_monthly_access_stats FROM assetvault_app;
GRANT SELECT ON TABLE v_monthly_access_stats_tenant TO assetvault_app;
