
-- 1. Identificar o owner real
SELECT pg_get_userbyid(relowner) as table_owner 
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE n.nspname = 'public' AND c.relname = 'server_cron_state';

-- 2. Limpar todas as policies conflitantes e criar contrato canônico
DROP POLICY IF EXISTS "Service role can do everything" ON public.server_cron_state;
DROP POLICY IF EXISTS "Service role only" ON public.server_cron_state;
DROP POLICY IF EXISTS "Public read-only health" ON public.server_cron_state;
DROP POLICY IF EXISTS "Users can read cron state" ON public.server_cron_state;
DROP POLICY IF EXISTS "Users can view cron state" ON public.server_cron_state;
DROP POLICY IF EXISTS "Allow all access for now" ON public.server_cron_state;

ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;

-- Grant service_role
GRANT ALL ON public.server_cron_state TO service_role;
-- Grant read-only to others
GRANT SELECT ON public.server_cron_state TO authenticated, anon;

-- Policy canônica
CREATE POLICY "service_role_all" ON public.server_cron_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "public_read" ON public.server_cron_state FOR SELECT TO authenticated, anon USING (true);

-- Garantir singleton
INSERT INTO public.server_cron_state (id, last_run_at, executor_type)
VALUES ('00000000-0000-0000-0000-000000000001', now(), 'edge_function_dispatcher')
ON CONFLICT (id) DO UPDATE SET last_run_at = EXCLUDED.last_run_at;
