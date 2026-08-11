-- 1. Ensure the singleton record exists
INSERT INTO public.server_cron_state (id, last_run_at, executor_type)
VALUES ('00000000-0000-0000-0000-000000000001', now(), 'edge_function_dispatcher')
ON CONFLICT (id) DO NOTHING;

-- 2. Grant table access to service_role (used by Edge Functions)
GRANT ALL ON public.server_cron_state TO service_role;

-- 3. Grant limited access to authenticated/anon (Frontend)
GRANT SELECT ON public.server_cron_state TO authenticated;
GRANT SELECT ON public.server_cron_state TO anon;

-- 4. Enable RLS and establish strict policies
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (requires owner, but we'll try to apply new ones)
-- We'll assume the migration runner has sufficient permissions to manage policies.
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read-only health" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Service role can do everything" ON public.server_cron_state;
    DROP POLICY IF EXISTS "Allow all access for now" ON public.server_cron_state;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE POLICY "Public read-only health"
ON public.server_cron_state
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Service role can do everything"
ON public.server_cron_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Audit the job to identify current state
-- This won't run here, but it's for documentation.
