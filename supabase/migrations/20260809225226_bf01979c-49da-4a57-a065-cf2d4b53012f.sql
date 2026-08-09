ALTER TABLE public.social_accounts 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'tiktok_direct',
ADD COLUMN IF NOT EXISTS provider_connection_id TEXT,
ADD COLUMN IF NOT EXISTS provider_account_id TEXT,
ADD COLUMN IF NOT EXISTS provider_status TEXT,
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Indices para busca eficiente por provider e IDs externos
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON public.social_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_conn ON public.social_accounts(provider_connection_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_acc ON public.social_accounts(provider_account_id);

-- Atualizar metadados para social_oauth_states se necessário (já parece ok)

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
