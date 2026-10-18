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

CREATE OR REPLACE VIEW v_monthly_spend WITH (security_invoker = true) AS
WITH monthly_costs AS (
    SELECT
        l.tenant_id,
        TO_CHAR(COALESCE(l.start_date, l.created_at), 'YYYY-MM') AS month_year,
        SUM(l.cost)::NUMERIC(12,2) AS monthly_spend
    FROM licenses l
    WHERE l.deleted_at IS NULL
    GROUP BY l.tenant_id, TO_CHAR(COALESCE(l.start_date, l.created_at), 'YYYY-MM')
)
SELECT
    tenant_id,
    month_year,
    COALESCE(monthly_spend, 0)::NUMERIC(12,2) AS monthly_spend,
    SUM(COALESCE(monthly_spend, 0)) OVER (
        PARTITION BY tenant_id
        ORDER BY month_year ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::NUMERIC(12,2) AS running_total_spend
FROM monthly_costs;

CREATE OR REPLACE VIEW v_top_downloaded_assets WITH (security_invoker = true) AS
WITH asset_downloads AS (
    SELECT
        a.tenant_id,
        a.id AS asset_id,
        a.name AS asset_name,
        a.asset_code,
        COUNT(aal.id)::BIGINT AS download_count
    FROM assets a
    LEFT JOIN asset_access_logs aal
      ON aal.asset_id = a.id
     AND aal.action = 'DOWNLOAD'
    WHERE a.deleted_at IS NULL
    GROUP BY a.tenant_id, a.id, a.name, a.asset_code
)
SELECT
    tenant_id,
    asset_id,
    asset_name,
    asset_code,
    download_count,
    RANK() OVER (
        PARTITION BY tenant_id
        ORDER BY download_count DESC
    ) AS rank
FROM asset_downloads;

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
