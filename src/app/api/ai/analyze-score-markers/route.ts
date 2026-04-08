import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Auth-gated proxy forwarding score marker analysis to .ai where the
// Gemini key lives. Called after the user picks a Lyria track — the returned
// markers get attached to the project so the Gemini Director can snap scene
// cuts to real musical sections.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  audioUrl: z.string().url(),
  genre: z.string().max(100).optional(),
  bpm: z.number().min(40).max(220).optional(),
  expectedDuration: z.number().min(1).max(600).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`markers:${email}`, 20);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const res = await fetch(`${API_BASE}/api/v1/analyze/score-markers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(parsed.data),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[AnalyzeScoreMarkers] Error:", err);
    return NextResponse.json(
      { error: "Marker analysis failed" },
      { status: 500 },
    );
  }
}
