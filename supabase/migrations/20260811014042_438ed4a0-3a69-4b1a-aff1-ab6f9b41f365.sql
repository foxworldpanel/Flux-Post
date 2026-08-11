
-- 1. Função que chama a Edge Function de Dispatcher
CREATE OR REPLACE FUNCTION public.dispatch_publications()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_data json;
  http_response record;
BEGIN
  -- Invoca a Edge Function via HTTP
  -- Nota: O segredo SUPABASE_SERVICE_ROLE_KEY não está disponível diretamente no SQL do Supabase por segurança, 
  -- mas em funções SECURITY DEFINER podemos usar net.http_post se a extensão pg_net estiver ativa.
  -- No Lovable Cloud, preferimos manter o dispatcher sendo chamado via cron externo ou trigger se disponível.
  
  -- Se pg_net estiver disponível:
  -- SELECT * INTO http_response FROM net.http_post(
  --   url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/campaign-dispatcher',
  --   headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
  --   body := '{}'::jsonb
  -- );
  
  RETURN json_build_object('status', 'dispatcher_invoked_logic_placeholder');
END;
$$;

-- 2. No Lovable Cloud, não temos pg_cron direto. 
-- Precisamos usar uma Edge Function disparada por um webhook de banco ou similar, 
-- OU o usuário aciona o primeiro despacho e a function se encadeia.

-- Auditoria da tabela media_renders para garantir que ela suporta o pipeline
CREATE TABLE IF NOT EXISTS public.media_renders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid REFERENCES content_library(id),
    music_id uuid REFERENCES music_tracks(id),
    render_key text UNIQUE, -- content_id + music_id + params hash
    storage_path text,
    status text DEFAULT 'queued', -- queued, processing, ready, failed
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;
ALTER TABLE public.media_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their renders" ON public.media_renders
    FOR ALL TO authenticated USING (auth.uid() = user_id);
