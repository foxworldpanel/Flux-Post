
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    // Em produção, este valor estaria no Supabase Vault ou Secret da Function.
    // Usando o valor literal definido no cron.command para esta fase de auditoria.
    if (cronSecret !== "v4-dispatcher-secret-internal") {
      console.error("[campaign-dispatcher] Unauthorized: Invalid X-Cron-Secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );


    console.log("[campaign-dispatcher] Iniciando ciclo de despacho...");

    // 1. Reconciliação de Renders (Watchdog)
    // Marcar como FAILED renders que estão em PROCESSING há mais de 1 hora
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    await supabaseAdmin
      .from("media_renders")
      .update({ status: 'failed', error_message: 'Render timeout (1h watchdog)' })
      .eq("status", "processing")
      .lt("started_at", oneHourAgo);

    // 2. Buscar publicações vencidas (scheduled_for <= NOW) que ainda não foram enviadas
    // Status canônicos: 'agendado', 'pending', 'scheduled'
    const { data: publications, error: fetchError } = await supabaseAdmin
      .from("publications")
      .select(`
        id, 
        campaign_id, 
        user_id, 
        status, 
        scheduled_for,
        content_id,
        music_track_id,
        render_options
      `)
      .in("status", ["agendado", "pending", "scheduled"])
      .lte("scheduled_for", new Date().toISOString())
      .limit(10); 

    if (fetchError) throw fetchError;

    if (!publications || publications.length === 0) {
      console.log("[campaign-dispatcher] Nenhuma publicação pendente encontrada.");
      
      try {
        await supabaseAdmin.functions.invoke("postpeer-post-sync", {
          headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }
        });
      } catch (syncErr) {
        console.warn("[campaign-dispatcher] Sync warning:", syncErr.message);
      }
    } else {
      console.log(`[campaign-dispatcher] Encontradas ${publications.length} publicações para processar.`);

      for (const pub of publications) {
        try {
          console.log(`[campaign-dispatcher] Analisando pub ${pub.id}...`);

          const needsRender = pub.music_track_id !== null;

          if (needsRender) {
            const { data: render } = await supabaseAdmin
              .from("media_renders")
              .select("id, status, storage_path, render_key")
              .eq("source_content_id", pub.content_id)
              .eq("music_track_id", pub.music_track_id)
              .eq("status", "ready")
              .maybeSingle();

            if (!render) {
               console.log(`[campaign-dispatcher] Pub ${pub.id} aguardando render server-side (PENDENTE).`);
               results.push({ id: pub.id, status: 'waiting_render' });
               continue;
            }

            await supabaseAdmin
              .from("publications")
              .update({ media_render_id: render.id })
              .eq("id", pub.id);
            console.log(`[campaign-dispatcher] Pub ${pub.id} vinculada ao render READY ${render.id}.`);
          }

          const { data: claimedPub, error: lockError } = await supabaseAdmin
            .from("publications")
            .update({ 
              status: 'publishing', 
              updated_at: new Date().toISOString(),
              metadata: { ...pub.metadata, dispatcher_claim_at: new Date().toISOString() } 
            })
            .eq("id", pub.id)
            .in("status", ["agendado", "pending", "scheduled"])
            .select()
            .single();

          if (lockError || !claimedPub) {
            console.warn(`[campaign-dispatcher] Falha ao adquirir lock para ${pub.id} (Já em processamento por outro worker).`);
            continue;
          }

          if (pub.provider_post_id) {
            console.log(`[campaign-dispatcher] Pub ${pub.id} já possui ID externo. Marcando como pronto.`);
            await supabaseAdmin.from("publications").update({ status: 'ready' }).eq("id", pub.id);
            continue;
          }

          const { data: invokeData, error: invokeError } = await supabaseAdmin.functions.invoke("postpeer-post-create", {
            body: { publicationId: pub.id },
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            }
          });

          if (invokeError) {
            console.error(`[campaign-dispatcher] Erro ao invocar postpeer-post-create para ${pub.id}:`, invokeError.message);
            await supabaseAdmin.from("publications").update({
              status: 'failed',
              last_error: `Dispatcher Invoke Error: ${invokeError.message}`,
              updated_at: new Date().toISOString()
            }).eq("id", pub.id);
            results.push({ id: pub.id, success: false, error: invokeError.message });
          } else {
            console.log(`[campaign-dispatcher] Pub ${pub.id} despachada com sucesso.`);
            results.push({ id: pub.id, success: true, data: invokeData });
          }
        } catch (pubErr: any) {
          console.error(`[campaign-dispatcher] Erro crítico na pub ${pub.id}:`, pubErr.message);
          results.push({ id: pub.id, success: false, error: pubErr.message });
        }
      }
    }

    const { error: upsertError } = await supabaseAdmin
      .from("server_cron_state")
      .upsert({ 
        id: '00000000-0000-0000-0000-000000000001',
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        processed_count: publications?.length || 0,
        executor_type: 'edge_function_dispatcher',
        last_error: null
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error(`[campaign-dispatcher] CRITICAL: Health Upsert Error: ${upsertError.code} - ${upsertError.message}`);
      return new Response(JSON.stringify({ 
        error: "Health update failed", 
        db_error: upsertError 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("[campaign-dispatcher] Ciclo finalizado com sucesso.");
    return new Response(JSON.stringify({ 
      processed: publications?.length || 0, 
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[campaign-dispatcher] Fatal Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

