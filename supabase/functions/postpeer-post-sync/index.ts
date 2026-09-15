import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, PostPeerClient } from "../_shared/social-helpers.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 204 });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const postpeerApiKey = Deno.env.get("POSTPEER_API_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !postpeerApiKey) return jsonResponse({ error: "Server configuration missing" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const bearerToken = authHeader.slice(7).trim();
    const isServiceRole = bearerToken === serviceRoleKey;
    let userId: string | null = null;

    if (!isServiceRole) {
      const supabaseUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const postpeer = new PostPeerClient(postpeerApiKey);

    // Do not use an embedded social_accounts relationship here. Older schemas can
    // expose more than one FK and make PostgREST reject the whole sync request.
    let query = supabaseAdmin
      .from("publications")
      .select("id,user_id,provider_post_id,status,content_id,media_render_id,social_account_id")
      .not("provider_post_id", "is", null)
      .not("status", "in", '("published","failed","cancelled","canceled")')
      .limit(100);
    if (!isServiceRole) query = query.eq("user_id", userId!);

    const { data: pubs, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!pubs?.length) return jsonResponse({ success: true, checked: 0, synced: [], message: "No publications to sync" });

    const accountIds = Array.from(new Set(pubs.map((p: any) => p.social_account_id).filter(Boolean)));
    const { data: accounts, error: accountsError } = accountIds.length
      ? await supabaseAdmin.from("social_accounts").select("id,provider").in("id", accountIds)
      : { data: [], error: null } as any;
    if (accountsError) throw accountsError;
    const providerByAccount = new Map((accounts || []).map((a: any) => [a.id, a.provider]));
    const eligible = pubs.filter((p: any) => providerByAccount.get(p.social_account_id) === "postpeer");

    const results: any[] = [];
    for (const pub of eligible) {
      try {
        const postData = await postpeer.getPost(pub.provider_post_id!);
        const rawStatus = typeof postData?.status === "string" ? postData.status.toLowerCase() : pub.status;
        const platformResult = postData?.platforms?.[0];
        let newStatus = rawStatus;
        if (platformResult?.error) newStatus = "failed";
        else if (postData?.publishedAt || rawStatus === "published" || rawStatus === "success" || rawStatus === "completed") newStatus = "published";
        else if (rawStatus === "cancelled" || rawStatus === "canceled") newStatus = "cancelled";
        else if (rawStatus === "failed" || rawStatus === "error") newStatus = "failed";
        else if (["processing", "publishing", "pending", "queued"].includes(rawStatus)) newStatus = "processing";

        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        const providerUrl = platformResult?.platformPostUrl || (platformResult as any)?.postUrl;
        if (providerUrl) updateData.post_url = providerUrl;
        if (platformResult?.error) updateData.last_error = typeof platformResult.error === "string" ? platformResult.error : JSON.stringify(platformResult.error);
        if (postData?.publishedAt) updateData.published_at = postData.publishedAt;

        const { error: updateError } = await supabaseAdmin.from("publications").update(updateData).eq("id", pub.id);
        if (updateError) throw updateError;

        // Cleanup only when this content has no non-published provider destination left.
        if (newStatus === "published" && pub.content_id) {
          const { data: related, error: relatedError } = await supabaseAdmin
            .from("publications")
            .select("id,status,provider_post_id")
            .eq("content_id", pub.content_id);
          if (!relatedError) {
            const relevant = (related || []).filter((r: any) => r.provider_post_id || r.id === pub.id);
            const allPublished = relevant.length > 0 && relevant.every((r: any) => r.id === pub.id ? true : r.status === "published");
            if (allPublished) {
              const now = new Date().toISOString();
              const { data: content } = await supabaseAdmin.from("content_library")
                .select("id,storage_path,status,use_count,first_used_at")
                .eq("id", pub.content_id).maybeSingle();
              if (content && content.status !== "used") {
                if (content.storage_path && !/^https?:\/\//i.test(content.storage_path)) {
                  const { error } = await supabaseAdmin.storage.from("content-library").remove([content.storage_path]);
                  if (error) console.error("[postpeer-post-sync] Original cleanup failed:", error.message);
                }
                const { data: renders } = await supabaseAdmin.from("media_renders").select("storage_path").eq("source_content_id", pub.content_id);
                const paths = Array.from(new Set((renders || []).map((r: any) => r.storage_path).filter((p: any) => p && !/^https?:\/\//i.test(p)))) as string[];
                if (paths.length) {
                  const { error } = await supabaseAdmin.storage.from("rendered").remove(paths);
                  if (error) console.error("[postpeer-post-sync] Render cleanup failed:", error.message);
                }
                const { error } = await supabaseAdmin.from("content_library").update({
                  status: "used",
                  use_count: (content.use_count || 0) + 1,
                  first_used_at: content.first_used_at || now,
                  last_used_at: now,
                  updated_at: now,
                }).eq("id", pub.content_id);
                if (error) console.error("[postpeer-post-sync] Failed marking content used:", error.message);
              }
            }
          }
        }

        results.push({ id: pub.id, provider_post_id: pub.provider_post_id, old_status: pub.status, new_status: newStatus, success: true });
      } catch (err: any) {
        console.error(`[postpeer-post-sync] Failed ${pub.id}:`, err?.message || String(err));
        results.push({ id: pub.id, provider_post_id: pub.provider_post_id, success: false, error: err?.message || String(err) });
      }
    }

    return jsonResponse({ success: true, checked: eligible.length, skipped_non_postpeer: pubs.length - eligible.length, synced: results });
  } catch (err: any) {
    console.error("[postpeer-post-sync] Error:", err?.message || String(err));
    return jsonResponse({ error: err?.message || "Internal server error" }, 500);
  }
});
