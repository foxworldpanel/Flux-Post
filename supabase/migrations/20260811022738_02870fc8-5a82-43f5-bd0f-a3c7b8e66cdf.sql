-- Tentar agendar o cron job novamente usando uma sintaxe SQL mais direta e robusta para o corpo do comando
-- O erro anterior sugeria falha de sintaxe no corpo do SELECT dentro do cron.schedule

SELECT cron.schedule(
  'flux-campaign-dispatcher-v2',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://kdbgfgnopqqnzmvxvtje.supabase.co/functions/v1/campaign-dispatcher',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
