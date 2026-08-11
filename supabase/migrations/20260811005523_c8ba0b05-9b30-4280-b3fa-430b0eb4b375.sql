ALTER TABLE public.campanhas 
ADD COLUMN IF NOT EXISTS repeat_policy text DEFAULT 'never',
ADD COLUMN IF NOT EXISTS repeat_cooldown_days integer,
ADD COLUMN IF NOT EXISTS schedule_mode text DEFAULT 'now',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS distribution_mode text DEFAULT 'intelligent',
ADD COLUMN IF NOT EXISTS variation_level text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS audio_mode text DEFAULT 'music_plus_original',
ADD COLUMN IF NOT EXISTS music_volume integer DEFAULT 80,
ADD COLUMN IF NOT EXISTS original_audio_volume integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS music_start_mode text DEFAULT 'beginning',
ADD COLUMN IF NOT EXISTS music_start_ms integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_start_time time without time zone DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS daily_end_time time without time zone DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS posts_per_day integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS content_interval_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS destination_interval_seconds integer DEFAULT 60;

ALTER TABLE public.publications
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS content_id uuid REFERENCES public.content_library(id),
ADD COLUMN IF NOT EXISTS media_render_id uuid REFERENCES public.media_renders(id),
ADD COLUMN IF NOT EXISTS provider_post_id text,
ADD COLUMN IF NOT EXISTS provider_connection_id text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_error text;

-- RENAME legacy column if it exists and scheduled_for doesn't
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='scheduled_at') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='scheduled_for') THEN
    ALTER TABLE public.publications RENAME COLUMN scheduled_at TO scheduled_for;
  END IF;
END $$;

ALTER TABLE public.publications 
ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_publications_scheduled_for ON public.publications(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_campanhas_user_id ON public.campanhas(user_id);
