
-- 1. Ensure all required tables and columns exist
CREATE TABLE IF NOT EXISTS public.media_renders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    render_key TEXT UNIQUE NOT NULL,
    source_content_id UUID REFERENCES public.content_library(id) ON DELETE SET NULL,
    music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    music_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    music_start_ms INTEGER DEFAULT 0,
    audio_mode TEXT DEFAULT 'music_plus_original',
    music_volume INTEGER DEFAULT 80,
    original_audio_volume INTEGER DEFAULT 20,
    output_profile TEXT DEFAULT 'short_vertical_v1',
    status TEXT DEFAULT 'queued' NOT NULL,
    storage_path TEXT,
    duration_seconds NUMERIC,
    file_size BIGINT,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;

-- Enable RLS
ALTER TABLE public.media_renders ENABLE ROW LEVEL SECURITY;

-- Drop existing functions to ensure fresh deployment with correct signature
DROP FUNCTION IF EXISTS public.claim_next_render_job(interval);
DROP FUNCTION IF EXISTS public.claim_next_render_job();
DROP FUNCTION IF EXISTS public.heartbeat_render_job(uuid);

-- Re-create claim RPC
CREATE OR REPLACE FUNCTION public.claim_next_render_job(lease_interval interval DEFAULT '5 minutes')
RETURNS SETOF public.media_renders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Re-create heartbeat RPC
CREATE OR REPLACE FUNCTION public.heartbeat_render_job(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.media_renders
  SET last_heartbeat = now()
  WHERE id = job_id AND status = 'processing';
END;
$$;

-- Security: Revoke Public access, Grant to Authenticated and Service Role
REVOKE ALL ON FUNCTION public.claim_next_render_job(interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.heartbeat_render_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_render_job(interval) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_render_job(uuid) TO authenticated, service_role;
