-- Centralize campaign completion and content lifecycle without deleting history.

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
      SET status='used', use_count=GREATEST(COALESCE(use_count,0),1),
          first_used_at=COALESCE(first_used_at,now()), last_used_at=now(), updated_at=now()
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
      UPDATE public.campanhas c
      SET status = CASE
        WHEN EXISTS (SELECT 1 FROM public.publications p WHERE p.campaign_id=c.id AND p.status='published') THEN 'concluido'
        ELSE 'encerrado'
      END,
      paused_at=NULL
      WHERE c.id=v_pub.campaign_id AND c.status NOT IN ('concluido','encerrado');
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
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.provider_post_id IS DISTINCT FROM OLD.provider_post_id THEN
    PERFORM public.reconcile_campaign_and_content(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_publication_lifecycle ON public.publications;
CREATE TRIGGER trg_reconcile_publication_lifecycle
AFTER UPDATE OF status, provider_post_id ON public.publications
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_publication_lifecycle();

REVOKE ALL ON FUNCTION public.reconcile_campaign_and_content(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_campaign_and_content(uuid) TO service_role;
