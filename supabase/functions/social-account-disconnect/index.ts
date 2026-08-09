
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/social-helpers.ts";

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

    // Validar se a conta pertence ao usuário
    const { data: account, error: accError } = await supabaseAdmin
      .from("social_accounts")
      .select("id, user_id, provider, provider_connection_id")
      .eq("id", social_account_id)
      .eq("user_id", user.id)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: "Social account not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Se for PostPeer, tentar desconectar no provedor
    if (account.provider === 'postpeer' && account.provider_connection_id) {
      const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
      if (POSTPEER_API_KEY) {
        try {
          const { PostPeerClient } = await import("../_shared/social-helpers.ts");
          const postpeer = new PostPeerClient(POSTPEER_API_KEY);
          await postpeer.deleteConnection(account.provider_connection_id);
        } catch (e) {
          console.warn("Could not disconnect from PostPeer provider:", e);
        }
      }
    }

    // 2. Remover credenciais locais (fallback direct)
    await supabaseAdmin
      .from("social_account_credentials")
      .delete()
      .eq("social_account_id", social_account_id);

    // 3. Limpar campos da conta social
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        connection_status: "nao_conectada",
        external_account_id: null,
        token_expires_at: null,
        last_sync_at: null,
        profile_image_url: null,
        provider_connection_id: null,
        provider_account_id: null,
        provider_status: null,
        connected_at: null,
        provider: null
      })
      .eq("id", social_account_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error in social-account-disconnect:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
