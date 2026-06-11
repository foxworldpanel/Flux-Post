-- Enable RLS for all public tables
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos_processados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts_agendados ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.music_tracks TO authenticated, service_role;
GRANT ALL ON public.videos TO authenticated, service_role;
GRANT ALL ON public.videos_processados TO authenticated, service_role;
GRANT ALL ON public.campanhas TO authenticated, service_role;
GRANT ALL ON public.tiktok_accounts TO authenticated, service_role;
GRANT ALL ON public.posts_agendados TO authenticated, service_role;

-- Public read access for musics and videos (needed for processing)
GRANT SELECT ON public.music_tracks TO anon;
GRANT SELECT ON public.videos TO anon;

-- Policies for music_tracks
CREATE POLICY "Public Read music_tracks" ON public.music_tracks FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated manage music_tracks" ON public.music_tracks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for videos
CREATE POLICY "Public Read videos" ON public.videos FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated manage videos" ON public.videos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for videos_processados
CREATE POLICY "Public Read videos_processados" ON public.videos_processados FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated manage videos_processados" ON public.videos_processados FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for other tables (scoped to authenticated for now as they are management tables)
CREATE POLICY "Authenticated manage campaigns" ON public.campanhas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage tiktok" ON public.tiktok_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage posts" ON public.posts_agendados FOR ALL TO authenticated USING (true) WITH CHECK (true);
