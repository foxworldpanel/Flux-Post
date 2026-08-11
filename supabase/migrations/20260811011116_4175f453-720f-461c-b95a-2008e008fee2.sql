
-- 1. Função para preencher platform automaticamente
CREATE OR REPLACE FUNCTION public.fill_publication_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    -- Resolve platform a partir da social_account se não fornecida
    IF NEW.platform IS NULL AND NEW.social_account_id IS NOT NULL THEN
        SELECT platform INTO NEW.platform 
        FROM public.social_accounts 
        WHERE id = NEW.social_account_id;
    END IF;
    
    -- Resolve user_id da campanha se não fornecido (segurança extra)
    IF NEW.user_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
        SELECT user_id INTO NEW.user_id 
        FROM public.campanhas 
        WHERE id = NEW.campaign_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger
DROP TRIGGER IF EXISTS tr_fill_publication_snapshot ON public.publications;
CREATE TRIGGER tr_fill_publication_snapshot
BEFORE INSERT ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.fill_publication_snapshot();

-- 3. Preencher registros existentes que por acaso estejam sem platform (se houver)
UPDATE public.publications p
SET platform = s.platform
FROM public.social_accounts s
WHERE p.social_account_id = s.id AND p.platform IS NULL;

-- 4. Re-ativar a constraint NOT NULL agora que temos o trigger garantindo o valor
-- Isso garante que a coluna nunca seja nula no disco, mantendo a integridade snapshot.
ALTER TABLE public.publications ALTER COLUMN platform SET NOT NULL;
