DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'content_discovery_categories_user_id_name_key'
    ) THEN
        ALTER TABLE public.content_discovery_categories ADD CONSTRAINT content_discovery_categories_user_id_name_key UNIQUE (user_id, name);
    END IF;
END $$;

GRANT ALL ON public.content_discovery_settings TO authenticated;
GRANT ALL ON public.content_discovery_settings TO service_role;
GRANT ALL ON public.content_discovery_categories TO authenticated;
GRANT ALL ON public.content_discovery_categories TO service_role;
GRANT ALL ON public.content_candidates TO authenticated;
GRANT ALL ON public.content_candidates TO service_role;

ALTER TABLE public.content_discovery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_discovery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_candidates ENABLE ROW LEVEL SECURITY;