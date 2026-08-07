-- 1. Remover acesso direto do papel anon às novas tabelas
REVOKE ALL ON TABLE public.artists FROM anon;
REVOKE ALL ON TABLE public.content_library FROM anon;
REVOKE ALL ON TABLE public.social_accounts FROM anon;
REVOKE ALL ON TABLE public.publications FROM anon;
REVOKE ALL ON TABLE public.publication_metrics FROM anon;

-- 2. Remover policies permissivas
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN 
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND policyname = 'Allow all access for now'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, policy_record.tablename);
    END LOOP;
END $$;

-- 3. Habilitar RLS em todas as tabelas (garantindo que esteja ON)
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_metrics ENABLE ROW LEVEL SECURITY;

-- 4. Criar novas policies restritivas baseadas em user_id

-- ARTISTS
CREATE POLICY "Users can manage their own artists"
ON public.artists
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- CONTENT_LIBRARY
CREATE POLICY "Users can manage their own content_library"
ON public.content_library
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- SOCIAL_ACCOUNTS
CREATE POLICY "Users can manage their own social_accounts"
ON public.social_accounts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- PUBLICATIONS
CREATE POLICY "Users can manage their own publications"
ON public.publications
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- PUBLICATION_METRICS (Baseado na publication relacionada)
CREATE POLICY "Users can view metrics of their publications"
ON public.publication_metrics
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.publications p
        WHERE p.id = publication_metrics.publication_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert metrics for their publications"
ON public.publication_metrics
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.publications p
        WHERE p.id = publication_metrics.publication_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update/delete metrics of their publications"
ON public.publication_metrics
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.publications p
        WHERE p.id = publication_metrics.publication_id
        AND p.user_id = auth.uid()
    )
);

-- 5. Grants para Authenticated e Service Role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artists TO authenticated;
GRANT ALL ON public.artists TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_library TO authenticated;
GRANT ALL ON public.content_library TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_metrics TO authenticated;
GRANT ALL ON public.publication_metrics TO service_role;

-- 6. Índices em Foreign Keys
CREATE INDEX IF NOT EXISTS idx_music_tracks_artist_id ON public.music_tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_artist_id ON public.campanhas(artist_id);
CREATE INDEX IF NOT EXISTS idx_content_library_artist_id ON public.content_library(artist_id);
CREATE INDEX IF NOT EXISTS idx_publications_campaign_id ON public.publications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_publications_content_id ON public.publications(content_id);
CREATE INDEX IF NOT EXISTS idx_publications_music_id ON public.publications(music_id);
CREATE INDEX IF NOT EXISTS idx_publications_account_id ON public.publications(account_id);
CREATE INDEX IF NOT EXISTS idx_publication_metrics_publication_id ON public.publication_metrics(publication_id);
CREATE INDEX IF NOT EXISTS idx_publication_metrics_collected_at ON public.publication_metrics(collected_at);
