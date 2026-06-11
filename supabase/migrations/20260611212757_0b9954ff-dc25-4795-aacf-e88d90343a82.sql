-- Allow public DELETE on storage objects for musicas and videos buckets
CREATE POLICY "Public Delete" ON storage.objects
FOR DELETE USING (bucket_id IN ('musicas', 'videos'));

-- Update music_tracks policies to allow anon management
DROP POLICY IF EXISTS "Authenticated manage music_tracks" ON public.music_tracks;
DROP POLICY IF EXISTS "Users manage their music_tracks" ON public.music_tracks;

CREATE POLICY "Allow public manage music_tracks" ON public.music_tracks
FOR ALL USING (true) WITH CHECK (true);

-- Update videos policies to allow anon management
DROP POLICY IF EXISTS "Allow authenticated management" ON public.videos;
DROP POLICY IF EXISTS "Users can manage their own videos" ON public.videos;

CREATE POLICY "Allow public manage videos" ON public.videos
FOR ALL USING (true) WITH CHECK (true);

-- Also for videos_processados
CREATE POLICY "Allow public manage videos_processados" ON public.videos_processados
FOR ALL USING (true) WITH CHECK (true);
