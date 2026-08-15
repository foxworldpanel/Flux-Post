
-- Add missing columns to media_renders if they don't exist
ALTER TABLE public.media_renders ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.media_renders ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
ALTER TABLE public.media_renders ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;
ALTER TABLE public.media_renders ADD COLUMN IF NOT EXISTS music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL;

-- Fix music_id vs music_track_id ambiguity
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_renders' AND column_name = 'music_id') THEN
        UPDATE public.media_renders SET music_track_id = music_id WHERE music_track_id IS NULL AND music_id IS NOT NULL;
    END IF;
END $$;

-- DROP OLD RPCs first to allow return type change if necessary
DROP FUNCTION IF EXISTS public.claim_next_render_job(interval);
DROP FUNCTION IF EXISTS public.claim_next_render_job();
DROP FUNCTION IF EXISTS public.heartbeat_render_job(uuid);

-- RPC: claim_next_render_job
CREATE OR REPLACE FUNCTION public.claim_next_render_job(lease_interval interval DEFAULT '5 minutes')
RETURNS SETOF public.media_renders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_job_id uuid;
BEGIN
  SELECT id INTO target_job_id
  FROM public.media_renders
  WHERE status = 'queued' 
     OR (status = 'processing' AND (last_heartbeat < now() - (lease_interval * 2) OR last_heartbeat IS NULL))
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF target_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.media_renders
  SET 
    status = 'processing',
    started_at = COALESCE(started_at, now()),
    last_heartbeat = now(),
    attempts = attempts + 1
  WHERE id = target_job_id
  RETURNING *;
END;
$$;

-- RPC: heartbeat_render_job
CREATE OR REPLACE FUNCTION public.heartbeat_render_job(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.media_renders
  SET last_heartbeat = now()
  WHERE id = job_id AND status = 'processing';
END;
$$;

-- GRANTS
GRANT EXECUTE ON FUNCTION public.claim_next_render_job(interval) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_render_job(uuid) TO authenticated, service_role;
