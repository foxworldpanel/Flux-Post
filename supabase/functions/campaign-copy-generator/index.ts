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

const COPY_GENERATOR_BUILD = "v6-studio-social-copy";

type Platform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "generic";

type CopyMode = "music" | "video";

interface CopyRequest {
  action?: "generate_copy" | "account_variants" | "motivational_scripts";
  contentId?: string;
  copyMode?: CopyMode;
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

  baseCopy?: {
    caption?: string;
    hashtags?: string;
  };

  accounts?: Array<{
    id: string;
    platform?: Platform;
    accountName?: string;
    username?: string | null;
  }>;

  motivational?: {
    theme?: string;
    tone?: string;
    audience?: string;
    durationSeconds?: number;
    quantity?: number;
    includeCta?: boolean;
    batchStart?: number;
    totalQuantity?: number;
  };
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

function enforceArtistHashtags(
  generated: unknown,
  priority: unknown,
  blocked: unknown,
) {
  const tokenize = (value: unknown): string[] => {
    const values = Array.isArray(value)
      ? value
      : typeof value === "string"
      ? value.split(/[\s,;]+/)
      : [];

    return values
      .flatMap(item => String(item).split(/[\s,;]+/))
      .map(item =>
        item
          .trim()
          .replace(/^["']+|["']+$/g, "")
          .replace(/^#+/, "")
          .replace(/\s+/g, "")
      )
      .filter(Boolean);
  };

  const blockedSet = new Set(
    tokenize(blocked).map(tag => tag.toLocaleLowerCase()),
  );
  const unique = new Map<string, string>();

  for (const tag of [...tokenize(priority), ...tokenize(generated)]) {
    const key = tag.toLocaleLowerCase();
    if (blockedSet.has(key) || unique.has(key)) continue;
    unique.set(key, "#" + tag);
  }

  return Array.from(unique.values()).join(" ");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary);
}

async function loadThumbnailImage(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    const response = await fetch(parsed.toString());
    if (!response.ok) return null;

    const mediaType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const supportedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);

    if (!supportedTypes.has(mediaType)) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 5_000_000) return null;

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: bytesToBase64(bytes),
      },
    };
  } catch (error) {
    console.warn(
      "[campaign-copy-generator] Thumbnail unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function appendMusicCredit(
  caption: string,
  artist?: string,
  title?: string,
) {
  const cleanArtist = (artist || "").trim();
  const cleanTitle = (title || "").trim();

  if (!cleanTitle) return caption.trim();

  const credit = cleanArtist
    ? `🎵 Música: ${cleanArtist} — ${cleanTitle}`
    : `🎵 Música: ${cleanTitle}`;

  const withoutExistingCredit = caption
    .trim()
    .replace(/\n*🎵?\s*Música\s*:[^\n]*$/iu, "")
    .trim();

  return withoutExistingCredit
    ? `${withoutExistingCredit}\n\n${credit}`
    : credit;
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

    const action =
      body.action === "account_variants"
        ? "account_variants"
        : body.action === "motivational_scripts"
        ? "motivational_scripts"
        : "generate_copy";
    const platform = body.platform || "generic";
    const copyMode: CopyMode =
      body.copyMode === "video" ? "video" : "music";

    let contentDetails: {
      title?: string | null;
      category?: string | null;
      niche?: string | null;
      tags?: unknown;
      author?: string | null;
      source?: string | null;
      thumbnail_url?: string | null;
    } | null = null;

    if (action === "generate_copy" && copyMode === "video") {
      if (!body.contentId) {
        return jsonResponse(
          { error: "contentId is required for video-based copy" },
          400,
        );
      }

      const { data, error } = await supabase
        .from("content_library")
        .select("title,category,niche,tags,author,source,thumbnail_url")
        .eq("id", body.contentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        return jsonResponse(
          {
            error: `Content lookup failed: ${error.message}`,
            stage: "content",
          },
          500,
        );
      }

      if (!data) {
        return jsonResponse(
          { error: "Content not found or unauthorized", stage: "content" },
          404,
        );
      }

      contentDetails = data;
    }

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

    const videoTags = Array.isArray(contentDetails?.tags)
      ? contentDetails.tags.map(tag => String(tag)).join(", ")
      : typeof contentDetails?.tags === "string"
      ? contentDetails.tags
      : "(none)";

    const videoFocus =
      copyMode === "video"
        ? `
PRIMARY COPY SOURCE: VIDEO CONTENT
- Make the visible subject/theme of the video the central topic.
- Use the attached thumbnail when available, together with title, category,
  niche and tags.
- The thumbnail is a representative frame only. Do not invent unseen
  actions, locations, people, brands or events.
- Ignore the track title, musical genre and artist genre when selecting
  descriptive hashtags.
- Apart from required artist priority hashtags, every hashtag must describe
  the visible video subject or its concrete theme.
- Example: a chocolate video should use chocolate/food/dessert hashtags,
  never Melodic House, Deep House or Electronic Music hashtags.
- Music attribution is appended separately by the system.
`
        : `
PRIMARY COPY SOURCE: MUSIC
- Make the track title, artist and artist editorial profile the central
  basis of the caption and hashtags.
- Treat the video as supporting visual context only.
- Preserve the current music-focused editorial behavior.
`;

    const priorityHashtags =
      artistProfile?.priorityHashtags?.length
        ? artistProfile.priorityHashtags.join(" ")
        : "(none)";

    const blockedHashtags =
      artistProfile?.blockedHashtags?.length
        ? artistProfile.blockedHashtags.join(" ")
        : "(none)";

    const hashtagSelectionRule =
      copyMode === "video"
        ? `- VIDEO MODE: use only hashtags about the visible video content.
- Do not use track names, music genres or generic electronic-music hashtags.
- The only artist/music hashtags allowed are those explicitly listed as required/prioritized.`
        : `- MUSIC MODE: hashtags may describe the track, artist, musical genre and platform context.`;

    const standardPrompt = `
You are the editorial copywriter for a professional music and social media publishing system.

ARTIST EDITORIAL PROFILE:
Artist: ${artistProfile?.name || body.music?.artist || "not informed"}
Language: ${artistProfile?.primaryLanguage || "pt-BR"}
Communication identity: ${artistProfile?.communicationIdentity || "not informed"}
Editorial briefing: ${artistProfile?.aiBriefing || "not informed"}
Required/prioritized hashtags: ${priorityHashtags}
Blocked hashtags: ${blockedHashtags}

Generate the final social media copy for the following publication.

COPY MODE:
${copyMode}
${videoFocus}

PLATFORM:
${platform}

CONTENT:
Title: ${contentDetails?.title || body.contentTitle || "Untitled vertical video"}
Category: ${contentDetails?.category || body.category || "general"}
Niche: ${contentDetails?.niche || "not informed"}
Tags: ${videoTags}
Original creator: ${contentDetails?.author || body.author || "unknown"}
Source: ${contentDetails?.source || "unknown"}

MUSIC:
Track: ${body.music?.title || "not informed"}
Artist: ${body.music?.artist || "not informed"}

PLATFORM INSTRUCTION:
${platformInstructions[platform] || platformInstructions.generic}

EDITORIAL RULES:
- Write in the artist profile language: ${artistProfile?.primaryLanguage || "pt-BR"}.
- Follow the artist communication identity and editorial briefing when provided.
- Always include every required/prioritized hashtag, without duplication.
- Never use any blocked hashtag.
- Sound human and natural.
- Do not mention that AI generated the text.
- Do not invent facts about the artist, song or video.
- Do not claim awards, chart positions, popularity or achievements unless explicitly provided.
- Avoid engagement bait.
- Avoid repetitive generic marketing language.
- Avoid excessive emojis.
- The caption must be ready to publish.
- Do not write a music attribution/credit line; the system appends it
  automatically in a fixed format.
${hashtagSelectionRule}
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

    const variantAccounts = body.accounts || [];

    if (action === "account_variants") {
      if (
        !body.contentId ||
        !body.baseCopy?.caption?.trim() ||
        variantAccounts.length < 2 ||
        variantAccounts.length > 20
      ) {
        return jsonResponse(
          {
            error:
              "Account variants require contentId, a base caption and 2 to 20 accounts",
            stage: "variants",
          },
          400,
        );
      }

      if (
        new Set(variantAccounts.map(account => account.id)).size !==
        variantAccounts.length
      ) {
        return jsonResponse(
          { error: "Duplicate accounts in variant request", stage: "variants" },
          400,
        );
      }
    }

    const variantsPrompt = `
You are creating account-specific social copy variants for one publication.

LANGUAGE:
${artistProfile?.primaryLanguage || "pt-BR"}

ARTIST PROFILE:
Artist: ${artistProfile?.name || body.music?.artist || "not informed"}
Communication identity: ${artistProfile?.communicationIdentity || "not informed"}
Editorial briefing: ${artistProfile?.aiBriefing || "not informed"}
Required/prioritized hashtags: ${priorityHashtags}
Blocked hashtags: ${blockedHashtags}

BASE APPROVED COPY:
Caption:
${body.baseCopy?.caption || ""}

Hashtags:
${body.baseCopy?.hashtags || ""}

MUSIC:
Track: ${body.music?.title || "not informed"}
Artist: ${body.music?.artist || "not informed"}

DESTINATION ACCOUNTS:
${JSON.stringify(variantAccounts)}

RULES:
- Return exactly one variant for every destination account, using its exact id.
- Every caption must be genuinely unique in wording and sentence structure.
- Preserve the meaning, tone and factual limits of the approved base copy.
- Adapt naturally to each account's platform.
- Do not mention account names or usernames unless the base copy already does.
- Do not invent facts, places, people, brands, actions or achievements.
- Do not add a music credit line; the system appends it automatically.
- Preserve the approved base hashtag set; do not introduce new hashtags.
- Always include every required/prioritized hashtag, without duplication.
- Never use blocked hashtags.
- Use hashtags beginning with #.
- Do not return duplicate captions.

Return ONLY valid JSON in exactly this structure:
{
  "variants": [
    {
      "accountId": "exact account id",
      "caption": "unique final caption without music credit",
      "hashtags": "#tag1 #tag2 #tag3"
    }
  ]
}
`.trim();

    const motivationalQuantity = Math.min(
      10,
      Math.max(1, Number(body.motivational?.quantity || 3)),
    );
    const motivationalDuration = Math.min(
      60,
      Math.max(15, Number(body.motivational?.durationSeconds || 30)),
    );
    const targetWords = Math.round(motivationalDuration * 2.15);
    const motivationalTheme =
      body.motivational?.theme?.trim() || "recomeço e confiança";
    const motivationalTone =
      body.motivational?.tone?.trim() || "emocional e acolhedor";
    const motivationalAudience =
      body.motivational?.audience?.trim() || "público adulto geral";
    const motivationalBatchStart = Math.max(
      1,
      Number(body.motivational?.batchStart || 1),
    );
    const motivationalTotalQuantity = Math.min(
      180,
      Math.max(
        motivationalQuantity,
        Number(body.motivational?.totalQuantity || motivationalQuantity),
      ),
    );

    const motivationalPrompt = `
You are the scriptwriter for Flux Post AI Studio. Create ${motivationalQuantity}
distinct short motivational voice-over scripts in Brazilian Portuguese.

WORKSPACE: Sourcee
THEME: ${motivationalTheme}
TONE: ${motivationalTone}
AUDIENCE: ${motivationalAudience}
TARGET DURATION: ${motivationalDuration} seconds
TARGET LENGTH: approximately ${targetWords} words per narration
INCLUDE A NATURAL CTA: ${body.motivational?.includeCta ? "yes" : "no"}
GLOBAL PLAN: scripts ${motivationalBatchStart} to ${motivationalBatchStart + motivationalQuantity - 1} of ${motivationalTotalQuantity}

EDITORIAL RULES:
- Each script must have a strong opening in the first sentence.
- Narration must sound human when spoken aloud, with short clear sentences.
- Every script must be genuinely different in angle, hook and wording.
- Avoid empty cliches, exaggerated promises, diagnoses and therapeutic claims.
- Do not mention AI, Flux Post, Sourcee, social networks or engagement metrics.
- Do not include hashtags, emojis, scene directions or quotation marks in narration.
- Do not invent personal stories or claim that a specific event happened.
- Keep the narration within 15 percent of the target word count.
- visualKeywords must contain 4 to 7 concrete Pexels search expressions in English.
- estimatedSeconds must reflect the returned narration length.
- socialCaption must be a short post description inspired by the narration,
  but must not copy the narration word for word. Maximum 220 characters.
- socialCaption should complement the video with one natural reflection or
  question. Do not add a music credit because the system adds it separately.
- socialHashtags must contain 4 to 8 relevant Brazilian Portuguese hashtags,
  separated by spaces, without spam or unrelated trending tags.
- Use the GLOBAL PLAN position to vary the angle and avoid repetitive scripts,
  captions, openings and hashtags across a large production batch.

Return ONLY valid JSON using exactly this structure:
{
  "scripts": [
    {
      "title": "short internal title",
      "hook": "opening sentence",
      "narration": "complete narration including the hook and closing",
      "closing": "final sentence",
      "socialCaption": "short complementary post description",
      "socialHashtags": "#motivação #coragem #recomeço #inspiração",
      "visualKeywords": ["sunrise nature", "ocean waves"],
      "estimatedSeconds": ${motivationalDuration}
    }
  ]
}
`.trim();

    const prompt =
      action === "account_variants"
        ? variantsPrompt
        : action === "motivational_scripts"
        ? motivationalPrompt
        : standardPrompt;

    const thumbnailImage =
      action === "generate_copy" && copyMode === "video"
        ? await loadThumbnailImage(contentDetails?.thumbnail_url)
        : null;

    const messageContent: any[] = [];
    if (thumbnailImage) messageContent.push(thumbnailImage);
    messageContent.push({ type: "text", text: prompt });

    console.log(
      `[campaign-copy-generator] user=${user.id} action=${action} platform=${platform} mode=${copyMode} content=${body.contentId || "unknown"} accounts=${variantAccounts.length} thumbnail=${Boolean(thumbnailImage)}`,
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
          max_tokens:
            action === "account_variants"
              ? Math.min(5000, Math.max(1200, variantAccounts.length * 420))
              : action === "motivational_scripts"
              ? Math.min(7000, Math.max(1600, motivationalQuantity * 650))
              : 700,
          temperature:
            action === "account_variants" || action === "motivational_scripts"
              ? 0.9
              : 0.8,
          messages: [
            {
              role: "user",
              content: messageContent,
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

    if (action === "motivational_scripts") {
      if (!Array.isArray(generated.scripts)) {
        throw new Error("Claude response is missing motivational scripts");
      }

      const scripts = generated.scripts
        .slice(0, motivationalQuantity)
        .map((script: any, index: number) => {
          if (
            !script ||
            typeof script.title !== "string" ||
            typeof script.narration !== "string" ||
            !script.narration.trim()
          ) {
            throw new Error(`Invalid motivational script at position ${index + 1}`);
          }

          return {
            title: script.title.trim(),
            hook:
              typeof script.hook === "string" ? script.hook.trim() : "",
            narration: script.narration.trim(),
            closing:
              typeof script.closing === "string" ? script.closing.trim() : "",
            socialCaption:
              typeof script.socialCaption === "string"
                ? script.socialCaption.trim().slice(0, 500)
                : "",
            socialHashtags:
              typeof script.socialHashtags === "string"
                ? script.socialHashtags.trim().slice(0, 1000)
                : "",
            visualKeywords: Array.isArray(script.visualKeywords)
              ? script.visualKeywords
                  .map((keyword: unknown) => String(keyword).trim())
                  .filter(Boolean)
                  .slice(0, 7)
              : [],
            estimatedSeconds: Math.min(
              60,
              Math.max(
                15,
                Number(script.estimatedSeconds || motivationalDuration),
              ),
            ),
          };
        });

      if (scripts.length !== motivationalQuantity) {
        throw new Error(
          `Claude returned ${scripts.length} of ${motivationalQuantity} requested scripts`,
        );
      }

      return jsonResponse({
        success: true,
        build: COPY_GENERATOR_BUILD,
        action,
        scripts,
        usage: {
          input_tokens: anthropicData?.usage?.input_tokens || 0,
          output_tokens: anthropicData?.usage?.output_tokens || 0,
        },
        model: anthropicData?.model || "claude-haiku-4-5-20251001",
      });
    }

    if (action === "account_variants") {
      if (!Array.isArray(generated.variants)) {
        throw new Error("Claude response is missing account variants");
      }

      const generatedByAccount = new Map<string, any>();

      for (const variant of generated.variants) {
        if (
          variant &&
          typeof variant.accountId === "string" &&
          !generatedByAccount.has(variant.accountId)
        ) {
          generatedByAccount.set(variant.accountId, variant);
        }
      }

      const normalizedCaptions = new Set<string>();
      const variants = variantAccounts.map(account => {
        const variant = generatedByAccount.get(account.id);

        if (
          !variant ||
          typeof variant.caption !== "string" ||
          typeof variant.hashtags !== "string" ||
          !variant.caption.trim()
        ) {
          throw new Error(
            `Claude did not return a valid variant for account ${account.id}`,
          );
        }

        const rawCaption = variant.caption
          .trim()
          .replace(/\n*🎵?\s*Música\s*:[^\n]*$/iu, "")
          .trim();
        const normalizedCaption = rawCaption
          .toLocaleLowerCase()
          .replace(/\s+/g, " ");

        if (normalizedCaptions.has(normalizedCaption)) {
          throw new Error(
            "Claude returned duplicate account captions; generation aborted",
          );
        }

        normalizedCaptions.add(normalizedCaption);

        return {
          accountId: account.id,
          caption: appendMusicCredit(
            rawCaption,
            body.music?.artist || artistProfile?.name,
            body.music?.title,
          ),
          hashtags: enforceArtistHashtags(
            body.baseCopy?.hashtags || variant.hashtags,
            artistProfile?.priorityHashtags,
            artistProfile?.blockedHashtags,
          ),
        };
      });

      return jsonResponse({
        success: true,
        build: COPY_GENERATOR_BUILD,
        action,
        contentId: body.contentId,
        variants,
        usage: {
          input_tokens: anthropicData?.usage?.input_tokens || 0,
          output_tokens: anthropicData?.usage?.output_tokens || 0,
        },
        model:
          anthropicData?.model || "claude-haiku-4-5-20251001",
      });
    }

    if (
      typeof generated.caption !== "string" ||
      typeof generated.hashtags !== "string"
    ) {
      throw new Error("Claude response is missing caption or hashtags");
    }

    const generatedCaption = generated.caption.trim();
    const caption = appendMusicCredit(
      generatedCaption,
      body.music?.artist || artistProfile?.name,
      body.music?.title,
    );
    const hashtags = enforceArtistHashtags(
      generated.hashtags,
      artistProfile?.priorityHashtags,
      artistProfile?.blockedHashtags,
    );

    if (!generatedCaption) {
      throw new Error("Claude returned an empty caption");
    }

    console.log(
      `[campaign-copy-generator] generated platform=${platform} captionChars=${caption.length}`,
    );

    return jsonResponse({
      success: true,
      build: COPY_GENERATOR_BUILD,
      contentId: body.contentId || null,
      platform,
      copyMode,
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
