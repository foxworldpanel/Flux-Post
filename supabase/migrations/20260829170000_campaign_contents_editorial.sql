-- Editorial Campaign Planner V2
-- Persiste ordem, copy e aprovação editorial dos conteúdos da campanha.

ALTER TABLE public.campaign_contents
  ADD COLUMN IF NOT EXISTS position INTEGER,
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS hashtags TEXT,
  ADD COLUMN IF NOT EXISTS editorial_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.campaign_contents
  DROP CONSTRAINT IF EXISTS campaign_contents_editorial_status_check;

ALTER TABLE public.campaign_contents
  ADD CONSTRAINT campaign_contents_editorial_status_check
  CHECK (
    editorial_status IN ('pending', 'generated', 'edited', 'approved')
  );

CREATE INDEX IF NOT EXISTS idx_campaign_contents_campaign_position
  ON public.campaign_contents(campaign_id, position);
