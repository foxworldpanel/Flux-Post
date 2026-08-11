ALTER TABLE public.campanhas 
ADD COLUMN IF NOT EXISTS start_mode text DEFAULT 'period' CHECK (start_mode IN ('period', 'now')),
ADD COLUMN IF NOT EXISTS daily_start_time time DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS daily_end_time time DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS batch_interval_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS destination_interval_seconds integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo';

-- Ensure grants are correct for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;