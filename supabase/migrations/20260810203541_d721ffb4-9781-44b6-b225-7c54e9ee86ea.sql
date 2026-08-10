ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS provider_profile_id text;
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_profile_id ON public.social_accounts(provider_profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;