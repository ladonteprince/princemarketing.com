import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Auth-gated proxy for fast audio remixes. Takes an already-stitched
// video and re-applies the duck with a different duckingDb value. No video
// clips are regenerated — this is cheap and near-instant compared to a
// full re-stitch.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  projectId: z.string(),
  baseVideoUrl: z.string().url(),
  audioUrl: z.string().url().optional(),
  voiceoverUrl: z.string().url().optional(),
  duckingDb: z.number().min(-24).max(0),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`remix:${email}`, 15);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Unwrap proxy URLs back to .ai direct URLs for the backend
    const resolve = (u?: string) => {
      if (!u) return u;
      if (u.startsWith("/api/proxy/image?url=")) {
        return decodeURIComponent(u.split("url=")[1]);
      }
      return u;
    };

    const payload = {
      ...parsed.data,
      baseVideoUrl: resolve(parsed.data.baseVideoUrl)!,
      audioUrl: resolve(parsed.data.audioUrl),
      voiceoverUrl: resolve(parsed.data.voiceoverUrl),
    };

    const res = await fetch(`${API_BASE}/api/v1/video/remix-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error ?? "Remix failed" },
        { status: res.status },
      );
    }

    const directUrl = result?.data?.videoUrl;
    const proxiedUrl = directUrl
      ? `/api/proxy/image?url=${encodeURIComponent(directUrl)}`
      : null;

    return NextResponse.json({
      videoUrl: proxiedUrl,
      directUrl,
      projectId: parsed.data.projectId,
      duckingDb: parsed.data.duckingDb,
      mixMode: result?.data?.mixMode,
    });
  } catch (err) {
    console.error("[RemixAudio] Error:", err);
    return NextResponse.json({ error: "Remix failed" }, { status: 500 });
  }
}
