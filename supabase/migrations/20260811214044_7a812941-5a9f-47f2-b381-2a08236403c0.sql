-- 1. Ensure Singleton exists with correct ID
INSERT INTO public.server_cron_state (id, last_run_at, processed_count, executor_type)
VALUES ('00000000-0000-0000-0000-000000000001', NOW(), 0, 'edge_function_dispatcher')
ON CONFLICT (id) DO UPDATE SET 
  executor_type = 'edge_function_dispatcher';

-- 2. Grant permissions explicitly
GRANT ALL ON public.server_cron_state TO service_role;
GRANT SELECT ON public.server_cron_state TO anon;
GRANT SELECT ON public.server_cron_state TO authenticated;

-- 3. Audit RLS
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.server_cron_state;
CREATE POLICY "public_read" ON public.server_cron_state 
FOR SELECT TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "service_role_all" ON public.server_cron_state;
CREATE POLICY "service_role_all" ON public.server_cron_state 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);
