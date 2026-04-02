// Firecrawl API — deep website crawling and content extraction
// WHY: When the Strategy Agent identifies competitors, Firecrawl can scrape
// their actual websites to understand messaging, positioning, pricing, and
// content strategy. This gives analysis depth that search alone cannot.

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

export type CrawlResult = {
  title: string;
  content: string;
  metadata: Record<string, string>;
};

/**
 * Scrape a single URL and return its content as markdown.
 * WHY: Markdown format preserves headings, lists, and structure while
 * stripping nav/footer noise — ideal for feeding into Claude for analysis.
 */
export async function crawlWebsite(url: string): Promise<CrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[Firecrawl] FIRECRAWL_API_KEY not set — skipping crawl");
    return { title: "", content: "", metadata: {} };
  }

  const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  if (!response.ok) {
    console.error(`[Firecrawl] API error: ${response.status} ${response.statusText}`);
    return { title: "", content: "", metadata: {} };
  }

  const data = await response.json();
  return {
    title: data.data?.metadata?.title ?? "",
    content: data.data?.markdown?.substring(0, 5000) ?? "",
    metadata: data.data?.metadata ?? {},
  };
}

/**
 * Crawl a competitor's website and return a structured summary.
 * WHY: Gives the Strategy Agent access to a competitor's actual messaging,
 * value propositions, and positioning — not just what search engines say.
 */
export async function analyzeCompetitorWebsite(url: string): Promise<string> {
  const { title, content, metadata } = await crawlWebsite(url);

  if (!title && !content) {
    return "";
  }

  return (
    `Website: ${title}\n` +
    `Description: ${metadata.description ?? ""}\n` +
    `Content preview:\n${content.substring(0, 3000)}`
  );
}
