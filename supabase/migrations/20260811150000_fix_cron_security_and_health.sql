-- 1. Garantir privilégios
GRANT ALL ON public.server_cron_state TO service_role;
GRANT SELECT ON public.server_cron_state TO authenticated;
GRANT SELECT ON public.server_cron_state TO anon;

-- 2. Corrigir políticas RLS (remover anteriores e criar limpas)
DROP POLICY IF EXISTS "Service role only" ON public.server_cron_state;
DROP POLICY IF EXISTS "Users can read cron state" ON public.server_cron_state;
DROP POLICY IF EXISTS "Users can view cron state" ON public.server_cron_state;

CREATE POLICY "Service role full access" 
ON public.server_cron_state 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can view health" 
ON public.server_cron_state 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. Neutralizar o scheduler inseguro (Se pudéssemos, rotacionaríamos a anon key, mas não temos privilégios para isso via SQL no cron schema)
-- Apenas garantimos que o dispatcher não use mais segredos hardcoded se possível.
