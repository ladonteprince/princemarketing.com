// Firecrawl API — deep website crawling and content extraction
// WHY: When the Strategy Agent identifies competitors, Firecrawl can scrape
// their actual websites to understand messaging, positioning, pricing, and
// content strategy. This gives analysis depth that search alone cannot.

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

// WHY: Firecrawl intermittently returns 408/429/5xx on premium retailers and
// video platforms. Without retries a single transient failure cascaded to
// "Product search failed" — even though the same query succeeds seconds later.
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type FirecrawlErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "NO_IMAGES"
  | "API_KEY_MISSING"
  | "UPSTREAM_ERROR"
  | "OK";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 1000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient =
        err instanceof Error &&
        (err.name === "AbortError" ||
          (err as Error & { status?: number }).status === undefined ||
          TRANSIENT_STATUSES.has((err as Error & { status?: number }).status ?? 0));
      if (attempt === retries || !isTransient) throw err;
      const delay = baseMs * Math.pow(2, attempt);
      console.warn(
        `[Firecrawl] ${opts.label ?? "request"} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Product search + image extraction
// WHY: The visual pipeline needs real product imagery from the open web.
// Firecrawl /search finds candidate product pages; Firecrawl /scrape pulls
// the HTML so we can mine <img> tags. Many premium retailers (Hodinkee,
// Net-a-Porter, etc.) block Firecrawl's scraper — for those URLs we fall
// back to a headless browser (see ./browser-fallback).
// ─────────────────────────────────────────────────────────────────────────────

export type ProductResult = {
  imageUrl: string;
  title: string;
  sourceUrl: string;
  sourceDomain: string; // e.g. "hodinkee.com"
  price?: string;
};

type FirecrawlSearchResult = {
  title: string;
  url: string;
  description: string;
};

/**
 * Search Firecrawl for product pages matching a query.
 * WHY: /search is Firecrawl's SERP-style endpoint — one call returns ranked
 * result URLs plus lightweight metadata, which is exactly what we need to
 * feed the product discovery pipeline before doing heavier per-page scrapes.
 */
export async function searchFirecrawl(
  query: string,
  limit = 10,
): Promise<FirecrawlSearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[Firecrawl] FIRECRAWL_API_KEY not set — skipping search");
    return [];
  }

  try {
    const response = await retryWithBackoff(
      async () => {
        const r = await fetchWithTimeout(
          `${FIRECRAWL_API_URL}/search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              limit,
              scrapeOptions: { formats: ["markdown"] },
            }),
          },
          15_000,
        );
        if (!r.ok) throw new HttpError(r.status, `search ${r.status}`);
        return r;
      },
      { label: `search "${query}"` },
    );

    const data = await response.json();
    const results: unknown[] = data.data ?? [];
    return results
      .map((r) => {
        const item = r as Record<string, unknown>;
        return {
          title: (item.title as string) ?? "",
          url: (item.url as string) ?? "",
          description:
            (item.description as string) ?? (item.snippet as string) ?? "",
        };
      })
      .filter((r) => r.url);
  } catch (err) {
    console.error("[Firecrawl] Search exception:", err);
    return [];
  }
}

// Regex-based <img> extraction — WHY: avoids pulling in a full HTML parser
// dep for what is essentially a tag-hunt. Good enough for 99% of product
// pages; browser fallback catches the rest.
const IMG_TAG_RE = /<img[^>]+>/gi;
const SRC_RE = /\bsrc=["']([^"']+)["']/i;
const SRCSET_RE = /\bsrcset=["']([^"']+)["']/i;
const ALT_RE = /\balt=["']([^"']*)["']/i;
const CLASS_RE = /\bclass=["']([^"']*)["']/i;
const WIDTH_RE = /\bwidth=["']?(\d+)/i;
const HEIGHT_RE = /\bheight=["']?(\d+)/i;

const JUNK_KEYWORDS = [
  "logo",
  "icon",
  "favicon",
  "sprite",
  "placeholder",
  "avatar",
  "badge",
  "flag",
  "social",
];

const GOOD_KEYWORDS = ["product", "main", "hero", "gallery", "primary"];

function isJunkImage(src: string, alt: string, cls: string): boolean {
  if (!src) return true;
  if (src.startsWith("data:")) return true;
  if (src.toLowerCase().endsWith(".svg")) return true;
  const hay = `${src} ${alt} ${cls}`.toLowerCase();
  return JUNK_KEYWORDS.some((k) => hay.includes(k));
}

function isLikelyProductImage(alt: string, cls: string): boolean {
  const hay = `${alt} ${cls}`.toLowerCase();
  return GOOD_KEYWORDS.some((k) => hay.includes(k));
}

// Pull the largest candidate from a srcset="url1 500w, url2 1000w" attr.
function pickLargestFromSrcset(srcset: string): string | null {
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .map((p) => {
      const [url, size] = p.split(/\s+/);
      const w = size ? parseInt(size.replace(/\D/g, ""), 10) || 0 : 0;
      return { url, w };
    })
    .filter((p) => p.url)
    .sort((a, b) => b.w - a.w);
  return parts[0]?.url ?? null;
}

function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

/**
 * Scrape a URL and extract usable product image URLs from the HTML.
 * WHY: Firecrawl returns cleaned HTML we can mine for <img> tags. We filter
 * out data URIs, SVGs, logos, icons, and anything that looks like chrome —
 * what's left should be product photography.
 */
export async function extractImagesFromUrl(url: string): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[Firecrawl] FIRECRAWL_API_KEY not set — skipping extract");
    return [];
  }

  let html = "";
  try {
    const response = await retryWithBackoff(
      async () => {
        const r = await fetchWithTimeout(
          `${FIRECRAWL_API_URL}/scrape`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url, formats: ["html", "markdown"] }),
          },
          15_000,
        );
        if (!r.ok) throw new HttpError(r.status, `scrape ${r.status}`);
        return r;
      },
      { label: `scrape ${url}` },
    );
    const data = await response.json();
    html = (data.data?.html as string) ?? (data.data?.rawHtml as string) ?? "";
  } catch (err) {
    console.error(`[Firecrawl] Scrape exception (${url}):`, err);
    return [];
  }

  if (!html) return [];

  const tags = html.match(IMG_TAG_RE) ?? [];
  type Candidate = { url: string; score: number; w: number; h: number };
  const candidates: Candidate[] = [];

  for (const tag of tags) {
    const srcMatch = tag.match(SRC_RE);
    const srcsetMatch = tag.match(SRCSET_RE);
    const altMatch = tag.match(ALT_RE);
    const classMatch = tag.match(CLASS_RE);
    const widthMatch = tag.match(WIDTH_RE);
    const heightMatch = tag.match(HEIGHT_RE);

    let src = srcMatch?.[1] ?? "";
    if (srcsetMatch) {
      const big = pickLargestFromSrcset(srcsetMatch[1]);
      if (big) src = big;
    }
    const alt = altMatch?.[1] ?? "";
    const cls = classMatch?.[1] ?? "";
    const w = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    const h = heightMatch ? parseInt(heightMatch[1], 10) : 0;

    if (isJunkImage(src, alt, cls)) continue;
    // WHY: if dimensions are declared and clearly tiny, drop it. If absent,
    // keep — many lazy-loaded product images omit width/height attributes.
    if (w && h && (w < 400 || h < 400)) continue;

    const absolute = resolveUrl(src, url);
    let score = 0;
    if (isLikelyProductImage(alt, cls)) score += 10;
    score += Math.min(w, 2000) / 100;

    candidates.push({ url: absolute, score, w, h });
  }

  // Dedupe while preserving best score per URL.
  const byUrl = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byUrl.get(c.url);
    if (!existing || c.score > existing.score) byUrl.set(c.url, c);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .map((c) => c.url);
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Orchestrator: search Firecrawl for products, scrape the top results, and
 * return ProductResult[] with images. If a given result yields no images via
 * Firecrawl, fall back to the headless-browser scraper.
 *
 * WHY: Two-stage design keeps the fast path fast — most queries resolve
 * purely through Firecrawl. The browser fallback is expensive (spins up
 * chromium) so we only reach for it when Firecrawl genuinely came up empty
 * for a page we still want to harvest.
 */
export async function findProducts(
  query: string,
  limit = 5,
): Promise<ProductResult[]> {
  const searchResults = await searchFirecrawl(query, Math.max(limit * 2, 10));
  if (searchResults.length === 0) return [];

  const products: ProductResult[] = [];

  for (const result of searchResults) {
    if (products.length >= limit) break;

    let images = await extractImagesFromUrl(result.url);

    if (images.length === 0) {
      // Last-resort: Firecrawl blocked or page was JS-rendered. Hand the
      // URL to the headless browser fallback. Dynamic import keeps the
      // Next.js build from exploding if playwright-core is missing.
      try {
        const { scrapeImagesWithBrowser } = await import("./browser-fallback");
        images = await scrapeImagesWithBrowser(result.url);
      } catch (err) {
        console.warn(
          `[Firecrawl] Browser fallback unavailable for ${result.url}:`,
          err,
        );
      }
    }

    if (images.length === 0) continue;

    products.push({
      imageUrl: images[0],
      title: result.title,
      sourceUrl: result.url,
      sourceDomain: safeDomain(result.url),
    });
  }

  return products;
}
