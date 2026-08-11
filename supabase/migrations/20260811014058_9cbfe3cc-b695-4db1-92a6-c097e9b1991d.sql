
-- Corrigindo permissões da função dispatcher
REVOKE ALL ON FUNCTION public.dispatch_publications() FROM public;
REVOKE ALL ON FUNCTION public.dispatch_publications() FROM anon;
REVOKE ALL ON FUNCTION public.dispatch_publications() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_publications() TO service_role;

-- Se houver outras funções SECURITY DEFINER vulneráveis (como fill_publication_snapshot do linter), corrigir também
REVOKE ALL ON FUNCTION public.fill_publication_snapshot() FROM public;
REVOKE ALL ON FUNCTION public.fill_publication_snapshot() FROM anon;
REVOKE ALL ON FUNCTION public.fill_publication_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fill_publication_snapshot() TO service_role;
