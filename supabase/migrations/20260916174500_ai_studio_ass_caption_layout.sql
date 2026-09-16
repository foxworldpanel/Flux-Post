-- Force a fresh Studio IA render after switching captions from SRT styling
-- to an ASS document whose alignment is embedded in the subtitle track.
UPDATE public.media_renders
SET render_key = render_key || ':legacy-before-ass-layout'
WHERE render_options ->> 'pipeline' = 'ai_studio_v2'
  AND render_key NOT LIKE '%:legacy-before-ass-layout';
