
-- Attempt to rename account_id to social_account_id if it exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'publications' AND column_name = 'account_id') THEN
    ALTER TABLE public.publications RENAME COLUMN account_id TO social_account_id;
  END IF;
END $$;

-- Ensure FK exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_publications_social_account') THEN
    ALTER TABLE public.publications 
      ADD CONSTRAINT fk_publications_social_account 
      FOREIGN KEY (social_account_id) 
      REFERENCES public.social_accounts(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'publications' AND column_name = 'social_account_id';
