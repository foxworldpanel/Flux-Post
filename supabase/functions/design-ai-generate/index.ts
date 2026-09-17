import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_IMAGE_MODEL =
  Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2.5-sunburst";
const ANTHROPIC_DESIGN_MODEL =
  Deno.env.get("ANTHROPIC_DESIGN_MODEL") || "claude-sonnet-4-6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ProviderMode = "openai" | "claude_openai";

interface GenerateRequest {
  styleId?: string | null;
  providerMode?: ProviderMode;
  prompt?: string;
  width?: number;
  height?: number;
  formatName?: string;
  quality?: "low" | "medium" | "high" | "xhigh" | "max";
  transparent?: boolean;
  overlay?: Record<string, unknown>;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeDimension(value: number, fallback: number) {
  const safe = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(3840, Math.max(256, Math.round(safe / 16) * 16));
}

function shouldTryFallback(status: number, payload: any) {
  const code = String(payload?.error?.code || "").toLowerCase();
  const message = String(payload?.error?.message || "").toLowerCase();
  return status === 404 || code === "model_not_found" || message.includes("model") && message.includes("not found");
}

async function requestOpenAiImage(
  model: string,
  prompt: string,
  references: Array<{ dataUrl: string; mediaType: string }>,
  size: string,
  quality: string,
  transparent: boolean,
) {
  const safeQuality = model === "gpt-image-2" && ["xhigh", "max"].includes(quality)
    ? "high"
    : quality;

  let response: Response;
  if (references.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", safeQuality);
    form.append("background", transparent ? "transparent" : "opaque");
    form.append("output_format", "png");
    references.forEach((reference, index) => {
      const bytes = base64ToBytes(reference.dataUrl.split(",")[1]);
      form.append(
        "image[]",
        new Blob([bytes], { type: reference.mediaType }),
        `reference-${index + 1}.${reference.mediaType.split("/")[1] || "png"}`,
      );
    });

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality: safeQuality,
        background: transparent ? "transparent" : "opaque",
        output_format: "png",
        n: 1,
      }),
    });
  }

  const payload = await response.json();
  return { response, payload };
}

async function analyzeWithClaude(
  references: Array<{ dataUrl: string; mediaType: string }>,
  styleName: string,
  notes: string,
) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const content: any[] = references.map(reference => ({
    type: "image",
    source: {
      type: "base64",
      media_type: reference.mediaType,
      data: reference.dataUrl.split(",")[1],
    },
  }));

  content.push({
    type: "text",
    text: `Você é um diretor de arte sênior. Analise as referências do padrão visual "${styleName}".
Instruções adicionais: ${notes || "nenhuma"}.
Descreva em português, de forma prática, a direção visual que outro modelo deve seguir: composição, iluminação, paleta, contraste, textura, fotografia/ilustração, hierarquia, atmosfera e elementos que devem ser evitados. Não copie marcas ou textos presentes nas referências. Retorne somente o briefing, sem introdução.`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_DESIGN_MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Erro Anthropic ${response.status}`);
  }

  const analysis = payload?.content
    ?.filter((item: any) => item.type === "text")
    ?.map((item: any) => item.text)
    ?.join("\n")
    ?.trim();

  if (!analysis) throw new Error("O Claude não retornou a direção visual");
  return analysis;
}

serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase não configurado");
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Autenticação necessária" }, 401);

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sessão inválida" }, 401);

    const user = authData.user;
    const body = (await request.json()) as GenerateRequest;
    const providerMode: ProviderMode =
      body.providerMode === "claude_openai" ? "claude_openai" : "openai";
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json({ error: "Descreva a imagem que deseja criar" }, 400);

    const width = normalizeDimension(Number(body.width), 1024);
    const height = normalizeDimension(Number(body.height), 1024);
    const ratio = Math.max(width, height) / Math.min(width, height);
    const pixels = width * height;
    if (ratio > 3 || pixels < 655360 || pixels > 8294400) {
      return json({ error: "A medida personalizada está fora dos limites do gerador" }, 400);
    }

    let style: any = null;
    let references: any[] = [];
    if (body.styleId) {
      const { data: styleData, error: styleError } = await service
        .from("design_ai_styles")
        .select("*")
        .eq("id", body.styleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (styleError) throw styleError;
      if (!styleData) return json({ error: "Padrão visual não encontrado" }, 404);
      style = styleData;

      const { data: referenceData, error: referenceError } = await service
        .from("design_ai_style_references")
        .select("*")
        .eq("style_id", style.id)
        .eq("user_id", user.id)
        .order("position")
        .limit(10);
      if (referenceError) throw referenceError;
      references = referenceData || [];
    }

    const referenceImages: Array<{ dataUrl: string; mediaType: string }> = [];
    for (const reference of references) {
      const { data, error } = await service.storage
        .from("design-ai")
        .download(reference.storage_path);
      if (error || !data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      if (!bytes.length || bytes.length > 10_485_760) continue;
      referenceImages.push({
        dataUrl: `data:${reference.mime_type};base64,${bytesToBase64(bytes)}`,
        mediaType: reference.mime_type,
      });
    }

    let direction = style?.analysis || "";
    if (providerMode === "claude_openai") {
      direction = await analyzeWithClaude(
        referenceImages,
        style?.name || "Projeto atual",
        style?.notes || "",
      );
      if (style) {
        await service
          .from("design_ai_styles")
          .update({
            analysis: direction,
            analysis_provider: providerMode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", style.id)
          .eq("user_id", user.id);
      }
    }

    const finalPrompt = `Crie uma imagem profissional para mídia social.
Objetivo: ${prompt}
${direction ? `Direção visual: ${direction}` : ""}
${style?.notes ? `Preferências do projeto: ${style.notes}` : ""}
Use as imagens fornecidas somente como referência de linguagem visual. Não copie textos, logotipos ou marcas existentes.
IMPORTANTE: não escreva nenhuma palavra, letra, número, preço ou logotipo na imagem. Deixe espaço visual limpo e bem composto para o sistema aplicar texto depois. Resultado premium, pronto para campanha profissional.`;

    const size = `${width}x${height}`;
    const requestedQuality = body.quality || "high";
    let usedImageModel = OPENAI_IMAGE_MODEL;
    let { response: openAiResponse, payload: openAiData } = await requestOpenAiImage(
      usedImageModel,
      finalPrompt,
      referenceImages,
      size,
      requestedQuality,
      Boolean(body.transparent),
    );

    if (!openAiResponse.ok && usedImageModel !== "gpt-image-2" && shouldTryFallback(openAiResponse.status, openAiData)) {
      console.warn(`[design-ai] ${usedImageModel} unavailable; trying gpt-image-2`);
      usedImageModel = "gpt-image-2";
      ({ response: openAiResponse, payload: openAiData } = await requestOpenAiImage(
        usedImageModel,
        finalPrompt,
        referenceImages,
        size,
        requestedQuality,
        Boolean(body.transparent),
      ));
    }

    if (!openAiResponse.ok) {
      console.error("[design-ai] OpenAI error", JSON.stringify(openAiData));
      const upstreamMessage = openAiData?.error?.message || `Erro OpenAI ${openAiResponse.status}`;
      const upstreamCode = openAiData?.error?.code ? ` [${openAiData.error.code}]` : "";
      throw new Error(`${upstreamMessage}${upstreamCode}`);
    }

    const imageBase64 = openAiData?.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("A OpenAI não retornou uma imagem");

    const imageBytes = base64ToBytes(imageBase64);
    const assetId = crypto.randomUUID();
    const storagePath = `${user.id}/generated/${assetId}.png`;
    const { error: uploadError } = await service.storage
      .from("design-ai")
      .upload(storagePath, imageBytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: asset, error: assetError } = await service
      .from("design_ai_assets")
      .insert({
        id: assetId,
        user_id: user.id,
        style_id: style?.id || null,
        provider_mode: providerMode,
        prompt,
        storage_path: storagePath,
        width,
        height,
        format_name: String(body.formatName || "custom").slice(0, 40),
        overlay: body.overlay || {},
      })
      .select("*")
      .single();
    if (assetError) throw assetError;

    const { data: signed } = await service.storage
      .from("design-ai")
      .createSignedUrl(storagePath, 3600);

    return json({
      success: true,
      asset: { ...asset, signedUrl: signed?.signedUrl || null },
      direction,
      models: {
        director: providerMode === "claude_openai" ? ANTHROPIC_DESIGN_MODEL : "openai-image",
        renderer: usedImageModel,
      },
    });
  } catch (error) {
    console.error("[design-ai]", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro ao gerar a imagem" },
      500,
    );
  }
});
