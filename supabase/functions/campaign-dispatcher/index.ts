import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DISPATCHER_BUILD = "v12-atomic-claim";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  const startedAt = new Date().toISOString();
  const executionId = crypto.randomUUID();

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 204 });

  try {
    const expectedCronSecret = Deno.env.get("CAMPAIGN_DISPATCHER_SECRET") ?? "";
    const receivedCronSecret = req.headers.get("x-cron-secret") ?? "";
    if (!expectedCronSecret || receivedCronSecret !== expectedCronSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server configuration missing" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    console.log(`[campaign-dispatcher][${executionId}] Start ${DISPATCHER_BUILD}`);

    await supabaseAdmin.from("server_cron_state").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      last_run_at: startedAt,
      executor_type: "edge_function_dispatcher",
      last_error: null,
    }, { onConflict: "id" });

    const { data: publications, error: fetchError } = await supabaseAdmin
      .from("publications")
      .select("*")
      .in("status", ["agendado", "pending", "scheduled", "waiting_render", "ready_to_post"])
      .lte("scheduled_for", startedAt)
      .is("provider_post_id", null)
      .order("scheduled_for", { ascending: true })
      .limit(20);

    if (fetchError) throw new Error(`Fetch publications failed: ${fetchError.message}`);

    const results: any[] = [];
    let publishedCount = 0;
    let waitingCount = 0;
    let failedCount = 0;
    let blockedCount = 0;

    const invokePostPeer = async (publicationId: string) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/postpeer-post-create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "x-internal-secret": expectedCronSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicationId }),
      });
      const text = await response.text();
      let body: any = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
      if (!response.ok) throw new Error(`postpeer-post-create ${response.status}: ${body?.error || text || "Unknown error"}`);
      return body;
    };

    for (const pub of publications || []) {
      try {
        if (pub.provider_post_id) {
          results.push({ id: pub.id, status: "already_sent" });
          continue;
        }

        if (pub.music_track_id) {
          const renderOptions = pub.render_options || {};
          const renderKey = renderOptions.render_key;
          let existingRender: any = null;

          if (pub.media_render_id) {
            const { data } = await supabaseAdmin.from("media_renders")
              .select("id,status,storage_path").eq("id", pub.media_render_id).maybeSingle();
            existingRender = data;
          }

          if (!existingRender && renderKey) {
            const { data } = await supabaseAdmin.from("media_renders")
              .select("id,status,storage_path").eq("render_key", renderKey).maybeSingle();
            existingRender = data;
          }

          if (existingRender?.status === "ready" && existingRender?.storage_path) {
            const { error } = await supabaseAdmin.from("publications").update({
              status: "ready_to_post",
              media_render_id: existingRender.id,
              updated_at: new Date().toISOString(),
            }).eq("id", pub.id).is("provider_post_id", null);
            if (error) throw new Error(`Render association failed: ${error.message}`);
          } else if (existingRender?.status === "failed") {
            await supabaseAdmin.from("publications").update({
              status: "failed",
              last_error: "Media render failed before publication",
              updated_at: new Date().toISOString(),
            }).eq("id", pub.id);
            failedCount++;
            results.push({ id: pub.id, status: "failed", reason: "render_failed" });
            continue;
          } else if (existingRender) {
            await supabaseAdmin.from("publications").update({
              status: "waiting_render",
              media_render_id: existingRender.id,
              updated_at: new Date().toISOString(),
            }).eq("id", pub.id);
            waitingCount++;
            results.push({ id: pub.id, status: "waiting_render", render_id: existingRender.id });
            continue;
          } else {
            if (!renderKey) {
              await supabaseAdmin.from("publications").update({
                status: "failed",
                last_error: "Missing render_key for music publication",
                updated_at: new Date().toISOString(),
              }).eq("id", pub.id);
              failedCount++;
              results.push({ id: pub.id, status: "failed", reason: "missing_render_key" });
              continue;
            }

            const { data: newRender, error: renderError } = await supabaseAdmin.from("media_renders").insert({
              user_id: pub.user_id,
              source_content_id: pub.content_id,
              music_track_id: pub.music_track_id,
              render_key: renderKey,
              render_options: renderOptions,
              status: "queued",
              audio_mode: renderOptions.audioMode || "music_plus_original",
              music_start_ms: renderOptions.musicStartMs || 0,
              music_volume: renderOptions.musicVolume ?? 80,
              original_audio_volume: renderOptions.originalAudioVolume ?? 20,
            }).select("id,status").single();

            if (renderError || !newRender) throw new Error(`Render creation failed: ${renderError?.message || "unknown error"}`);

            await supabaseAdmin.from("publications").update({
              status: "waiting_render",
              media_render_id: newRender.id,
              updated_at: new Date().toISOString(),
            }).eq("id", pub.id);
            waitingCount++;
            results.push({ id: pub.id, status: "waiting_render", render_id: newRender.id });
            continue;
          }
        }

        // Atomic final gate. The DB serializes same account+content claims,
        // rejects closed/paused campaigns and marks duplicate attempts cancelled.
        const { data: claim, error: claimError } = await supabaseAdmin.rpc(
          "claim_publication_for_posting",
          { p_publication_id: pub.id },
        );

        if (claimError) throw new Error(`Publication safety claim failed: ${claimError.message}`);

        if (!claim?.allowed) {
          blockedCount++;
          results.push({ id: pub.id, status: "blocked", reason: claim?.reason || "safety_guard" });
          continue;
        }

        const postResult = await invokePostPeer(pub.id);
        publishedCount++;
        results.push({
          id: pub.id,
          status: postResult?.status || "submitted",
          provider_post_id: postResult?.postId || null,
        });
      } catch (err: any) {
        const message = err?.message || String(err);
        console.error(`[campaign-dispatcher][${executionId}] ${pub.id}:`, message);
        await supabaseAdmin.from("publications").update({
          last_error: message,
          updated_at: new Date().toISOString(),
        }).eq("id", pub.id);
        failedCount++;
        results.push({ id: pub.id, status: "error", error: message });
      }
    }

    try {
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/postpeer-post-sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source: "campaign-dispatcher", executionId }),
      });
      const syncText = await syncResponse.text();
      if (!syncResponse.ok) console.error(`[campaign-dispatcher][${executionId}] PostPeer sync failed:`, syncResponse.status, syncText);
    } catch (syncError: any) {
      console.error(`[campaign-dispatcher][${executionId}] PostPeer sync exception:`, syncError?.message || String(syncError));
    }

    const finishedAt = new Date().toISOString();
    await supabaseAdmin.from("server_cron_state").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      last_run_at: startedAt,
      last_success_at: finishedAt,
      executor_type: "edge_function_dispatcher",
      last_error: null,
    }, { onConflict: "id" });

    console.log(`[campaign-dispatcher][${executionId}] Finished`, {
      total: publications?.length || 0,
      published: publishedCount,
      waiting: waitingCount,
      blocked: blockedCount,
      failed: failedCount,
    });

    return jsonResponse({
      status: "ok",
      build: DISPATCHER_BUILD,
      executionId,
      total: publications?.length || 0,
      published: publishedCount,
      waiting_render: waitingCount,
      blocked: blockedCount,
      failed: failedCount,
      results,
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error(`[campaign-dispatcher][${executionId}] Fatal:`, message);
    return jsonResponse({ status: "error", build: DISPATCHER_BUILD, executionId, error: message }, 500);
  }
});
