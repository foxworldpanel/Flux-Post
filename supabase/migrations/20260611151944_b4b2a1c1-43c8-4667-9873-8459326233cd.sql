CREATE TABLE IF NOT EXISTS public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text,
  nicho text,
  duracao_segundos int,
  storage_path text,
  vezes_usada int DEFAULT 0,
  ultimo_uso timestamptz,
  criado_em timestamptz DEFAULT now(),
  user_id uuid
);

-- Caso a tabela já exista mas sem a coluna, adiciona explicitamente
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='duracao_segundos') THEN
        ALTER TABLE public.videos ADD COLUMN duracao_segundos int;
    END IF;
END $$;

ALTER TABLE public.videos DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.videos TO anon, authenticated, service_role;