// Perplexity Sonar API — real-time web search with AI synthesis
// WHY: Upgrades the Strategy Agent from Claude-only analysis (training data)
// to real-time web search. Competitors, trends, and audience insights are
// pulled live, making every strategy current and data-backed.

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

/**
 * Core search function — sends a query to Perplexity Sonar and returns
 * the AI-synthesized answer with citations.
 */
export async function searchWeb(query: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.warn("[Perplexity] PERPLEXITY_API_KEY not set — skipping web search");
    return "";
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "You are a marketing research assistant. Provide factual, data-backed answers with specific numbers, names, and recent examples.",
        },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`[Perplexity] API error: ${response.status} ${response.statusText}`);
    return "";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Search for real competitors in an industry.
 * WHY: Claude's training data can identify major players, but Perplexity
 * finds emerging competitors, recent pivots, and current social stats.
 */
export async function searchCompetitors(
  industry: string,
  businessName: string,
): Promise<string> {
  return searchWeb(
    `Who are the top 5 competitors to ${businessName} in the ${industry} industry? ` +
      `List their social media presence, content strategy, posting frequency, and what makes them successful. ` +
      `Focus on their Instagram, TikTok, YouTube, and Twitter presence.`,
  );
}

/**
 * Search for the latest marketing trends in an industry.
 * WHY: Trends shift fast — what worked 6 months ago may be stale.
 * Perplexity surfaces what is working right now.
 */
export async function searchIndustryTrends(industry: string): Promise<string> {
  return searchWeb(
    `What are the latest marketing trends in the ${industry} industry in 2026? ` +
      `What content formats are performing best? What platforms are growing fastest?`,
  );
}

/**
 * Search for audience demographics and behavior on specific platforms.
 * WHY: Platform demographics shift yearly. Real-time data ensures
 * posting-time and content-format recommendations are current.
 */
export async function searchAudienceInsights(
  industry: string,
  platforms: string[],
): Promise<string> {
  return searchWeb(
    `What is the typical audience demographics for ${industry} brands on ${platforms.join(", ")}? ` +
      `What content do they engage with most? What are the best posting times?`,
  );
}
