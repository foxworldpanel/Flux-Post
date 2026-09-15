-- Permanent provider content memory.
-- Survives media cleanup and protects Pexels/provider IDs from reuse.

CREATE TABLE IF NOT EXISTS public.content_usage_history (
  user_id uuid NOT NULL,
  source text NOT NULL,
  external_id text NOT NULL,
  content_id uuid NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz NULL,
  PRIMARY KEY (user_id, source, external_id)
);

ALTER TABLE public.content_usage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_usage_history_select_own ON public.content_usage_history;
CREATE POLICY content_usage_history_select_own
ON public.content_usage_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.content_usage_history FROM authenticated, anon;
GRANT SELECT ON public.content_usage_history TO authenticated;

CREATE OR REPLACE FUNCTION public.remember_external_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.external_id IS NOT NULL AND btrim(NEW.external_id) <> '' THEN
    INSERT INTO public.content_usage_history(user_id, source, external_id, content_id, first_seen_at, last_seen_at, used_at)
    VALUES(
      NEW.user_id,
      lower(COALESCE(NULLIF(NEW.source,''),'unknown')),
      NEW.external_id,
      NEW.id,
      now(), now(),
      CASE WHEN NEW.status='used' THEN now() ELSE NULL END
    )
    ON CONFLICT (user_id, source, external_id) DO UPDATE SET
      content_id = COALESCE(public.content_usage_history.content_id, EXCLUDED.content_id),
      last_seen_at = now(),
      used_at = CASE WHEN NEW.status='used' THEN COALESCE(public.content_usage_history.used_at, now()) ELSE public.content_usage_history.used_at END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remember_external_content ON public.content_library;
CREATE TRIGGER trg_remember_external_content
AFTER INSERT OR UPDATE OF external_id, source, status ON public.content_library
FOR EACH ROW EXECUTE FUNCTION public.remember_external_content();

CREATE OR REPLACE FUNCTION public.remember_publication_external_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.source_external_id IS NOT NULL AND btrim(NEW.source_external_id) <> '' THEN
    INSERT INTO public.content_usage_history(user_id, source, external_id, content_id, first_seen_at, last_seen_at, used_at)
    VALUES(NEW.user_id, lower(COALESCE(NULLIF(NEW.source_provider,''),'unknown')), NEW.source_external_id, NEW.content_id, now(), now(),
      CASE WHEN NEW.provider_post_id IS NOT NULL OR NEW.status IN ('publishing','processing','published') THEN now() ELSE NULL END)
    ON CONFLICT (user_id, source, external_id) DO UPDATE SET
      content_id = COALESCE(public.content_usage_history.content_id, EXCLUDED.content_id),
      last_seen_at = now(),
      used_at = CASE WHEN NEW.provider_post_id IS NOT NULL OR NEW.status IN ('publishing','processing','published') THEN COALESCE(public.content_usage_history.used_at, now()) ELSE public.content_usage_history.used_at END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remember_publication_external_content ON public.publications;
CREATE TRIGGER trg_remember_publication_external_content
AFTER INSERT OR UPDATE OF source_external_id, source_provider, status, provider_post_id ON public.publications
FOR EACH ROW EXECUTE FUNCTION public.remember_publication_external_content();

-- Backfill all provider IDs we still know about.
INSERT INTO public.content_usage_history(user_id, source, external_id, content_id, first_seen_at, last_seen_at, used_at)
SELECT c.user_id, lower(COALESCE(NULLIF(c.source,''),'unknown')), c.external_id, c.id,
       COALESCE(c.created_at,now()), now(), CASE WHEN c.status='used' THEN COALESCE(c.last_used_at,now()) ELSE NULL END
FROM public.content_library c
WHERE c.user_id IS NOT NULL AND c.external_id IS NOT NULL AND btrim(c.external_id)<>''
ON CONFLICT (user_id,source,external_id) DO UPDATE SET
  content_id=COALESCE(public.content_usage_history.content_id,EXCLUDED.content_id), last_seen_at=now(),
  used_at=COALESCE(public.content_usage_history.used_at,EXCLUDED.used_at);

INSERT INTO public.content_usage_history(user_id, source, external_id, content_id, first_seen_at, last_seen_at, used_at)
SELECT p.user_id, lower(COALESCE(NULLIF(p.source_provider,''),'unknown')), p.source_external_id, p.content_id,
       COALESCE(p.created_at,now()), now(),
       CASE WHEN p.provider_post_id IS NOT NULL OR p.status IN ('publishing','processing','published') THEN COALESCE(p.published_at,p.updated_at,now()) ELSE NULL END
FROM public.publications p
WHERE p.user_id IS NOT NULL AND p.source_external_id IS NOT NULL AND btrim(p.source_external_id)<>''
ON CONFLICT (user_id,source,external_id) DO UPDATE SET
  content_id=COALESCE(public.content_usage_history.content_id,EXCLUDED.content_id), last_seen_at=now(),
  used_at=COALESCE(public.content_usage_history.used_at,EXCLUDED.used_at);
