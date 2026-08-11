import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPATCHER_BUILD = "health-v5-debug";

serve(async (req) => {
  const startedAt = new Date().toISOString();
  const executionId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret !== "v4-dispatcher-secret-internal") {
      console.error(`[campaign-dispatcher] Unauthorized: Invalid X-Cron-Secret. Received: ${cronSecret}`);
      return new Response(JSON.stringify({ 
        error: "Unauthorized",
        build: DISPATCHER_BUILD,
        execution_id: executionId
      }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Extrair Project Ref
    const runtimeProjectRef = new URL(supabaseUrl).hostname.split('.')[0];

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[campaign-dispatcher][${executionId}] Iniciando ciclo ${DISPATCHER_BUILD}...`);

    let healthWriteAttempted = false;
    let healthWriteSuccess = false;
    let upsertErrorData = null;
    let upsertReturnedRow = null;
    let healthReadbackAt = null;

    // 5. TESTAR O WRITE DIRETAMENTE NO INÍCIO
    healthWriteAttempted = true;
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from("server_cron_state")
      .upsert({ 
        id: '00000000-0000-0000-0000-000000000001',
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        processed_count: 0, // Será atualizado no final se houver pubs
        executor_type: 'edge_function_dispatcher',
        last_error: null
      }, { onConflict: 'id' })
      .select('last_run_at')
      .single();

    if (upsertError) {
      upsertErrorData = { code: upsertError.code, message: upsertError.message };
    } else {
      healthWriteSuccess = !!upsertData;
      upsertReturnedRow = upsertData;
    }

    // 6. READ-AFTER-WRITE
    const { data: readbackData } = await supabaseAdmin
      .from("server_cron_state")
      .select("last_run_at")
      .eq("id", '00000000-0000-0000-0000-000000000001')
      .single();
    
    healthReadbackAt = readbackData?.last_run_at;

    // 8. NÃO MASCARAR FALHA (Para Auditoria V5)
    if (upsertError || !upsertReturnedRow || !healthReadbackAt) {
        return new Response(JSON.stringify({
            build: DISPATCHER_BUILD,
            execution_id: executionId,
            runtime_project_ref: runtimeProjectRef,
            health_write_attempted: true,
            health_write_success: false,
            upsert_error: upsertErrorData,
            upsert_returned_row: !!upsertReturnedRow,
            health_written_at: upsertReturnedRow?.last_run_at,
            health_readback_at: healthReadbackAt,
            status: "FAILED_HEALTH_PERSISTENCE"
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // Processamento normal (resumido para debug)
    const { data: publications } = await supabaseAdmin
      .from("publications")
      .select("id")
      .in("status", ["agendado", "pending", "scheduled"])
      .lte("scheduled_for", new Date().toISOString())
      .limit(1);

    const finishedAt = new Date().toISOString();

    return new Response(JSON.stringify({ 
      build: DISPATCHER_BUILD,
      execution_id: executionId,
      started_at: startedAt,
      finished_at: finishedAt,
      runtime_project_ref: runtimeProjectRef,
      queue_size: publications?.length || 0,
      processed_count: 0, // V5-debug foca em health
      health_write_attempted: true,
      health_write_success: true,
      upsert_error: null,
      upsert_returned_row: true,
      health_written_at: upsertReturnedRow?.last_run_at,
      health_readback_at: healthReadbackAt
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
        error: err.message,
        build: DISPATCHER_BUILD,
        execution_id: executionId
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
