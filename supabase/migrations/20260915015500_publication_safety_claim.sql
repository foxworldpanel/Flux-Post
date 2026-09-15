-- Flux Post publication safety gate
-- Prevents paused campaigns and duplicate content from reaching the provider.

CREATE OR REPLACE FUNCTION public.claim_publication_for_posting(
  p_publication_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pub public.publications%ROWTYPE;
  v_campaign_status text;
  v_duplicate_id uuid;
  v_lock_key bigint;
BEGIN
  SELECT * INTO v_pub
  FROM public.publications
  WHERE id = p_publication_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'publication_not_found');
  END IF;

  IF v_pub.provider_post_id IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_sent');
  END IF;

  IF v_pub.status = 'publishing' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_claimed');
  END IF;

  IF v_pub.campaign_id IS NOT NULL THEN
    SELECT status INTO v_campaign_status
    FROM public.campanhas
    WHERE id = v_pub.campaign_id;

    IF v_campaign_status IS DISTINCT FROM 'ativo' THEN
      UPDATE public.publications
      SET status = CASE WHEN v_campaign_status = 'pausado' THEN 'paused' ELSE 'cancelled' END,
          last_error = 'Blocked by campaign status: ' || COALESCE(v_campaign_status, 'missing'),
          updated_at = now()
      WHERE id = v_pub.id;

      RETURN jsonb_build_object('allowed', false, 'reason', 'campaign_' || COALESCE(v_campaign_status, 'missing'));
    END IF;
  END IF;

  -- Serialize claims for the same destination + content identity.
  v_lock_key := hashtextextended(
    COALESCE(v_pub.social_account_id::text, '') || ':' ||
    COALESCE(v_pub.content_id::text, v_pub.source_provider || ':' || v_pub.source_external_id, v_pub.id::text),
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT p.id INTO v_duplicate_id
  FROM public.publications p
  WHERE p.id <> v_pub.id
    AND p.social_account_id = v_pub.social_account_id
    AND (
      (v_pub.content_id IS NOT NULL AND p.content_id = v_pub.content_id)
      OR (
        v_pub.source_external_id IS NOT NULL
        AND p.source_external_id = v_pub.source_external_id
        AND COALESCE(p.source_provider, '') = COALESCE(v_pub.source_provider, '')
      )
    )
    AND (
      p.provider_post_id IS NOT NULL
      OR p.status IN ('publishing', 'processing', 'published')
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_duplicate_id IS NOT NULL THEN
    UPDATE public.publications
    SET status = 'cancelled',
        last_error = 'Duplicate content blocked; original publication: ' || v_duplicate_id::text,
        updated_at = now()
    WHERE id = v_pub.id;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'duplicate_content_for_destination',
      'duplicate_publication_id', v_duplicate_id
    );
  END IF;

  UPDATE public.publications
  SET status = 'publishing',
      updated_at = now(),
      last_error = NULL
  WHERE id = v_pub.id
    AND provider_post_id IS NULL;

  RETURN jsonb_build_object('allowed', true, 'reason', 'claimed');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_publication_for_posting(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_publication_for_posting(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_publication_for_posting(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_publication_for_posting(uuid) TO service_role;
