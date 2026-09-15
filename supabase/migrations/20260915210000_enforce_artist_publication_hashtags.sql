-- Guarantee that every campaign publication keeps the artist's priority
-- hashtags. Existing AI/video hashtags are preserved, duplicates are removed,
-- and blocked hashtags are excluded.

CREATE OR REPLACE FUNCTION public.enforce_publication_artist_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priority text[] := ARRAY[]::text[];
  v_blocked text[] := ARRAY[]::text[];
  v_campaign_hashtags text := '';
  v_values text[] := ARRAY[]::text[];
  v_result text[] := ARRAY[]::text[];
  v_seen text[] := ARRAY[]::text[];
  v_blocked_keys text[] := ARRAY[]::text[];
  v_tag text;
  v_clean text;
  v_key text;
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(a.priority_hashtags, ARRAY[]::text[]),
    COALESCE(a.blocked_hashtags, ARRAY[]::text[]),
    COALESCE(cc.hashtags, '')
  INTO
    v_priority,
    v_blocked,
    v_campaign_hashtags
  FROM public.campanhas c
  JOIN public.artists a
    ON a.id = c.artist_id
  LEFT JOIN public.campaign_contents cc
    ON cc.campaign_id = c.id
   AND cc.content_id = NEW.content_id
  WHERE c.id = NEW.campaign_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  FOREACH v_tag IN ARRAY v_blocked
  LOOP
    v_clean := btrim(regexp_replace(COALESCE(v_tag, ''), '^#+', ''));
    IF v_clean <> '' THEN
      v_blocked_keys := array_append(v_blocked_keys, lower(v_clean));
    END IF;
  END LOOP;

  v_values := v_priority || COALESCE(NEW.hashtags, ARRAY[]::text[]);

  IF COALESCE(cardinality(NEW.hashtags), 0) = 0
     AND btrim(v_campaign_hashtags) <> '' THEN
    v_values := v_values ||
      regexp_split_to_array(v_campaign_hashtags, E'[\\s,;]+');
  END IF;

  FOREACH v_tag IN ARRAY v_values
  LOOP
    v_clean := btrim(regexp_replace(COALESCE(v_tag, ''), '^#+', ''));
    v_clean := regexp_replace(v_clean, '\s+', '', 'g');
    v_key := lower(v_clean);

    IF v_clean = ''
       OR v_key = ANY(v_seen)
       OR v_key = ANY(v_blocked_keys) THEN
      CONTINUE;
    END IF;

    v_seen := array_append(v_seen, v_key);
    v_result := array_append(v_result, '#' || v_clean);
  END LOOP;

  NEW.hashtags := v_result;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_publication_artist_hashtags()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_publication_artist_hashtags
  ON public.publications;

CREATE TRIGGER trg_enforce_publication_artist_hashtags
BEFORE INSERT OR UPDATE OF campaign_id, content_id, hashtags
ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_publication_artist_hashtags();

-- Repair all not-yet-sent publications in active or paused campaigns.
-- The harmless self-assignment fires the trigger without changing scheduling,
-- status, provider ids, claims, or publication identity.
UPDATE public.publications p
SET hashtags = COALESCE(p.hashtags, ARRAY[]::text[])
FROM public.campanhas c
WHERE c.id = p.campaign_id
  AND c.status IN ('ativo', 'pausado')
  AND p.provider_post_id IS NULL
  AND p.status IN (
    'agendado',
    'pending',
    'scheduled',
    'waiting_render',
    'ready_to_post',
    'queued',
    'paused'
  );
