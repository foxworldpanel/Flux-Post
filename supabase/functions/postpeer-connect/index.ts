import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { 
  corsHeaders, 
  PostPeerClient 
} from "../_shared/social-helpers.ts";

serve(async (req) => {
  console.log("FUNCTION_STARTED", { method: req.method, url: req.url });
  
  if (req.method === "OPTIONS") {
    console.log("OPTIONS_OK");
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    
    if (!authHeader) {
      console.error("MISSING_AUTH_HEADER");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log("AUTH_START");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error("AUTH_FAILED", authError);
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    console.log("AUTH_OK", { userId: user.id });

    // Try to parse body
    let social_account_id;
    let run_diagnostic = false;
    try {
      const body = await req.json();
      social_account_id = body.social_account_id;
      run_diagnostic = body.diagnostic === true;
    } catch (e) {
      console.log("BODY_PARSE_EMPTY_OR_FAILED");
    }

    // 2. Verificar PostPeer API Key
    console.log("POSTPEER_KEY_CHECK");
    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    if (!POSTPEER_API_KEY) {
      console.error("POSTPEER_KEY_MISSING");
      return new Response(JSON.stringify({ error: "postpeer_config_pending", message: "Configuração PostPeer pendente." }), { 
        status: 412, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    console.log("POSTPEER_KEY_PRESENT");

    const postpeer = new PostPeerClient(POSTPEER_API_KEY);

    // MODO DIAGNÓSTICO
    if (run_diagnostic) {
      console.log("DIAGNOSTIC_MODE_START");
      const results: any = { stages: [] };

      try {
        console.log("POSTPEER_HEALTH_START");
        results.stages.push("HEALTH_START");
        const health = await postpeer.checkHealth();
        results.health = health;
        console.log("POSTPEER_HEALTH_OK");
        results.stages.push("HEALTH_OK");

        console.log("PROFILE_START");
        results.stages.push("PROFILE_START");
        const profile = await postpeer.createProfile("Flux Diagnostic " + new Date().toISOString());
        results.profile = profile;
        const profileId = profile.id || profile.data?.id;
        console.log("PROFILE_OK", { profileId });
        results.stages.push("PROFILE_OK");

        console.log("TIKTOK_CONNECT_START_NO_REDIRECT");
        results.stages.push("TIKTOK_NO_REDIRECT_START");
        const connectNoRedirect = await postpeer.getOAuthUrl("tiktok", profileId);
        results.connect_no_redirect = connectNoRedirect;
        console.log("TIKTOK_CONNECT_OK_NO_REDIRECT");
        results.stages.push("TIKTOK_NO_REDIRECT_OK");

        console.log("TIKTOK_CONNECT_START_WITH_REDIRECT");
        results.stages.push("TIKTOK_REDIRECT_START");
        const redirectUri = "https://kdbgfgnopqqnzmvxvtje.supabase.co/functions/v1/postpeer-callback";
        const connectWithRedirect = await postpeer.getOAuthUrl("tiktok", profileId, redirectUri);
        results.connect_with_redirect = connectWithRedirect;
        console.log("TIKTOK_CONNECT_OK_WITH_REDIRECT");
        results.stages.push("TIKTOK_REDIRECT_OK");

      } catch (err: any) {
        console.error("DIAGNOSTIC_STAGE_FAILED", err);
        results.error = {
          status: err.status,
          message: err.message,
          error: err.error,
          endpoint: err.endpoint,
          full_data: err.full_data
        };
      }

      return new Response(JSON.stringify(results), { 
        status: results.error ? 500 : 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!social_account_id) {
      return new Response(JSON.stringify({ 
        error: "social_account_id is required",
        stage: "AUTH_OK"
      }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 1. Carregar social_account
    const { data: account, error: accountError } = await supabaseClient
      .from("social_accounts")
      .select("*, artist:artists(name)")
      .eq("id", social_account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      console.error("ACCOUNT_FETCH_FAILED", accountError);
      return new Response(JSON.stringify({ error: "Social account not found or access denied" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    console.log("ACCOUNT_OK", { id: account.id, platform: account.platform });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Garantir Profile no PostPeer
    console.log("PROFILE_START");
    let profileId = account.provider_profile_id;
    if (!profileId) {
      const profileName = account.artist?.name || account.account_name || `Account ${account.id.slice(0, 8)}`;
      const profileResponse: any = await postpeer.createProfile(profileName);
      profileId = profileResponse.id || profileResponse.data?.id;
      
      if (!profileId) {
         console.error("POSTPEER_PROFILE_CREATE_FAILED_NO_ID", profileResponse);
         throw { status: 500, message: "PostPeer profile creation failed to return an ID", full_data: profileResponse };
      }

      // Persistir profileId
      await supabaseAdmin
        .from("social_accounts")
        .update({ provider_profile_id: profileId })
        .eq("id", account.id);
    }
    console.log("PROFILE_OK", { profileId });

    // 4. Gerar State para CSRF
    const state = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await supabaseAdmin
      .from("social_oauth_states")
      .insert({
        user_id: user.id,
        social_account_id: account.id,
        state,
        expires_at: expiresAt.toISOString(),
      });

    // 5. Obter URL de Autorização
    console.log("OAUTH_START");
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/postpeer-callback?state=${state}`;
    
    const { url } = await postpeer.getOAuthUrl(
      account.platform,
      profileId,
      callbackUrl
    );
    console.log("OAUTH_OK", { url: url.substring(0, 50) + "..." });

    return new Response(JSON.stringify({ authorization_url: url }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("CRITICAL_ERROR", err);
    return new Response(JSON.stringify({ 
      error: err.error || "internal_error", 
      message: err.message || "An unexpected error occurred",
      status: err.status,
      endpoint: err.endpoint,
      full_data: err.full_data
    }), { 
      status: err.status || 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
