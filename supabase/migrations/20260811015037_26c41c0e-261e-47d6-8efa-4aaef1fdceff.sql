-- Check if we can use a HTTP trigger or if we need a different approach for cron
-- Since pg_cron is not available, we might need a worker or a different mechanism.
-- But first, let's see if we can at least create a table for tasks.
CREATE TABLE IF NOT EXISTS public.server_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type text NOT NULL,
    payload jsonb DEFAULT '{}',
    status text DEFAULT 'pending',
    scheduled_for timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_tasks TO authenticated;
GRANT ALL ON public.server_tasks TO service_role;
ALTER TABLE public.server_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own tasks" ON public.server_tasks FOR ALL TO authenticated USING (auth.uid() = (payload->>'user_id')::uuid);
