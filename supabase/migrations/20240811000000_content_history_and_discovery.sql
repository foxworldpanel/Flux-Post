-- Add status column to content_candidates if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_status') THEN
        CREATE TYPE public.candidate_status AS ENUM ('pendente', 'aprovado', 'descartado');
    END IF;
END $$;

-- Add current_page tracker to discovery categories to progress through pages
ALTER TABLE public.content_discovery_categories ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 1;

-- Add last_run_at to settings
ALTER TABLE public.content_discovery_settings ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

-- Ensure content_candidates has the right structure
ALTER TABLE public.content_candidates ADD COLUMN IF NOT EXISTS status candidate_status DEFAULT 'pendente';
ALTER TABLE public.content_candidates ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_candidates TO authenticated;
GRANT SELECT, UPDATE ON public.content_discovery_categories TO authenticated;
GRANT SELECT, UPDATE ON public.content_discovery_settings TO authenticated;
GRANT ALL ON public.content_candidates TO service_role;
GRANT ALL ON public.content_discovery_categories TO service_role;
GRANT ALL ON public.content_discovery_settings TO service_role;
