-- Criar tabela de estado do cron
CREATE TABLE IF NOT EXISTS public.server_cron_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    last_run_at timestamptz DEFAULT now(),
    last_success_at timestamptz,
    last_error text,
    processed_count int DEFAULT 0,
    next_expected_run_at timestamptz,
    executor_type text DEFAULT 'unknown'
);

-- Habilitar RLS
ALTER TABLE public.server_cron_state ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.server_cron_state TO authenticated;
GRANT ALL ON public.server_cron_state TO service_role;

-- Política de leitura para o Dashboard
CREATE POLICY "Users can read cron state" ON public.server_cron_state
    FOR SELECT TO authenticated USING (true);

-- Adicionar colunas necessárias em publications se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'publications' AND COLUMN_NAME = 'render_options') THEN
        ALTER TABLE public.publications ADD COLUMN render_options jsonb;
    END IF;
END $$;
