
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { social_account_id } = await req.json();

    if (!social_account_id) {
      return new Response(JSON.stringify({ error: "social_account_id is required" }), { 
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
      return new Response(JSON.stringify({ error: "Social account not found or access denied" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Verificar PostPeer API Key
    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    if (!POSTPEER_API_KEY) {
      return new Response(JSON.stringify({ error: "postpeer_config_pending", message: "Configuração PostPeer pendente." }), { 
        status: 412, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const postpeer = new PostPeerClient(POSTPEER_API_KEY);
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Garantir Profile no PostPeer
    let profileId = account.provider_profile_id;
    if (!profileId) {
      const profileName = account.artist?.name || account.account_name || `Account ${account.id.slice(0, 8)}`;
      const profile = await postpeer.createProfile(profileName);
      profileId = profile.id;
      
      // Persistir profileId
      await supabaseAdmin
        .from("social_accounts")
        .update({ provider_profile_id: profileId })
        .eq("id", account.id);
    }

    // 4. Gerar State para CSRF e correlação local
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

    // 5. Obter URL de Autorização (GET /connect/{platform})
    // O PostPeer redirecionará para o callback do desenvolvedor configurado no dashboard deles.
    // Mas passamos redirectUri aqui se a API suportar override ou for usada para callback interno.
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/postpeer-callback?state=${state}`;
    
    const { url } = await postpeer.getOAuthUrl(
      account.platform,
      profileId,
      callbackUrl
    );

    return new Response(JSON.stringify({ authorization_url: url }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("Error in postpeer-connect:", err);
    return new Response(JSON.stringify({ 
      error: err.error || "internal_error", 
      message: err.message || "An unexpected error occurred" 
    }), { 
      status: err.status || 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
