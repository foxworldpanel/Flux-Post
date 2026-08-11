-- 1. Reconciliação do schema server_cron_state para o contrato de monitoramento completo
ALTER TABLE public.server_cron_state 
RENAME COLUMN last_run TO last_run_at;

ALTER TABLE public.server_cron_state 
ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS executor_type TEXT,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS next_expected_run_at TIMESTAMP WITH TIME ZONE;

-- 2. Limpeza de constraints redundantes em publications (baseado na auditoria visual dos types)
-- O log de types sugere que account_id foi renomeado para social_account_id mas a FK social_account_id_fkey pode coexistir.
-- Vamos garantir que apenas as FKs canônicas existam.
DO $$ 
BEGIN
    -- Remover FKs legadas de music se existirem
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'publications_music_id_fkey') THEN
        ALTER TABLE public.publications DROP CONSTRAINT publications_music_id_fkey;
    END IF;
END $$;

-- 3. Grants
GRANT ALL ON public.server_cron_state TO service_role;
GRANT SELECT ON public.server_cron_state TO authenticated;

NOTIFY pgrst, 'reload schema';