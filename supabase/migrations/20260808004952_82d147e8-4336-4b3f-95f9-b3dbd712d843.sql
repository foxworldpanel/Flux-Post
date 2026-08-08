-- FASE 2.2 - GARIMPO AUTOMÁTICO E ESTOQUE INTELIGENTE

-- 1. Configurações gerais do Garimpo
CREATE TABLE IF NOT EXISTS public.content_discovery_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_active boolean DEFAULT false,
    target_stock integer DEFAULT 100,
    max_per_execution integer DEFAULT 20,
    default_orientation text DEFAULT 'portrait' CHECK (default_orientation IN ('portrait', 'landscape', 'square', 'all')),
    min_duration integer DEFAULT 5,
    max_duration integer DEFAULT 60,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Categorias e Metas de Descoberta
CREATE TABLE IF NOT EXISTS public.content_discovery_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    target_count integer DEFAULT 0,
    search_terms text[] DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, name)
);

-- 3. Fila de Candidatos (Conteúdo encontrado mas não importado)
CREATE TABLE IF NOT EXISTS public.content_candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source text NOT NULL DEFAULT 'pexels',
    external_id text NOT NULL,
    original_url text,
    preview_url text,
    author text,
    category text,
    search_term text,
    duration integer,
    width integer,
    height integer,
    orientation text,
    metadata jsonb DEFAULT '{}',
    status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovando', 'aprovado', 'descartado', 'expirado')),
    discovered_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    UNIQUE(user_id, source, external_id)
);

-- 4. RLS e Permissões
ALTER TABLE public.content_discovery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_discovery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_candidates ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.content_discovery_settings TO authenticated;
GRANT ALL ON public.content_discovery_categories TO authenticated;
GRANT ALL ON public.content_candidates TO authenticated;

GRANT ALL ON public.content_discovery_settings TO service_role;
GRANT ALL ON public.content_discovery_categories TO service_role;
GRANT ALL ON public.content_candidates TO service_role;

-- Policies
CREATE POLICY "Users can manage their own discovery settings"
    ON public.content_discovery_settings
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own discovery categories"
    ON public.content_discovery_categories
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own candidates"
    ON public.content_candidates
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS content_candidates_user_id_status_idx ON public.content_candidates(user_id, status);
CREATE INDEX IF NOT EXISTS content_discovery_categories_user_id_idx ON public.content_discovery_categories(user_id);
CREATE INDEX IF NOT EXISTS content_candidates_external_id_idx ON public.content_candidates(external_id);
