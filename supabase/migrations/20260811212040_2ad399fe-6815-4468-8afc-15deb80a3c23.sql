
-- 1. Identificar o owner real (postgres, supabase_admin, etc)
SELECT pg_get_userbyid(relowner) as table_owner 
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE n.nspname = 'public' AND c.relname = 'server_cron_state';

-- 2. RESET TOTAL de RLS e Policies para contrato canônico
ALTER TABLE public.server_cron_state DISABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.server_cron_state;
    DROP POLICY IF EXISTS "public_read" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Service role only" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Users can read cron state" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Users can view cron state" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Allow all access for now" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Service role can do everything" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Public read-only health" ON public.server_cron_state;
END $$;

-- 3. Grants explícitos (Supabase Data API)
REVOKE ALL ON public.server_cron_state FROM anon, authenticated;
GRANT ALL ON public.server_cron_state TO service_role;
GRANT SELECT ON public.server_cron_state TO authenticated, anon;

-- 4. Re-enable RLS com policies canônicas
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.server_cron_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "public_read" ON public.server_cron_state FOR SELECT TO authenticated, anon USING (true);

-- 5. Forçar reconciliação do singleton
DELETE FROM public.server_cron_state WHERE id = '00000000-0000-0000-0000-000000000001';
INSERT INTO public.server_cron_state (id, last_run_at, last_success_at, executor_type, processed_count)
VALUES ('00000000-0000-0000-0000-000000000001', now(), now(), 'edge_function_dispatcher', 0);
