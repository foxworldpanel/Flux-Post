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
