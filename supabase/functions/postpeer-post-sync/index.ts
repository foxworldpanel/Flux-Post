import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  PostPeerClient
} from "../_shared/social-helpers.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const postpeerApiKey = Deno.env.get("POSTPEER_API_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !postpeerApiKey) {
      console.error("[postpeer-post-sync] Missing server configuration");
      return jsonResponse({ error: "Server configuration missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const bearerToken = authHeader.slice(7).trim();
    const isServiceRole = bearerToken === serviceRoleKey;

    let userId: string | null = null;

    if (!isServiceRole) {
      const supabaseUser = createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: { Authorization: authHeader }
          }
        }
      );

      const {
        data: { user },
        error: authError
      } = await supabaseUser.auth.getUser();

      if (authError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      userId = user.id;
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const postpeer = new PostPeerClient(postpeerApiKey);

    /*
     * Somente posts que já existem no PostPeer
     * e ainda não chegaram a estado final.
     */
    let query = supabaseAdmin
      .from("publications")
      .select(`
        id,
        user_id,
        provider_post_id,
        status,
        content_id,
        media_render_id,
        social_accounts!inner (
          provider
        )
      `)
      .eq("social_accounts.provider", "postpeer")
      .not("provider_post_id", "is", null)
      .not("status", "in", '("published","failed","cancelled")')
      .limit(100);

    if (!isServiceRole) {
      query = query.eq("user_id", userId!);
    }

    const {
      data: pubs,
      error: fetchError
    } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!pubs || pubs.length === 0) {
      return jsonResponse({
        success: true,
        checked: 0,
        synced: [],
        message: "No publications to sync"
      });
    }

    const results: any[] = [];

    for (const pub of pubs) {
      try {
        if (!pub.provider_post_id) continue;

        const postData = await postpeer.getPost(
          pub.provider_post_id
        );

        const newStatus =
          typeof postData?.status === "string"
            ? postData.status.toLowerCase()
            : pub.status;

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString()
        };

        if (newStatus && newStatus !== pub.status) {
          updateData.status = newStatus;
        }

        const platformResult = postData?.platforms?.[0];

        if (platformResult?.postUrl) {
          updateData.post_url = platformResult.postUrl;
        }

        if (platformResult?.error) {
          updateData.status = "failed";
          updateData.last_error =
            typeof platformResult.error === "string"
              ? platformResult.error
              : JSON.stringify(platformResult.error);
        }

        if (postData?.publishedAt) {
          updateData.published_at = postData.publishedAt;
        }

        const {
          error: updateError
        } = await supabaseAdmin
          .from("publications")
          .update(updateData)
          .eq("id", pub.id);

        if (updateError) {
          throw updateError;
        }

        /*
         * Limpeza segura:
         * somente depois que esta publicação foi realmente confirmada
         * como published pelo provider.
         */
        const finalStatus =
          typeof updateData.status === "string"
            ? updateData.status
            : pub.status;

        if (finalStatus === "published" && pub.content_id) {
          const { data: relatedPublications, error: relatedError } =
            await supabaseAdmin
              .from("publications")
              .select("id,status")
              .eq("content_id", pub.content_id);

          if (relatedError) {
            console.error(
              "[postpeer-post-sync] Failed checking related publications:",
              relatedError.message
            );
          } else {
            const allPublished =
              (relatedPublications?.length || 0) > 0 &&
              relatedPublications!.every(
                related => related.status === "published"
              );

            if (allPublished) {
              const now = new Date().toISOString();

              const { data: content } = await supabaseAdmin
                .from("content_library")
                .select("id,storage_path,status,use_count,first_used_at")
                .eq("id", pub.content_id)
                .maybeSingle();

              if (content && content.status !== "used") {
                // Apaga somente arquivo físico local do original.
                // URLs externas (Pexels etc.) nunca são removidas.
                if (
                  content.storage_path &&
                  !/^https?:\/\//i.test(content.storage_path)
                ) {
                  const { error: originalRemoveError } =
                    await supabaseAdmin.storage
                      .from("content-library")
                      .remove([content.storage_path]);

                  if (originalRemoveError) {
                    console.error(
                      "[postpeer-post-sync] Original cleanup failed:",
                      originalRemoveError.message
                    );
                  }
                }

                // Pode haver mais de um render relacionado ao mesmo conteúdo.
                const { data: contentRenders } = await supabaseAdmin
                  .from("media_renders")
                  .select("id,storage_path")
                  .eq("source_content_id", pub.content_id);

                const renderPaths = Array.from(
                  new Set(
                    (contentRenders || [])
                      .map(render => render.storage_path)
                      .filter(
                        (path): path is string =>
                          !!path && !/^https?:\/\//i.test(path)
                      )
                  )
                );

                if (renderPaths.length) {
                  const { error: renderRemoveError } =
                    await supabaseAdmin.storage
                      .from("rendered")
                      .remove(renderPaths);

                  if (renderRemoveError) {
                    console.error(
                      "[postpeer-post-sync] Render cleanup failed:",
                      renderRemoveError.message
                    );
                  }
                }

                const { error: contentUpdateError } = await supabaseAdmin
                  .from("content_library")
                  .update({
                    status: "used",
                    use_count: (content.use_count || 0) + 1,
                    first_used_at: content.first_used_at || now,
                    last_used_at: now,
                    updated_at: now
                  })
                  .eq("id", pub.content_id);

                if (contentUpdateError) {
                  console.error(
                    "[postpeer-post-sync] Failed marking content used:",
                    contentUpdateError.message
                  );
                } else {
                  console.log(
                    "[postpeer-post-sync] Content finalized and physical media cleaned:",
                    pub.content_id
                  );
                }
              }
            }
          }
        }

        results.push({
          id: pub.id,
          provider_post_id: pub.provider_post_id,
          old_status: pub.status,
          new_status: updateData.status ?? pub.status,
          success: true
        });

      } catch (err: any) {
        console.error(
          `[postpeer-post-sync] Failed ${pub.id}:`,
          err?.message || String(err)
        );

        results.push({
          id: pub.id,
          provider_post_id: pub.provider_post_id,
          success: false,
          error: err?.message || String(err)
        });
      }
    }

    return jsonResponse({
      success: true,
      checked: pubs.length,
      synced: results
    });

  } catch (err: any) {
    console.error(
      "[postpeer-post-sync] Error:",
      err?.message || String(err)
    );

    return jsonResponse({
      error: err?.message || "Internal server error"
    }, 500);
  }
});
