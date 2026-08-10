
CREATE TABLE IF NOT EXISTS public.campaign_social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(campaign_id, social_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_social_accounts TO authenticated;
GRANT ALL ON public.campaign_social_accounts TO service_role;

ALTER TABLE public.campaign_social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their campaign accounts"
ON public.campaign_social_accounts
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.campanhas c
        WHERE c.id = campaign_social_accounts.campaign_id
        AND c.user_id = auth.uid()
    )
);
