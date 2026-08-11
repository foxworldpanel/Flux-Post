-- Create a table for managing renders server-side if not already aligned
-- And a table for server-side locks/cron emulation if pg_cron is missing
CREATE TABLE IF NOT EXISTS public.server_cron_state (
    id text PRIMARY KEY,
    last_run timestamptz,
    next_run timestamptz,
    status text
);

INSERT INTO public.server_cron_state (id, last_run, status) 
VALUES ('campaign_dispatcher', now(), 'idle')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, UPDATE ON public.server_cron_state TO authenticated;
GRANT ALL ON public.server_cron_state TO service_role;
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.server_cron_state FOR ALL TO service_role USING (true);
