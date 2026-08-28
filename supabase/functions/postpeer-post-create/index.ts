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
      console.error("[postpeer-post-create] Missing server configuration");
      return jsonResponse({ error: "Server configuration missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    /*
     * Chamadas internas feitas com Service Role são permitidas.
     * Chamadas do frontend precisam pertencer ao dono da publicação.
     */
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

    let body: any;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const publicationId = body?.publicationId;

    if (!publicationId) {
      return jsonResponse({ error: "publicationId is required" }, 400);
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    let publicationQuery = supabaseAdmin
      .from("publications")
      .select(`
        *,
        social_accounts (
          id,
          platform,
          provider,
          provider_connection_id,
          provider_profile_id,
          connection_status
        ),
        content_library (
          id,
          storage_path
        ),
        media_renders (
          id,
          storage_path,
          status
        )
      `)
      .eq("id", publicationId);

    if (!isServiceRole) {
      publicationQuery = publicationQuery.eq("user_id", userId!);
    }

    const {
      data: pub,
      error: pubError
    } = await publicationQuery.single();

    if (pubError || !pub) {
      console.error(
        "[postpeer-post-create] Publication lookup failed:",
        pubError?.message
      );

      return jsonResponse(
        { error: "Publication not found or unauthorized" },
        404
      );
    }

    if (pub.provider_post_id) {
      return jsonResponse({
        error: "Post already exists on provider",
        provider_post_id: pub.provider_post_id
      }, 409);
    }

    const account = pub.social_accounts;

    if (!account) {
      return jsonResponse(
        { error: "Social account not found for publication" },
        400
      );
    }

    if (account.provider !== "postpeer") {
      return jsonResponse(
        { error: "Social account is not connected through PostPeer" },
        400
      );
    }

    if (!account.provider_connection_id) {
      return jsonResponse(
        { error: "PostPeer integration ID is missing" },
        400
      );
    }

    const platform = pub.platform || account.platform;

    if (!platform) {
      return jsonResponse(
        { error: "Publication platform is missing" },
        400
      );
    }

    /*
     * Preferimos sempre o render final.
     * Se não houver render associado, usamos o conteúdo original.
     */
    const renderPath = pub.media_renders?.storage_path ?? null;
    const contentPath = pub.content_library?.storage_path ?? null;

    const mediaPath = renderPath || contentPath;
    const bucketName = renderPath
      ? "rendered"
      : "content-library";

    if (!mediaPath) {
      return jsonResponse(
        { error: "Publication has no media available" },
        400
      );
    }

    if (pub.media_render_id && !renderPath) {
      return jsonResponse(
        { error: "Rendered media is not ready" },
        409
      );
    }

    const {
      data: signedUrlData,
      error: signedUrlError
    } = await supabaseAdmin
      .storage
      .from(bucketName)
      .createSignedUrl(mediaPath, 86400);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(
        "[postpeer-post-create] Signed URL failed:",
        signedUrlError?.message
      );

      return jsonResponse(
        { error: "Failed to prepare media for publishing" },
        500
      );
    }

    const postpeer = new PostPeerClient(postpeerApiKey);

    const publishNow =
      pub.status === "publishing" ||
      !pub.scheduled_for;

    const payload = {
      platforms: [{
        platform,
        accountId: account.provider_connection_id
      }],
      content: pub.caption || "",
      mediaItems: [{
        url: signedUrlData.signedUrl,
        type: "VIDEO" as const
      }],
      timezone: pub.timezone || "America/Sao_Paulo",
      publishNow,
      scheduledFor: publishNow
        ? undefined
        : pub.scheduled_for
    };

    /*
     * Não logamos a signed URL completa.
     */
    console.log(
      "[postpeer-post-create] Sending publication",
      {
        publicationId,
        platform,
        accountId: account.provider_connection_id,
        bucketName,
        publishNow,
        scheduledFor: payload.scheduledFor ?? null
      }
    );

    const response = await postpeer.createPost(payload);

    if (!response?.id) {
      throw new Error("PostPeer returned no post ID");
    }

    const providerStatus =
      typeof response.status === "string"
        ? response.status.toLowerCase()
        : "processing";

    const updatePayload: Record<string, unknown> = {
      provider_post_id: response.id,
      status: providerStatus,
      updated_at: new Date().toISOString()
    };

    const platformResult = response.platforms?.[0];

    if (platformResult?.postUrl) {
      updatePayload.post_url = platformResult.postUrl;
    }

    if (platformResult?.error) {
      updatePayload.status = "failed";
      updatePayload.last_error =
        typeof platformResult.error === "string"
          ? platformResult.error
          : JSON.stringify(platformResult.error);
    }

    if (response.publishedAt) {
      updatePayload.published_at = response.publishedAt;
    }

    const {
      error: updateError
    } = await supabaseAdmin
      .from("publications")
      .update(updatePayload)
      .eq("id", publicationId);

    if (updateError) {
      /*
       * Importante:
       * o post já pode existir no PostPeer neste ponto.
       * Não tentamos criar novamente automaticamente.
       */
      console.error(
        "[postpeer-post-create] Provider created but DB update failed:",
        updateError.message,
        "provider_post_id:",
        response.id
      );

      return jsonResponse({
        error: "Post created on provider but local update failed",
        provider_post_id: response.id
      }, 500);
    }

    console.log(
      "[postpeer-post-create] Created successfully",
      {
        publicationId,
        providerPostId: response.id,
        status: updatePayload.status
      }
    );

    return jsonResponse({
      success: true,
      postId: response.id,
      status: updatePayload.status
    });

  } catch (err: any) {
    console.error(
      "[postpeer-post-create] Error:",
      err?.message || String(err)
    );

    return jsonResponse({
      error: err?.message || "Internal server error"
    }, 500);
  }
});
