-- FASE 2.1 - GARIMPO REAL + PEXELS
-- Adicionando campos necessários para rastreabilidade de fontes externas

ALTER TABLE public.content_library
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS author text,
ADD COLUMN IF NOT EXISTS original_url text,
ADD COLUMN IF NOT EXISTS credit text,
ADD COLUMN IF NOT EXISTS license_info text;

-- Índice para prevenção de duplicidade por usuário/fonte/id_externo
CREATE UNIQUE INDEX IF NOT EXISTS content_library_source_external_id_user_id_idx 
ON public.content_library (source, external_id, user_id) 
WHERE external_id IS NOT NULL;

-- Garante permissões (embora RLS esteja ativo, os GRANTS são necessários no Supabase Data API)
GRANT ALL ON public.content_library TO authenticated;
GRANT ALL ON public.content_library TO service_role;

