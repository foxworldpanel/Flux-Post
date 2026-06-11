CREATE TABLE public.videos_processados (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos_processados TO authenticated;
GRANT ALL ON public.videos_processados TO service_role;

ALTER TABLE public.videos_processados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage processed videos" ON public.videos_processados
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');