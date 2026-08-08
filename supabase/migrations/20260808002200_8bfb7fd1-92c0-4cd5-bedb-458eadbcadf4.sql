-- Adicionar coluna credit
ALTER TABLE public.content_library 
ADD COLUMN IF NOT EXISTS credit text;

-- Adicionar coluna file_type
ALTER TABLE public.content_library 
ADD COLUMN IF NOT EXISTS file_type text;

-- Grant permissions again just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_library TO authenticated;
GRANT ALL ON public.content_library TO service_role;

-- Index for external_id if not already there
CREATE INDEX IF NOT EXISTS content_library_external_id_idx ON public.content_library (external_id);