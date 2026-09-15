import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, PostPeerClient } from "../_shared/social-helpers.ts";

const BATCH_SIZE = 8;
const ANALYTICS_LIMIT = 100;
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/\/$/, "");
  }
};

const analyticsItems = (payload: any): any[] => {
  if (Array.isArray(payload?.posts)) return payload.posts;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  if (payload?.post && typeof payload.post === "object") return [payload.post];
  return [];
};

const platformEntry = (item: any, platform: string) => {
  if (!Array.isArray(item?.platforms)) return null;
  return (
    item.platforms.find(
      (entry: any) => String(entry?.platform || "").toLowerCase() === platform.toLowerCase(),
    ) ||
    item.platforms[0] ||
    null
  );
};

const extractMetrics = (item: any, platform: string) => {
  const platformData = platformEntry(item, platform);
  const metrics = platformData?.metrics || item?.metrics || item?.aggregated || {};
  const views = asNumber(metrics.views ?? metrics.videoViews ?? metrics.impressions);
  const likes = asNumber(metrics.likes ?? metrics.likeCount);
  const comments = asNumber(metrics.comments ?? metrics.replies ?? metrics.commentCount);
  const shares = asNumber(metrics.shares ?? metrics.retweets ?? metrics.shareCount);
  let engagementRate = asNumber(metrics.engagementRate ?? metrics.engagement_rate);

  if (engagementRate === null && views && views > 0) {
    engagementRate = (((likes || 0) + (comments || 0) + (shares || 0)) / views) * 100;
  }

  return {
    platformData,
    views,
    likes,
    comments,
    shares,
    engagementRate,
    hasMetrics: [views, likes, comments, shares, engagementRate].some((value) => value !== null),
  };
};

const fetchAccountAnalytics = async (apiKey: string, platform: string, accountId: string) => {
  const url = new URL("https://api.postpeer.dev/v1/analytics");
  url.searchParams.set("platform", platform.toLowerCase());
  url.searchParams.set("accountId", accountId);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(ANALYTICS_LIMIT));

  const response = await fetch(url, { headers: { "x-access-key": apiKey } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PostPeer analytics ${response.status}: ${detail || "Unknown error"}`);
  }
  return response.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 204 });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const postpeerApiKey = Deno.env.get("POSTPEER_API_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !postpeerApiKey) {
      return jsonResponse({ error: "Server configuration missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
    const bearerToken = authHeader.slice(7).trim();
    const isServiceRole = bearerToken === serviceRoleKey;
    let userId: string | null = null;

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error,
      } = await userClient.auth.getUser();
      if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }
    const forceAnalytics = requestBody?.forceAnalytics === true;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const postpeer = new PostPeerClient(postpeerApiKey);

    // Reconciliation is read-only at the provider and never resubmits a post.
    let statusQuery = admin
      .from("publications")
      .select("id,user_id,provider_post_id,status,content_id,social_account_id")
      .not("provider_post_id", "is", null)
      .not("status", "in", '("published","failed","cancelled","canceled")')
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE + 1);
    if (!isServiceRole) statusQuery = statusQuery.eq("user_id", userId!);

    const { data: pubs, error: fetchError } = await statusQuery;
    if (fetchError) throw fetchError;

    const statusCandidates = pubs || [];
    const hasMoreCandidates = statusCandidates.length > BATCH_SIZE;
    const batch = statusCandidates.slice(0, BATCH_SIZE);
    const batchAccountIds = Array.from(
      new Set(batch.map((p: any) => p.social_account_id).filter(Boolean)),
    );
    const { data: statusAccounts, error: accountsError } = batchAccountIds.length
      ? await admin.from("social_accounts").select("id,provider").in("id", batchAccountIds)
      : ({ data: [], error: null } as any);
    if (accountsError) throw accountsError;
    const providerByAccount = new Map((statusAccounts || []).map((a: any) => [a.id, a.provider]));
    const eligible = batch.filter(
      (p: any) => providerByAccount.get(p.social_account_id) === "postpeer",
    );

    const results: any[] = [];
    for (const pub of eligible) {
      try {
        const postData = await postpeer.getPost(pub.provider_post_id!);
        const raw =
          typeof postData?.status === "string" ? postData.status.toLowerCase() : pub.status;
        const platformResult = postData?.platforms?.[0];
        let status = raw;
        if (platformResult?.error || raw === "failed" || raw === "error") status = "failed";
        else if (postData?.publishedAt || ["published", "success", "completed"].includes(raw))
          status = "published";
        else if (["cancelled", "canceled"].includes(raw)) status = "cancelled";
        else if (["processing", "publishing", "pending", "queued"].includes(raw))
          status = "processing";

        const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
        const postUrl = platformResult?.platformPostUrl || (platformResult as any)?.postUrl;
        if (postUrl) update.post_url = postUrl;
        if (platformResult?.error) {
          update.last_error =
            typeof platformResult.error === "string"
              ? platformResult.error
              : JSON.stringify(platformResult.error);
        }
        if (postData?.publishedAt) update.published_at = postData.publishedAt;
        const { error: updateError } = await admin
          .from("publications")
          .update(update)
          .eq("id", pub.id);
        if (updateError) throw updateError;
        results.push({ id: pub.id, old_status: pub.status, new_status: status, success: true });
      } catch (err: any) {
        console.error(`[postpeer-post-sync] ${pub.id}:`, err?.message || String(err));
        results.push({ id: pub.id, success: false, error: err?.message || String(err) });
      }
    }

    // Analytics is isolated from status/claim logic. A database claim limits
    // automatic collection to one request every 12 hours for each account.
    let accountQuery = admin
      .from("social_accounts")
      .select("id,user_id,platform,provider_connection_id,account_name,username")
      .eq("provider", "postpeer")
      .eq("connection_status", "conectada")
      .or("status.is.null,status.neq.archived")
      .not("provider_connection_id", "is", null);
    if (!isServiceRole) accountQuery = accountQuery.eq("user_id", userId!);

    const { data: analyticsAccounts, error: analyticsAccountsError } = await accountQuery;
    if (analyticsAccountsError) throw analyticsAccountsError;

    const analyticsResults: any[] = [];
    for (const account of analyticsAccounts || []) {
      const { data: accountPublications, error: accountPublicationsError } = await admin
        .from("publications")
        .select("id,provider_post_id,post_url,status,published_at")
        .eq("social_account_id", account.id)
        .not("provider_post_id", "is", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(250);

      if (accountPublicationsError) {
        analyticsResults.push({
          account_id: account.id,
          success: false,
          error: accountPublicationsError.message,
        });
        continue;
      }
      if (!accountPublications?.length) continue;

      const { data: claimed, error: claimError } = await admin.rpc(
        "claim_postpeer_analytics_sync",
        {
          p_social_account_id: account.id,
          p_force: forceAnalytics,
        },
      );
      if (claimError) {
        analyticsResults.push({
          account_id: account.id,
          success: false,
          error: claimError.message,
        });
        continue;
      }
      if (!claimed) {
        analyticsResults.push({ account_id: account.id, skipped: true, reason: "not_due" });
        continue;
      }

      try {
        const payload = await fetchAccountAnalytics(
          postpeerApiKey,
          account.platform,
          account.provider_connection_id,
        );
        const items = analyticsItems(payload);
        const byProviderPostId = new Map<string, any>();
        const byPostUrl = new Map<string, any>();
        for (const publication of accountPublications) {
          if (publication.provider_post_id) {
            byProviderPostId.set(String(publication.provider_post_id), publication);
          }
          const normalized = normalizeUrl(publication.post_url);
          if (normalized) byPostUrl.set(normalized, publication);
        }

        const snapshots: any[] = [];
        const seenPublications = new Set<string>();
        for (const item of items) {
          const extracted = extractMetrics(item, account.platform);
          if (!extracted.hasMetrics) continue;
          const providerId = item?.postId || item?.id || null;
          const itemUrl = normalizeUrl(
            extracted.platformData?.platformPostUrl ||
              extracted.platformData?.postUrl ||
              item?.platformPostUrl ||
              item?.postUrl,
          );
          const publication =
            (providerId ? byProviderPostId.get(String(providerId)) : null) ||
            (itemUrl ? byPostUrl.get(itemUrl) : null);
          if (!publication || seenPublications.has(publication.id)) continue;
          seenPublications.add(publication.id);

          snapshots.push({
            publication_id: publication.id,
            views: Math.round(extracted.views || 0),
            likes: Math.round(extracted.likes || 0),
            comments: Math.round(extracted.comments || 0),
            shares: Math.round(extracted.shares || 0),
            engagement_rate: extracted.engagementRate,
            collected_at: new Date().toISOString(),
          });
        }

        if (snapshots.length) {
          const { error: insertError } = await admin.from("publication_metrics").insert(snapshots);
          if (insertError) throw insertError;
        }

        await admin.rpc("finish_postpeer_analytics_sync", {
          p_social_account_id: account.id,
          p_success: true,
          p_metrics_collected: snapshots.length,
          p_error: null,
        });
        analyticsResults.push({
          account_id: account.id,
          platform: account.platform,
          success: true,
          received: items.length,
          collected: snapshots.length,
        });
      } catch (err: any) {
        const message = err?.message || String(err);
        console.error(`[postpeer-analytics] ${account.id}:`, message);
        await admin.rpc("finish_postpeer_analytics_sync", {
          p_social_account_id: account.id,
          p_success: false,
          p_metrics_collected: 0,
          p_error: message,
        });
        analyticsResults.push({ account_id: account.id, success: false, error: message });
      }
    }

    return jsonResponse({
      success: true,
      checked: eligible.length,
      synced: results,
      has_more: hasMoreCandidates,
      batch_size: BATCH_SIZE,
      analytics: analyticsResults,
    });
  } catch (err: any) {
    console.error("[postpeer-post-sync] Error:", err?.message || String(err));
    return jsonResponse({ error: err?.message || "Internal server error" }, 500);
  }
});
