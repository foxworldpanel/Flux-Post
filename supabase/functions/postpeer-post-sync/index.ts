import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, PostPeerClient } from "../_shared/social-helpers.ts";

const BATCH_SIZE = 8;
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const postpeer = new PostPeerClient(postpeerApiKey);
    let query = admin.from("publications")
      .select("id,user_id,provider_post_id,status,content_id,social_account_id")
      .not("provider_post_id", "is", null)
      .not("status", "in", '("published","failed","cancelled","canceled")')
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE + 1);
    if (!isServiceRole) query = query.eq("user_id", userId!);

    const { data: pubs, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!pubs?.length) return jsonResponse({ success: true, checked: 0, synced: [], has_more: false });

    const hasMoreCandidates = pubs.length > BATCH_SIZE;
    const batch = pubs.slice(0, BATCH_SIZE);
    const accountIds = Array.from(new Set(batch.map((p: any) => p.social_account_id).filter(Boolean)));
    const { data: accounts, error: accountsError } = accountIds.length
      ? await admin.from("social_accounts").select("id,provider").in("id", accountIds)
      : { data: [], error: null } as any;
    if (accountsError) throw accountsError;
    const providerByAccount = new Map((accounts || []).map((a: any) => [a.id, a.provider]));
    const eligible = batch.filter((p: any) => providerByAccount.get(p.social_account_id) === "postpeer");

    const results: any[] = [];
    for (const pub of eligible) {
      try {
        const postData = await postpeer.getPost(pub.provider_post_id!);
        const raw = typeof postData?.status === "string" ? postData.status.toLowerCase() : pub.status;
        const platformResult = postData?.platforms?.[0];
        let status = raw;
        if (platformResult?.error || raw === "failed" || raw === "error") status = "failed";
        else if (postData?.publishedAt || ["published", "success", "completed"].includes(raw)) status = "published";
        else if (["cancelled", "canceled"].includes(raw)) status = "cancelled";
        else if (["processing", "publishing", "pending", "queued"].includes(raw)) status = "processing";

        const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
        const postUrl = platformResult?.platformPostUrl || (platformResult as any)?.postUrl;
        if (postUrl) update.post_url = postUrl;
        if (platformResult?.error) update.last_error = typeof platformResult.error === "string" ? platformResult.error : JSON.stringify(platformResult.error);
        if (postData?.publishedAt) update.published_at = postData.publishedAt;
        const { error: updateError } = await admin.from("publications").update(update).eq("id", pub.id);
        if (updateError) throw updateError;
        results.push({ id: pub.id, old_status: pub.status, new_status: status, success: true });
      } catch (err: any) {
        console.error(`[postpeer-post-sync] ${pub.id}:`, err?.message || String(err));
        results.push({ id: pub.id, success: false, error: err?.message || String(err) });
      }
    }

    return jsonResponse({ success: true, checked: eligible.length, synced: results, has_more: hasMoreCandidates, batch_size: BATCH_SIZE });
  } catch (err: any) {
    console.error("[postpeer-post-sync] Error:", err?.message || String(err));
    return jsonResponse({ error: err?.message || "Internal server error" }, 500);
  }
});
