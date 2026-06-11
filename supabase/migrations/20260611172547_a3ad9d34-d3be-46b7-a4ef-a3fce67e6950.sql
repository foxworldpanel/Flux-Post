-- Desabilita temporariamente as restrições que dependem da tabela videos
ALTER TABLE IF EXISTS public.posts_agendados DROP CONSTRAINT IF EXISTS posts_agendados_video_id_fkey;
ALTER TABLE IF EXISTS public.scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_video_id_fkey;

DROP TABLE IF EXISTS public.videos;

CREATE TABLE public.videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text,
  nicho text,
  duracao_segundos int,
  storage_path text,
  vezes_usada int DEFAULT 0,
  ultimo_uso timestamptz,
  criado_em timestamptz DEFAULT now()
);

-- Recria as restrições
ALTER TABLE IF EXISTS public.posts_agendados 
  ADD CONSTRAINT posts_agendados_video_id_fkey 
  FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.scheduled_posts 
  ADD CONSTRAINT scheduled_posts_video_id_fkey 
  FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;

-- RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público total para vídeos por enquanto" ON public.videos FOR ALL USING (true) WITH CHECK (true);