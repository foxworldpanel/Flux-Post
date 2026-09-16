-- Studio IA publishes already-rendered final videos. Keep the strict music
-- rotation and reusable-source rules for traditional campaigns, while letting
-- Studio batches preserve the exact music baked into each approved render.

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
  v_music_ids uuid[];
  v_publication_music_id uuid;
  v_manual_daily_times time[];
  v_content jsonb;
  v_account jsonb;
  v_pub jsonb;
  v_content_id uuid;
  v_account_id uuid;
  v_render_id uuid;
  v_duplicate uuid;
  v_is_studio boolean := COALESCE(p_campaign->>'campaign_type', '') = 'studio_ai';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_array_length(COALESCE(p_contents,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'No contents'; END IF;
  IF jsonb_array_length(COALESCE(p_accounts,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'No social accounts'; END IF;
  IF jsonb_array_length(COALESCE(p_publications,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'No publications'; END IF;

  IF jsonb_typeof(p_campaign->'music_track_ids') = 'array' THEN
    SELECT COALESCE(array_agg(item.track_id ORDER BY item.first_position), ARRAY[]::uuid[])
    INTO v_music_ids
    FROM (
      SELECT value::uuid AS track_id, min(ordinality) AS first_position
      FROM jsonb_array_elements_text(p_campaign->'music_track_ids') WITH ORDINALITY
      WHERE NULLIF(value, '') IS NOT NULL
      GROUP BY value::uuid
    ) AS item;
  ELSE
    v_music_ids := ARRAY[]::uuid[];
  END IF;

  IF cardinality(v_music_ids) = 0 THEN
    v_music_id := NULLIF(p_campaign->>'music_track_id','')::uuid;
    IF v_music_id IS NOT NULL THEN v_music_ids := ARRAY[v_music_id]; END IF;
  END IF;

  IF cardinality(v_music_ids) = 0 THEN RAISE EXCEPTION 'No music tracks'; END IF;
  v_music_id := v_music_ids[1];

  IF EXISTS (
    SELECT 1
    FROM unnest(v_music_ids) AS selected_music_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.music_tracks m
      WHERE m.id = selected_music_id
        AND m.user_id = v_user
        AND (
          NULLIF(p_campaign->>'artist_id','')::uuid IS NULL
          OR m.artist_id = NULLIF(p_campaign->>'artist_id','')::uuid
        )
    )
  ) THEN
    RAISE EXCEPTION 'Invalid music track selection';
  END IF;

  IF NOT v_is_studio
     AND cardinality(v_music_ids) < (p_campaign->>'posts_por_dia')::int THEN
    RAISE EXCEPTION 'Select at least one different music track per daily post';
  END IF;

  IF NOT v_is_studio AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_publications) AS publication
    GROUP BY
      publication->>'social_account_id',
      (NULLIF(publication->>'scheduled_for','')::timestamptz AT TIME ZONE COALESCE(NULLIF(publication->>'timezone',''),'America/Sao_Paulo'))::date,
      COALESCE(NULLIF(publication->>'music_track_id','')::uuid, v_music_id)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A music track cannot repeat on the same account and local day';
  END IF;

  IF jsonb_typeof(p_campaign->'manual_daily_times') = 'array' THEN
    SELECT COALESCE(array_agg(value::time ORDER BY ordinality), ARRAY[]::time[])
    INTO v_manual_daily_times
    FROM jsonb_array_elements_text(p_campaign->'manual_daily_times') WITH ORDINALITY;
  ELSE
    v_manual_daily_times := ARRAY[]::time[];
  END IF;

  FOR v_content IN SELECT value FROM jsonb_array_elements(p_contents)
  LOOP
    v_content_id := (v_content->>'content_id')::uuid;
    PERFORM 1 FROM public.content_library c WHERE c.id=v_content_id AND c.user_id=v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Content not found: %', v_content_id; END IF;
    IF NOT v_is_studio AND EXISTS (
      SELECT 1 FROM public.content_library c
      WHERE c.id=v_content_id AND c.status IN ('reserved','used')
    ) THEN
      RAISE EXCEPTION 'Content already reserved or used: %', v_content_id;
    END IF;
  END LOOP;

  IF p_draft_campaign_id IS NOT NULL THEN
    SELECT id INTO v_campaign_id FROM public.campanhas
      WHERE id=p_draft_campaign_id AND user_id=v_user AND status='rascunho' FOR UPDATE;
    IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'Draft campaign not found'; END IF;
    UPDATE public.campanhas SET
      nome=p_campaign->>'nome', artist_id=NULLIF(p_campaign->>'artist_id','')::uuid,
      music_track_id=v_music_id, music_track_ids=v_music_ids, manual_daily_times=v_manual_daily_times,
      posts_por_dia=(p_campaign->>'posts_por_dia')::int,
      hora_inicio=(p_campaign->>'hora_inicio')::int, hora_fim=(p_campaign->>'hora_fim')::int,
      daily_start_time=NULLIF(p_campaign->>'daily_start_time','')::time,
      daily_end_time=NULLIF(p_campaign->>'daily_end_time','')::time,
      schedule_mode=p_campaign->>'schedule_mode', intervalo_min=(p_campaign->>'intervalo_min')::int,
      intervalo_max=(p_campaign->>'intervalo_max')::int, data_inicio=(p_campaign->>'data_inicio')::date,
      data_fim=(p_campaign->>'data_fim')::date, audio_mode=p_campaign->>'audio_mode',
      music_volume=(p_campaign->>'music_volume')::numeric,
      original_audio_volume=(p_campaign->>'original_audio_volume')::numeric,
      music_start_ms=(p_campaign->>'music_start_ms')::int, status='ativo', paused_at=NULL
      WHERE id=v_campaign_id;
    DELETE FROM public.campaign_contents WHERE campaign_id=v_campaign_id;
    DELETE FROM public.campaign_social_accounts WHERE campaign_id=v_campaign_id;
  ELSE
    INSERT INTO public.campanhas(
      user_id,nome,artist_id,music_track_id,music_track_ids,manual_daily_times,
      posts_por_dia,hora_inicio,hora_fim,daily_start_time,daily_end_time,
      schedule_mode,intervalo_min,intervalo_max,data_inicio,data_fim,audio_mode,
      music_volume,original_audio_volume,music_start_ms,status
    ) VALUES (
      v_user,p_campaign->>'nome',NULLIF(p_campaign->>'artist_id','')::uuid,
      v_music_id,v_music_ids,v_manual_daily_times,(p_campaign->>'posts_por_dia')::int,
      (p_campaign->>'hora_inicio')::int,(p_campaign->>'hora_fim')::int,
      NULLIF(p_campaign->>'daily_start_time','')::time,
      NULLIF(p_campaign->>'daily_end_time','')::time,p_campaign->>'schedule_mode',
      (p_campaign->>'intervalo_min')::int,(p_campaign->>'intervalo_max')::int,
      (p_campaign->>'data_inicio')::date,(p_campaign->>'data_fim')::date,
      p_campaign->>'audio_mode',(p_campaign->>'music_volume')::numeric,
      (p_campaign->>'original_audio_volume')::numeric,
      (p_campaign->>'music_start_ms')::int,'ativo'
    ) RETURNING id INTO v_campaign_id;
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
    v_publication_music_id := COALESCE(NULLIF(v_pub->>'music_track_id','')::uuid, v_music_id);
    v_render_id := NULLIF(v_pub->>'media_render_id','')::uuid;

    IF NOT (v_publication_music_id = ANY(v_music_ids)) THEN RAISE EXCEPTION 'Publication music not selected'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.campaign_contents cc WHERE cc.campaign_id=v_campaign_id AND cc.content_id=v_content_id) THEN RAISE EXCEPTION 'Publication content not in campaign'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.campaign_social_accounts ca WHERE ca.campaign_id=v_campaign_id AND ca.social_account_id=v_account_id) THEN RAISE EXCEPTION 'Publication account not in campaign'; END IF;
    IF v_render_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.media_renders r
      WHERE r.id=v_render_id AND r.user_id=v_user
        AND r.source_content_id=v_content_id
        AND r.music_track_id=v_publication_music_id
        AND r.status='ready' AND r.storage_path IS NOT NULL AND r.is_approved=true
    ) THEN RAISE EXCEPTION 'Approved render does not match publication content and music'; END IF;

    SELECT p.id INTO v_duplicate FROM public.publications p
      WHERE p.user_id=v_user AND p.social_account_id=v_account_id
        AND (p.content_id=v_content_id OR ((v_pub->>'source_external_id') IS NOT NULL AND p.source_external_id=v_pub->>'source_external_id' AND COALESCE(p.source_provider,'')=COALESCE(v_pub->>'source_provider','')))
        AND (p.provider_post_id IS NOT NULL OR p.status NOT IN ('failed','cancelled','canceled')) LIMIT 1;
    IF v_duplicate IS NOT NULL THEN RAISE EXCEPTION 'Duplicate content for destination; existing publication %', v_duplicate; END IF;

    INSERT INTO public.publications(campaign_id,content_id,music_track_id,social_account_id,platform,caption,hashtags,scheduled_for,status,user_id,media_render_id,timezone,source_provider,source_external_id,metadata)
    VALUES(v_campaign_id,v_content_id,v_publication_music_id,v_account_id,v_pub->>'platform',NULLIF(v_pub->>'caption',''),ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_pub->'hashtags','[]'::jsonb))),NULLIF(v_pub->>'scheduled_for','')::timestamptz,'scheduled',v_user,v_render_id,COALESCE(v_pub->>'timezone','America/Sao_Paulo'),NULLIF(v_pub->>'source_provider',''),NULLIF(v_pub->>'source_external_id',''),COALESCE(v_pub->'metadata','{}'::jsonb));
  END LOOP;

  UPDATE public.content_library SET status='reserved'
  WHERE user_id=v_user AND id IN (SELECT (value->>'content_id')::uuid FROM jsonb_array_elements(p_contents));
  UPDATE public.music_tracks SET campanha_ativa=true
  WHERE user_id=v_user AND id=ANY(v_music_ids);

  RETURN jsonb_build_object(
    'ok',true,
    'campaign_id',v_campaign_id,
    'publication_count',jsonb_array_length(p_publications),
    'music_track_count',cardinality(v_music_ids),
    'campaign_type',CASE WHEN v_is_studio THEN 'studio_ai' ELSE 'traditional' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.launch_campaign_atomic(jsonb,uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.launch_campaign_atomic(jsonb,uuid,jsonb,jsonb,jsonb) TO authenticated;
