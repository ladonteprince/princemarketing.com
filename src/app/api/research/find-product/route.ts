import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";
import { findProducts } from "@/lib/research/firecrawl";

// WHY: Product sourcing endpoint for the AI Strategist. When the user
// asks for a real product (watch, shoes, tracksuit), this searches the
// web via Firecrawl, extracts product images, and falls back to a
// Playwright browser for sites that block scraping. Returns up to 5
// product cards the user can pick from inline in the chat.

const schema = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`product-search:${email}`, 20);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { error: "Search backend not configured", code: "API_KEY_MISSING", query: parsed.data.query, count: 0, products: [] },
        { status: 503 },
      );
    }

    const products = await findProducts(parsed.data.query, parsed.data.limit ?? 5);

    if (products.length === 0) {
      return NextResponse.json({
        query: parsed.data.query,
        count: 0,
        products: [],
        code: "NO_IMAGES" as const,
        message: `No products found for "${parsed.data.query}" — try a more specific search.`,
      });
    }

    return NextResponse.json({
      query: parsed.data.query,
      count: products.length,
      products,
      code: "OK" as const,
    });
  } catch (error) {
    console.error("[FindProduct] Error:", error);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: isAbort ? "Search timed out" : "Product search failed",
        code: isAbort ? ("TIMEOUT" as const) : ("UPSTREAM_ERROR" as const),
      },
      { status: isAbort ? 504 : 500 },
    );
  }
}
