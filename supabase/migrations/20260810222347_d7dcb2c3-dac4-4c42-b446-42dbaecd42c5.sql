
-- Set search_path and fix linter warnings
ALTER FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) SET search_path = public;

-- Revoke execute from public/anon to avoid 0028_anon_security_definer_function_executable
REVOKE EXECUTE ON FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) FROM anon;

-- Re-grant to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) TO service_role;
