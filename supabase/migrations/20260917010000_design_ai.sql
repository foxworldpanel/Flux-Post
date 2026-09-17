CREATE TABLE IF NOT EXISTS public.design_ai_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text NOT NULL DEFAULT '',
  analysis text NOT NULL DEFAULT '',
  analysis_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_ai_styles_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT design_ai_styles_provider_check CHECK (
    analysis_provider IS NULL OR analysis_provider IN ('openai', 'claude_openai')
  )
);

CREATE TABLE IF NOT EXISTS public.design_ai_style_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id uuid NOT NULL REFERENCES public.design_ai_styles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_ai_reference_mime_check CHECK (
    mime_type IN ('image/jpeg', 'image/png', 'image/webp')
  )
);

CREATE TABLE IF NOT EXISTS public.design_ai_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id uuid REFERENCES public.design_ai_styles(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_mode text NOT NULL,
  prompt text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  width integer NOT NULL,
  height integer NOT NULL,
  format_name text NOT NULL DEFAULT 'custom',
  overlay jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_ai_assets_provider_check CHECK (
    provider_mode IN ('openai', 'claude_openai')
  ),
  CONSTRAINT design_ai_assets_dimensions_check CHECK (
    width BETWEEN 256 AND 3840 AND height BETWEEN 256 AND 3840
  )
);

CREATE INDEX IF NOT EXISTS idx_design_ai_styles_user_created
  ON public.design_ai_styles (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_ai_references_style_position
  ON public.design_ai_style_references (style_id, position, created_at);
CREATE INDEX IF NOT EXISTS idx_design_ai_assets_user_created
  ON public.design_ai_assets (user_id, created_at DESC);

ALTER TABLE public.design_ai_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_ai_style_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_ai_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS design_ai_styles_owner_all ON public.design_ai_styles;
CREATE POLICY design_ai_styles_owner_all ON public.design_ai_styles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS design_ai_references_owner_all ON public.design_ai_style_references;
CREATE POLICY design_ai_references_owner_all ON public.design_ai_style_references
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.design_ai_styles style
      WHERE style.id = style_id AND style.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS design_ai_assets_owner_all ON public.design_ai_assets;
CREATE POLICY design_ai_assets_owner_all ON public.design_ai_assets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_design_ai_reference_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF (
    SELECT count(*)
    FROM public.design_ai_style_references
    WHERE style_id = NEW.style_id
  ) >= 10 THEN
    RAISE EXCEPTION 'Cada padrão visual aceita no máximo 10 referências';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_design_ai_reference_limit
  ON public.design_ai_style_references;
CREATE TRIGGER trg_design_ai_reference_limit
  BEFORE INSERT ON public.design_ai_style_references
  FOR EACH ROW EXECUTE FUNCTION public.enforce_design_ai_reference_limit();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-ai',
  'design-ai',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS design_ai_storage_owner_select ON storage.objects;
CREATE POLICY design_ai_storage_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'design-ai'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS design_ai_storage_owner_insert ON storage.objects;
CREATE POLICY design_ai_storage_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'design-ai'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS design_ai_storage_owner_delete ON storage.objects;
CREATE POLICY design_ai_storage_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'design-ai'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.design_ai_styles,
     public.design_ai_style_references,
     public.design_ai_assets
  TO authenticated;

NOTIFY pgrst, 'reload schema';
