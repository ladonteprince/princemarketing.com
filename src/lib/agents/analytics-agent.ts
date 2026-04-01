// Analytics Agent — AI-powered performance analysis and recommendations
// WHY: The landing page promises "Tracks what is working, what is not, and why.
// Adjusts your strategy in real time." Raw numbers don't tell users what to DO.
// This agent uses Claude to interpret analytics data and produce actionable
// insights — the kind a $5K/month marketing consultant would give.

import { claude } from "@/lib/claude";

export type PerformanceInsight = {
  finding: string; // "Videos get 3x more engagement than images"
  recommendation: string; // "Increase video content to 60% of your mix"
  confidence: number; // 0-1
  dataPoints: number; // How many posts this is based on
};

export type ContentRecommendation = {
  type: string; // "video" | "image" | "copy"
  topic: string; // "Behind-the-scenes product shots"
  platform: string; // "instagram"
  bestTime: string; // "Tuesday 2pm"
  reasoning: string; // "Your audience engages most with..."
};

export type AnalyzablePost = {
  content: string;
  platform: string;
  engagement: number;
  impressions: number;
  postedAt: string;
  mediaType?: string;
};

/**
 * Analyze what's working and what's not across all published content.
 * WHY: Users see numbers in a dashboard but rarely know what they mean.
 * This transforms raw metrics into findings like "Your Tuesday posts get 2x
 * the engagement of weekend posts" — actionable intelligence that changes behavior.
 *
 * Confidence scoring lets the frontend display stronger findings more prominently
 * and caveat weaker ones (e.g. "Based on limited data...").
 */
export async function analyzePerformance(
  posts: AnalyzablePost[],
): Promise<PerformanceInsight[]> {
  if (posts.length === 0) {
    return [
      {
        finding: "No published content to analyze yet.",
        recommendation: "Start by publishing 5-10 posts across your connected platforms. The analytics agent needs data to find patterns.",
        confidence: 1,
        dataPoints: 0,
      },
    ];
  }

  // Pre-compute summary stats to keep the prompt focused
  const stats = computeStats(posts);

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a senior marketing analyst. Analyze the performance data and extract actionable insights. Be specific with numbers — "3x more" not "significantly more."

Return ONLY valid JSON — an array of insights:
[
  {
    "finding": "specific observation with numbers",
    "recommendation": "specific action to take",
    "confidence": 0.0-1.0,
    "dataPoints": number of posts this insight is based on
  }
]

Rules:
- Minimum 3, maximum 7 insights
- Sort by confidence (highest first)
- If data is sparse (under 10 posts), set confidence below 0.6 and note it
- Focus on what changes behavior, not vanity metrics
- Include at least 1 "what's NOT working" insight if data supports it
- Never fabricate numbers — only reference patterns in the provided data`,
    messages: [
      {
        role: "user",
        content: `Analyze this content performance data:

Total posts: ${posts.length}
Date range: ${stats.dateRange}

Platform breakdown:
${stats.platformBreakdown}

Content type breakdown:
${stats.mediaTypeBreakdown}

Time-of-day patterns:
${stats.timePatterns}

Top 5 posts by engagement:
${stats.topPosts}

Bottom 5 posts by engagement:
${stats.bottomPosts}

Engagement rate (engagement/impressions): ${stats.avgEngagementRate}`,
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
    if (!jsonMatch) throw new Error("No JSON array found");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    return parsed.map((item: Record<string, unknown>) => ({
      finding: String(item.finding ?? ""),
      recommendation: String(item.recommendation ?? ""),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
      dataPoints: Number(item.dataPoints) || 0,
    }));
  } catch (err) {
    console.error("[AnalyticsAgent] Failed to parse insights:", err);
    return [
      {
        finding: "Unable to generate insights at this time.",
        recommendation: "Try again in a moment, or ensure you have published content with engagement data.",
        confidence: 0,
        dataPoints: posts.length,
      },
    ];
  }
}

/**
 * Generate smart recommendations for what to post next.
 * WHY: "What should I post?" is the #1 question every marketer asks.
 * This combines performance insights with platform best practices to
 * give concrete, scheduled recommendations — not vague tips.
 */
export async function generateRecommendations(
  insights: PerformanceInsight[],
  currentStrategy?: { platforms?: string[]; goals?: string; industry?: string },
): Promise<ContentRecommendation[]> {
  const insightsBlock = insights
    .map(
      (i) =>
        `- [${(i.confidence * 100).toFixed(0)}% confidence] ${i.finding} → ${i.recommendation}`,
    )
    .join("\n");

  const strategyBlock = currentStrategy
    ? `Current strategy context:
- Platforms: ${currentStrategy.platforms?.join(", ") ?? "not specified"}
- Goals: ${currentStrategy.goals ?? "not specified"}
- Industry: ${currentStrategy.industry ?? "not specified"}`
    : "No current strategy context available.";

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a marketing strategist. Based on performance insights, recommend specific content to create next.

Return ONLY valid JSON — an array of recommendations:
[
  {
    "type": "video|image|copy|carousel|reel|story",
    "topic": "specific content topic",
    "platform": "instagram|facebook|twitter|linkedin|tiktok|youtube",
    "bestTime": "Day HH:MM format, e.g. Tuesday 2:00 PM",
    "reasoning": "1-2 sentences explaining why, referencing the data"
  }
]

Rules:
- Generate 3-5 recommendations
- Each should be different (vary type, platform, topic)
- Best times should be specific, based on the insights when possible
- Topics should be concrete enough to act on immediately
- Prioritize high-confidence insights when forming recommendations`,
    messages: [
      {
        role: "user",
        content: `Based on these performance insights, recommend what to post next:

${insightsBlock}

${strategyBlock}`,
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
    if (!jsonMatch) throw new Error("No JSON array found");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    return parsed.map((item: Record<string, unknown>) => ({
      type: String(item.type ?? "copy"),
      topic: String(item.topic ?? ""),
      platform: String(item.platform ?? ""),
      bestTime: String(item.bestTime ?? ""),
      reasoning: String(item.reasoning ?? ""),
    }));
  } catch (err) {
    console.error("[AnalyticsAgent] Failed to parse recommendations:", err);
    return [];
  }
}

/**
 * Generate a natural language weekly summary.
 * WHY: Most marketers don't have time to dig through dashboards. A concise
 * weekly summary that reads like a message from a marketing manager —
 * highlighting wins, flagging concerns, and giving 1-2 action items —
 * is the human-centric way to deliver analytics.
 */
export async function generateWeeklySummary(
  platformAnalytics: Array<{
    platform: string;
    followers: number;
    impressions: number;
    engagement: number;
  }>,
  publishedPosts: Array<{
    title: string;
    platform: string;
    engagement: number;
    impressions: number;
    postedAt: string;
  }>,
): Promise<string> {
  if (publishedPosts.length === 0 && platformAnalytics.length === 0) {
    return "No activity this week. Connect your social platforms and start publishing to get weekly performance summaries.";
  }

  const platformBlock = platformAnalytics
    .map(
      (p) =>
        `${p.platform}: ${formatNumber(p.followers)} followers, ${formatNumber(p.impressions)} impressions, ${formatNumber(p.engagement)} engagements`,
    )
    .join("\n");

  const postsBlock = publishedPosts
    .map(
      (p) =>
        `"${p.title}" (${p.platform}) — ${formatNumber(p.impressions)} impressions, ${formatNumber(p.engagement)} engagements`,
    )
    .join("\n");

  const topPost = [...publishedPosts].sort(
    (a, b) => b.engagement - a.engagement,
  )[0];

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a marketing manager writing a weekly performance brief. Write in first person plural ("we" / "your"). Be concise — 3-5 sentences max. Include:
1. How many posts were published and across how many platforms
2. The top performer with its key metric
3. One trend (up or down)
4. One specific recommendation for next week

Tone: direct, data-driven, encouraging but honest. No exclamation marks. No fluff.`,
    messages: [
      {
        role: "user",
        content: `Write the weekly summary:

Posts published this week: ${publishedPosts.length}
Platforms active: ${[...new Set(publishedPosts.map((p) => p.platform))].join(", ") || "none"}

Platform metrics:
${platformBlock || "No platform data available."}

Published posts:
${postsBlock || "No posts this week."}

Top performer: ${topPost ? `"${topPost.title}" on ${topPost.platform} with ${formatNumber(topPost.engagement)} engagements` : "N/A"}`,
      },
    ],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("") || "";

  return text.trim() || "Unable to generate summary at this time.";
}

// --- Internal helpers ---

/**
 * Pre-compute stats from posts to keep the Claude prompt focused on analysis,
 * not raw data processing. Cheaper to compute here than burn tokens on it.
 */
function computeStats(posts: AnalyzablePost[]) {
  // Date range
  const dates = posts
    .map((p) => new Date(p.postedAt).getTime())
    .filter((d) => !isNaN(d))
    .sort();
  const dateRange =
    dates.length > 0
      ? `${new Date(dates[0]).toLocaleDateString()} to ${new Date(dates[dates.length - 1]).toLocaleDateString()}`
      : "unknown";

  // Platform breakdown
  const byPlatform: Record<string, { count: number; totalEng: number; totalImp: number }> = {};
  for (const p of posts) {
    const key = p.platform.toLowerCase();
    if (!byPlatform[key]) byPlatform[key] = { count: 0, totalEng: 0, totalImp: 0 };
    byPlatform[key].count++;
    byPlatform[key].totalEng += p.engagement;
    byPlatform[key].totalImp += p.impressions;
  }
  const platformBreakdown = Object.entries(byPlatform)
    .map(
      ([platform, data]) =>
        `${platform}: ${data.count} posts, avg engagement ${Math.round(data.totalEng / data.count)}, avg impressions ${Math.round(data.totalImp / data.count)}`,
    )
    .join("\n");

  // Media type breakdown
  const byType: Record<string, { count: number; totalEng: number }> = {};
  for (const p of posts) {
    const key = p.mediaType ?? "unknown";
    if (!byType[key]) byType[key] = { count: 0, totalEng: 0 };
    byType[key].count++;
    byType[key].totalEng += p.engagement;
  }
  const mediaTypeBreakdown = Object.entries(byType)
    .map(
      ([type, data]) =>
        `${type}: ${data.count} posts, avg engagement ${Math.round(data.totalEng / data.count)}`,
    )
    .join("\n");

  // Time patterns (hour of day)
  const byHour: Record<number, { count: number; totalEng: number }> = {};
  for (const p of posts) {
    const date = new Date(p.postedAt);
    if (isNaN(date.getTime())) continue;
    const hour = date.getHours();
    if (!byHour[hour]) byHour[hour] = { count: 0, totalEng: 0 };
    byHour[hour].count++;
    byHour[hour].totalEng += p.engagement;
  }
  const timePatterns = Object.entries(byHour)
    .sort(([, a], [, b]) => b.totalEng / b.count - a.totalEng / a.count)
    .slice(0, 5)
    .map(
      ([hour, data]) =>
        `${Number(hour) % 12 || 12}${Number(hour) >= 12 ? "PM" : "AM"}: ${data.count} posts, avg engagement ${Math.round(data.totalEng / data.count)}`,
    )
    .join("\n");

  // Top and bottom posts
  const sorted = [...posts].sort((a, b) => b.engagement - a.engagement);
  const topPosts = sorted
    .slice(0, 5)
    .map(
      (p) =>
        `[${p.platform}] "${p.content.slice(0, 80)}..." — ${p.engagement} engagements, ${p.impressions} impressions (${p.postedAt})`,
    )
    .join("\n");
  const bottomPosts = sorted
    .slice(-5)
    .map(
      (p) =>
        `[${p.platform}] "${p.content.slice(0, 80)}..." — ${p.engagement} engagements, ${p.impressions} impressions (${p.postedAt})`,
    )
    .join("\n");

  // Average engagement rate
  const totalImp = posts.reduce((sum, p) => sum + p.impressions, 0);
  const totalEng = posts.reduce((sum, p) => sum + p.engagement, 0);
  const avgEngagementRate =
    totalImp > 0
      ? `${((totalEng / totalImp) * 100).toFixed(2)}%`
      : "N/A (no impression data)";

  return {
    dateRange,
    platformBreakdown,
    mediaTypeBreakdown,
    timePatterns,
    topPosts,
    bottomPosts,
    avgEngagementRate,
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
