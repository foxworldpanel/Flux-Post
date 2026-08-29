-- Editorial Campaign Planner V2
-- Persiste as configurações de renderização do rascunho da campanha.

ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS audio_mode TEXT NOT NULL DEFAULT 'only_music',
  ADD COLUMN IF NOT EXISTS music_volume INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS original_audio_volume INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS music_start_ms INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.campanhas
  DROP CONSTRAINT IF EXISTS campanhas_audio_mode_check;

ALTER TABLE public.campanhas
  ADD CONSTRAINT campanhas_audio_mode_check
  CHECK (audio_mode IN ('only_music', 'music_plus_original'));
