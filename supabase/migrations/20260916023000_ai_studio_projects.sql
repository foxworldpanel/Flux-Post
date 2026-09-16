CREATE TABLE IF NOT EXISTS public.ai_studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  project_type text NOT NULL DEFAULT 'motivational_video',
  theme text NOT NULL,
  tone text NOT NULL,
  audience text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 30,
  include_cta boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_studio_projects_duration_check
    CHECK (duration_seconds BETWEEN 15 AND 60),
  CONSTRAINT ai_studio_projects_status_check
    CHECK (status IN ('draft', 'review', 'approved', 'producing', 'completed', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.ai_studio_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ai_studio_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL,
  title text NOT NULL,
  hook text NOT NULL DEFAULT '',
  narration text NOT NULL,
  closing text NOT NULL DEFAULT '',
  visual_keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  estimated_seconds integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_studio_scripts_position_unique UNIQUE (project_id, position),
  CONSTRAINT ai_studio_scripts_duration_check
    CHECK (estimated_seconds BETWEEN 15 AND 60),
  CONSTRAINT ai_studio_scripts_status_check
    CHECK (status IN ('draft', 'approved', 'rejected', 'voiced', 'rendered'))
);

CREATE INDEX IF NOT EXISTS idx_ai_studio_projects_user_created
  ON public.ai_studio_projects (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_studio_scripts_project_position
  ON public.ai_studio_scripts (project_id, position);

CREATE INDEX IF NOT EXISTS idx_ai_studio_scripts_user_status
  ON public.ai_studio_scripts (user_id, status);

ALTER TABLE public.ai_studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_studio_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_studio_projects_owner_all
  ON public.ai_studio_projects;
CREATE POLICY ai_studio_projects_owner_all
  ON public.ai_studio_projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_studio_scripts_owner_all
  ON public.ai_studio_scripts;
CREATE POLICY ai_studio_scripts_owner_all
  ON public.ai_studio_scripts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.ai_studio_projects project
      WHERE project.id = ai_studio_scripts.project_id
        AND project.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.save_ai_studio_project(
  p_project jsonb,
  p_scripts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_script jsonb;
  v_position integer := 0;
  v_script_count integer;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(p_scripts) <> 'array' THEN
    RAISE EXCEPTION 'Scripts must be a JSON array';
  END IF;

  v_script_count := jsonb_array_length(p_scripts);
  IF v_script_count < 1 OR v_script_count > 10 THEN
    RAISE EXCEPTION 'A project must contain between 1 and 10 scripts';
  END IF;

  IF btrim(COALESCE(p_project->>'theme', '')) = '' THEN
    RAISE EXCEPTION 'Project theme is required';
  END IF;

  INSERT INTO public.ai_studio_projects (
    user_id,
    name,
    project_type,
    theme,
    tone,
    audience,
    duration_seconds,
    include_cta,
    status
  )
  VALUES (
    v_user_id,
    left(COALESCE(NULLIF(btrim(p_project->>'name'), ''), 'Lote motivacional'), 120),
    'motivational_video',
    left(btrim(p_project->>'theme'), 1000),
    left(COALESCE(NULLIF(btrim(p_project->>'tone'), ''), 'emocional e acolhedor'), 200),
    left(COALESCE(NULLIF(btrim(p_project->>'audience'), ''), 'público adulto geral'), 300),
    LEAST(60, GREATEST(15, COALESCE((p_project->>'durationSeconds')::integer, 30))),
    COALESCE((p_project->>'includeCta')::boolean, false),
    'review'
  )
  RETURNING id INTO v_project_id;

  FOR v_script IN
    SELECT value
    FROM jsonb_array_elements(p_scripts)
  LOOP
    v_position := v_position + 1;

    IF btrim(COALESCE(v_script->>'title', '')) = ''
       OR btrim(COALESCE(v_script->>'narration', '')) = ''
    THEN
      RAISE EXCEPTION 'Script % is missing title or narration', v_position;
    END IF;

    v_status := COALESCE(v_script->>'status', 'draft');
    IF v_status NOT IN ('draft', 'approved', 'rejected') THEN
      v_status := 'draft';
    END IF;

    INSERT INTO public.ai_studio_scripts (
      project_id,
      user_id,
      position,
      title,
      hook,
      narration,
      closing,
      visual_keywords,
      estimated_seconds,
      status
    )
    VALUES (
      v_project_id,
      v_user_id,
      v_position,
      left(btrim(v_script->>'title'), 200),
      left(COALESCE(v_script->>'hook', ''), 1000),
      btrim(v_script->>'narration'),
      left(COALESCE(v_script->>'closing', ''), 1000),
      COALESCE(
        ARRAY(
          SELECT left(btrim(value), 160)
          FROM jsonb_array_elements_text(
            COALESCE(v_script->'visualKeywords', '[]'::jsonb)
          )
          WHERE btrim(value) <> ''
          LIMIT 7
        ),
        ARRAY[]::text[]
      ),
      LEAST(
        60,
        GREATEST(
          15,
          COALESCE((v_script->>'estimatedSeconds')::integer, 30)
        )
      ),
      v_status
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'projectId', v_project_id,
    'scriptCount', v_script_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_ai_studio_project(jsonb, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ai_studio_project(jsonb, jsonb)
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ai_studio_projects, public.ai_studio_scripts
  TO authenticated;
