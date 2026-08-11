-- Add missing columns to 'campanhas'
ALTER TABLE public.campanhas 
    ADD COLUMN IF NOT EXISTS music_start_ms INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS audio_mode TEXT DEFAULT 'music_plus_original',
    ADD COLUMN IF NOT EXISTS music_volume INTEGER DEFAULT 80,
    ADD COLUMN IF NOT EXISTS original_audio_volume INTEGER DEFAULT 20,
    ADD COLUMN IF NOT EXISTS distribution_mode TEXT DEFAULT 'intelligent',
    ADD COLUMN IF NOT EXISTS distribution_variation TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS cooldown_days INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS editorial_language TEXT DEFAULT 'pt-BR',
    ADD COLUMN IF NOT EXISTS editorial_style TEXT DEFAULT 'engaging';

-- Create 'media_renders' table if missing (Fixing discrepancy where migration was present but table not in cache)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'render_status') THEN
        CREATE TYPE public.render_status AS ENUM ('queued', 'processing', 'ready', 'failed', 'cancelled');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.media_renders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    render_key TEXT UNIQUE NOT NULL,
    source_content_id UUID REFERENCES public.content_library(id) ON DELETE SET NULL,
    music_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    music_start_ms INTEGER DEFAULT 0,
    audio_mode TEXT DEFAULT 'music_plus_original',
    music_volume INTEGER DEFAULT 80,
    original_audio_volume INTEGER DEFAULT 20,
    output_profile TEXT DEFAULT 'short_vertical_v1',
    status public.render_status DEFAULT 'queued' NOT NULL,
    storage_path TEXT,
    duration_seconds NUMERIC,
    file_size BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Grant privileges for media_renders
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;

-- Enable RLS for media_renders
ALTER TABLE public.media_renders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'media_renders' AND policyname = 'Users can manage their own renders'
    ) THEN
        CREATE POLICY "Users can manage their own renders"
            ON public.media_renders
            FOR ALL
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Fix missing publications column
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS media_render_id UUID REFERENCES public.media_renders(id) ON DELETE SET NULL;
