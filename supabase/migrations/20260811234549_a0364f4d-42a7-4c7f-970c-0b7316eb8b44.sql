CREATE OR REPLACE FUNCTION public.claim_next_render_job()
RETURNS public.media_renders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_job public.media_renders;
BEGIN
  UPDATE public.media_renders
  SET 
    status = 'processing',
    started_at = now()
  WHERE id = (
    SELECT id
    FROM public.media_renders
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed_job;

  RETURN claimed_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_render_job() TO service_role;
REVOKE ALL ON FUNCTION public.claim_next_render_job() FROM public, anon, authenticated;