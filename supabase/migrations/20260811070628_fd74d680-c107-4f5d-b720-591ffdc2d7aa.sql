
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
      'Authorization', 'Bearer <REDACTED_ANON_KEY>'
    ),
    body := jsonb_build_object('trigger', 'cron_fix_v2_canonical')
  );
  $$
);
