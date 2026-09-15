-- Campaign V2: atomic launch + safe pause/resume.

ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_campaign_paused(
  p_campaign_id uuid,
  p_paused boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign public.campanhas%ROWTYPE;
  v_pause_delta interval;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_campaign FROM public.campanhas
  WHERE id = p_campaign_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;

  IF p_paused THEN
    IF v_campaign.status <> 'ativo' THEN
      RETURN jsonb_build_object('ok', true, 'status', v_campaign.status, 'changed', false);
    END IF;

    UPDATE public.campanhas SET status='pausado', paused_at=now() WHERE id=p_campaign_id;
    UPDATE public.publications
      SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('paused_from_status', status),
          status='paused', updated_at=now()
      WHERE campaign_id=p_campaign_id AND provider_post_id IS NULL
        AND status IN ('agendado','pending','scheduled','waiting_render','ready_to_post','queued');
    RETURN jsonb_build_object('ok', true, 'status', 'pausado', 'changed', true);
  END IF;

  IF v_campaign.status <> 'pausado' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_campaign.status, 'changed', false);
  END IF;

  v_pause_delta := now() - COALESCE(v_campaign.paused_at, now());
  UPDATE public.campanhas SET status='ativo', paused_at=NULL WHERE id=p_campaign_id;
  UPDATE public.publications
    SET status = CASE
          WHEN metadata->>'paused_from_status' IN ('agendado','pending','scheduled','waiting_render','ready_to_post','queued')
            THEN metadata->>'paused_from_status'
          ELSE 'scheduled' END,
        scheduled_for = CASE WHEN scheduled_for IS NULL THEN NULL ELSE scheduled_for + v_pause_delta END,
        metadata = COALESCE(metadata,'{}'::jsonb) - 'paused_from_status',
        updated_at=now()
    WHERE campaign_id=p_campaign_id AND provider_post_id IS NULL AND status='paused';
  RETURN jsonb_build_object('ok', true, 'status', 'ativo', 'changed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_campaign_paused(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_campaign_paused(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.launch_campaign_atomic(
  p_campaign jsonb,
  p_draft_campaign_id uuid,
  p_contents jsonb,
  p_accounts jsonb,
  p_publications jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign_id uuid;
  v_music_id uuid;
  v_content jsonb;
  v_account jsonb;
  v_pub jsonb;
  v_content_id uuid;
  v_account_id uuid;
  v_duplicate uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_array_length(COALESCE(p_contents,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'No contents'; END IF;
  IF jsonb_array_length(COALESCE(p_accounts,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'No social accounts'; END IF;
  IF jsonb_array_length(COALESCE(p_publications,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'No publications'; END IF;

  v_music_id := NULLIF(p_campaign->>'music_track_id','')::uuid;
  IF v_music_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.music_tracks m WHERE m.id=v_music_id AND m.user_id=v_user
      AND (p_campaign->>'artist_id' IS NULL OR m.artist_id=NULLIF(p_campaign->>'artist_id','')::uuid)
  ) THEN RAISE EXCEPTION 'Invalid music track'; END IF;

  -- Lock every selected content and reject already reserved/used content.
  FOR v_content IN SELECT value FROM jsonb_array_elements(p_contents)
  LOOP
    v_content_id := (v_content->>'content_id')::uuid;
    PERFORM 1 FROM public.content_library c WHERE c.id=v_content_id AND c.user_id=v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Content not found: %', v_content_id; END IF;
    IF EXISTS (SELECT 1 FROM public.content_library c WHERE c.id=v_content_id AND c.status IN ('reserved','used')) THEN
      RAISE EXCEPTION 'Content already reserved or used: %', v_content_id;
    END IF;
  END LOOP;

  IF p_draft_campaign_id IS NOT NULL THEN
    SELECT id INTO v_campaign_id FROM public.campanhas
      WHERE id=p_draft_campaign_id AND user_id=v_user AND status='rascunho' FOR UPDATE;
    IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'Draft campaign not found'; END IF;
    UPDATE public.campanhas SET
      nome=p_campaign->>'nome', artist_id=NULLIF(p_campaign->>'artist_id','')::uuid,
      music_track_id=v_music_id, posts_por_dia=(p_campaign->>'posts_por_dia')::int,
      hora_inicio=(p_campaign->>'hora_inicio')::int, hora_fim=(p_campaign->>'hora_fim')::int,
      daily_start_time=NULLIF(p_campaign->>'daily_start_time','')::time, daily_end_time=NULLIF(p_campaign->>'daily_end_time','')::time,
      schedule_mode=p_campaign->>'schedule_mode', intervalo_min=(p_campaign->>'intervalo_min')::int,
      intervalo_max=(p_campaign->>'intervalo_max')::int, data_inicio=(p_campaign->>'data_inicio')::date,
      data_fim=(p_campaign->>'data_fim')::date, audio_mode=p_campaign->>'audio_mode',
      music_volume=(p_campaign->>'music_volume')::numeric, original_audio_volume=(p_campaign->>'original_audio_volume')::numeric,
      music_start_ms=(p_campaign->>'music_start_ms')::int, status='ativo', paused_at=NULL
      WHERE id=v_campaign_id;
    DELETE FROM public.campaign_contents WHERE campaign_id=v_campaign_id;
    DELETE FROM public.campaign_social_accounts WHERE campaign_id=v_campaign_id;
  ELSE
    INSERT INTO public.campanhas(user_id,nome,artist_id,music_track_id,posts_por_dia,hora_inicio,hora_fim,daily_start_time,daily_end_time,schedule_mode,intervalo_min,intervalo_max,data_inicio,data_fim,audio_mode,music_volume,original_audio_volume,music_start_ms,status)
    VALUES(v_user,p_campaign->>'nome',NULLIF(p_campaign->>'artist_id','')::uuid,v_music_id,(p_campaign->>'posts_por_dia')::int,(p_campaign->>'hora_inicio')::int,(p_campaign->>'hora_fim')::int,NULLIF(p_campaign->>'daily_start_time','')::time,NULLIF(p_campaign->>'daily_end_time','')::time,p_campaign->>'schedule_mode',(p_campaign->>'intervalo_min')::int,(p_campaign->>'intervalo_max')::int,(p_campaign->>'data_inicio')::date,(p_campaign->>'data_fim')::date,p_campaign->>'audio_mode',(p_campaign->>'music_volume')::numeric,(p_campaign->>'original_audio_volume')::numeric,(p_campaign->>'music_start_ms')::int,'ativo') RETURNING id INTO v_campaign_id;
  END IF;

  FOR v_content IN SELECT value FROM jsonb_array_elements(p_contents)
  LOOP
    INSERT INTO public.campaign_contents(campaign_id,content_id,position,caption,hashtags,editorial_status,approved_at)
    VALUES(v_campaign_id,(v_content->>'content_id')::uuid,(v_content->>'position')::int,NULLIF(v_content->>'caption',''),NULLIF(v_content->>'hashtags',''),COALESCE(v_content->>'editorial_status','pending'),NULLIF(v_content->>'approved_at','')::timestamptz);
  END LOOP;

  FOR v_account IN SELECT value FROM jsonb_array_elements(p_accounts)
  LOOP
    v_account_id := (v_account->>'social_account_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.social_accounts a WHERE a.id=v_account_id AND a.user_id=v_user) THEN RAISE EXCEPTION 'Invalid social account'; END IF;
    INSERT INTO public.campaign_social_accounts(campaign_id,social_account_id) VALUES(v_campaign_id,v_account_id);
  END LOOP;

  FOR v_pub IN SELECT value FROM jsonb_array_elements(p_publications)
  LOOP
    v_content_id := (v_pub->>'content_id')::uuid;
    v_account_id := (v_pub->>'social_account_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.campaign_contents cc WHERE cc.campaign_id=v_campaign_id AND cc.content_id=v_content_id) THEN RAISE EXCEPTION 'Publication content not in campaign'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.campaign_social_accounts ca WHERE ca.campaign_id=v_campaign_id AND ca.social_account_id=v_account_id) THEN RAISE EXCEPTION 'Publication account not in campaign'; END IF;

    SELECT p.id INTO v_duplicate FROM public.publications p
      WHERE p.user_id=v_user AND p.social_account_id=v_account_id
        AND (p.content_id=v_content_id OR ((v_pub->>'source_external_id') IS NOT NULL AND p.source_external_id=v_pub->>'source_external_id' AND COALESCE(p.source_provider,'')=COALESCE(v_pub->>'source_provider','')))
        AND (p.provider_post_id IS NOT NULL OR p.status NOT IN ('failed','cancelled','canceled')) LIMIT 1;
    IF v_duplicate IS NOT NULL THEN RAISE EXCEPTION 'Duplicate content for destination; existing publication %', v_duplicate; END IF;

    INSERT INTO public.publications(campaign_id,content_id,music_track_id,social_account_id,platform,caption,hashtags,scheduled_for,status,user_id,media_render_id,timezone,source_provider,source_external_id,metadata)
    VALUES(v_campaign_id,v_content_id,v_music_id,v_account_id,v_pub->>'platform',NULLIF(v_pub->>'caption',''),ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_pub->'hashtags','[]'::jsonb))),NULLIF(v_pub->>'scheduled_for','')::timestamptz,'scheduled',v_user,NULLIF(v_pub->>'media_render_id','')::uuid,COALESCE(v_pub->>'timezone','America/Sao_Paulo'),NULLIF(v_pub->>'source_provider',''),NULLIF(v_pub->>'source_external_id',''),COALESCE(v_pub->'metadata','{}'::jsonb));
  END LOOP;

  UPDATE public.content_library SET status='reserved' WHERE user_id=v_user AND id IN (SELECT (value->>'content_id')::uuid FROM jsonb_array_elements(p_contents));
  UPDATE public.music_tracks SET campanha_ativa=true WHERE id=v_music_id AND user_id=v_user;

  RETURN jsonb_build_object('ok',true,'campaign_id',v_campaign_id,'publication_count',jsonb_array_length(p_publications));
END;
$$;

REVOKE ALL ON FUNCTION public.launch_campaign_atomic(jsonb,uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.launch_campaign_atomic(jsonb,uuid,jsonb,jsonb,jsonb) TO authenticated;
