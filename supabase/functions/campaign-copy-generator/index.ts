import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Platform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "generic";

interface CopyRequest {
  contentId?: string;
  contentTitle?: string;
  category?: string;
  author?: string;

  platform?: Platform;

  music?: {
    title?: string;
    artist?: string;
  };

  artistProfile?: {
    name?: string;
    primaryLanguage?: string;
    communicationIdentity?: string;
    aiBriefing?: string;
    priorityHashtags?: string[];
    blockedHashtags?: string[];
  };

  regenerate?: boolean;
  previousCaption?: string;
  previousHashtags?: string;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude did not return valid JSON");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // ─────────────────────────────────────────────
    // Authentication
    // ─────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse(
        {
          error: "Unauthorized",
          stage: "auth",
        },
        401,
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        {
          error: "Supabase environment not configured",
          stage: "config",
        },
        500,
      );
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(
        {
          error: "Invalid token",
          stage: "auth",
        },
        401,
      );
    }

    // ─────────────────────────────────────────────
    // Anthropic configuration
    // ─────────────────────────────────────────────
    if (!ANTHROPIC_API_KEY) {
      return jsonResponse(
        {
          error: "ANTHROPIC_API_KEY not configured",
          stage: "config",
        },
        500,
      );
    }

    const body: CopyRequest = await req.json();

    const platform = body.platform || "generic";

    const platformInstructions: Record<string, string> = {
      instagram:
        "Create an engaging Instagram caption. Natural tone, visually appealing formatting, controlled hashtags and no spammy language.",

      tiktok:
        "Create a short and direct TikTok caption designed for discovery and engagement. Keep it natural and concise.",

      youtube:
        "Create copy suitable for a YouTube Short. The caption must be concise and useful as a short-form video description.",

      facebook:
        "Create a natural Facebook caption focused on engagement without excessive hashtags.",

      generic:
        "Create a natural social media caption suitable for short-form vertical video.",
    };

    const regenerationContext =
      body.regenerate && (body.previousCaption || body.previousHashtags)
        ? `
This is a regeneration request.

Previous caption:
${body.previousCaption || "(none)"}

Previous hashtags:
${body.previousHashtags || "(none)"}

Generate a genuinely different alternative. Do not simply paraphrase the previous version.
`
        : "";

    const artistProfile = body.artistProfile;

    const priorityHashtags =
      artistProfile?.priorityHashtags?.length
        ? artistProfile.priorityHashtags.join(" ")
        : "(none)";

    const blockedHashtags =
      artistProfile?.blockedHashtags?.length
        ? artistProfile.blockedHashtags.join(" ")
        : "(none)";

    const prompt = `
You are the editorial copywriter for a professional music and social media publishing system.

ARTIST EDITORIAL PROFILE:
Artist: ${artistProfile?.name || body.music?.artist || "not informed"}
Language: ${artistProfile?.primaryLanguage || "pt-BR"}
Communication identity: ${artistProfile?.communicationIdentity || "not informed"}
Editorial briefing: ${artistProfile?.aiBriefing || "not informed"}
Required/prioritized hashtags: ${priorityHashtags}
Blocked hashtags: ${blockedHashtags}

Generate the final social media copy for the following publication.

PLATFORM:
${platform}

CONTENT:
Title: ${body.contentTitle || "Untitled vertical video"}
Category: ${body.category || "general"}
Original creator/source: ${body.author || "unknown"}

MUSIC:
Track: ${body.music?.title || "not informed"}
Artist: ${body.music?.artist || "not informed"}

PLATFORM INSTRUCTION:
${platformInstructions[platform] || platformInstructions.generic}

EDITORIAL RULES:
- Write in the artist profile language: ${artistProfile?.primaryLanguage || "pt-BR"}.
- Follow the artist communication identity and editorial briefing when provided.
- Include the required/prioritized hashtags when relevant, without duplicating them.
- Never use any blocked hashtag.
- Sound human and natural.
- Do not mention that AI generated the text.
- Do not invent facts about the artist, song or video.
- Do not claim awards, chart positions, popularity or achievements unless explicitly provided.
- Avoid engagement bait.
- Avoid repetitive generic marketing language.
- Avoid excessive emojis.
- The caption must be ready to publish.
- Hashtags must be relevant to the actual content, music and platform.
- Use between 4 and 8 hashtags.
- Do not repeat hashtags.
- Return hashtags beginning with #.
${regenerationContext}

Return ONLY valid JSON using exactly this structure:

{
  "caption": "final caption here",
  "hashtags": "#tag1 #tag2 #tag3"
}
`.trim();

    console.log(
      `[campaign-copy-generator] user=${user.id} platform=${platform} content=${body.contentId || "unknown"}`,
    );

    // ─────────────────────────────────────────────
    // Claude
    // ─────────────────────────────────────────────
    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 700,
          temperature: 0.8,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
    );

    const anthropicData = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      console.error(
        "[campaign-copy-generator] Anthropic error:",
        JSON.stringify(anthropicData),
      );

      return jsonResponse(
        {
          error:
            anthropicData?.error?.message ||
            `Anthropic API error ${anthropicResponse.status}`,
          stage: "anthropic",
        },
        502,
      );
    }

    const text = anthropicData?.content
      ?.filter((item: any) => item.type === "text")
      ?.map((item: any) => item.text)
      ?.join("\n")
      ?.trim();

    if (!text) {
      throw new Error("Claude returned an empty response");
    }

    const generated = extractJson(text);

    if (
      typeof generated.caption !== "string" ||
      typeof generated.hashtags !== "string"
    ) {
      throw new Error("Claude response is missing caption or hashtags");
    }

    const caption = generated.caption.trim();
    const hashtags = generated.hashtags.trim();

    if (!caption) {
      throw new Error("Claude returned an empty caption");
    }

    console.log(
      `[campaign-copy-generator] generated platform=${platform} captionChars=${caption.length}`,
    );

    return jsonResponse({
      success: true,
      contentId: body.contentId || null,
      platform,
      copy: {
        caption,
        hashtags,
      },
      usage: {
        input_tokens: anthropicData?.usage?.input_tokens || 0,
        output_tokens: anthropicData?.usage?.output_tokens || 0,
      },
      model: anthropicData?.model || "claude-haiku-4-5-20251001",
    });
  } catch (error: any) {
    console.error(
      "[campaign-copy-generator] Fatal error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error: error?.message || "Internal error",
        stage: "internal",
      },
      500,
    );
  }
});
