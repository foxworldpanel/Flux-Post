CREATE TABLE IF NOT EXISTS public.ai_studio_voice_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL UNIQUE
    REFERENCES public.ai_studio_scripts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL
    REFERENCES public.ai_studio_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'elevenlabs',
  voice_id text NOT NULL,
  voice_name text,
  model_id text NOT NULL DEFAULT 'eleven_multilingual_v2',
  storage_bucket text NOT NULL DEFAULT 'ai-studio-audio',
  storage_path text,
  content_type text NOT NULL DEFAULT 'audio/mpeg',
  size_bytes bigint,
  alignment jsonb,
  status text NOT NULL DEFAULT 'generating',
  attempts integer NOT NULL DEFAULT 1,
  error_message text,
  provider_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_studio_voice_assets_status_check CHECK (
    status IN ('generating', 'ready', 'failed_safe', 'needs_review')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_studio_voice_assets_user_status
  ON public.ai_studio_voice_assets (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_studio_voice_assets_project
  ON public.ai_studio_voice_assets (project_id, created_at DESC);

ALTER TABLE public.ai_studio_voice_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_studio_voice_assets_owner_select
  ON public.ai_studio_voice_assets;
CREATE POLICY ai_studio_voice_assets_owner_select
  ON public.ai_studio_voice_assets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.ai_studio_voice_assets TO authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'ai-studio-audio',
  'ai-studio-audio',
  false,
  20971520,
  ARRAY['audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.claim_ai_studio_voice(
  p_script_id uuid,
  p_voice_id text,
  p_voice_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_script public.ai_studio_scripts%ROWTYPE;
  v_asset public.ai_studio_voice_assets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF btrim(COALESCE(p_voice_id, '')) = '' THEN
    RAISE EXCEPTION 'Voice is required';
  END IF;

  SELECT *
  INTO v_script
  FROM public.ai_studio_scripts
  WHERE id = p_script_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script not found or unauthorized';
  END IF;

  SELECT *
  INTO v_asset
  FROM public.ai_studio_voice_assets
  WHERE script_id = p_script_id;

  IF FOUND THEN
    IF v_asset.status = 'ready' THEN
      RETURN jsonb_build_object(
        'claimed', false,
        'state', 'ready',
        'assetId', v_asset.id,
        'storageBucket', v_asset.storage_bucket,
        'storagePath', v_asset.storage_path
      );
    END IF;

    IF v_asset.status IN ('generating', 'needs_review') THEN
      RETURN jsonb_build_object(
        'claimed', false,
        'state', v_asset.status,
        'assetId', v_asset.id
      );
    END IF;

    IF v_asset.status = 'failed_safe' THEN
      UPDATE public.ai_studio_voice_assets
      SET
        voice_id = btrim(p_voice_id),
        voice_name = NULLIF(btrim(COALESCE(p_voice_name, '')), ''),
        status = 'generating',
        attempts = attempts + 1,
        error_message = NULL,
        updated_at = now()
      WHERE id = v_asset.id
      RETURNING * INTO v_asset;

      RETURN jsonb_build_object(
        'claimed', true,
        'state', 'generating',
        'assetId', v_asset.id,
        'projectId', v_script.project_id,
        'narration', v_script.narration
      );
    END IF;
  END IF;

  IF v_script.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved scripts can generate narration';
  END IF;

  INSERT INTO public.ai_studio_voice_assets (
    script_id,
    project_id,
    user_id,
    voice_id,
    voice_name,
    status
  )
  VALUES (
    v_script.id,
    v_script.project_id,
    v_user_id,
    btrim(p_voice_id),
    NULLIF(btrim(COALESCE(p_voice_name, '')), ''),
    'generating'
  )
  RETURNING * INTO v_asset;

  RETURN jsonb_build_object(
    'claimed', true,
    'state', 'generating',
    'assetId', v_asset.id,
    'projectId', v_script.project_id,
    'narration', v_script.narration
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_studio_voice(uuid, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_studio_voice(uuid, text, text)
  TO authenticated;
