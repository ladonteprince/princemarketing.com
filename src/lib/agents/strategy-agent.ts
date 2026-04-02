// Strategy Agent — AI-powered competitor, audience, and strategy analysis
// WHY: The landing page promises "Analyzes your business, competitors, and audience
// to build a data-backed marketing strategy tailored to your goals."
// This agent delivers on that promise using Claude for structured analysis,
// augmented by Perplexity (real-time web search) and Firecrawl (website crawling)
// for live data. Falls back gracefully to Claude-only if external APIs are unavailable.

import { claude } from "@/lib/claude";
import {
  searchCompetitors as perplexitySearchCompetitors,
  searchIndustryTrends,
  searchAudienceInsights,
} from "@/lib/research/perplexity";
// Firecrawl is available for deep website analysis when competitor URLs are known.
// Usage: import { analyzeCompetitorWebsite } from "@/lib/research/firecrawl";
// Not used in the main pipeline yet — intended for future "deep dive" competitor mode.

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
 * Analyze competitors in a given industry using Perplexity for live data + Claude for structured analysis.
 * WHY: Perplexity provides real-time competitor intelligence (current social stats,
 * recent campaigns, emerging players) that Claude's training data may miss.
 * Claude then structures this live data into our typed CompetitorInsight format.
 * Falls back to Claude-only analysis if Perplexity is unavailable.
 */
export async function analyzeCompetitors(
  industry: string,
  businessName: string,
  connectedPlatforms: string[],
): Promise<CompetitorInsight[]> {
  // Step 1: Fetch real-time competitor data and trends in parallel
  const [competitorData, trendData] = await Promise.all([
    perplexitySearchCompetitors(industry, businessName).catch((err) => {
      console.warn("[StrategyAgent] Perplexity competitor search failed, falling back to Claude:", err);
      return "";
    }),
    searchIndustryTrends(industry).catch((err) => {
      console.warn("[StrategyAgent] Perplexity trend search failed:", err);
      return "";
    }),
  ]);

  // Step 2: Build the research context — either live data or a fallback instruction
  const researchSection = competitorData || trendData
    ? `Here is real-time research data to inform your analysis:\n\nCOMPETITOR RESEARCH:\n${competitorData || "Not available."}\n\nINDUSTRY TRENDS:\n${trendData || "Not available."}\n\nUse this data as your primary source. Supplement with your own knowledge where the research has gaps.`
    : `No real-time research data is available. Use your knowledge of the industry to provide the best analysis possible.`;

  // Step 3: Feed real data to Claude for structured analysis
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a competitive intelligence analyst specializing in social media marketing. You provide accurate, actionable competitor analysis. When provided with real-time research data, use it as your primary source and cite specific details. Always return valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Analyze the top 3-5 competitors for a business called "${businessName}" in the "${industry}" industry.

The business is active on these platforms: ${connectedPlatforms.join(", ") || "none yet"}.

${researchSection}

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
 * Analyze the user's audience based on their connected platform data + live web research.
 * WHY: Combines the user's actual social data (from the indexer) with Perplexity's
 * real-time audience insights to produce a persona grounded in both their specific
 * metrics and current platform-wide trends. Falls back to Claude-only if Perplexity unavailable.
 */
export async function analyzeAudience(
  socialContext: string,
  industry?: string,
  platforms?: string[],
): Promise<AudienceInsight> {
  // Fetch real-time audience insights if we have industry/platform context
  let audienceResearch = "";
  if (industry && platforms && platforms.length > 0) {
    audienceResearch = await searchAudienceInsights(industry, platforms).catch((err) => {
      console.warn("[StrategyAgent] Perplexity audience search failed, falling back to Claude:", err);
      return "";
    });
  }

  const researchSection = audienceResearch
    ? `\n\nREAL-TIME AUDIENCE RESEARCH:\n${audienceResearch}\n\nUse this research data alongside the profile data above to build a more accurate persona.`
    : "";

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are an audience research specialist. You analyze social media data and real-time market research to build detailed audience personas, identify optimal posting times, and understand content preferences. Always return valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Based on this social media profile data, build a detailed audience analysis:

${socialContext || "No platform data available yet. Provide general best-practice recommendations."}${researchSection}

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
 * Generate a complete marketing strategy using Claude + real-time trend data.
 * WHY: This is the core deliverable — a comprehensive, actionable marketing plan
 * that combines competitor intelligence, audience data, live industry trends, and
 * business goals into specific content pillars, posting schedules, and campaign ideas.
 * Users get a strategy grounded in what is working right now, not a generic playbook.
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

  // WHY: Fetch fresh trend data to inform the strategy with what is working NOW.
  // This runs independently of the competitor/audience data already collected.
  const trendData = await searchIndustryTrends(industry).catch((err) => {
    console.warn("[StrategyAgent] Perplexity trend search failed for strategy, continuing without:", err);
    return "";
  });

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

  const trendSection = trendData
    ? `\nCURRENT INDUSTRY TRENDS (real-time data):\n${trendData}\n\nIncorporate these trends into your strategy where relevant.`
    : "";

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are a senior marketing strategist who builds comprehensive, actionable marketing plans. Your strategies are specific, measurable, and tailored to the business — never generic. When provided with real-time trend data, incorporate current opportunities into your recommendations. You understand platform-specific best practices and content optimization. Always return valid JSON.`,
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
${audienceBrief}${trendSection}

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
  // Both now use Perplexity for real-time data under the hood.
  // Strategy depends on both, so it runs after they complete.
  const [competitors, audience] = await Promise.all([
    analyzeCompetitors(industry, businessName, platforms),
    analyzeAudience(socialContext, industry, platforms),
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
