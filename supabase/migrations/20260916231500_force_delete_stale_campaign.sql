-- Allow confirmed deletion of campaigns whose publications were abandoned in
-- publishing/processing, while protecting a provider request that really
-- started in the last two minutes.

CREATE OR REPLACE FUNCTION public.delete_campaign_atomic(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign public.campanhas%ROWTYPE;
  v_content_ids uuid[] := ARRAY[]::uuid[];
  v_music_ids uuid[] := ARRAY[]::uuid[];
  v_removed_publications integer := 0;
  v_preserved_publications integer := 0;
  v_stale_publications integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO v_campaign
  FROM public.campanhas
  WHERE id = p_campaign_id
    AND user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha não encontrada ou sem permissão';
  END IF;

  -- A claim is only considered active for a short provider boundary. Older
  -- publishing rows are abandoned attempts and must not make a campaign
  -- impossible to delete forever.
  IF EXISTS (
    SELECT 1
    FROM public.publications
    WHERE campaign_id = p_campaign_id
      AND provider_post_id IS NULL
      AND lower(COALESCE(status, '')) IN ('publishing', 'processing')
      AND COALESCE(updated_at, created_at, now()) >= now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'Existe uma publicação sendo enviada agora. Aguarde dois minutos e tente excluir novamente';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT content_id), ARRAY[]::uuid[])
  INTO v_content_ids
  FROM public.publications
  WHERE campaign_id = p_campaign_id
    AND content_id IS NOT NULL;

  v_music_ids := COALESCE(v_campaign.music_track_ids, ARRAY[]::uuid[]);
  IF cardinality(v_music_ids) = 0 AND v_campaign.music_track_id IS NOT NULL THEN
    v_music_ids := ARRAY[v_campaign.music_track_id];
  END IF;

  UPDATE public.publications
  SET status = 'cancelled',
      last_error = 'Cancelado pela exclusão da campanha após envio abandonado',
      updated_at = now()
  WHERE campaign_id = p_campaign_id
    AND provider_post_id IS NULL
    AND lower(COALESCE(status, '')) IN ('publishing', 'processing');
  GET DIAGNOSTICS v_stale_publications = ROW_COUNT;

  -- Remove every local job that never reached the provider. Provider-backed
  -- and published rows remain as standalone permanent history.
  DELETE FROM public.publications
  WHERE campaign_id = p_campaign_id
    AND provider_post_id IS NULL
    AND lower(COALESCE(status, '')) <> 'published';
  GET DIAGNOSTICS v_removed_publications = ROW_COUNT;

  SELECT count(*)
  INTO v_preserved_publications
  FROM public.publications
  WHERE campaign_id = p_campaign_id;

  DELETE FROM public.campanhas
  WHERE id = p_campaign_id
    AND user_id = v_user;

  UPDATE public.content_library AS content
  SET status = 'new',
      updated_at = now()
  WHERE content.user_id = v_user
    AND content.id = ANY(v_content_ids)
    AND content.status = 'reserved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.publications AS publication
      WHERE publication.user_id = v_user
        AND publication.content_id = content.id
        AND publication.provider_post_id IS NULL
        AND lower(COALESCE(publication.status, '')) NOT IN (
          'published', 'failed', 'cancelled', 'canceled'
        )
    );

  UPDATE public.music_tracks AS track
  SET campanha_ativa = false
  WHERE track.user_id = v_user
    AND track.id = ANY(v_music_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.campanhas AS campaign
      WHERE campaign.user_id = v_user
        AND lower(COALESCE(campaign.status, '')) IN ('ativo', 'pausado')
        AND (
          campaign.music_track_id = track.id
          OR track.id = ANY(COALESCE(campaign.music_track_ids, ARRAY[]::uuid[]))
        )
    );

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', p_campaign_id,
    'removed_publications', v_removed_publications,
    'preserved_publications', v_preserved_publications,
    'stale_publications_cancelled', v_stale_publications
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_campaign_atomic(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_campaign_atomic(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
