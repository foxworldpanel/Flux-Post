-- Corrige o problema do search_path para evitar alertas de segurança (0011_function_search_path_mutable)
-- E revoga execução de anon (público) para as funções SECURITY DEFINER (0028_anon_security_definer_function_executable)

CREATE OR REPLACE FUNCTION insert_media_render(
  p_user_id uuid,
  p_source_content_id uuid,
  p_music_track_id uuid,
  p_audio_mode text,
  p_music_volume int,
  p_original_audio_volume int,
  p_music_start_ms int
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO media_renders (
    user_id, source_content_id, music_track_id,
    render_key, status, attempts,
    audio_mode, music_volume, 
    original_audio_volume, music_start_ms
  ) VALUES (
    p_user_id, p_source_content_id, p_music_track_id,
    p_source_content_id || '|' || p_music_track_id || '|' || p_music_start_ms,
    'queued', 0,
    p_audio_mode, p_music_volume,
    p_original_audio_volume, p_music_start_ms
  ) 
  ON CONFLICT (render_key) DO UPDATE SET
    status = 'queued',
    attempts = 0
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoga acesso público por padrão (bom hábito para SECURITY DEFINER)
REVOKE ALL ON FUNCTION insert_media_render FROM PUBLIC;
-- Garante acesso apenas para autenticados e service_role
GRANT EXECUTE ON FUNCTION insert_media_render TO authenticated;
GRANT EXECUTE ON FUNCTION insert_media_render TO service_role;
