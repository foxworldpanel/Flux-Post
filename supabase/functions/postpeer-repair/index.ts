import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, PostPeerClient } from "../_shared/social-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const POSTPEER_API_KEY = Deno.env.get("POSTPEER_API_KEY");
    const postpeer = new PostPeerClient(POSTPEER_API_KEY!);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const { data: accounts } = await supabaseAdmin
      .from("social_accounts")
      .select("*")
      .ilike("account_name", "%TikTok Conta 02%")
      .eq("user_id", user.id);

    const targetAccount = accounts?.[0];
    if (!targetAccount) throw new Error("TikTok Conta 02 not found in Flux database");

    // Discovery de profiles
    const response = await fetch("https://api.postpeer.dev/v1/profiles", {
        headers: { "x-access-key": POSTPEER_API_KEY! }
    });
    const profilesData = await response.json();
    const profiles = profilesData.profiles || [];
    
    let foundIntegration = null;
    let foundProfileId = null;

    for (const p of profiles) {
        const ints = await postpeer.listIntegrations(p.id);
        const match = ints.find(i => i.platform.toLowerCase() === 'tiktok' && i.displayName === 'Só Trend Oficial');
        if (match) {
            foundIntegration = match;
            foundProfileId = p.id;
            break;
        }
    }

    if (!foundIntegration) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: "Could not find 'Só Trend Oficial' integration in any PostPeer profile." 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reparar a social_account
    const { error: updateError } = await supabaseAdmin
      .from("social_accounts")
      .update({
        provider: 'postpeer',
        provider_profile_id: foundProfileId,
        provider_connection_id: foundIntegration.id,
        provider_account_id: foundIntegration.platformUserId,
        external_account_id: foundIntegration.platformUserId,
        connection_status: 'conectada',
        account_name: foundIntegration.displayName,
        username: foundIntegration.displayName,
        profile_image_url: foundIntegration.imageUrl,
        connected_at: targetAccount.connected_at || new Date().toISOString(),
        last_sync_at: new Date().toISOString()
      })
      .eq("id", targetAccount.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
        success: true, 
        integration: foundIntegration,
        profileId: foundProfileId
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
