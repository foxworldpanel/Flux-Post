
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { 
  corsHeaders, 
  PostPeerClient 
} from "../_shared/social-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { publicationId } = await req.json();
    if (!publicationId) {
      return new Response(JSON.stringify({ error: "publicationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch Publication data
    const { data: pub, error: pubError } = await supabaseAdmin
      .from("publications")
      .select(`
        *,
        social_accounts(platform, provider_connection_id, provider_profile_id),
        content_library(storage_path),
        media_renders(storage_path)
      `)
      .eq("id", publicationId)
      .eq("user_id", user.id)
      .single();

    if (pubError || !pub) {
      return new Response(JSON.stringify({ error: "Publication not found or unauthorized" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pub.provider_post_id) {
       return new Response(JSON.stringify({ error: "Post already exists on provider", provider_post_id: pub.provider_post_id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Prepare Media URL (Signed URL for PostPeer to download)
    // Usamos 24 horas para garantir que o PostPeer consiga processar, mesmo se houver delay na fila deles
    const mediaPath = pub.media_renders?.storage_path || pub.content_library.storage_path;
    const bucketName = pub.media_renders?.storage_path ? "rendered" : "content-library";

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from(bucketName)
      .createSignedUrl(mediaPath, 86400);

    if (signedUrlError || !signedUrlData?.signedUrl) {
       throw new Error(`Failed to generate signed URL: ${signedUrlError?.message}`);
    }

    // 3. PostPeer API call
    const postpeer = new PostPeerClient(Deno.env.get("POSTPEER_API_KEY") || "");
    
    const payload = {
      platforms: [{
        platform: pub.platform,
        accountId: pub.social_accounts.provider_connection_id // IMPORTANTE: Integration ID
      }],
      content: pub.caption || "", // Alterado de { caption: ... } para string conforme contrato V1
      mediaItems: [{
        url: signedUrlData.signedUrl,
        type: "VIDEO" as const
      }],
      timezone: pub.timezone || "America/Sao_Paulo",
      publishNow: pub.status === 'publishing' || !pub.scheduled_at,
      scheduledFor: pub.scheduled_at || undefined
    };

    console.log("[postpeer-post-create] Payload:", JSON.stringify(payload, null, 2));

    const response = await postpeer.createPost(payload);
    console.log("[postpeer-post-create] Response:", JSON.stringify(response, null, 2));

    // 4. Persist Result
    const updatePayload: any = {
      provider_post_id: response.id,
      status: response.status.toLowerCase(), // PostPeer retorna status
      updated_at: new Date().toISOString()
    };

    if (response.platforms?.[0]?.postUrl) {
      updatePayload.post_url = response.platforms[0].postUrl;
    }
    
    if (response.platforms?.[0]?.error) {
      updatePayload.status = 'failed';
      updatePayload.last_error = response.platforms[0].error;
    }

    if (response.platforms?.[0]?.postId) {
      console.log("[postpeer-post-create] Platform Post ID:", response.platforms[0].postId);
    }

    await supabaseAdmin
      .from("publications")
      .update(updatePayload)
      .eq("id", publicationId);

    return new Response(JSON.stringify({ success: true, postId: response.id, status: updatePayload.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[postpeer-post-create] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
