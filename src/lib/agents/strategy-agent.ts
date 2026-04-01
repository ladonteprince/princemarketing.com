// Strategy Agent — AI-powered competitor, audience, and strategy analysis
// WHY: The landing page promises "Analyzes your business, competitors, and audience
// to build a data-backed marketing strategy tailored to your goals."
// This agent delivers on that promise using Claude for deep analysis rather than
// web scraping, making it reliable and legally clean.

import { claude } from "@/lib/claude";

// --- Types ---

export type CompetitorInsight = {
  name: string;
  platforms: string[];
  strengths: string[];
  contentThemes: string[];
  postingFrequency: string;
  estimatedEngagement: string;
};

export type AudienceInsight = {
  persona: string;
  interests: string[];
  peakTimes: { day: string; time: string }[];
  contentPreferences: string[];
  demographics: string;
};

export type MarketingStrategy = {
  contentPillars: Array<{
    name: string;
    description: string;
    percentage: number;
  }>;
  postingSchedule: Array<{
    platform: string;
    frequency: string;
    bestTimes: string[];
  }>;
  contentMix: { images: number; videos: number; copy: number };
  toneGuidelines: string;
  campaignIdeas: Array<{
    name: string;
    goal: string;
    duration: string;
    platforms: string[];
  }>;
  kpis: Array<{ metric: string; target: string; timeframe: string }>;
};

// --- Competitor Analysis ---

/**
 * Analyze competitors in a given industry using Claude's knowledge.
 * WHY: AI-powered analysis instead of web scraping. Claude knows about major brands,
 * their marketing strategies, and content patterns across industries. This gives
 * users actionable competitor intelligence without any API or scraping dependencies.
 */
export async function analyzeCompetitors(
  industry: string,
  businessName: string,
  connectedPlatforms: string[],
): Promise<CompetitorInsight[]> {
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a competitive intelligence analyst specializing in social media marketing. You provide accurate, actionable competitor analysis based on your knowledge of industry players, their marketing strategies, and content patterns. Always return valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Analyze the top 3-5 competitors for a business called "${businessName}" in the "${industry}" industry.

The business is active on these platforms: ${connectedPlatforms.join(", ") || "none yet"}.

For each competitor, provide:
- name: Company/brand name
- platforms: Which social platforms they use effectively
- strengths: 2-3 key marketing strengths
- contentThemes: 3-5 recurring content themes they use
- postingFrequency: How often they typically post (e.g., "2-3 times daily on Instagram, weekly on YouTube")
- estimatedEngagement: Qualitative assessment of their engagement levels

Return ONLY a JSON array of competitor objects. No markdown, no explanation.
Example format: [{"name": "...", "platforms": [...], "strengths": [...], "contentThemes": [...], "postingFrequency": "...", "estimatedEngagement": "..."}]`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    // WHY: Claude sometimes wraps JSON in markdown code fences. Strip them.
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((c: Record<string, unknown>) => ({
      name: String(c.name ?? "Unknown"),
      platforms: Array.isArray(c.platforms)
        ? c.platforms.map(String)
        : [],
      strengths: Array.isArray(c.strengths)
        ? c.strengths.map(String)
        : [],
      contentThemes: Array.isArray(c.contentThemes)
        ? c.contentThemes.map(String)
        : [],
      postingFrequency: String(c.postingFrequency ?? "Unknown"),
      estimatedEngagement: String(c.estimatedEngagement ?? "Unknown"),
    }));
  } catch (err) {
    console.error("[StrategyAgent] Failed to parse competitor analysis:", err);
    return [];
  }
}

// --- Audience Analysis ---

/**
 * Analyze the user's audience based on their connected platform data.
 * WHY: Takes the social context string built by the indexer (which contains
 * follower counts, top topics, brand voice, engagement stats) and asks Claude
 * to derive a detailed audience persona. This turns raw platform data into
 * actionable audience intelligence.
 */
export async function analyzeAudience(
  socialContext: string,
): Promise<AudienceInsight> {
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are an audience research specialist. You analyze social media data to build detailed audience personas, identify optimal posting times, and understand content preferences. Always return valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Based on this social media profile data, build a detailed audience analysis:

${socialContext || "No platform data available yet. Provide general best-practice recommendations."}

Return ONLY a JSON object with these fields:
- persona: A 2-3 sentence description of their ideal audience member
- interests: Array of 5-8 interests/topics the audience likely cares about
- peakTimes: Array of objects with {day, time} for best posting times (use general day names like "Monday" and times like "9:00 AM", "6:00 PM")
- contentPreferences: Array of 4-6 content types/formats the audience prefers (e.g., "short-form video", "carousel posts", "behind-the-scenes")
- demographics: A 1-2 sentence summary of likely demographics (age range, location tendencies, professional context)

No markdown, no explanation. Just the JSON object.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      persona: String(parsed.persona ?? ""),
      interests: Array.isArray(parsed.interests)
        ? parsed.interests.map(String)
        : [],
      peakTimes: Array.isArray(parsed.peakTimes)
        ? parsed.peakTimes.map((t: Record<string, unknown>) => ({
            day: String(t.day ?? ""),
            time: String(t.time ?? ""),
          }))
        : [],
      contentPreferences: Array.isArray(parsed.contentPreferences)
        ? parsed.contentPreferences.map(String)
        : [],
      demographics: String(parsed.demographics ?? ""),
    };
  } catch (err) {
    console.error("[StrategyAgent] Failed to parse audience analysis:", err);
    return {
      persona: "Unable to determine audience persona. Connect social platforms for better analysis.",
      interests: [],
      peakTimes: [],
      contentPreferences: [],
      demographics: "",
    };
  }
}

// --- Strategy Builder ---

/**
 * Generate a complete marketing strategy using Claude.
 * WHY: This is the core deliverable — a comprehensive, actionable marketing plan
 * that combines competitor intelligence, audience data, and business goals into
 * specific content pillars, posting schedules, and campaign ideas. Users get
 * a strategy they can execute immediately, not a generic playbook.
 */
export async function buildStrategy(businessContext: {
  name: string;
  industry: string;
  audience: AudienceInsight;
  competitors: CompetitorInsight[];
  goals: string[];
  platforms: string[];
}): Promise<MarketingStrategy> {
  const { name, industry, audience, competitors, goals, platforms } =
    businessContext;

  // WHY: We serialize context into a natural-language brief so Claude can reason
  // about it holistically, rather than parsing fragmented JSON fields.
  const competitorBrief = competitors.length > 0
    ? competitors
        .map(
          (c) =>
            `${c.name}: active on ${c.platforms.join(", ")}. Strengths: ${c.strengths.join(", ")}. Content themes: ${c.contentThemes.join(", ")}. Posts ${c.postingFrequency}. Engagement: ${c.estimatedEngagement}.`,
        )
        .join("\n")
    : "No competitor data available.";

  const audienceBrief = audience.persona
    ? `Audience persona: ${audience.persona}\nInterests: ${audience.interests.join(", ")}\nPreferred content: ${audience.contentPreferences.join(", ")}\nDemographics: ${audience.demographics}`
    : "No audience data available yet.";

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are a senior marketing strategist who builds comprehensive, actionable marketing plans. Your strategies are specific, measurable, and tailored to the business — never generic. You understand platform-specific best practices and content optimization. Always return valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Build a complete marketing strategy for:

BUSINESS: ${name}
INDUSTRY: ${industry}
ACTIVE PLATFORMS: ${platforms.join(", ") || "None selected yet"}
GOALS: ${goals.length > 0 ? goals.join(", ") : "Grow brand awareness and engagement"}

COMPETITOR LANDSCAPE:
${competitorBrief}

AUDIENCE DATA:
${audienceBrief}

Return ONLY a JSON object with these fields:

- contentPillars: Array of 3-5 objects with {name, description, percentage} where percentages sum to 100. Each pillar should be specific to this business, not generic.
- postingSchedule: Array of objects with {platform, frequency, bestTimes[]} for each platform the business uses.
- contentMix: Object with {images, videos, copy} as percentages summing to 100. Tailor to the platforms being used.
- toneGuidelines: A 2-3 sentence description of the recommended brand voice and tone.
- campaignIdeas: Array of 3-4 objects with {name, goal, duration, platforms[]} — specific 30-day campaign concepts.
- kpis: Array of 4-6 objects with {metric, target, timeframe} — concrete targets based on the goals.

Make every recommendation specific to "${name}" in the "${industry}" industry. Reference competitor gaps and audience preferences where relevant.

No markdown, no explanation. Just the JSON object.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      contentPillars: Array.isArray(parsed.contentPillars)
        ? parsed.contentPillars.map((p: Record<string, unknown>) => ({
            name: String(p.name ?? ""),
            description: String(p.description ?? ""),
            percentage: Number(p.percentage) || 0,
          }))
        : [],
      postingSchedule: Array.isArray(parsed.postingSchedule)
        ? parsed.postingSchedule.map((s: Record<string, unknown>) => ({
            platform: String(s.platform ?? ""),
            frequency: String(s.frequency ?? ""),
            bestTimes: Array.isArray(s.bestTimes)
              ? s.bestTimes.map(String)
              : [],
          }))
        : [],
      contentMix: {
        images: Number(parsed.contentMix?.images) || 40,
        videos: Number(parsed.contentMix?.videos) || 35,
        copy: Number(parsed.contentMix?.copy) || 25,
      },
      toneGuidelines: String(parsed.toneGuidelines ?? ""),
      campaignIdeas: Array.isArray(parsed.campaignIdeas)
        ? parsed.campaignIdeas.map((c: Record<string, unknown>) => ({
            name: String(c.name ?? ""),
            goal: String(c.goal ?? ""),
            duration: String(c.duration ?? ""),
            platforms: Array.isArray(c.platforms)
              ? c.platforms.map(String)
              : [],
          }))
        : [],
      kpis: Array.isArray(parsed.kpis)
        ? parsed.kpis.map((k: Record<string, unknown>) => ({
            metric: String(k.metric ?? ""),
            target: String(k.target ?? ""),
            timeframe: String(k.timeframe ?? ""),
          }))
        : [],
    };
  } catch (err) {
    console.error("[StrategyAgent] Failed to parse strategy:", err);
    return {
      contentPillars: [],
      postingSchedule: [],
      contentMix: { images: 40, videos: 35, copy: 25 },
      toneGuidelines: "",
      campaignIdeas: [],
      kpis: [],
    };
  }
}

/**
 * Run the full strategy pipeline: competitors + audience + strategy in one call.
 * WHY: Most users want the complete picture, not individual pieces. This orchestrates
 * all three analyses and feeds each result into the next, so the final strategy
 * is informed by real competitor and audience data.
 */
export async function generateFullStrategy(params: {
  businessName: string;
  industry: string;
  goals: string[];
  platforms: string[];
  socialContext: string;
}): Promise<{
  competitors: CompetitorInsight[];
  audience: AudienceInsight;
  strategy: MarketingStrategy;
}> {
  const { businessName, industry, goals, platforms, socialContext } = params;

  // WHY: Run competitor and audience analysis in parallel — they are independent.
  // Strategy depends on both, so it runs after they complete.
  const [competitors, audience] = await Promise.all([
    analyzeCompetitors(industry, businessName, platforms),
    analyzeAudience(socialContext),
  ]);

  const strategy = await buildStrategy({
    name: businessName,
    industry,
    audience,
    competitors,
    goals,
    platforms,
  });

  return { competitors, audience, strategy };
}
