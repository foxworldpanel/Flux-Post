
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, decryptToken, encryptToken, TikTokTokenResponse } from "../_shared/social-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const { social_account_id } = await req.json();
    if (!social_account_id) {
      throw new Error("Missing social_account_id");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const encryptionKey = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY missing");
    }

    // 1. Carregar credenciais
    const { data: credentials, error: credError } = await supabaseAdmin
      .from("social_account_credentials")
      .select("*")
      .eq("social_account_id", social_account_id)
      .eq("provider", "tiktok")
      .single();

    if (credError || !credentials) {
      throw new Error("Credentials not found");
    }

    const refreshToken = await decryptToken(credentials.refresh_token_encrypted, encryptionKey);

    const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
    const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      throw new Error("TikTok secrets not configured");
    }

    // 2. Chamar Refresh no TikTok
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const data: TikTokTokenResponse = await response.json();
    if (!response.ok) {
      console.error("TikTok token refresh failed");
      throw new Error(data.error_description || "Token refresh failed");
    }

    // 3. Criptografar e persistir novos tokens
    const accessExpiry = new Date();
    accessExpiry.setSeconds(accessExpiry.getSeconds() + data.expires_in);
    
    const refreshExpiry = new Date();
    refreshExpiry.setSeconds(refreshExpiry.getSeconds() + data.refresh_expires_in);

    const encryptedAccess = await encryptToken(data.access_token, encryptionKey);
    const encryptedRefresh = await encryptToken(data.refresh_token, encryptionKey);

    await supabaseAdmin
      .from("social_account_credentials")
      .update({
        access_token_encrypted: encryptedAccess,
        refresh_token_encrypted: encryptedRefresh,
        access_token_expires_at: accessExpiry.toISOString(),
        refresh_token_expires_at: refreshExpiry.toISOString(),
      })
      .eq("id", credentials.id);

    await supabaseAdmin
      .from("social_accounts")
      .update({
        token_expires_at: accessExpiry.toISOString(),
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", social_account_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error in tiktok-token-refresh:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
