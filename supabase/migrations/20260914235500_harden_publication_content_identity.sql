-- Flux Post safety hardening: every campaign publication must carry a durable
-- content identity. Duplicate protection works with the internal content UUID
-- and, as a fallback, with source_provider + source_external_id (e.g. Pexels).

CREATE OR REPLACE FUNCTION public.prevent_duplicate_social_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.social_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Campaign publications are never allowed to be anonymous again.
  IF NEW.campaign_id IS NOT NULL
     AND NEW.content_id IS NULL
     AND (NEW.source_provider IS NULL OR btrim(NEW.source_provider) = '')
     AND (NEW.source_external_id IS NULL OR btrim(NEW.source_external_id) = '') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'publication_content_identity_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.publications p
    WHERE p.id IS DISTINCT FROM NEW.id
      AND p.social_account_id = NEW.social_account_id
      AND p.status NOT IN ('cancelled', 'canceled')
      AND (
        (NEW.content_id IS NOT NULL AND p.content_id = NEW.content_id)
        OR
        (
          NEW.source_provider IS NOT NULL
          AND NEW.source_external_id IS NOT NULL
          AND p.source_provider = NEW.source_provider
          AND p.source_external_id = NEW.source_external_id
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'duplicate_social_content';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_social_content ON public.publications;
CREATE TRIGGER trg_prevent_duplicate_social_content
BEFORE INSERT OR UPDATE OF content_id, social_account_id, source_provider, source_external_id
ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_social_content();

CREATE INDEX IF NOT EXISTS idx_publications_social_external_guard
ON public.publications (social_account_id, source_provider, source_external_id)
WHERE social_account_id IS NOT NULL
  AND source_provider IS NOT NULL
  AND source_external_id IS NOT NULL;

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
  v_identity_key text;
BEGIN
  SELECT * INTO v_pub
  FROM public.publications
  WHERE id = p_publication_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_found', 'publication_id', p_publication_id);
  END IF;

  IF auth.uid() IS NOT NULL AND v_pub.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'publication_not_owned_by_user';
  END IF;

  IF v_pub.provider_post_id IS NOT NULL OR v_pub.status = 'published' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_sent', 'publication_id', p_publication_id);
  END IF;

  IF v_pub.campaign_id IS NOT NULL THEN
    SELECT status INTO v_campaign_status
    FROM public.campanhas
    WHERE id = v_pub.campaign_id;

    IF v_campaign_status IS DISTINCT FROM 'ativo' THEN
      IF v_pub.provider_post_id IS NULL AND v_campaign_status = 'pausado' THEN
        UPDATE public.publications SET status = 'paused', updated_at = now() WHERE id = v_pub.id;
      END IF;
      RETURN jsonb_build_object('allowed', false, 'reason', 'campaign_not_active', 'publication_id', p_publication_id);
    END IF;
  END IF;

  -- Never send a campaign publication whose content cannot be identified.
  IF v_pub.campaign_id IS NOT NULL
     AND v_pub.content_id IS NULL
     AND (v_pub.source_provider IS NULL OR btrim(v_pub.source_provider) = '')
     AND (v_pub.source_external_id IS NULL OR btrim(v_pub.source_external_id) = '') THEN
    UPDATE public.publications
      SET status = 'cancelled', last_error = 'Blocked: publication has no durable content identity', updated_at = now()
      WHERE id = v_pub.id AND provider_post_id IS NULL;
    RETURN jsonb_build_object('allowed', false, 'reason', 'missing_content_identity', 'publication_id', p_publication_id);
  END IF;

  v_identity_key := CASE
    WHEN v_pub.content_id IS NOT NULL THEN 'content:' || v_pub.content_id::text
    ELSE 'external:' || coalesce(v_pub.source_provider, '') || ':' || coalesce(v_pub.source_external_id, '')
  END;

  IF v_pub.social_account_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_pub.social_account_id::text || ':' || v_identity_key, 0));

    SELECT p.id INTO v_duplicate_id
    FROM public.publications p
    WHERE p.id <> v_pub.id
      AND p.social_account_id = v_pub.social_account_id
      AND (
        (v_pub.content_id IS NOT NULL AND p.content_id = v_pub.content_id)
        OR
        (
          v_pub.source_provider IS NOT NULL
          AND v_pub.source_external_id IS NOT NULL
          AND p.source_provider = v_pub.source_provider
          AND p.source_external_id = v_pub.source_external_id
        )
      )
      AND (
        p.provider_post_id IS NOT NULL
        OR p.status IN ('published', 'publishing', 'processing')
      )
    LIMIT 1;

    IF v_duplicate_id IS NOT NULL THEN
      UPDATE public.publications
        SET status = 'cancelled', last_error = 'Blocked: content already used for this social account', updated_at = now()
        WHERE id = v_pub.id AND provider_post_id IS NULL;
      RETURN jsonb_build_object('allowed', false, 'reason', 'duplicate_social_content', 'publication_id', p_publication_id, 'duplicate_publication_id', v_duplicate_id);
    END IF;
  END IF;

  UPDATE public.publications
    SET status = 'publishing', updated_at = now()
    WHERE id = v_pub.id AND provider_post_id IS NULL;

  RETURN jsonb_build_object('allowed', true, 'reason', 'claimed', 'publication_id', p_publication_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_publication_for_posting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_publication_for_posting(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
