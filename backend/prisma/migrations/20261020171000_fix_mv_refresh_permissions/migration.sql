-- Allow the least-privilege application role to refresh the reporting MV safely.
-- The function runs as its owner (who owns the materialized view) rather than
-- granting ownership of the view to the application role.

CREATE OR REPLACE FUNCTION public.fn_refresh_monthly_access_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_access_stats;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_refresh_monthly_access_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_refresh_monthly_access_stats() TO assetvault_app;
