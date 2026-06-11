ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.videos ALTER COLUMN user_id DROP NOT NULL;