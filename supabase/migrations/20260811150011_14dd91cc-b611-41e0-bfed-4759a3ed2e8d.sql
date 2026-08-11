
-- 1. Correct table grants
GRANT ALL ON public.server_cron_state TO service_role;
GRANT SELECT ON public.server_cron_state TO authenticated;
GRANT SELECT ON public.server_cron_state TO anon;

-- 2. Ensure singleton record exists
INSERT INTO public.server_cron_state (id, last_run_at, executor_type)
VALUES ('00000000-0000-0000-0000-000000000001', now(), 'edge_function_dispatcher')
ON CONFLICT (id) DO NOTHING;

-- 3. Audit cron job (column is jobid)
SELECT jobid, jobname, schedule, command, active FROM cron.job;
