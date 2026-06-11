-- Desabilitar RLS nas tabelas principais
ALTER TABLE public.music_tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts_agendados DISABLE ROW LEVEL SECURITY;

-- Garantir permissões para anon e authenticated (desenvolvimento)
GRANT ALL ON public.music_tracks TO anon, authenticated;
GRANT ALL ON public.videos TO anon, authenticated;
GRANT ALL ON public.tiktok_accounts TO anon, authenticated;
GRANT ALL ON public.campanhas TO anon, authenticated;
GRANT ALL ON public.posts_agendados TO anon, authenticated;

-- Liberar acesso público nos buckets de storage
-- Nota: buckets já foram criados, agora garantimos que objetos possam ser manipulados sem RLS restritivo
CREATE POLICY "Public Access Musicas" ON storage.objects FOR ALL USING (bucket_id = 'musicas') WITH CHECK (bucket_id = 'musicas');
CREATE POLICY "Public Access Videos" ON storage.objects FOR ALL USING (bucket_id = 'videos') WITH CHECK (bucket_id = 'videos');

-- Como as tabelas podem já ter RLS habilitado mas com políticas restritivas, DISABLE é o caminho mais rápido para o pedido do usuário
