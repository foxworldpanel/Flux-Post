-- Do not reuse Studio IA videos created before the caption preview/position fix.
-- The next production request will create a fresh render with the selected style.
UPDATE public.media_renders
SET render_key = render_key || ':legacy-caption-position'
WHERE render_options ->> 'pipeline' = 'ai_studio_v2'
  AND render_key NOT LIKE '%:legacy-caption-position';
