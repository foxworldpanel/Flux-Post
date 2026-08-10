
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const postpeer = new PostPeerClient(Deno.env.get("POSTPEER_API_KEY") || "");

    // Buscar publicações que não estão em estado final (published/failed)
    const { data: pubs, error: fetchError } = await supabaseAdmin
      .from("publications")
      .select("id, provider_post_id, status")
      .not("provider_post_id", "is", null)
      .not("status", "in", '("published","failed","cancelled")');

    if (fetchError) throw fetchError;
    if (!pubs || pubs.length === 0) {
      return new Response(JSON.stringify({ message: "No publications to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const results = [];

    for (const pub of pubs) {
      try {
        const postData = await postpeer.getPost(pub.provider_post_id);
        const newStatus = postData.status.toLowerCase();

        if (newStatus !== pub.status) {
          const updateData: any = {
            status: newStatus,
            updated_at: new Date().toISOString()
          };

          if (postData.platforms?.[0]?.postUrl) {
            updateData.post_url = postData.platforms[0].postUrl;
          }

          if (postData.publishedAt) {
            updateData.published_at = postData.publishedAt;
          }

          await supabaseAdmin
            .from("publications")
            .update(updateData)
            .eq("id", pub.id);
          
          results.push({ id: pub.id, old: pub.status, new: newStatus });
        }
      } catch (e) {
        console.error(`Failed to sync post ${pub.provider_post_id}:`, e.message);
      }
    }

    return new Response(JSON.stringify({ success: true, synced: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[postpeer-post-sync] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
