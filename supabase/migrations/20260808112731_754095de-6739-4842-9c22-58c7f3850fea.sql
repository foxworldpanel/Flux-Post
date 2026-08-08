
-- Criptografia e Credenciais Sociais Seguras - Fase 3.2A

-- 1. Estrutura de Credenciais Sociais (Apenas Edge Functions/Service Role)
CREATE TABLE public.social_account_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE CASCADE NOT NULL,
    provider text NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scopes text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (social_account_id, provider)
);

-- RLS Restritiva: Ninguém tem SELECT além do service_role
ALTER TABLE public.social_account_credentials ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.social_account_credentials TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.social_account_credentials TO authenticated;
-- NOTA: SELECT NÃO é concedido para 'authenticated' para evitar exposição acidental via API.
-- As Edge Functions usarão service_role para ler tokens.

-- 2. Tabela para OAuth State (CSRF Protection)
CREATE TABLE public.social_oauth_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state text UNIQUE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE CASCADE NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.social_oauth_states ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.social_oauth_states TO service_role;
GRANT INSERT, SELECT, DELETE ON public.social_oauth_states TO authenticated;

-- Índices para performance
CREATE INDEX idx_social_creds_account ON public.social_account_credentials(social_account_id);
CREATE INDEX idx_social_oauth_states_state ON public.social_oauth_states(state);
CREATE INDEX idx_social_oauth_states_expires ON public.social_oauth_states(expires_at);

-- Comentários de auditoria
COMMENT ON TABLE public.social_account_credentials IS 'Armazena tokens OAuth criptografados. RLS restritiva: frontend não deve ter acesso SELECT.';
COMMENT ON TABLE public.social_oauth_states IS 'Armazena states temporários para fluxo OAuth (CSRF protection).';
