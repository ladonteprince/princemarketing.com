import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { buildUserContext } from "@/lib/social/indexer";
import {
  generateFullStrategy,
  analyzeCompetitors,
  analyzeAudience,
  buildStrategy,
} from "@/lib/agents/strategy-agent";
import { z } from "zod";

// WHY: Separate validation schemas for the full pipeline vs. individual analyses.
// Users can hit the full pipeline (most common) or request a specific piece
// if they only need competitor data or audience insights.
const requestSchema = z.object({
  industry: z.string().min(1),
  businessName: z.string().min(1),
  goals: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  // WHY: Optional "mode" lets the frontend request just one piece of the strategy.
  // Default is "full" which runs the complete pipeline.
  mode: z
    .enum(["full", "competitors", "audience", "strategy"])
    .default("full"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    // WHY: Strategy generation makes multiple Claude API calls, so we use a tighter
    // rate limit (5/min) than the chat endpoint (15/min) to control costs.
    const { allowed, remaining } = checkRateLimit(`strategy:${email}`, 5);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Strategy generation is resource-intensive — try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { industry, businessName, goals, platforms, mode } = parsed.data;

    // WHY: Always fetch the user's social context — it enriches every analysis mode.
    let socialContext = "";
    try {
      socialContext = await buildUserContext(session.user.id ?? "");
    } catch (err) {
      console.error("[StrategyAPI] Failed to build social context:", err);
    }

    // WHY: Switch on mode so the frontend can request exactly what it needs.
    // "full" is the default and most common — runs the complete pipeline.
    switch (mode) {
      case "competitors": {
        const competitors = await analyzeCompetitors(
          industry,
          businessName,
          platforms,
        );
        return NextResponse.json({ competitors });
      }

      case "audience": {
        const audience = await analyzeAudience(socialContext, industry, platforms);
        return NextResponse.json({ audience });
      }

      case "strategy": {
        // WHY: "strategy" mode without competitor/audience data still works —
        // buildStrategy handles empty arrays gracefully with sensible defaults.
        const audience = await analyzeAudience(socialContext, industry, platforms);
        const strategy = await buildStrategy({
          name: businessName,
          industry,
          audience,
          competitors: [],
          goals,
          platforms,
        });
        return NextResponse.json({ strategy });
      }

      case "full":
      default: {
        const result = await generateFullStrategy({
          businessName,
          industry,
          goals,
          platforms,
          socialContext,
        });
        return NextResponse.json(result);
      }
    }
  } catch (error) {
    console.error("[StrategyAPI] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate strategy" },
      { status: 500 },
    );
  }
}
