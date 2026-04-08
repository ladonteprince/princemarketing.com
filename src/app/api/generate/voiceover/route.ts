import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Auth-gated proxy forwarding voiceover generation to .ai where the
// ElevenLabs key lives. Keeps credentials off the .com side.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  videoProjectId: z.string(),
  voiceId: z.string().min(10).max(100),
  text: z.string().min(1).max(5000).optional(),
  script: z
    .array(
      z.object({
        startTime: z.number().min(0),
        endTime: z.number().min(0),
        text: z.string().min(1).max(1000),
      }),
    )
    .max(50)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`voiceover:${email}`, 15);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const res = await fetch(`${API_BASE}/api/v1/generate/voiceover`, {
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
    console.error("[Voiceover] Error:", err);
    return NextResponse.json(
      { error: "Voiceover failed" },
      { status: 500 },
    );
  }
}
