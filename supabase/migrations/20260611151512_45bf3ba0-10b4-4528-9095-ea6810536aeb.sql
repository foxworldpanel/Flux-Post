ALTER TABLE public.music_tracks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.videos ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.tiktok_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.campanhas ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.posts_agendados ALTER COLUMN user_id DROP NOT NULL;
