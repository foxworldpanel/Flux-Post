ALTER TABLE public.media_renders ADD COLUMN render_options JSONB;
GRANT SELECT, UPDATE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;
COMMENT ON COLUMN public.media_renders.render_options IS 'Detailed options used for this render job';