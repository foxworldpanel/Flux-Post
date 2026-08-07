-- FASE 1.3: Tabela de Conteúdos da Campanha
CREATE TABLE IF NOT EXISTS public.campaign_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campanhas(id) ON DELETE CASCADE NOT NULL,
    content_id UUID REFERENCES public.content_library(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(campaign_id, content_id)
);

-- Habilitar RLS
ALTER TABLE public.campaign_contents ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para campaign_contents
-- Usuário só pode gerenciar relações de suas próprias campanhas com seus próprios conteúdos
CREATE POLICY "Users can manage their own campaign_contents"
ON public.campaign_contents
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campanhas c
        WHERE c.id = campaign_contents.campaign_id
        AND c.user_id = auth.uid()
    )
    AND
    EXISTS (
        SELECT 1 FROM public.content_library cl
        WHERE cl.id = campaign_contents.content_id
        AND cl.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.campanhas c
        WHERE c.id = campaign_contents.campaign_id
        AND c.user_id = auth.uid()
    )
    AND
    EXISTS (
        SELECT 1 FROM public.content_library cl
        WHERE cl.id = campaign_contents.content_id
        AND cl.user_id = auth.uid()
    )
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_contents TO authenticated;
GRANT ALL ON public.campaign_contents TO service_role;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_campaign_contents_campaign_id ON public.campaign_contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contents_content_id ON public.campaign_contents(content_id);
