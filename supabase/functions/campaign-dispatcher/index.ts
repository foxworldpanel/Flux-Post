
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
      
      // Também rodar o Sync de posts se não houver despacho pendente
      await supabaseAdmin.functions.invoke("postpeer-post-sync", {
        headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }
      });

      return new Response(JSON.stringify({ message: "No publications to dispatch, sync invoked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[campaign-dispatcher] Encontradas ${publications.length} publicações para processar.`);

    const results = [];

    for (const pub of publications) {
      try {
        console.log(`[campaign-dispatcher] Analisando pub ${pub.id}...`);

        // A. Verificar se precisa de render
        // Se a campanha tem música e o audio_mode não é 'only_original', precisa de render
        const needsRender = pub.music_track_id !== null;

        if (needsRender) {
          // Tentar encontrar render READY usando a render_key se disponível ou as opções
          // Nota: render_options deve ser populado pelo engine no momento do agendamento
          const options = pub.render_options || {};
          
          // Se não temos render_key, não conseguimos cachear server-side ainda sem lógica de hash aqui
          // Por agora, o dispatcher falha se não houver render pronto e for automático
          // pois o FFmpeg ainda é client-side.
          
          const { data: render } = await supabaseAdmin
            .from("media_renders")
            .select("id, status, storage_path, render_key")
            .eq("source_content_id", pub.content_id)
            .eq("music_track_id", pub.music_track_id)
            .eq("status", "ready")
            .maybeSingle();

          if (!render) {
             console.log(`[campaign-dispatcher] Pub ${pub.id} aguardando render server-side (PENDENTE).`);
             // Não marcamos como falha, apenas pulamos até que o render esteja pronto
             // Em v4.0, aqui dispararíamos o Render Worker Server-Side
             results.push({ id: pub.id, status: 'waiting_render' });
             continue;
          }

          // Se achou render, garantir que a publicação está vinculada
          await supabaseAdmin
            .from("publications")
            .update({ media_render_id: render.id })
            .eq("id", pub.id);
          console.log(`[campaign-dispatcher] Pub ${pub.id} vinculada ao render READY ${render.id}.`);
        }

        // B. Marcar como 'publishing' usando claim atômico
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

        // C. Verificar idempotência se já existe post externo
        if (pub.provider_post_id) {
          console.log(`[campaign-dispatcher] Pub ${pub.id} já possui ID externo. Marcando como pronto.`);
          await supabaseAdmin.from("publications").update({ status: 'ready' }).eq("id", pub.id);
          continue;
        }

        // C. Chamar a Edge Function de criação de post no PostPeer
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

    // 3. Atualizar estado do cron para auditoria REAL
    // Usamos um ID fixo ou singleton para o dispatcher principal
    const { error: upsertError } = await supabaseAdmin
      .from("server_cron_state")
      .upsert({ 
        id: '00000000-0000-0000-0000-000000000001', // UUID fixo para o motor principal
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        processed_count: publications.length,
        executor_type: 'edge_function_dispatcher'
      }, { onConflict: 'id' });

    if (upsertError) console.error("[campaign-dispatcher] Erro ao atualizar server_cron_state:", upsertError.message);

    return new Response(JSON.stringify({ processed: publications.length, results }), {
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

