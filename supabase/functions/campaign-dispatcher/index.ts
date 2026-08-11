import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPATCHER_BUILD = "v6-full-pipeline";

serve(async (req) => {
  const startedAt = new Date().toISOString();
  const executionId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret !== "v4-dispatcher-secret-internal") {
      console.error(`[campaign-dispatcher] Unauthorized: Invalid X-Cron-Secret.`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[campaign-dispatcher][${executionId}] Iniciando ciclo ${DISPATCHER_BUILD}...`);

    // 1. Health Update (Atômico)
    const { error: healthError } = await supabaseAdmin
      .from("server_cron_state")
      .upsert({ 
        id: '00000000-0000-0000-0000-000000000001',
        last_run_at: startedAt,
        last_success_at: startedAt,
        executor_type: 'edge_function_dispatcher',
        last_error: null
      }, { onConflict: 'id' });

    if (healthError) {
      console.error("[campaign-dispatcher] Erro ao atualizar health:", healthError);
    }

    // 2. Buscar publicações elegíveis
    // Status canônicos: agendado, pending, scheduled
    const { data: publications, error: fetchError } = await supabaseAdmin
      .from("publications")
      .select(`
        *,
        social_accounts (
          id,
          platform,
          provider_connection_id,
          username
        )
      `)
      .in("status", ["agendado", "pending", "scheduled"])
      .lte("scheduled_for", startedAt)
      .order("scheduled_for", { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    let processedCount = 0;
    const results = [];

    for (const pub of (publications || [])) {
      console.log(`[campaign-dispatcher] Processando publicação ${pub.id}...`);
      
      // 3. Claim Atômico
      const { data: claimedPub, error: claimError } = await supabaseAdmin
        .from("publications")
        .update({ 
          status: 'publishing',
          metadata: { 
            ...(pub.metadata || {}), 
            dispatcher_claim_at: new Date().toISOString(),
            execution_id: executionId
          }
        })
        .eq("id", pub.id)
        .in("status", ["agendado", "pending", "scheduled"])
        .select()
        .single();

      if (claimError || !claimedPub) {
        console.log(`[campaign-dispatcher] Falha ao dar claim na publicação ${pub.id} (provavelmente já processada).`);
        continue;
      }

      // 4. Lógica de Render
      if (pub.music_track_id) {
        console.log(`[campaign-dispatcher] Publicação ${pub.id} requer render.`);
        
        // Verificar se já existe render pronto (CACHE HIT)
        const renderKey = pub.render_options?.render_key || 
          `${pub.content_id}_${pub.music_track_id}_${pub.render_options?.musicStartMs || 0}`;

        const { data: existingRender } = await supabaseAdmin
          .from("media_renders")
          .select("id, status, storage_path, render_key")
          .eq("render_key", renderKey)
          .eq("status", "ready")
          .maybeSingle();

        if (existingRender) {
          console.log(`[campaign-dispatcher] Cache hit para render: ${existingRender.id}`);
          await supabaseAdmin
            .from("publications")
            .update({ 
              media_render_id: existingRender.id,
              status: 'ready_to_publish' 
            })
            .eq("id", pub.id);
          results.push({ id: pub.id, status: 'ready_to_publish', cache: true });
          processedCount++;
          continue;
        }

        // Criar job de render se não existir nenhum em andamento
        const { data: pendingRender } = await supabaseAdmin
          .from("media_renders")
          .select("id, status")
          .eq("render_key", renderKey)
          .in("status", ["queued", "processing"])
          .maybeSingle();

        if (!pendingRender) {
          console.log(`[campaign-dispatcher] Criando novo job de render para key ${renderKey}`);
          const { data: newRender } = await supabaseAdmin
            .from("media_renders")
            .insert({
              user_id: pub.user_id,
              render_key: renderKey,
              source_content_id: pub.content_id,
              music_track_id: pub.music_track_id,
              status: 'queued',
              audio_mode: pub.render_options?.audioMode || 'music_plus_original',
              music_volume: pub.render_options?.musicVolume || 100,
              original_audio_volume: pub.render_options?.originalAudioVolume || 20,
              music_start_ms: pub.render_options?.musicStartMs || 0
            })
            .select()
            .single();
          
          if (newRender) {
             await supabaseAdmin
              .from("publications")
              .update({ media_render_id: newRender.id, status: 'waiting_render' })
              .eq("id", pub.id);
          }
        } else {
          await supabaseAdmin
            .from("publications")
            .update({ media_render_id: pendingRender.id, status: 'waiting_render' })
            .eq("id", pub.id);
        }
        
        results.push({ id: pub.id, status: 'waiting_render' });
        processedCount++;
        continue;
      }

      // 5. Enviar para PostPeer (Simulado nesta auditoria - apenas logs)
      console.log(`[campaign-dispatcher] Publicação ${pub.id} pronta para PostPeer (sem música).`);
      // Aqui entraria a chamada ao PostPeer futuramente
      results.push({ id: pub.id, status: 'ready_to_publish_manual_trigger_next' });
      processedCount++;
    }

    // Atualizar processed_count no final
    if (processedCount > 0) {
      await supabaseAdmin
        .from("server_cron_state")
        .update({ processed_count: processedCount })
        .eq("id", '00000000-0000-0000-0000-000000000001');
    }

    return new Response(JSON.stringify({ 
      build: DISPATCHER_BUILD,
      execution_id: executionId,
      queue_size: publications?.length || 0,
      processed_count: processedCount,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[campaign-dispatcher] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});