
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
      .select("*")
      .eq("id", social_account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: "Social account not found or access denied" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (account.status === 'archived') {
      return new Response(JSON.stringify({ error: "Cannot connect an archived account" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Validar plataforma
    const allowedPlatforms = ['tiktok', 'instagram', 'facebook', 'youtube'];
    if (!allowedPlatforms.includes(account.platform)) {
      return new Response(JSON.stringify({ error: `Platform ${account.platform} not supported via PostPeer yet` }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Verificar PostPeer API Key
    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    if (!POSTPEER_API_KEY) {
      return new Response(JSON.stringify({ error: "postpeer_config_pending", message: "Configuração PostPeer pendente." }), { 
        status: 412, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const postpeer = new PostPeerClient(POSTPEER_API_KEY);
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:8080";
    
    // 4. Gerar State para correlação
    const state = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseAdmin
      .from("social_oauth_states")
      .insert({
        user_id: user.id,
        social_account_id: account.id,
        state,
        expires_at: expiresAt.toISOString(),
      });

    // 5. Iniciar conexão no PostPeer
    const redirectUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/postpeer-callback`;
    
    const { connection_id, authorization_url } = await postpeer.createConnection({
      platform: account.platform,
      redirect_url: redirectUrl,
      state,
      metadata: {
        flux_account_id: account.id,
        flux_user_id: user.id
      }
    });

    // 6. Associar connection_id temporariamente (opcional, mas bom para debug)
    await supabaseAdmin
      .from("social_accounts")
      .update({
        provider: 'postpeer',
        provider_connection_id: connection_id,
        provider_status: 'pending'
      })
      .eq("id", account.id);

    return new Response(JSON.stringify({ authorization_url }), { 
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
