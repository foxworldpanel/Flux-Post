
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
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      console.error("PostPeer callback error:", errorParam);
      return Response.redirect(`${appUrl}/accounts?error=${encodeURIComponent(errorParam)}`, 302);
    }

    if (!state) {
      return Response.redirect(`${appUrl}/accounts?error=missing_state`, 302);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Validar state
    const { data: stateData, error: stateFetchError } = await supabaseAdmin
      .from("social_oauth_states")
      .select("*, social_accounts(provider_profile_id, platform)")
      .eq("state", state)
      .is("used_at", null)
      .single();

    if (stateFetchError || !stateData) {
      return Response.redirect(`${appUrl}/accounts?error=invalid_state`, 302);
    }

    if (new Date(stateData.expires_at) < new Date()) {
      return Response.redirect(`${appUrl}/accounts?error=state_expired`, 302);
    }

    const profileId = stateData.social_accounts?.provider_profile_id;
    const platform = stateData.social_accounts?.platform;

    // Limpa registro pending (criado apenas para iniciar o OAuth) quando o fluxo falha
    const cleanupPending = async () => {
      await supabaseAdmin
        .from("social_accounts")
        .delete()
        .eq("id", stateData.social_account_id)
        .eq("connection_status", "nao_conectada")
        .is("provider_connection_id", null);
    };

    if (!profileId || !platform) {
      return Response.redirect(`${appUrl}/accounts?error=missing_profile_context`, 302);
    }

    // Marcar state como usado
    await supabaseAdmin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // 2. Consultar integrações no PostPeer (GET /connect/integrations?profileId=...)
    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    if (!POSTPEER_API_KEY) {
      return Response.redirect(`${appUrl}/accounts?error=config_pending`, 302);
    }

    const postpeer = new PostPeerClient(POSTPEER_API_KEY);
    const integrations = await postpeer.listIntegrations(profileId);

    // Identificar a integração recém-criada para esta plataforma
    const integration = integrations.find(i => i.platform.toLowerCase() === platform.toLowerCase());

    if (!integration) {
      await cleanupPending();
      return Response.redirect(`${appUrl}/accounts?error=integration_not_found`, 302);
    }

    // 3. Verificar duplicidade (server-side)
    const { data: existingAccount } = await supabaseAdmin
      .from("social_accounts")
      .select("id, account_name")
      .eq("provider", "postpeer")
      .eq("provider_account_id", integration.platformUserId)
      .neq("id", stateData.social_account_id)
      .single();

    if (existingAccount) {
      await cleanupPending();
      return Response.redirect(`${appUrl}/accounts?error=already_connected&account=${encodeURIComponent(existingAccount.account_name || 'outra')}`, 302);
    }

    // 4. Atualizar social_account com dados reais do PostPeer
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        provider: 'postpeer',
        provider_connection_id: integration.id,
        provider_account_id: integration.platformUserId,
        provider_status: integration.status,
        external_account_id: integration.platformUserId,
        external_display_name: integration.displayName || undefined,
        profile_image_url: integration.imageUrl || undefined,
        connection_status: 'conectada',
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        metadata: {
          postpeer_integration_id: integration.id,
          postpeer_updated_at: integration.updatedAt
        }
      })
      .eq("id", stateData.social_account_id);

    if (updateError) {
      console.error("Error updating social account:", updateError);
      await cleanupPending();
      return Response.redirect(`${appUrl}/accounts?error=database_update_failed`, 302);
    }

    return Response.redirect(`${appUrl}/accounts?success=postpeer_connected`, 302);

  } catch (err: any) {
    console.error("Critical error in postpeer-callback:", err);
    return Response.redirect(`${appUrl}/accounts?error=internal_callback_error`, 302);
  }
});
