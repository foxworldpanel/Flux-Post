ALTER TABLE public.ai_studio_scripts
  ADD COLUMN IF NOT EXISTS music_start_ms integer NOT NULL DEFAULT 0;

ALTER TABLE public.ai_studio_scripts
  DROP CONSTRAINT IF EXISTS ai_studio_scripts_music_start_ms_check;

ALTER TABLE public.ai_studio_scripts
  ADD CONSTRAINT ai_studio_scripts_music_start_ms_check
    CHECK (music_start_ms BETWEEN 0 AND 3600000);

DROP FUNCTION IF EXISTS public.start_ai_studio_render(
  uuid, uuid, uuid, integer, integer, boolean, text, integer, text, text
);

CREATE FUNCTION public.start_ai_studio_render(
  p_script_id uuid,
  p_content_id uuid,
  p_music_track_id uuid,
  p_music_volume integer DEFAULT 18,
  p_music_start_ms integer DEFAULT 0,
  p_subtitles_enabled boolean DEFAULT true,
  p_subtitle_font text DEFAULT 'DejaVu Sans',
  p_subtitle_font_size integer DEFAULT 22,
  p_subtitle_color text DEFAULT 'white',
  p_subtitle_position text DEFAULT 'bottom'
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
  v_music_start_ms integer := LEAST(3600000, GREATEST(0, COALESCE(p_music_start_ms, 0)));
  v_font text;
  v_font_size integer := LEAST(36, GREATEST(16, COALESCE(p_subtitle_font_size, 22)));
  v_color text;
  v_position text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_font := CASE p_subtitle_font
    WHEN 'Liberation Sans' THEN 'Liberation Sans'
    WHEN 'Liberation Serif' THEN 'Liberation Serif'
    WHEN 'DejaVu Sans Mono' THEN 'DejaVu Sans Mono'
    ELSE 'DejaVu Sans'
  END;
  v_color := CASE WHEN p_subtitle_color IN ('white', 'yellow', 'cyan', 'pink')
    THEN p_subtitle_color ELSE 'white' END;
  v_position := CASE WHEN p_subtitle_position IN ('top', 'center', 'bottom')
    THEN p_subtitle_position ELSE 'bottom' END;

  SELECT * INTO v_script
  FROM public.ai_studio_scripts
  WHERE id = p_script_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Roteiro não encontrado'; END IF;

  SELECT * INTO v_voice
  FROM public.ai_studio_voice_assets
  WHERE script_id = p_script_id
    AND user_id = v_user_id
    AND status = 'ready'
    AND storage_path IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gere a narração antes de montar o vídeo'; END IF;

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
    ':', 'ai-studio-v3', p_script_id, v_voice.id, p_content_id,
    p_music_track_id, v_music_volume, v_music_start_ms, p_subtitles_enabled,
    replace(v_font, ' ', '_'), v_font_size, v_color, v_position
  );

  SELECT * INTO v_render FROM public.media_renders WHERE render_key = v_render_key;

  IF NOT FOUND THEN
    INSERT INTO public.media_renders (
      user_id, render_key, source_content_id, music_track_id, music_start_ms,
      audio_mode, music_volume, original_audio_volume, output_profile,
      render_options, status, attempts
    ) VALUES (
      v_user_id, v_render_key, p_content_id, p_music_track_id, v_music_start_ms,
      'narration_plus_music', v_music_volume, 0, 'ai_studio_vertical_v3',
      jsonb_build_object(
        'pipeline', 'ai_studio_v3',
        'scriptId', p_script_id,
        'projectId', v_script.project_id,
        'voiceAssetId', v_voice.id,
        'musicStartMs', v_music_start_ms,
        'subtitlesEnabled', p_subtitles_enabled,
        'subtitleFont', v_font,
        'subtitleFontSize', v_font_size,
        'subtitleColor', v_color,
        'subtitlePosition', v_position
      ),
      'queued', 0
    ) RETURNING * INTO v_render;
  ELSIF v_render.status IN ('failed', 'cancelled') THEN
    UPDATE public.media_renders
    SET status = 'queued', attempts = 0, error_message = NULL,
        last_heartbeat = NULL, started_at = NULL, completed_at = NULL
    WHERE id = v_render.id
    RETURNING * INTO v_render;
  END IF;

  UPDATE public.ai_studio_scripts
  SET content_id = p_content_id,
      music_track_id = p_music_track_id,
      voice_asset_id = v_voice.id,
      media_render_id = v_render.id,
      music_volume = v_music_volume,
      music_start_ms = v_music_start_ms,
      subtitles_enabled = p_subtitles_enabled,
      subtitle_font = v_font,
      subtitle_font_size = v_font_size,
      subtitle_color = v_color,
      subtitle_position = v_position,
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
  uuid, uuid, uuid, integer, integer, boolean, text, integer, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_ai_studio_render(
  uuid, uuid, uuid, integer, integer, boolean, text, integer, text, text
) TO authenticated;
