import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Proxy route checks NextAuth session then forwards to princemarketing.ai.
// API key never leaves the server. Returns generationId + streamUrl for SSE.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  prompt: z.string().min(1),
  duration: z.number().optional(),
  aspectRatio: z.string().optional(),
  mode: z.enum(['t2v', 'i2v', 'extend', 'character', 'video-edit']).optional(),
  sourceImage: z.string().url().optional(),
  sourceVideo: z.string().url().optional(),
  seed: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed, remaining } = checkRateLimit(`video:${email}`, 20);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
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

    // Call .ai backend directly to handle 202 response
    const res = await fetch(`${API_BASE}/api/v1/generate/video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(parsed.data),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? "Video generation failed" },
        { status: res.status },
      );
    }

    // Extract generationId from 202 response and return with local stream URL
    const generationId = result?.data?.generationId ?? result?.meta?.generationId;

    return NextResponse.json({
      generationId,
      status: result?.data?.status ?? "processing",
      streamUrl: generationId ? `/api/stream/${generationId}` : null,
      pollUrl: generationId ? `/api/stream/${generationId}` : null,
      message: result?.data?.message,
    }, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Video generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
