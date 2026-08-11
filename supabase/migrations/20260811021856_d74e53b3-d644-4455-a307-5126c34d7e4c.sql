-- Corrigindo as permissões com assinaturas corretas
REVOKE EXECUTE ON FUNCTION public.generate_unique_artist_slug(text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_artist_slug(text, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_artist_slug(text, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fill_publication_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_publication_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fill_publication_snapshot() TO service_role;

REVOKE EXECUTE ON FUNCTION public.dispatch_publications() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispatch_publications() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_publications() TO service_role;
