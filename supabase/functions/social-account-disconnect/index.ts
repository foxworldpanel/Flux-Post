
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
      .select("id, user_id")
      .eq("id", social_account_id)
      .eq("user_id", user.id)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: "Social account not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Remover credenciais
    await supabaseAdmin
      .from("social_account_credentials")
      .delete()
      .eq("social_account_id", social_account_id);

    // 2. Limpar campos da conta social
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        connection_status: "nao_conectada",
        external_account_id: null,
        token_expires_at: null,
        last_sync_at: null,
        profile_image_url: null
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
