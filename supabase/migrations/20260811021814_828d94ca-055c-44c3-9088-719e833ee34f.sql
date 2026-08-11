-- 1. PUBLICATIONS: Garantir colunas essenciais
ALTER TABLE public.publications 
ADD COLUMN IF NOT EXISTS music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS render_options JSONB;

-- 2. MEDIA_RENDERS: Garantir colunas essenciais
ALTER TABLE public.media_renders 
ADD COLUMN IF NOT EXISTS music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL;

-- 3. Limpeza de colunas legadas se existirem
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'publications' AND column_name = 'music_id') THEN
    ALTER TABLE public.publications DROP COLUMN music_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_renders' AND column_name = 'music_id') THEN
    ALTER TABLE public.media_renders DROP COLUMN music_id;
  END IF;
END $$;

-- 4. Notificar recarregamento de schema
NOTIFY pgrst, 'reload schema';