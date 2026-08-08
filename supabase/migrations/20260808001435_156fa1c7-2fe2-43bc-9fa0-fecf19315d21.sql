ALTER TABLE public.content_library ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS content_library_external_id_idx ON public.content_library (external_id);