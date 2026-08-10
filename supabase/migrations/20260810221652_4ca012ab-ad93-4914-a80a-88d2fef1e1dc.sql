ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS provider_post_id text;
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo';
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

GRANT ALL ON public.publications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
