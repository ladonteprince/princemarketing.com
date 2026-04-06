import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Proxies first-last-frame interpolation requests to the .ai backend.
// This is the "Lock Endpoints" power tool — Seedance 2 generates motion
// between two specified keyframes. Costs ~50% more than t2v but gives
// pixel-perfect control over scene endpoints (critical for brand reveals
// and invisible match-cuts between scenes).

const schema = z.object({
  prompt: z.string().min(1).max(4000),
  firstFrameUrl: z.string().url(),
  lastFrameUrl: z.string().url(),
  duration: z.number().min(5).max(15).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  fast: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`interpolate:${email}`, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const apiUrl = process.env.PRINCE_API_URL ?? "https://princemarketing.ai";
    const apiKey = process.env.PRINCE_API_KEY ?? "";

    const res = await fetch(`${apiUrl}/api/v1/generate/video/interpolate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(parsed.data),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Interpolate] Error:", error);
    return NextResponse.json(
      { error: "Interpolation service unavailable" },
      { status: 502 },
    );
  }
}
