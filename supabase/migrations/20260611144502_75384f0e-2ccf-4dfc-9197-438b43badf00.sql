-- Criar tabelas faltantes ou ajustar nomes
CREATE TABLE IF NOT EXISTS public.music_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    artista TEXT,
    estilo TEXT,
    duracao_segundos INTEGER,
    storage_path TEXT,
    vezes_usada INTEGER DEFAULT 0,
    campanha_ativa BOOLEAN DEFAULT false,
    criado_em TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    posts_por_dia INTEGER,
    intervalo_min INTEGER DEFAULT 40,
    intervalo_max INTEGER DEFAULT 90,
    hora_inicio INTEGER DEFAULT 9,
    hora_fim INTEGER DEFAULT 22,
    data_inicio DATE,
    data_fim DATE,
    status TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.posts_agendados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID REFERENCES public.campanhas(id) ON DELETE CASCADE,
    tiktok_account_id UUID REFERENCES public.tiktok_accounts(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    music_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
    legenda TEXT,
    hashtags TEXT[],
    agendado_para TIMESTAMPTZ,
    status TEXT,
    postado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Garantir que as tabelas existentes tenham as colunas corretas e RLS
DO $$
BEGIN
    -- tiktok_accounts já existia, garantir colunas do prompt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tiktok_accounts' AND column_name='posts_hoje') THEN
        ALTER TABLE public.tiktok_accounts ADD COLUMN posts_hoje INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tiktok_accounts' AND column_name='total_posts') THEN
        ALTER TABLE public.tiktok_accounts ADD COLUMN total_posts INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tiktok_accounts' AND column_name='user_id') THEN
        ALTER TABLE public.tiktok_accounts ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- videos já existia, garantir colunas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='storage_path') THEN
        ALTER TABLE public.videos ADD COLUMN storage_path TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='vezes_usada') THEN
        ALTER TABLE public.videos ADD COLUMN vezes_usada INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='user_id') THEN
        ALTER TABLE public.videos ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END $$;

-- Habilitar RLS e conceder privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_tracks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts_agendados TO authenticated;
GRANT ALL ON public.music_tracks TO service_role;
GRANT ALL ON public.campanhas TO service_role;
GRANT ALL ON public.posts_agendados TO service_role;

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts_agendados ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (usuário só vê o dele)
CREATE POLICY "Users manage their music_tracks" ON public.music_tracks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their campanhas" ON public.campanhas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their posts_agendados" ON public.posts_agendados FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Configurar políticas para os buckets de storage
CREATE POLICY "Authenticated users can upload music" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'musicas' AND (auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "Authenticated users can view their music" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'musicas');
CREATE POLICY "Authenticated users can upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos' AND (auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "Authenticated users can view their videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos');
