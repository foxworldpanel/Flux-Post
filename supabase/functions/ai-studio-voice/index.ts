import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let claimedAssetId: string | null = null;
  let providerAccepted = false;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return jsonResponse({ error: "Supabase environment not configured" }, 500);
    }

    const authenticated = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await service.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = await req.json();
    const action = body?.action || "generate";

    if (!ELEVENLABS_API_KEY) {
      return jsonResponse(
        {
          error: "ElevenLabs ainda não foi configurado no servidor",
          code: "ELEVENLABS_NOT_CONFIGURED",
        },
        503,
      );
    }

    if (action === "list_voices") {
      const response = await fetch(
        "https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=true",
        { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
      );
      const payload = await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            error:
              payload?.detail?.message ||
              payload?.detail ||
              `ElevenLabs voices error ${response.status}`,
          },
          502,
        );
      }

      const blockedCategories = new Set(["cloned", "professional"]);
      const voices = (payload?.voices || [])
        .map((voice: any) => ({
          id: voice.voice_id,
          name: voice.name,
          category: String(voice.category || "voice").toLowerCase(),
          description: voice.description || "",
          previewUrl: voice.preview_url || null,
          labels: voice.labels || {},
        }))
        .filter((voice: any) => !blockedCategories.has(voice.category))
        .sort((left: any, right: any) => {
          const leftPriority = left.category === "premade" ? 0 : 1;
          const rightPriority = right.category === "premade" ? 0 : 1;
          return leftPriority - rightPriority || left.name.localeCompare(right.name);
        });

      return jsonResponse({ success: true, voices });
    }

    const scriptId = String(body?.scriptId || "").trim();
    if (!scriptId) return jsonResponse({ error: "scriptId is required" }, 400);

    if (action === "get_audio") {
      const { data: asset, error } = await service
        .from("ai_studio_voice_assets")
        .select("storage_bucket,storage_path,status")
        .eq("script_id", scriptId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!asset || asset.status !== "ready" || !asset.storage_path) {
        return jsonResponse({ error: "Narração ainda não está pronta" }, 404);
      }

      const { data: signed, error: signedError } = await service.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 3600);
      if (signedError) throw signedError;

      return jsonResponse({ success: true, audioUrl: signed.signedUrl });
    }

    if (action !== "generate") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const voiceId = String(body?.voiceId || "").trim();
    const voiceName = String(body?.voiceName || "").trim();
    if (!voiceId) return jsonResponse({ error: "Selecione uma voz" }, 400);

    const { data: claim, error: claimError } = await authenticated.rpc(
      "claim_ai_studio_voice",
      {
        p_script_id: scriptId,
        p_voice_id: voiceId,
        p_voice_name: voiceName || null,
      },
    );
    if (claimError) throw claimError;

    claimedAssetId = claim?.assetId || null;

    if (!claim?.claimed) {
      if (claim?.state === "ready" && claim?.storagePath) {
        const { data: signed, error: signedError } = await service.storage
          .from(claim.storageBucket || "ai-studio-audio")
          .createSignedUrl(claim.storagePath, 3600);
        if (signedError) throw signedError;
        return jsonResponse({
          success: true,
          reused: true,
          state: "ready",
          audioUrl: signed.signedUrl,
        });
      }

      return jsonResponse(
        {
          error:
            claim?.state === "needs_review"
              ? "A geração anterior precisa de reconciliação e não será repetida automaticamente"
              : "A narração já está sendo processada",
          state: claim?.state || "blocked",
        },
        409,
      );
    }

    const providerResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: claim.narration,
          model_id: "eleven_multilingual_v2",
          language_code: "pt",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      },
    );

    const providerRequestId = providerResponse.headers.get("request-id");
    const providerPayload = await providerResponse.json();

    if (!providerResponse.ok || !providerPayload?.audio_base64) {
      const providerMessage =
        providerPayload?.detail?.message ||
        providerPayload?.detail ||
        `ElevenLabs error ${providerResponse.status}`;
      const friendlyMessage = String(providerMessage).includes(
        "Instantly cloned voices are not available",
      )
        ? "Essa voz clonada não está disponível no seu plano. Atualize as vozes e escolha uma voz padrão."
        : providerMessage;

      await service
        .from("ai_studio_voice_assets")
        .update({
          status: "failed_safe",
          error_message: friendlyMessage,
          provider_request_id: providerRequestId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimedAssetId)
        .eq("user_id", user.id);

      return jsonResponse(
        {
          error: friendlyMessage,
        },
        502,
      );
    }

    providerAccepted = true;
    const audioBytes = decodeBase64(providerPayload.audio_base64);
    const storagePath =
      `${user.id}/${claim.projectId}/${scriptId}/${claimedAssetId}.mp3`;

    const { error: uploadError } = await service.storage
      .from("ai-studio-audio")
      .upload(storagePath, audioBytes, {
        contentType: "audio/mpeg",
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: assetError } = await service
      .from("ai_studio_voice_assets")
      .update({
        status: "ready",
        storage_path: storagePath,
        size_bytes: audioBytes.length,
        alignment: {
          alignment: providerPayload.alignment || null,
          normalized_alignment: providerPayload.normalized_alignment || null,
        },
        provider_request_id: providerRequestId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimedAssetId)
      .eq("user_id", user.id);
    if (assetError) throw assetError;

    const { error: scriptError } = await service
      .from("ai_studio_scripts")
      .update({ status: "voiced", updated_at: new Date().toISOString() })
      .eq("id", scriptId)
      .eq("user_id", user.id);
    if (scriptError) throw scriptError;

    const { data: signed, error: signedError } = await service.storage
      .from("ai-studio-audio")
      .createSignedUrl(storagePath, 3600);
    if (signedError) throw signedError;

    return jsonResponse({
      success: true,
      reused: false,
      state: "ready",
      audioUrl: signed.signedUrl,
      alignmentAvailable: Boolean(
        providerPayload.alignment || providerPayload.normalized_alignment,
      ),
    });
  } catch (error: any) {
    console.error("[ai-studio-voice] Fatal error", error);

    if (claimedAssetId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await service
          .from("ai_studio_voice_assets")
          .update({
            status: providerAccepted ? "needs_review" : "failed_safe",
            error_message: error?.message || "Voice generation failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", claimedAssetId);
      } catch (reconciliationError) {
        console.error("[ai-studio-voice] Reconciliation failed", reconciliationError);
      }
    }

    return jsonResponse(
      { error: error?.message || "Internal voice generation error" },
      500,
    );
  }
});
