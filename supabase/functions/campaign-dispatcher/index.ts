import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DISPATCHER_BUILD = "v11-postpeer-final";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });

serve(async (req) => {
  const startedAt = new Date().toISOString();
  const executionId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 204
    });
  }

  try {
    const expectedCronSecret =
      Deno.env.get("CAMPAIGN_DISPATCHER_SECRET") ?? "";

    const receivedCronSecret =
      req.headers.get("x-cron-secret") ?? "";

    if (
      !expectedCronSecret ||
      receivedCronSecret !== expectedCronSecret
    ) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? "";

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Server configuration missing" },
        500
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    console.log(
      `[campaign-dispatcher][${executionId}] Start ${DISPATCHER_BUILD}`
    );

    await supabaseAdmin
      .from("server_cron_state")
      .upsert({
        id: "00000000-0000-0000-0000-000000000001",
        last_run_at: startedAt,
        executor_type: "edge_function_dispatcher",
        last_error: null
      }, {
        onConflict: "id"
      });

    /*
     * Apenas publicações cujo horário já chegou.
     * ready_to_post também entra para recuperar execuções
     * interrompidas entre render e envio.
     */
    const {
      data: publications,
      error: fetchError
    } = await supabaseAdmin
      .from("publications")
      .select("*")
      .in("status", [
        "agendado",
        "pending",
        "scheduled",
        "waiting_render",
        "ready_to_post"
      ])
      .lte("scheduled_for", startedAt)
      .is("provider_post_id", null)
      .order("scheduled_for", {
        ascending: true
      })
      .limit(20);

    if (fetchError) {
      throw new Error(
        `Fetch publications failed: ${fetchError.message}`
      );
    }

    const results: any[] = [];
    let publishedCount = 0;
    let waitingCount = 0;
    let failedCount = 0;

    const invokePostPeer = async (
      publicationId: string
    ) => {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/postpeer-post-create`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey,
            "x-internal-secret": expectedCronSecret,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            publicationId
          })
        }
      );

      const text = await response.text();

      let body: any = null;

      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text };
      }

      if (!response.ok) {
        throw new Error(
          `postpeer-post-create ${response.status}: ${
            body?.error || text || "Unknown error"
          }`
        );
      }

      return body;
    };

    for (const pub of publications || []) {
      try {
        /*
         * Segurança adicional contra reenvio.
         */
        if (pub.provider_post_id) {
          results.push({
            id: pub.id,
            status: "already_sent"
          });

          continue;
        }

        /*
         * PUBLICAÇÃO COM MÚSICA
         */
        if (pub.music_track_id) {
          const renderOptions =
            pub.render_options || {};

          const renderKey =
            renderOptions.render_key;

          /*
           * Primeiro tenta pelo media_render_id já associado.
           */
          let existingRender: any = null;

          if (pub.media_render_id) {
            const {
              data: renderById
            } = await supabaseAdmin
              .from("media_renders")
              .select("id,status,storage_path")
              .eq("id", pub.media_render_id)
              .maybeSingle();

            existingRender = renderById;
          }

          /*
           * Compatibilidade com campanhas antigas:
           * procura também pelo render_key.
           */
          if (!existingRender && renderKey) {
            const {
              data: renderByKey
            } = await supabaseAdmin
              .from("media_renders")
              .select("id,status,storage_path")
              .eq("render_key", renderKey)
              .maybeSingle();

            existingRender = renderByKey;
          }

          /*
           * Render pronto: associa à publicação
           * e segue para postagem.
           */
          if (
            existingRender?.status === "ready" &&
            existingRender?.storage_path
          ) {
            await supabaseAdmin
              .from("publications")
              .update({
                status: "ready_to_post",
                media_render_id:
                  existingRender.id
              })
              .eq("id", pub.id);

          } else if (
            existingRender?.status === "failed"
          ) {
            await supabaseAdmin
              .from("publications")
              .update({
                status: "failed",
                last_error:
                  "Media render failed before publication",
                updated_at:
                  new Date().toISOString()
              })
              .eq("id", pub.id);

            failedCount++;

            results.push({
              id: pub.id,
              status: "failed",
              reason: "render_failed"
            });

            continue;

          } else if (existingRender) {
            await supabaseAdmin
              .from("publications")
              .update({
                status: "waiting_render",
                media_render_id:
                  existingRender.id
              })
              .eq("id", pub.id);

            waitingCount++;

            results.push({
              id: pub.id,
              status: "waiting_render",
              render_id:
                existingRender.id
            });

            continue;

          } else {
            /*
             * Não existe render ainda.
             * Para criar precisamos do render_key.
             */
            if (!renderKey) {
              await supabaseAdmin
                .from("publications")
                .update({
                  status: "failed",
                  last_error:
                    "Missing render_key for music publication",
                  updated_at:
                    new Date().toISOString()
                })
                .eq("id", pub.id);

              failedCount++;

              results.push({
                id: pub.id,
                status: "failed",
                reason: "missing_render_key"
              });

              continue;
            }

            const {
              data: newRender,
              error: renderError
            } = await supabaseAdmin
              .from("media_renders")
              .insert({
                user_id:
                  pub.user_id,
                source_content_id:
                  pub.content_id,
                music_track_id:
                  pub.music_track_id,
                render_key:
                  renderKey,
                render_options:
                  renderOptions,
                status:
                  "queued",
                audio_mode:
                  renderOptions.audioMode ||
                  "music_plus_original",
                music_start_ms:
                  renderOptions.musicStartMs || 0,
                music_volume:
                  renderOptions.musicVolume ?? 80,
                original_audio_volume:
                  renderOptions.originalAudioVolume ?? 20
              })
              .select("id,status")
              .single();

            if (renderError || !newRender) {
              throw new Error(
                `Render creation failed: ${
                  renderError?.message ||
                  "unknown error"
                }`
              );
            }

            await supabaseAdmin
              .from("publications")
              .update({
                status: "waiting_render",
                media_render_id:
                  newRender.id
              })
              .eq("id", pub.id);

            waitingCount++;

            results.push({
              id: pub.id,
              status: "waiting_render",
              render_id:
                newRender.id
            });

            continue;
          }
        }

        /*
         * Aqui chegamos em dois casos:
         *
         * 1. publicação sem música;
         * 2. publicação com render READY.
         *
         * Como o horário já chegou, publicamos AGORA.
         */
        await supabaseAdmin
          .from("publications")
          .update({
            status: "publishing",
            updated_at:
              new Date().toISOString()
          })
          .eq("id", pub.id)
          .is("provider_post_id", null);

        const postResult =
          await invokePostPeer(pub.id);

        publishedCount++;

        results.push({
          id: pub.id,
          status:
            postResult?.status ||
            "submitted",
          provider_post_id:
            postResult?.postId ||
            null
        });

      } catch (err: any) {
        const message =
          err?.message || String(err);

        console.error(
          `[campaign-dispatcher][${executionId}] ${pub.id}:`,
          message
        );

        /*
         * Não marcamos automaticamente como failed se
         * existir a possibilidade do PostPeer ter criado
         * o post e a resposta ter sido interrompida.
         */
        await supabaseAdmin
          .from("publications")
          .update({
            last_error: message,
            updated_at:
              new Date().toISOString()
          })
          .eq("id", pub.id);

        failedCount++;

        results.push({
          id: pub.id,
          status: "error",
          error: message
        });
      }
    }

    const finishedAt =
      new Date().toISOString();

    await supabaseAdmin
      .from("server_cron_state")
      .upsert({
        id: "00000000-0000-0000-0000-000000000001",
        last_run_at: startedAt,
        last_success_at: finishedAt,
        executor_type:
          "edge_function_dispatcher",
        last_error: null
      }, {
        onConflict: "id"
      });

    console.log(
      `[campaign-dispatcher][${executionId}] Finished`,
      {
        total:
          publications?.length || 0,
        published:
          publishedCount,
        waiting:
          waitingCount,
        failed:
          failedCount
      }
    );

    return jsonResponse({
      status: "ok",
      build: DISPATCHER_BUILD,
      executionId,
      total:
        publications?.length || 0,
      published:
        publishedCount,
      waiting_render:
        waitingCount,
      failed:
        failedCount,
      results
    });

  } catch (err: any) {
    const message =
      err?.message || String(err);

    console.error(
      `[campaign-dispatcher][${executionId}] Fatal:`,
      message
    );

    return jsonResponse({
      status: "error",
      build: DISPATCHER_BUILD,
      executionId,
      error: message
    }, 500);
  }
});
