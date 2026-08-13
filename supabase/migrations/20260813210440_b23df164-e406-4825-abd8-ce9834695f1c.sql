
ALTER TABLE public.publications 
DROP CONSTRAINT IF EXISTS publications_campaign_id_fkey;

ALTER TABLE public.publications 
ADD CONSTRAINT publications_campaign_id_fkey 
FOREIGN KEY (campaign_id) 
REFERENCES campanhas(id) 
ON DELETE CASCADE;

-- Also check posts_agendados just in case (audit said it has cascade, but let's be sure)
ALTER TABLE public.posts_agendados 
DROP CONSTRAINT IF EXISTS posts_agendados_campanha_id_fkey;

ALTER TABLE public.posts_agendados 
ADD CONSTRAINT posts_agendados_campanha_id_fkey 
FOREIGN KEY (campanha_id) 
REFERENCES campanhas(id) 
ON DELETE CASCADE;
