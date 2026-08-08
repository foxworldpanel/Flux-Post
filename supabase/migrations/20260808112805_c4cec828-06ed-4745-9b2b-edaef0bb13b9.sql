
-- Políticas de RLS para Credenciais e States OAuth - Fase 3.2A

-- 1. Políticas para social_account_credentials
-- Usuários podem deletar suas próprias credenciais (ex: desconexão), mas NÃO podem ler/ver tokens.
CREATE POLICY "Users can delete their own social credentials"
ON public.social_account_credentials
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2. Políticas para social_oauth_states
-- Usuários podem gerenciar seus próprios states durante o fluxo de login
CREATE POLICY "Users can manage their own oauth states"
ON public.social_oauth_states
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- O service_role tem acesso total herdado pelo GRANT ALL já executado.
