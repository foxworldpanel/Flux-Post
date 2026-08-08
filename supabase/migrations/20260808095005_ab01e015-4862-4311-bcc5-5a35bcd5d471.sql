-- Phase 3.1: Audit and Consolidate social_accounts

-- 1. Add new columns
ALTER TABLE public.social_accounts 
ADD COLUMN IF NOT EXISTS artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS profile_image_url text,
ADD COLUMN IF NOT EXISTS editorial_profile text,
ADD COLUMN IF NOT EXISTS preferred_categories text[],
ADD COLUMN IF NOT EXISTS posts_per_day integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS posting_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS receive_all_campaigns boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_post_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'nao_conectada',
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Ensure indices
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_artist_id ON public.social_accounts(artist_id);

-- 3. Re-grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
