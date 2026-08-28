-- Histórico permanente da origem do conteúdo.
-- Permite remover os arquivos pesados e content_library sem perder
-- identificação do vídeo usado na publicação.

ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS source_provider TEXT,
  ADD COLUMN IF NOT EXISTS source_external_id TEXT;

CREATE INDEX IF NOT EXISTS publications_source_external_idx
  ON public.publications (user_id, source_provider, source_external_id)
  WHERE source_external_id IS NOT NULL;

-- A publicação deve sobreviver mesmo se a campanha for removida.
ALTER TABLE public.publications
  DROP CONSTRAINT IF EXISTS publications_campaign_id_fkey;

ALTER TABLE public.publications
  ADD CONSTRAINT publications_campaign_id_fkey
  FOREIGN KEY (campaign_id)
  REFERENCES public.campanhas(id)
  ON DELETE SET NULL;

-- A publicação também deve sobreviver quando o conteúdo pesado
-- for removido da biblioteca.
ALTER TABLE public.publications
  DROP CONSTRAINT IF EXISTS publications_content_id_fkey;

ALTER TABLE public.publications
  ADD CONSTRAINT publications_content_id_fkey
  FOREIGN KEY (content_id)
  REFERENCES public.content_library(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.publications.source_provider IS
  'Origem permanente do conteúdo, ex: pexels';

COMMENT ON COLUMN public.publications.source_external_id IS
  'ID permanente do conteúdo no provedor. Usado para impedir reutilização.';
