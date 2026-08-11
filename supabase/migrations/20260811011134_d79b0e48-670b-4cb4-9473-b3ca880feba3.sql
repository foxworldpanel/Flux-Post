
-- Fix linter warnings for fill_publication_snapshot
ALTER FUNCTION public.fill_publication_snapshot() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.fill_publication_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_publication_snapshot() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_publication_snapshot() FROM anon;

-- Re-grant execute only to service_role (triggers run as owner, but we should be explicit)
GRANT EXECUTE ON FUNCTION public.fill_publication_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.fill_publication_snapshot() TO postgres;
