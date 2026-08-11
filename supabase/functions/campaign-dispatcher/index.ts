import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPATCHER_BUILD = "v7-render-handoff";

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

    // 1. Health Update
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
      .in("status", ["agendado", "pending", "scheduled", "waiting_render"])
      .lte("scheduled_for", startedAt)
      .order("scheduled_for", { ascending: true })
      .limit(20);

    if (fetchError) throw fetchError;

    let processedCount = 0;
    const results = [];

    for (const pub of (publications || [])) {
      console.log(`[campaign-dispatcher] Processando publicação ${pub.id} (status: ${pub.status})...`);
      
      // Lógica de Render
      if (pub.music_track_id) {
        // Calcular render_key determinística
        const renderOptions = pub.render_options || {};
        const renderKey = renderOptions.render_key || 
          `${pub.content_id}_${pub.music_track_id}_${renderOptions.musicStartMs || 0}_${renderOptions.audioMode || 'default'}`;

        console.log(`[campaign-dispatcher] Render key para ${pub.id}: ${renderKey}`);

        // 1. Verificar se o render já está pronto (CACHE HIT)
        const { data: existingRender, error: renderLookupError } = await supabaseAdmin
          .from("media_renders")
          .select("id, status, storage_path")
          .eq("render_key", renderKey)
          .maybeSingle();

        if (renderLookupError) {
          console.error(`[campaign-dispatcher] Erro ao buscar render para key ${renderKey}:`, renderLookupError);
          continue;
        }

        // Se o render já está pronto, faz o handoff para publicação
        if (existingRender?.status === "ready") {
          console.log(`[campaign-dispatcher] Cache hit (READY) para render: ${existingRender.id}`);
          
          // Claim atômico para transição para publicação
          const { data: claimedPub } = await supabaseAdmin
            .from("publications")
            .update({ 
              status: 'ready_to_publish',
              media_render_id: existingRender.id,
              metadata: { 
                ...(pub.metadata || {}), 
                dispatcher_claim_at: new Date().toISOString(),
                execution_id: executionId
              }
            })
            .eq("id", pub.id)
            .in("status", ["agendado", "pending", "scheduled", "waiting_render"])
            .select()
            .single();

          if (claimedPub) {
            results.push({ id: pub.id, status: 'ready_to_publish', cache: true });
            processedCount++;
            continue;
          }
        }

        // Se o render está em processamento, apenas vincula e mantém em waiting_render
        if (existingRender && ["queued", "processing", "pending"].includes(existingRender.status)) {
          console.log(`[campaign-dispatcher] Render em andamento: ${existingRender.id} (${existingRender.status})`);
          if (pub.media_render_id !== existingRender.id || pub.status !== 'waiting_render') {
             await supabaseAdmin
              .from("publications")
              .update({ 
                media_render_id: existingRender.id, 
                status: 'waiting_render' 
              })
              .eq("id", pub.id);
          }
          results.push({ id: pub.id, status: 'waiting_render', render_id: existingRender.id });
          processedCount++;
          continue;
        }

        // Se não existe render, tenta criar UM (concorrência tratada pela constraint UNIQUE no banco)
        if (!existingRender) {
          console.log(`[campaign-dispatcher] Criando novo job de render para key ${renderKey}`);
          const { data: newRender, error: insertError } = await supabaseAdmin
            .from("media_renders")
            .insert({
              user_id: pub.user_id,
              render_key: renderKey,
              source_content_id: pub.content_id,
              music_track_id: pub.music_track_id,
              status: 'queued',
              audio_mode: renderOptions.audioMode || 'music_plus_original',
              music_volume: renderOptions.musicVolume || 100,
              original_audio_volume: renderOptions.originalAudioVolume || 20,
              music_start_ms: renderOptions.musicStartMs || 0
            })
            .select()
            .single();

          if (insertError) {
            // Se falhou por conflito de render_key (concorrência), busca o que o concorrente criou
            if (insertError.code === "23505") {
               const { data: racedRender } = await supabaseAdmin
                .from("media_renders")
                .select("id, status")
                .eq("render_key", renderKey)
                .single();
               
               if (racedRender) {
                 await supabaseAdmin
                  .from("publications")
                  .update({ media_render_id: racedRender.id, status: 'waiting_render' })
                  .eq("id", pub.id);
                 results.push({ id: pub.id, status: 'waiting_render', render_id: racedRender.id, raced: true });
                 processedCount++;
                 continue;
               }
            }
            console.error(`[campaign-dispatcher] Erro ao criar render job:`, insertError);
            continue;
          }

          if (newRender) {
            await supabaseAdmin
              .from("publications")
              .update({ media_render_id: newRender.id, status: 'waiting_render' })
              .eq("id", pub.id);
            results.push({ id: pub.id, status: 'waiting_render', render_id: newRender.id, created: true });
            processedCount++;
            continue;
          }
        }
      } else {
        // Publicações sem música: Claim direto para pronto para publicar
        const { data: claimedPub } = await supabaseAdmin
          .from("publications")
          .update({ 
            status: 'ready_to_publish',
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

        if (claimedPub) {
          results.push({ id: pub.id, status: 'ready_to_publish' });
          processedCount++;
        }
      }
    }

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