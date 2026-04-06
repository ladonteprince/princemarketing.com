// Headless-browser image scraper — last-resort fallback for findProducts().
//
// INSTALL: npm install playwright-core @playwright/browser-chromium
// This runs on the VPS, not serverless. Do NOT import this module at the top
// level of any route that ships to Vercel Functions — always dynamic-import
// it so the Next.js build doesn't try to bundle chromium.
//
// WHY THIS EXISTS: Firecrawl is fast and cheap but some premium retailers
// (Hodinkee, Net-a-Porter, Farfetch, anything behind Cloudflare bot-fight)
// either block Firecrawl outright or serve a JS shell with no <img> tags in
// the initial HTML. For those pages we need a real browser that can execute
// scripts, honor cookies, and wait for lazy-loaded gallery images to render.
// This function is the ONLY place we reach for that sledgehammer — and only
// when Firecrawl has already returned zero usable images.

type PlaywrightImage = {
  src: string;
  width: number;
};

/**
 * Navigate to a URL in a headless browser, wait for images to load, and
 * return all visible <img> src URLs sorted by natural size (largest first).
 * Returns [] on any error — callers should treat an empty array as a
 * graceful "no images found" signal, not a crash.
 */
export async function scrapeImagesWithBrowser(url: string): Promise<string[]> {
  // Dynamic import: keeps the Next.js build green when playwright-core isn't
  // installed (e.g. on Vercel or before npm install runs on the VPS). The
  // type cast to any avoids TS resolution failure when the package isn't
  // present at build time. At runtime on the VPS, chromium is launched normally.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let playwright: any;
  try {
    // Variable name keeps webpack from analyzing the static import path
    const moduleName = "playwright-core";
    playwright = await import(/* webpackIgnore: true */ moduleName);
  } catch (err) {
    console.warn(
      "[browser-fallback] playwright-core not installed — run `npm install playwright-core` on the VPS. Returning [].",
      err,
    );
    return [];
  }

  // Hard 30s wall for the whole operation.
  const OVERALL_TIMEOUT_MS = 30_000;
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>> | null =
    null;

  const run = async (): Promise<string[]> => {
    browser = await playwright.chromium.launch({
      headless: true,
      // WHY: --no-sandbox needed for root/container envs; the blink-features
      // flag reduces the "I'm a bot" fingerprint that Cloudflare checks.
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Extra breathing room for lazy-loaded gallery images that only kick in
    // after the scroll observer fires.
    await page.waitForTimeout(2_000);

    const images: PlaywrightImage[] = await page.evaluate(() => {
      const out: { src: string; width: number }[] = [];
      const nodes = Array.from(document.querySelectorAll("img"));
      for (const img of nodes) {
        const src = img.currentSrc || img.src;
        if (!src || src.startsWith("data:")) continue;
        const w = img.naturalWidth || 0;
        if (w < 400) continue;
        const rect = img.getBoundingClientRect();
        if (rect.width <= 0) continue;
        out.push({ src, width: w });
      }
      return out;
    });

    return images
      .sort((a, b) => b.width - a.width)
      .map((i) => i.src);
  };

  try {
    return await Promise.race([
      run(),
      new Promise<string[]>((resolve) =>
        setTimeout(() => resolve([]), OVERALL_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    console.error(`[browser-fallback] Error scraping ${url}:`, err);
    return [];
  } finally {
    // ALWAYS close — leaked chromium procs on a VPS will eat RAM fast.
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}
