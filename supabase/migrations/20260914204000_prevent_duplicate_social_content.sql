-- Permanent safety net: the same content can never be scheduled twice
-- for the same social account. Existing historical duplicates are preserved;
-- the trigger applies to new rows only.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_social_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content_id IS NULL OR NEW.social_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.publications p
    WHERE p.social_account_id = NEW.social_account_id
      AND p.content_id = NEW.content_id
      AND p.id IS DISTINCT FROM NEW.id
      AND COALESCE(p.status, '') NOT IN ('cancelled', 'canceled')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'duplicate_social_content',
      DETAIL = 'This content has already been used for this social account.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_social_content ON public.publications;
CREATE TRIGGER trg_prevent_duplicate_social_content
BEFORE INSERT OR UPDATE OF content_id, social_account_id
ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_social_content();

CREATE INDEX IF NOT EXISTS idx_publications_social_content_guard
ON public.publications (social_account_id, content_id)
WHERE content_id IS NOT NULL AND social_account_id IS NOT NULL;

-- Final atomic gate used immediately before sending a post to the provider.
-- It serializes attempts for the same account/content pair, checks campaign
-- status and makes one historical duplicate the winner while blocking the rest.
CREATE OR REPLACE FUNCTION public.claim_publication_for_posting(p_publication_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pub public.publications%ROWTYPE;
  v_campaign_status text;
  v_duplicate_id uuid;
BEGIN
  SELECT * INTO v_pub
  FROM public.publications
  WHERE id = p_publication_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'publication_not_found');
  END IF;

  IF auth.uid() IS NOT NULL AND v_pub.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_pub.provider_post_id IS NOT NULL OR v_pub.status = 'published' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_sent');
  END IF;

  IF v_pub.campaign_id IS NOT NULL THEN
    SELECT status INTO v_campaign_status
    FROM public.campanhas
    WHERE id = v_pub.campaign_id;

    IF COALESCE(v_campaign_status, '') <> 'ativo' THEN
      UPDATE public.publications
      SET status = CASE WHEN v_campaign_status = 'pausado' THEN 'paused' ELSE status END,
          updated_at = now()
      WHERE id = v_pub.id;

      RETURN jsonb_build_object('allowed', false, 'reason', 'campaign_not_active');
    END IF;
  END IF;

  IF v_pub.content_id IS NOT NULL AND v_pub.social_account_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_pub.social_account_id::text || ':' || v_pub.content_id::text, 0)
    );

    SELECT p.id INTO v_duplicate_id
    FROM public.publications p
    WHERE p.social_account_id = v_pub.social_account_id
      AND p.content_id = v_pub.content_id
      AND p.id <> v_pub.id
      AND (
        p.provider_post_id IS NOT NULL
        OR p.status IN ('published', 'publishing', 'processing')
      )
    ORDER BY p.created_at ASC
    LIMIT 1;

    IF v_duplicate_id IS NOT NULL THEN
      UPDATE public.publications
      SET status = 'cancelled',
          last_error = 'Blocked: content already used for this social account',
          updated_at = now()
      WHERE id = v_pub.id
        AND provider_post_id IS NULL;

      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'duplicate_social_content',
        'duplicate_publication_id', v_duplicate_id
      );
    END IF;
  END IF;

  UPDATE public.publications
  SET status = 'publishing', updated_at = now()
  WHERE id = v_pub.id
    AND provider_post_id IS NULL;

  RETURN jsonb_build_object('allowed', true, 'reason', 'claimed');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_publication_for_posting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_publication_for_posting(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.prevent_duplicate_social_content() IS
'Prevents scheduling the same content more than once for the same social account while preserving historical rows.';
COMMENT ON FUNCTION public.claim_publication_for_posting(uuid) IS
'Atomic final gate: blocks paused campaigns, already-sent posts and duplicate account/content delivery.';

NOTIFY pgrst, 'reload schema';
