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

-- Fast lookup used by the trigger and by the final publishing guard.
CREATE INDEX IF NOT EXISTS idx_publications_social_content_guard
ON public.publications (social_account_id, content_id)
WHERE content_id IS NOT NULL AND social_account_id IS NOT NULL;

COMMENT ON FUNCTION public.prevent_duplicate_social_content() IS
'Prevents scheduling the same content more than once for the same social account while preserving historical rows.';

NOTIFY pgrst, 'reload schema';
