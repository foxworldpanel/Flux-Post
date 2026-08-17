GRANT SELECT, UPDATE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;
GRANT SELECT ON public.content_library TO service_role;
GRANT SELECT ON public.music_tracks TO service_role;