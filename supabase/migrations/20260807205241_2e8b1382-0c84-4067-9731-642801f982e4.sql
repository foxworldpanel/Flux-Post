-- 1. Tabela de Artistas
CREATE TABLE IF NOT EXISTS public.artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    photo_url TEXT,
    description TEXT,
    genre TEXT,
    priority_markets TEXT[],
    primary_language TEXT DEFAULT 'pt-BR',
    communication_identity TEXT,
    priority_hashtags TEXT[],
    blocked_hashtags TEXT[],
    ai_briefing TEXT,
    status TEXT DEFAULT 'active',
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artists TO authenticated;
GRANT ALL ON public.artists TO service_role;
GRANT SELECT ON public.artists TO anon;

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for now" ON public.artists FOR ALL TO public USING (true);

-- 2. Tabela de Biblioteca de Conteúdo (content_library)
CREATE TABLE IF NOT EXISTS public.content_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    niche TEXT,
    duration_seconds INTEGER,
    storage_path TEXT NOT NULL,
    thumbnail_url TEXT,
    source TEXT,
    original_url TEXT,
    author TEXT,
    license_info TEXT,
    category TEXT,
    tags TEXT[],
    orientation TEXT,
    status TEXT DEFAULT 'new',
    use_count INTEGER DEFAULT 0,
    first_used_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    performance_score FLOAT DEFAULT 0,
    artist_id UUID REFERENCES public.artists(id),
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_library TO authenticated;
GRANT ALL ON public.content_library TO service_role;
GRANT SELECT ON public.content_library TO anon;

ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for now" ON public.content_library FOR ALL TO public USING (true);

-- 3. Contas Sociais (social_accounts)
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    account_name TEXT,
    username TEXT NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    external_account_id TEXT,
    connection_metadata JSONB,
    posts_today INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
GRANT SELECT ON public.social_accounts TO anon;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for now" ON public.social_accounts FOR ALL TO public USING (true);

-- 4. Tabela de Publicações (publications)
CREATE TABLE IF NOT EXISTS public.publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campanhas(id),
    content_id UUID REFERENCES public.content_library(id),
    music_id UUID REFERENCES public.music_tracks(id),
    account_id UUID REFERENCES public.social_accounts(id),
    platform TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT[],
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status TEXT DEFAULT 'planned',
    post_url TEXT,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;
GRANT SELECT ON public.publications TO anon;

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for now" ON public.publications FOR ALL TO public USING (true);

-- 5. Tabela de Métricas (publication_metrics)
CREATE TABLE IF NOT EXISTS public.publication_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES public.publications(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    watch_time_total FLOAT,
    watch_time_avg FLOAT,
    collected_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_metrics TO authenticated;
GRANT ALL ON public.publication_metrics TO service_role;
GRANT SELECT ON public.publication_metrics TO anon;

ALTER TABLE public.publication_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for now" ON public.publication_metrics FOR ALL TO public USING (true);

-- 6. Evolução de Tabelas Existentes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='music_tracks' AND column_name='artist_id') THEN
        ALTER TABLE public.music_tracks ADD COLUMN artist_id UUID REFERENCES public.artists(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campanhas' AND column_name='artist_id') THEN
        ALTER TABLE public.campanhas ADD COLUMN artist_id UUID REFERENCES public.artists(id);
    END IF;
END $$;

-- 7. Artista Inicial
INSERT INTO public.artists (name, slug, genre, description)
VALUES ('Sourcee', 'sourcee', 'Eletrônico / Tech House', 'Artista principal do Flux Post e do label.')
ON CONFLICT (slug) DO NOTHING;
