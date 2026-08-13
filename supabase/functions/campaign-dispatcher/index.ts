import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPATCHER_BUILD = "v10-canonical-fix";

serve(async (req) => {
  const startedAt = new Date().toISOString();
  const executionId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret !== "v4-dispatcher-secret-internal") {
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
    await supabaseAdmin
      .from("server_cron_state")
      .upsert({ 
        id: '00000000-0000-0000-0000-000000000001',
        last_run_at: startedAt,
        last_success_at: startedAt,
        executor_type: 'edge_function_dispatcher',
        last_error: null
      }, { onConflict: 'id' });

    // 2. Buscar publicações elegíveis
    const { data: publications, error: fetchError } = await supabaseAdmin
      .from("publications")
      .select("*")
      .in("status", ["agendado", "pending", "scheduled", "waiting_render"])
      .lte("scheduled_for", startedAt)
      .limit(10);

    if (fetchError) {
       return new Response(JSON.stringify({ error: "Fetch error: " + fetchError.message, details: fetchError }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let processedCount = 0;
    const results = [];

    for (const pub of (publications || [])) {
      if (pub.music_track_id) {
        const renderOptions = pub.render_options || {};
        const renderKey = renderOptions.render_key; 
        
        if (!renderKey) {
          console.error(`[campaign-dispatcher][${executionId}] Publicação ${pub.id} sem render_key!`);
          continue;
        }

        const { data: existingRender } = await supabaseAdmin
          .from("media_renders")
          .select("id, status")
          .eq("render_key", renderKey)
          .maybeSingle();

        if (existingRender?.status === "ready") {
          const { data: claimedPub } = await supabaseAdmin
            .from("publications")
            .update({ 
              status: 'ready_to_post',
              media_render_id: existingRender.id
            })
            .eq('id', pub.id)
            .select()
            .single();

          if (claimedPub) {
            processedCount++;
            results.push({ id: pub.id, status: 'ready_to_post' });
          }
        } else if (!existingRender) {
          // Criar media_render se não existir (backfill)
          const { data: newRender, error: renderError } = await supabaseAdmin
            .from("media_renders")
            .insert({
              user_id: pub.user_id,
              source_content_id: pub.content_id,
              music_track_id: pub.music_track_id,
              render_key: renderKey,
              render_options: renderOptions,
              status: 'queued',
              audio_mode: renderOptions.audioMode || 'music_plus_original',
              music_start_ms: renderOptions.musicStartMs || 0,
              music_volume: renderOptions.musicVolume || 80,
              original_audio_volume: renderOptions.originalAudioVolume || 20
            })
            .select()
            .single();

          if (newRender) {
            await supabaseAdmin
              .from("publications")
              .update({ status: 'waiting_render', media_render_id: newRender.id })
              .eq('id', pub.id);
            
            results.push({ id: pub.id, status: 'waiting_render', render_id: newRender.id });
          } else {
            console.error(`[campaign-dispatcher] Erro ao criar render para ${pub.id}:`, renderError);
          }
        } else {
          // Render existe mas não está ready (queued/processing/failed)
          await supabaseAdmin
            .from("publications")
            .update({ status: 'waiting_render', media_render_id: existingRender.id })
            .eq('id', pub.id);
          
          results.push({ id: pub.id, status: 'waiting_render', render_id: existingRender.id });
        }
      }
    }

    console.log(`[campaign-dispatcher][${executionId}] Ciclo finalizado. Processados: ${processedCount}/${publications?.length || 0}`);

    return new Response(JSON.stringify({ 
      status: "ok", 
      executionId, 
      processed: processedCount, 
      total: publications?.length || 0,
      results
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error(`[campaign-dispatcher][${executionId}] Fatal Error:`, err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
