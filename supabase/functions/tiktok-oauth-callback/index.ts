
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { 
  corsHeaders, 
  encryptToken, 
  TikTokTokenResponse, 
  TikTokUserInfoResponse 
} from "../_shared/social-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) {
    console.error("CRITICAL: APP_URL environment variable is missing.");
    return new Response("Configuration Error: APP_URL missing", { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return Response.redirect(`${appUrl}/accounts?error=${errorParam}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}/accounts?error=invalid_callback`, 302);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Validar state (atomicamente)
    const { data: stateData, error: stateFetchError } = await supabaseAdmin
      .from("social_oauth_states")
      .select("*")
      .eq("state", state)
      .is("used_at", null)
      .single();

    if (stateFetchError || !stateData) {
      return Response.redirect(`${appUrl}/accounts?error=state_not_found_or_used`, 302);
    }

    if (new Date(stateData.expires_at) < new Date()) {
      return Response.redirect(`${appUrl}/accounts?error=state_expired`, 302);
    }

    // Marcar state como usado imediatamente
    await supabaseAdmin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // 2. Token Exchange
    const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
    const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const TIKTOK_REDIRECT_URI = Deno.env.get("TIKTOK_REDIRECT_URI");
    const encryptionKey = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY");

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI || !encryptionKey) {
      console.error("Missing critical configuration for TikTok OAuth");
      return Response.redirect(`${appUrl}/accounts?error=config_pending`, 302);
    }

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: TIKTOK_REDIRECT_URI,
      }),
    });

    const tokenData: TikTokTokenResponse = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("TikTok token exchange failed");
      return Response.redirect(`${appUrl}/accounts?error=token_exchange_failed`, 302);
    }

    const { access_token, refresh_token, expires_in, refresh_expires_in, open_id, scope } = tokenData;

    // 3. Obter User Info
    const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    if (!userResponse.ok) {
      console.error("TikTok user info request failed");
      return Response.redirect(`${appUrl}/accounts?error=user_info_failed`, 302);
    }
    
    const userData: TikTokUserInfoResponse = await userResponse.json();
    if (userData.error) {
      console.error("TikTok user info returned error:", userData.error.message);
      return Response.redirect(`${appUrl}/accounts?error=user_info_error`, 302);
    }

    const tiktokUser = userData.data.user;
    const externalId = open_id || tiktokUser.open_id;

    // 4. Verificar duplicidade
    const { data: existingAccount } = await supabaseAdmin
      .from("social_accounts")
      .select("id, user_id")
      .eq("provider", "tiktok")
      .eq("external_account_id", externalId)
      .single();

    if (existingAccount && existingAccount.user_id === stateData.user_id && existingAccount.id !== stateData.social_account_id) {
       return Response.redirect(`${appUrl}/accounts?error=already_connected_elsewhere`, 302);
    }
    
    if (existingAccount && existingAccount.user_id !== stateData.user_id) {
       return Response.redirect(`${appUrl}/accounts?error=connected_by_another_user`, 302);
    }

    // 5. Criptografar e Salvar Credenciais
    const encryptedAccess = await encryptToken(access_token, encryptionKey);
    const encryptedRefresh = await encryptToken(refresh_token, encryptionKey);

    const accessExpiry = new Date();
    accessExpiry.setSeconds(accessExpiry.getSeconds() + expires_in);
    
    const refreshExpiry = new Date();
    refreshExpiry.setSeconds(refreshExpiry.getSeconds() + refresh_expires_in);

    await supabaseAdmin
      .from("social_account_credentials")
      .upsert({
        user_id: stateData.user_id,
        social_account_id: stateData.social_account_id,
        provider: "tiktok",
        access_token_encrypted: encryptedAccess,
        refresh_token_encrypted: encryptedRefresh,
        access_token_expires_at: accessExpiry.toISOString(),
        refresh_token_expires_at: refreshExpiry.toISOString(),
        scopes: scope ? scope.split(",") : [],
        metadata: {
          display_name: tiktokUser.display_name,
          avatar_url: tiktokUser.avatar_url
        }
      });

    await supabaseAdmin
      .from("social_accounts")
      .update({
        external_account_id: externalId,
        account_name: tiktokUser.display_name || undefined,
        profile_image_url: tiktokUser.avatar_url || undefined,
        connection_status: "conectada",
        last_sync_at: new Date().toISOString(),
        token_expires_at: accessExpiry.toISOString(),
      })
      .eq("id", stateData.social_account_id);

    return Response.redirect(`${appUrl}/accounts?success=tiktok_connected`, 302);

  } catch (err: any) {
    console.error("Critical error in tiktok-oauth-callback:", err.message);
    return Response.redirect(`${appUrl}/accounts?error=callback_critical_failure`, 302);
  }
});
