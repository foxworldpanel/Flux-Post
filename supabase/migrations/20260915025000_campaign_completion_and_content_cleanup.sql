-- Centralize campaign completion and content lifecycle without deleting history.
-- Runs from a deferred trigger so the publication update is already visible and
-- avoids mutating the same row from a BEFORE trigger.

CREATE OR REPLACE FUNCTION public.reconcile_campaign_and_content(p_publication_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pub public.publications%ROWTYPE;
  v_all_terminal boolean;
  v_has_success boolean;
  v_content_done boolean;
  v_music_id uuid;
BEGIN
  SELECT * INTO v_pub FROM public.publications WHERE id=p_publication_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_pub.content_id IS NOT NULL THEN
    SELECT
      NOT EXISTS (
        SELECT 1 FROM public.publications p
        WHERE p.content_id=v_pub.content_id AND p.user_id=v_pub.user_id
          AND p.status NOT IN ('published','failed','cancelled','canceled')
      ),
      EXISTS (
        SELECT 1 FROM public.publications p
        WHERE p.content_id=v_pub.content_id AND p.user_id=v_pub.user_id
          AND (p.status='published' OR p.provider_post_id IS NOT NULL)
      )
    INTO v_content_done, v_has_success;

    IF v_content_done AND v_has_success THEN
      UPDATE public.content_library
      SET status='used',
          use_count=GREATEST(COALESCE(use_count,0),1),
          first_used_at=COALESCE(first_used_at,now()),
          last_used_at=now(),
          updated_at=now()
      WHERE id=v_pub.content_id AND user_id=v_pub.user_id;
    END IF;
  END IF;

  IF v_pub.campaign_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.publications p
      WHERE p.campaign_id=v_pub.campaign_id
        AND p.status NOT IN ('published','failed','cancelled','canceled')
    ) INTO v_all_terminal;

    IF v_all_terminal THEN
      SELECT c.music_track_id INTO v_music_id FROM public.campanhas c WHERE c.id=v_pub.campaign_id;

      UPDATE public.campanhas c
      SET status = CASE
        WHEN EXISTS (SELECT 1 FROM public.publications p WHERE p.campaign_id=c.id AND p.status='published') THEN 'concluido'
        ELSE 'encerrado'
      END,
      paused_at=NULL
      WHERE c.id=v_pub.campaign_id AND c.status NOT IN ('concluido','encerrado');

      -- A music track remains active while any other active/paused campaign uses it.
      IF v_music_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.campanhas c
        WHERE c.music_track_id=v_music_id
          AND c.id<>v_pub.campaign_id
          AND c.status IN ('ativo','pausado')
      ) THEN
        UPDATE public.music_tracks SET campanha_ativa=false WHERE id=v_music_id AND user_id=v_pub.user_id;
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_publication_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  PERFORM public.reconcile_campaign_and_content(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_publication_lifecycle ON public.publications;
CREATE CONSTRAINT TRIGGER trg_reconcile_publication_lifecycle
AFTER UPDATE OF status, provider_post_id ON public.publications
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_publication_lifecycle();

REVOKE ALL ON FUNCTION public.reconcile_campaign_and_content(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_campaign_and_content(uuid) TO service_role;
