ALTER TABLE public.ai_studio_scripts
  ADD COLUMN IF NOT EXISTS content_id uuid
    REFERENCES public.content_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS music_track_id uuid
    REFERENCES public.music_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voice_asset_id uuid
    REFERENCES public.ai_studio_voice_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_render_id uuid
    REFERENCES public.media_renders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS music_volume integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS subtitles_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.ai_studio_scripts
  DROP CONSTRAINT IF EXISTS ai_studio_scripts_music_volume_check;
ALTER TABLE public.ai_studio_scripts
  ADD CONSTRAINT ai_studio_scripts_music_volume_check
  CHECK (music_volume BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_ai_studio_scripts_render
  ON public.ai_studio_scripts (media_render_id)
  WHERE media_render_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.start_ai_studio_render(
  p_script_id uuid,
  p_content_id uuid,
  p_music_track_id uuid,
  p_music_volume integer DEFAULT 18,
  p_subtitles_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_script public.ai_studio_scripts%ROWTYPE;
  v_voice public.ai_studio_voice_assets%ROWTYPE;
  v_render public.media_renders%ROWTYPE;
  v_render_key text;
  v_music_volume integer := LEAST(100, GREATEST(0, COALESCE(p_music_volume, 18)));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_script
  FROM public.ai_studio_scripts
  WHERE id = p_script_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Roteiro não encontrado';
  END IF;

  SELECT * INTO v_voice
  FROM public.ai_studio_voice_assets
  WHERE script_id = p_script_id
    AND user_id = v_user_id
    AND status = 'ready'
    AND storage_path IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gere a narração antes de montar o vídeo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_library
    WHERE id = p_content_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Vídeo não encontrado na Biblioteca';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.music_tracks
    WHERE id = p_music_track_id
      AND (user_id = v_user_id OR user_id IS NULL)
      AND storage_path IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Música não encontrada';
  END IF;

  v_render_key := concat_ws(
    ':',
    'ai-studio-v1',
    p_script_id,
    v_voice.id,
    p_content_id,
    p_music_track_id,
    v_music_volume,
    p_subtitles_enabled
  );

  SELECT * INTO v_render
  FROM public.media_renders
  WHERE render_key = v_render_key;

  IF NOT FOUND THEN
    INSERT INTO public.media_renders (
      user_id,
      render_key,
      source_content_id,
      music_track_id,
      music_start_ms,
      audio_mode,
      music_volume,
      original_audio_volume,
      output_profile,
      render_options,
      status,
      attempts
    ) VALUES (
      v_user_id,
      v_render_key,
      p_content_id,
      p_music_track_id,
      0,
      'narration_plus_music',
      v_music_volume,
      0,
      'ai_studio_vertical_v1',
      jsonb_build_object(
        'pipeline', 'ai_studio_v1',
        'scriptId', p_script_id,
        'projectId', v_script.project_id,
        'voiceAssetId', v_voice.id,
        'subtitlesEnabled', p_subtitles_enabled
      ),
      'queued',
      0
    )
    RETURNING * INTO v_render;
  ELSIF v_render.status = 'failed' THEN
    UPDATE public.media_renders
    SET status = 'queued', attempts = 0, error_message = NULL,
        last_heartbeat = NULL, started_at = NULL, completed_at = NULL
    WHERE id = v_render.id
    RETURNING * INTO v_render;
  END IF;

  UPDATE public.ai_studio_scripts
  SET
    content_id = p_content_id,
    music_track_id = p_music_track_id,
    voice_asset_id = v_voice.id,
    media_render_id = v_render.id,
    music_volume = v_music_volume,
    subtitles_enabled = p_subtitles_enabled,
    updated_at = now()
  WHERE id = p_script_id;

  UPDATE public.ai_studio_projects
  SET status = 'producing', updated_at = now()
  WHERE id = v_script.project_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'renderId', v_render.id,
    'status', v_render.status,
    'reused', v_render.status = 'ready'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_ai_studio_render(
  uuid, uuid, uuid, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_ai_studio_render(
  uuid, uuid, uuid, integer, boolean
) TO authenticated;

GRANT SELECT, UPDATE ON public.ai_studio_scripts TO authenticated;
