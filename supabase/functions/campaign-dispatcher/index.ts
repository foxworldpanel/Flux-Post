import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPATCHER_BUILD = "v9-manual-debug";

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

    // 2. Buscar publicações elegíveis usando query simples
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
        const renderKey = renderOptions.render_key || 
          `${pub.content_id}_${pub.music_track_id}_${renderOptions.musicStartMs || 0}_${renderOptions.audioMode || 'default'}`;

        const { data: existingRender } = await supabaseAdmin
          .from("media_renders")
          .select("id, status")
          .eq("render_key", renderKey)
          .maybeSingle();

        if (existingRender?.status === "ready") {
          const { data: claimedPub } = await supabaseAdmin
            .from("publications")
            .update({ 
              status: 'ready_to_publish',
              media_render_id: existingRender.id
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

        if (existingRender && ["queued", "processing", "pending"].includes(existingRender.status)) {
           await supabaseAdmin
            .from("publications")
            .update({ 
              media_render_id: existingRender.id, 
              status: 'waiting_render' 
            })
            .eq("id", pub.id);
          results.push({ id: pub.id, status: 'waiting_render', render_id: existingRender.id });
          processedCount++;
          continue;
        }

        if (!existingRender) {
          const { data: newRender, error: insertError } = await supabaseAdmin
            .from("media_renders")
            .insert({
              user_id: pub.user_id,
              render_key: renderKey,
              source_content_id: pub.content_id,
              music_track_id: pub.music_track_id,
              status: 'queued'
            })
            .select()
            .single();

          if (!insertError && newRender) {
            await supabaseAdmin
              .from("publications")
              .update({ media_render_id: newRender.id, status: 'waiting_render' })
              .eq("id", pub.id);
            results.push({ id: pub.id, status: 'waiting_render', render_id: newRender.id, created: true });
            processedCount++;
            continue;
          }
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
      queue_size: publications?.length || 0,
      processed_count: processedCount,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});