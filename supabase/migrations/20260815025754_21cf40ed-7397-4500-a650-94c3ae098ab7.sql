
-- Fix security linter warnings for the new RPCs
ALTER FUNCTION public.claim_next_render_job(interval) SET search_path = public;
ALTER FUNCTION public.heartbeat_render_job(uuid) SET search_path = public;

-- Revoke public (anon) execute permissions as these are for authenticated/service_role only
REVOKE EXECUTE ON FUNCTION public.claim_next_render_job(interval) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.heartbeat_render_job(uuid) FROM PUBLIC;

-- Re-grant to specific roles
GRANT EXECUTE ON FUNCTION public.claim_next_render_job(interval) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_render_job(uuid) TO authenticated, service_role;
