-- 1. PUBLICATIONS Table reconciliation
ALTER TABLE public.publications RENAME COLUMN music_id TO music_track_id;
-- Note: render_options already exists as jsonb from previous migration audit

-- 2. Ensure Constraints and FKs
ALTER TABLE public.publications 
  ADD CONSTRAINT fk_publications_music_track_id 
  FOREIGN KEY (music_track_id) REFERENCES public.music_tracks(id) ON DELETE SET NULL;

-- 3. MEDIA_RENDERS Table reconciliation (Syncing with dispatcher expectations)
ALTER TABLE public.media_renders RENAME COLUMN music_id TO music_track_id;

-- 4. CAMPANHAS Table audit
-- The audit showed columns like 'posts_per_day' (default 4) and 'posts_por_dia' (existing). 
-- Standardizing to what the code uses: 'posts_por_dia'.
-- No action needed if code already uses it.

-- 5. SERVER_CRON_STATE Table (if missing)
CREATE TABLE IF NOT EXISTS public.server_cron_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_run_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    processed_count INTEGER DEFAULT 0,
    executor_type TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.server_cron_state TO authenticated;
GRANT ALL ON public.server_cron_state TO service_role;
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view cron state" ON public.server_cron_state FOR SELECT TO authenticated USING (true);

-- 6. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
