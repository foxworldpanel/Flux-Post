-- Recover descriptive metadata for Pexels videos imported before the
-- importer started preserving the page slug/title and editorial keywords.

WITH pexels_metadata AS (
  SELECT
    id,
    regexp_replace(
      split_part(split_part(original_url, '/video/', 2), '/', 1),
      '-[0-9]+$',
      ''
    ) AS clean_slug
  FROM public.content_library
  WHERE source = 'pexels'
    AND original_url LIKE '%/video/%'
),
normalized AS (
  SELECT
    id,
    clean_slug,
    initcap(replace(clean_slug, '-', ' ')) AS descriptive_title
  FROM pexels_metadata
  WHERE clean_slug IS NOT NULL
    AND btrim(clean_slug) <> ''
)
UPDATE public.content_library AS content
SET
  title = CASE
    WHEN content.title IS NULL
      OR btrim(content.title) = ''
      OR content.title ~* '^Pexels Video [0-9]+$'
      OR content.title ~* '^Video [0-9]+$'
    THEN normalized.descriptive_title
    ELSE content.title
  END,
  tags = CASE
    WHEN COALESCE(cardinality(content.tags), 0) = 0
    THEN array_prepend(
      normalized.descriptive_title,
      regexp_split_to_array(normalized.clean_slug, '-+')
    )
    ELSE content.tags
  END,
  niche = COALESCE(NULLIF(btrim(content.niche), ''), content.category),
  updated_at = now()
FROM normalized
WHERE normalized.id = content.id
  AND (
    content.title IS NULL
    OR btrim(content.title) = ''
    OR content.title ~* '^Pexels Video [0-9]+$'
    OR content.title ~* '^Video [0-9]+$'
    OR COALESCE(cardinality(content.tags), 0) = 0
    OR content.niche IS NULL
    OR btrim(content.niche) = ''
  );
