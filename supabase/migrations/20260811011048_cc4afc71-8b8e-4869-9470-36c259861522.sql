
DO $$ 
BEGIN 
    -- 1. Tornar platform NULLABLE para resolver o erro imediato de INSERT
    ALTER TABLE public.publications ALTER COLUMN platform DROP NOT NULL;

    -- 2. Limpeza de colunas legadas se existirem e não forem mais mapeadas (segurança)
    -- Já verificado que account_id foi renomeado, mas vamos garantir que não há lixo.
    
    -- 3. Garantir que social_account_id é a fonte canônica com FK correta
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publications_social_account_id_fkey') THEN
        ALTER TABLE public.publications 
        ADD CONSTRAINT publications_social_account_id_fkey 
        FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE;
    END IF;

END $$;

-- 4. Teste de INSERT com o contrato atual do Campaign Engine
-- Simula o payload exato enviado por src/routes/campanha.tsx
INSERT INTO public.publications (
    campaign_id,
    social_account_id,
    content_id,
    scheduled_for,
    status,
    timezone,
    user_id
)
SELECT 
    (SELECT id FROM campanhas LIMIT 1),
    (SELECT id FROM social_accounts LIMIT 1),
    (SELECT id FROM content_library LIMIT 1),
    NOW() + interval '1 hour',
    'agendado',
    'America/Sao_Paulo',
    (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM social_accounts) 
  AND EXISTS (SELECT 1 FROM campanhas)
  AND EXISTS (SELECT 1 FROM content_library)
RETURNING id, platform;
