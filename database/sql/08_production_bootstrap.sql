-- ==============================================================================
-- AssetVault: Production Database Security Bootstrap
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- Purpose: Creates the restricted application runtime role (assetvault_app)
--          with least-privilege access (DML only, no DDL/DROP capabilities).
--
-- Usage:
--   psql "$DIRECT_URL" -v DBPASS="$APP_DB_PASSWORD" -f database/sql/08_production_bootstrap.sql
-- ==============================================================================

\set ON_ERROR_STOP on

-- Never fall back to a known/default password.
\if :{?DBPASS}
\else
  \echo 'FATAL: DBPASS must be supplied explicitly; refusing insecure default credentials.'
  \quit 3
\endif

-- 1. Create restricted application runtime role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'assetvault_app') THEN
    CREATE ROLE assetvault_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE 'Role assetvault_app created.';
  ELSE
    RAISE NOTICE 'Role assetvault_app already exists. Updating attributes...';
  END IF;
END $$;

-- 2. Set password for application runtime role from variable
ALTER ROLE assetvault_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'DBPASS';

-- 3. Grant connection privileges on the current database
SELECT format('GRANT CONNECT ON DATABASE %I TO assetvault_app', current_database()) \gexec

-- 4. Grant schema usage (prevents schema tampering)
GRANT USAGE ON SCHEMA public TO assetvault_app;

-- 5. Revoke DDL creation rights on schema public (Least Privilege: No table creations or drops at runtime)
REVOKE CREATE ON SCHEMA public FROM assetvault_app;

-- 6. Grant standard DML rights across all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assetvault_app;

-- 7. Grant sequence usage across all sequences for primary key autoincrements
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO assetvault_app;

-- 8. Grant execution rights on all stored functions and procedures
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO assetvault_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO assetvault_app;

-- The materialized view contains all tenants; expose only the filtered wrapper view.
REVOKE ALL PRIVILEGES ON TABLE mv_monthly_access_stats FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE mv_monthly_access_stats FROM assetvault_app;
GRANT SELECT ON TABLE v_monthly_access_stats_tenant TO assetvault_app;

-- 9. Configure default privileges for future objects created by migrations/admin
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assetvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO assetvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO assetvault_app;

-- 10. Verification queries (use PostgreSQL's supported information-schema views).
SELECT
  'public' AS schema_name,
  has_schema_privilege('assetvault_app', 'public', 'USAGE') AS has_usage,
  has_schema_privilege('assetvault_app', 'public', 'CREATE') AS has_create;

SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'assetvault_app'
ORDER BY table_schema, table_name, privilege_type;

SELECT 'Production bootstrap role configuration completed successfully.' AS status;
