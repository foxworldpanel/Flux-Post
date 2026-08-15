-- MIGRATION CORRETIVA: ATUALIZAR URLs DO DISPATCHER PARA O PROJETO CORRETO
-- Esta migration corrige referências hardcoded ao projeto antigo no pg_cron.

DO $$
BEGIN
    -- Remove o job antigo
    PERFORM cron.unschedule('flux-campaign-dispatcher-v2');
    
    -- Agenda o novo job com a URL correta
    PERFORM cron.schedule(
      'flux-campaign-dispatcher-v2',
      '* * * * *',
      'SELECT net.http_post(
        url := ''https://yfdbsjdhntajsddvlcsc.supabase.co/functions/v1/campaign-dispatcher'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''X-Cron-Secret'', ''v4-dispatcher-secret-internal''
        ),
        body := jsonb_build_object(''trigger'', ''cron_v3_secure_audit'')
      );'
    );
END $$;
