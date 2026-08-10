-- Add profile_id to social_accounts for PostPeer integration
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS provider_profile_id text;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_profile_id ON public.social_accounts(provider_profile_id);

-- Update RLS if needed (already broad for authenticated)
