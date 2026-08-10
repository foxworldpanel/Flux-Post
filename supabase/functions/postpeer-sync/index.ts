import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, PostPeerClient } from "../_shared/social-helpers.ts";

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { social_account_id } = await req.json();
    if (!social_account_id) {
      return new Response(JSON.stringify({ error: "Missing social_account_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: account, error: accError } = await supabaseAdmin
      .from("social_accounts")
      .select("*")
      .eq("id", social_account_id)
      .eq("user_id", user.id)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (account.provider !== 'postpeer' || !account.provider_profile_id) {
      return new Response(JSON.stringify({ error: "Not a PostPeer account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    if (!POSTPEER_API_KEY) {
      return new Response(JSON.stringify({ error: "Config missing" }), {
        status: 412,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postpeer = new PostPeerClient(POSTPEER_API_KEY);
    const integrations = await postpeer.listIntegrations(account.provider_profile_id);
    
    // Tenta encontrar por ID de conexão ou tenta recuperar pela plataforma se ID for nulo
    let integration = integrations.find(i => i.id === account.provider_connection_id);
    
    if (!integration && !account.provider_connection_id) {
      // LINK/RECOVERY: Se não temos ID local mas temos o profileId, pegamos a primeira da plataforma
      integration = integrations.find(i => i.platform.toLowerCase() === account.platform.toLowerCase());
      console.log("[postpeer-sync] Link recovery attempted", { found: !!integration });
    }

    if (!integration) {
      // Se não encontrar, e já tínhamos um ID, talvez tenha sido deletada
      if (account.provider_connection_id) {
        await supabaseAdmin
          .from("social_accounts")
          .update({ 
            connection_status: 'requer_reconexao', 
            provider_status: 'not_found',
            last_sync_at: new Date().toISOString()
          })
          .eq("id", account.id);
      }
        
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Integration not found in PostPeer for this profile and platform" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar dados locais (Reconciliação)
    await supabaseAdmin
      .from("social_accounts")
      .update({
        provider_connection_id: integration.id,
        provider_account_id: integration.platformUserId,
        external_account_id: integration.platformUserId,
        external_display_name: integration.displayName || undefined,
        provider_status: integration.status,
        connection_status: (integration.status === 'active' || integration.status === 'valid') ? 'conectada' : 'erro',
        profile_image_url: integration.imageUrl || account.profile_image_url,
        connected_at: account.connected_at || new Date().toISOString(),
        last_sync_at: new Date().toISOString()
      })
      .eq("id", account.id);

    return new Response(JSON.stringify({ success: true, status: integration.status, recovered: !account.provider_connection_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });


  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
