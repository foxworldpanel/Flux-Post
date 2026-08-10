-- FASE 3.5: MEDIA RENDER ENGINE
CREATE TYPE public.render_status AS ENUM ('queued', 'processing', 'ready', 'failed', 'cancelled');

CREATE TABLE public.media_renders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    render_key TEXT UNIQUE NOT NULL,
    source_content_id UUID REFERENCES public.content_library(id) ON DELETE SET NULL,
    music_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    music_start_ms INTEGER DEFAULT 0,
    audio_mode TEXT DEFAULT 'music_plus_original', -- 'only_music', 'music_plus_original', 'only_original'
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

-- Index for performance
CREATE INDEX idx_media_renders_key ON public.media_renders(render_key);
CREATE INDEX idx_media_renders_user ON public.media_renders(user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;

-- RLS
ALTER TABLE public.media_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own renders"
    ON public.media_renders
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Update publications table to reference media_render
ALTER TABLE public.publications ADD COLUMN media_render_id UUID REFERENCES public.media_renders(id) ON DELETE SET NULL;

-- Audit existing distribution settings
ALTER TABLE public.campanhas 
    ADD COLUMN IF NOT EXISTS music_start_ms INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS audio_mode TEXT DEFAULT 'music_plus_original',
    ADD COLUMN IF NOT EXISTS music_volume INTEGER DEFAULT 80,
    ADD COLUMN IF NOT EXISTS original_audio_volume INTEGER DEFAULT 20;

