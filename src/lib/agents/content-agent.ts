// Content Agent — brand voice learning and A/B variant generation
// WHY: The landing page promises "scroll-stopping posts in your brand voice."
// This agent delivers on that promise by analyzing a user's existing content
// to learn their voice, then generating multiple variants with different
// strategic angles so the user can pick the best one.

import { claude } from "@/lib/claude";
import type { SocialPost } from "@/lib/social/indexer";

export type BrandVoice = {
  tone: string; // e.g. "bold and premium"
  vocabulary: string[]; // words to use and words to avoid
  style: string; // e.g. "short punchy sentences"
  emoji: boolean;
  hashtags: string[];
};

export type ContentVariant = {
  content: string;
  variant: string; // "A" | "B" | "C"
  rationale: string;
};

/**
 * Learn brand voice from a user's existing posts using Claude.
 * WHY: Heuristic detection (like deriveBrandVoice in indexer.ts) only catches
 * surface-level patterns. This uses Claude to deeply analyze vocabulary choices,
 * sentence structure, emotional tone, and rhetorical patterns — then outputs a
 * structured BrandVoice that can be injected into all future content generation.
 */
export async function learnBrandVoice(
  recentPosts: Array<{ content: string; platform: string }>,
): Promise<BrandVoice> {
  // Fallback for users with no content history
  if (recentPosts.length === 0) {
    return {
      tone: "professional and approachable",
      vocabulary: [],
      style: "clear and direct",
      emoji: false,
      hashtags: [],
    };
  }

  // Sample up to 20 posts to keep context manageable
  const sample = recentPosts.slice(0, 20);
  const postsBlock = sample
    .map((p, i) => `[${p.platform}] Post ${i + 1}: ${p.content}`)
    .join("\n\n");

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a brand voice analyst. Analyze the given social media posts and extract a precise brand voice profile. Return ONLY valid JSON matching this schema:
{
  "tone": "2-4 word description of overall tone",
  "vocabulary": ["list of 5-10 signature words/phrases the brand uses", "also include 3-5 words to AVOID prefixed with NOT:"],
  "style": "description of sentence structure and writing patterns",
  "emoji": true/false,
  "hashtags": ["recurring hashtags or hashtag patterns"]
}

Be specific. "energetic" is too vague. "bold, street-culture, unapologetic" is right.`,
    messages: [
      {
        role: "user",
        content: `Analyze these ${sample.length} posts and extract the brand voice:\n\n${postsBlock}`,
      },
    ],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("") || "";

  try {
    // Extract JSON from the response (handles both raw JSON and markdown-wrapped)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      tone: String(parsed.tone ?? "professional"),
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      style: String(parsed.style ?? "clear and direct"),
      emoji: Boolean(parsed.emoji),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
  } catch (err) {
    console.error("[ContentAgent] Failed to parse brand voice:", err);
    return {
      tone: "professional and approachable",
      vocabulary: [],
      style: "clear and direct",
      emoji: false,
      hashtags: [],
    };
  }
}

/**
 * Generate A/B content variants for a given prompt.
 * WHY: No single approach works for every audience. Generating 3 variants with
 * different strategic angles (direct, story-driven, question-led) lets the user
 * pick what resonates — and over time, the analytics agent can learn which
 * variant style performs best for their audience.
 *
 * Each variant includes a rationale explaining the strategic choice so the user
 * learns marketing thinking, not just gets output. Human-centric: teach the tool user.
 */
export async function generateVariants(
  prompt: string,
  brandVoice: BrandVoice,
  platform: string,
  count: number = 3,
): Promise<ContentVariant[]> {
  const platformLimits: Record<string, string> = {
    twitter: "280 characters max. Punchy, no fluff.",
    instagram: "2200 characters max. First line is the hook — must stop the scroll. Use line breaks for readability.",
    facebook: "No hard limit but 40-80 words performs best. Conversational tone.",
    linkedin: "1300 characters for preview. Professional but not corporate. Open with a bold statement or stat.",
    tiktok: "Caption for video. 150 characters max. Trend-aware, casual.",
    youtube: "Video title + description. Title under 60 chars. Description front-loaded with keywords.",
  };

  const platformGuidance = platformLimits[platform.toLowerCase()] ?? "Standard social media post.";

  const voiceBlock = [
    `Tone: ${brandVoice.tone}`,
    `Style: ${brandVoice.style}`,
    brandVoice.emoji ? "Uses emoji" : "Avoids emoji",
    brandVoice.vocabulary.length > 0
      ? `Key vocabulary: ${brandVoice.vocabulary.join(", ")}`
      : "",
    brandVoice.hashtags.length > 0
      ? `Hashtag style: ${brandVoice.hashtags.join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const variantStyles = [
    { label: "A", name: "Direct and Bold", instruction: "Lead with the strongest value proposition. No buildup. Hit them with the point immediately." },
    { label: "B", name: "Story-driven", instruction: "Open with a micro-story, relatable situation, or before/after narrative. Draw them in emotionally before the CTA." },
    { label: "C", name: "Question-led Engagement", instruction: "Open with a thought-provoking question that makes the reader pause. Use curiosity gap to drive engagement." },
  ];

  // Only use as many styles as requested
  const activeStyles = variantStyles.slice(0, Math.min(count, variantStyles.length));

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a world-class social media copywriter. Generate content variants that match the brand voice EXACTLY. Every word matters.

Brand Voice:
${voiceBlock}

Platform: ${platform}
Platform rules: ${platformGuidance}

Return ONLY valid JSON — an array of objects:
[
  {"content": "the actual post text", "variant": "A", "rationale": "1-2 sentences on why this approach might work"}
]

Do NOT include markdown formatting. Return raw JSON only.`,
    messages: [
      {
        role: "user",
        content: `Create ${activeStyles.length} variants for: "${prompt}"

${activeStyles.map((s) => `Variant ${s.label} (${s.name}): ${s.instruction}`).join("\n")}`,
      },
    ],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("") || "";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error("Response is not an array");

    return parsed.map((item: Record<string, unknown>) => ({
      content: String(item.content ?? ""),
      variant: String(item.variant ?? "?"),
      rationale: String(item.rationale ?? ""),
    }));
  } catch (err) {
    console.error("[ContentAgent] Failed to parse variants:", err);
    // Return single fallback variant rather than failing completely
    return [
      {
        content: `[Generation failed — please retry] ${prompt}`,
        variant: "A",
        rationale: "Fallback due to parsing error.",
      },
    ];
  }
}

/**
 * Build a brand voice context string for injection into system prompts.
 * WHY: Other agents (the chat, the create-content route) need to know the brand
 * voice without re-analyzing posts every time. This serializes a BrandVoice into
 * a concise instruction block.
 */
export function brandVoiceToPrompt(voice: BrandVoice): string {
  const parts = [
    `Write in a ${voice.tone} tone.`,
    `Style: ${voice.style}.`,
  ];

  if (voice.emoji) {
    parts.push("Use emoji where natural.");
  } else {
    parts.push("Do not use emoji.");
  }

  const useWords = voice.vocabulary.filter((w) => !w.startsWith("NOT:"));
  const avoidWords = voice.vocabulary
    .filter((w) => w.startsWith("NOT:"))
    .map((w) => w.replace("NOT:", "").trim());

  if (useWords.length > 0) {
    parts.push(`Incorporate these words/phrases naturally: ${useWords.join(", ")}.`);
  }
  if (avoidWords.length > 0) {
    parts.push(`Avoid these words: ${avoidWords.join(", ")}.`);
  }
  if (voice.hashtags.length > 0) {
    parts.push(`Hashtag style: ${voice.hashtags.join(" ")}.`);
  }

  return parts.join(" ");
}
