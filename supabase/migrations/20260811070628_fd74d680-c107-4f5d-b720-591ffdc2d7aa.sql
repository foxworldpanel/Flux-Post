
-- Tentativa de Correção do Agendador (Recriação com sintaxe robusta)
-- Como o unschedule(1) falhou por permissão de tabela e o schedule falhou por transação read-only,
-- este comando serve para documentar a falha de escrita no ambiente de runtime atual.
SELECT cron.schedule(
  'flux-campaign-dispatcher-v2',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kdbgfgnopqqnzmvxvtje.supabase.co/functions/v1/campaign-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmdmZ25vcHFxbnptdnh2dGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzM1NjgsImV4cCI6MjA5Njc0OTU2OH0.wtEiWMZCaKi1S-KzRHLPWIhr5BVWN0uA8Q3dJFOK_7Q'
    ),
    body := jsonb_build_object('trigger', 'cron_fix_v2_canonical')
  );
  $$
);
