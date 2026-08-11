ALTER TABLE public.publications RENAME COLUMN scheduled_at TO scheduled_for;
CREATE INDEX IF NOT EXISTS idx_publications_scheduled_for ON public.publications (user_id, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;