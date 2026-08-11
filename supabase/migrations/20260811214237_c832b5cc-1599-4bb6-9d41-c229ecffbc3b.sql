-- 1. Grant explicit privileges to service_role (UID 16486 in this project)
GRANT ALL ON public.server_cron_state TO service_role;
GRANT ALL ON public.server_cron_state TO authenticated;
GRANT ALL ON public.server_cron_state TO anon;

-- 2. Audit ownership
ALTER TABLE public.server_cron_state OWNER TO postgres;

-- 3. Reset RLS just to be sure there's no interference
ALTER TABLE public.server_cron_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_everything_service_role" ON public.server_cron_state;
CREATE POLICY "allow_everything_service_role" ON public.server_cron_state 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "allow_read_public" ON public.server_cron_state;
CREATE POLICY "allow_read_public" ON public.server_cron_state 
FOR SELECT TO anon, authenticated 
USING (true);
