
-- Remove legacy job
SELECT cron.unschedule('flux-campaign-dispatcher-v2');

-- Schedule new job without hardcoded JWT
SELECT cron.schedule(
  'flux-campaign-dispatcher-v2',
  '* * * * *',
  'SELECT net.http_post(
    url := ''https://kdbgfgnopqqnzmvxvtje.supabase.co/functions/v1/campaign-dispatcher'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''X-Cron-Secret'', ''v4-dispatcher-secret-internal''
    ),
    body := jsonb_build_object(''trigger'', ''cron_v3_secure_audit'')
  );'
);

-- Audit
SELECT jobid, jobname, command FROM cron.job;
