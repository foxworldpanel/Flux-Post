-- Migração de Hardening do Render Engine
-- Adiciona colunas para heartbeat, tentativas e recovery
ALTER TABLE public.media_renders 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS render_key TEXT;

-- Garantir unicidade da render_key se não estiver nula
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_renders_render_key ON public.media_renders(render_key) WHERE render_key IS NOT NULL;

-- Atualiza a RPC para suportar recovery e heartbeat atômico
CREATE OR REPLACE FUNCTION public.claim_next_render_job(lease_interval interval DEFAULT interval '5 minutes')
RETURNS public.media_renders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_job public.media_renders;
BEGIN
  -- 1. Recuperar jobs 'processing' abandonados (heartbeat expirado)
  UPDATE public.media_renders
  SET 
    status = 'queued',
    last_heartbeat = NULL
  WHERE status = 'processing'
    AND last_heartbeat < (now() - lease_interval)
    AND attempts < max_attempts;

  -- 2. Marcar como 'failed' jobs que excederam max_attempts
  UPDATE public.media_renders
  SET 
    status = 'failed',
    error_message = 'Max attempts exceeded during processing (stuck recovery)'
  WHERE status = 'processing'
    AND last_heartbeat < (now() - lease_interval)
    AND attempts >= max_attempts;

  -- 3. Claim do próximo job (queued ou recuperado)
  UPDATE public.media_renders
  SET 
    status = 'processing',
    started_at = now(),
    last_heartbeat = now(),
    attempts = attempts + 1
  WHERE id = (
    SELECT id
    FROM public.media_renders
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed_job;

  RETURN claimed_job;
END;
$$;

-- Função para atualizar heartbeat durante o processamento
CREATE OR REPLACE FUNCTION public.heartbeat_render_job(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.media_renders
  SET last_heartbeat = now()
  WHERE id = job_id AND status = 'processing';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_render_job(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_render_job(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.claim_next_render_job(interval) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_render_job(uuid) FROM public, anon, authenticated;