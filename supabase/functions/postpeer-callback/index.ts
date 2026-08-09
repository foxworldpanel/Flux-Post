
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

  const appUrl = Deno.env.get("APP_URL") || "http://localhost:8080";

  try {
    const url = new URL(req.url);
    const connection_id = url.searchParams.get("connection_id");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      console.error("PostPeer callback error:", errorParam);
      return Response.redirect(`${appUrl}/accounts?error=${encodeURIComponent(errorParam)}`, 302);
    }

    if (!connection_id || !state) {
      return Response.redirect(`${appUrl}/accounts?error=missing_parameters`, 302);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Validar state
    const { data: stateData, error: stateFetchError } = await supabaseAdmin
      .from("social_oauth_states")
      .select("*")
      .eq("state", state)
      .is("used_at", null)
      .single();

    if (stateFetchError || !stateData) {
      return Response.redirect(`${appUrl}/accounts?error=invalid_state`, 302);
    }

    if (new Date(stateData.expires_at) < new Date()) {
      return Response.redirect(`${appUrl}/accounts?error=state_expired`, 302);
    }

    // Marcar state como usado
    await supabaseAdmin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // 2. Verificar conexão no PostPeer
    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    if (!POSTPEER_API_KEY) {
      return Response.redirect(`${appUrl}/accounts?error=config_pending`, 302);
    }

    const postpeer = new PostPeerClient(POSTPEER_API_KEY);
    const connection = await postpeer.getConnection(connection_id);

    if (connection.status !== 'connected' && connection.status !== 'active') {
      return Response.redirect(`${appUrl}/accounts?error=connection_not_ready&status=${connection.status}`, 302);
    }

    // 3. Verificar duplicidade (mesmo provedor e conta externa)
    if (connection.external_account_id) {
      const { data: existingAccount } = await supabaseAdmin
        .from("social_accounts")
        .select("id, user_id, account_name")
        .eq("provider", "postpeer")
        .eq("external_account_id", connection.external_account_id)
        .neq("id", stateData.social_account_id)
        .single();

      if (existingAccount) {
        return Response.redirect(`${appUrl}/accounts?error=already_connected&account=${encodeURIComponent(existingAccount.account_name || 'outra')}`, 302);
      }
    }

    // 4. Atualizar social_account
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        provider: 'postpeer',
        provider_connection_id: connection.id,
        provider_account_id: connection.external_account_id,
        provider_status: connection.status,
        external_account_id: connection.external_account_id,
        username: connection.username || undefined,
        account_name: connection.display_name || undefined,
        profile_image_url: connection.avatar_url || undefined,
        connection_status: 'conectada',
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        metadata: {
          ...connection.metadata,
          postpeer_updated_at: connection.updated_at
        }
      })
      .eq("id", stateData.social_account_id);

    if (updateError) {
      console.error("Error updating social account:", updateError);
      return Response.redirect(`${appUrl}/accounts?error=database_update_failed`, 302);
    }

    return Response.redirect(`${appUrl}/accounts?success=postpeer_connected`, 302);

  } catch (err: any) {
    console.error("Critical error in postpeer-callback:", err);
    return Response.redirect(`${appUrl}/accounts?error=internal_callback_error`, 302);
  }
});
