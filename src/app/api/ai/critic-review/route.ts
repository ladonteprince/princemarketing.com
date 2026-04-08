import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Auth-gated proxy for the final video critic. Fires Gemini 3.1 Pro
// against the stitched MP4 and returns structured per-scene feedback.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  videoUrl: z.string().url(),
  brief: z.string().min(10).max(4000),
  scenes: z
    .array(
      z.object({
        index: z.number().int().min(0),
        prompt: z.string().max(2000),
        duration: z.number().min(0),
        attentionRole: z.string().max(50).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`critic:${email}`, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Unwrap proxied URLs so the backend gets the real .ai path
    let videoUrl = parsed.data.videoUrl;
    if (videoUrl.startsWith("/api/proxy/image?url=")) {
      videoUrl = decodeURIComponent(videoUrl.split("url=")[1]);
    }

    const res = await fetch(`${API_BASE}/api/v1/critic/review-final`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ ...parsed.data, videoUrl }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[CriticReview] Error:", err);
    return NextResponse.json({ error: "Critic failed" }, { status: 500 });
  }
}
