-- PostPeer analytics snapshots and atomic 12-hour collection throttle.
-- Analytics is intentionally isolated from the publication/claim pipeline.

CREATE TABLE IF NOT EXISTS public.analytics_sync_state (
  social_account_id uuid PRIMARY KEY
    REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metrics_collected integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_sync_state FROM anon, authenticated;
GRANT ALL ON public.analytics_sync_state TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_sync_state_user
  ON public.analytics_sync_state(user_id);

CREATE INDEX IF NOT EXISTS idx_publication_metrics_publication_collected
  ON public.publication_metrics(publication_id, collected_at DESC);

-- Claim one account atomically. Automatic collection runs every 12 hours.
-- Manual collection may bypass the 12-hour window, but keeps a 10-minute
-- cooldown to avoid accidental repeated credit consumption.
CREATE OR REPLACE FUNCTION public.claim_postpeer_analytics_sync(
  p_social_account_id uuid,
  p_force boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed uuid;
BEGIN
  SELECT user_id
    INTO v_user_id
  FROM public.social_accounts
  WHERE id = p_social_account_id
    AND provider = 'postpeer'
    AND provider_connection_id IS NOT NULL;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.analytics_sync_state (
    social_account_id,
    user_id,
    last_attempt_at,
    last_error,
    updated_at
  )
  VALUES (
    p_social_account_id,
    v_user_id,
    now(),
    NULL,
    now()
  )
  ON CONFLICT (social_account_id) DO UPDATE
  SET last_attempt_at = now(),
      last_error = NULL,
      updated_at = now()
  WHERE
    analytics_sync_state.last_attempt_at IS NULL
    OR analytics_sync_state.last_attempt_at <= now() - interval '10 minutes'
    AND (
      p_force
      OR analytics_sync_state.last_success_at IS NULL
      OR analytics_sync_state.last_success_at <= now() - interval '12 hours'
    )
  RETURNING social_account_id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_postpeer_analytics_sync(
  p_social_account_id uuid,
  p_success boolean,
  p_metrics_collected integer DEFAULT 0,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.analytics_sync_state
  SET last_success_at = CASE WHEN p_success THEN now() ELSE last_success_at END,
      last_error = CASE WHEN p_success THEN NULL ELSE left(p_error, 2000) END,
      metrics_collected = CASE
        WHEN p_success THEN GREATEST(COALESCE(p_metrics_collected, 0), 0)
        ELSE metrics_collected
      END,
      updated_at = now()
  WHERE social_account_id = p_social_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_postpeer_analytics_sync(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_postpeer_analytics_sync(uuid, boolean, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_postpeer_analytics_sync(uuid, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_postpeer_analytics_sync(uuid, boolean, integer, text)
  TO service_role;

COMMENT ON TABLE public.analytics_sync_state IS
  'Internal throttle and health state for PostPeer analytics collection.';
