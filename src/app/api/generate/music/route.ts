import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Proxy route checks NextAuth session then forwards to princemarketing.ai.
// Builds a music prompt from scene descriptions and sends to Suno via .ai.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  prompt: z.string().min(1).optional(),
  duration: z.number().min(5).max(120).optional(),
  style: z.string().optional(),
  // Accept scene prompts to auto-build a music prompt
  projectId: z.string().optional(),
  scenes: z.array(z.string()).optional(),
});

/** Build a music generation prompt from scene descriptions */
function buildMusicPrompt(scenes: string[], style?: string): string {
  const sceneContext = scenes
    .map((s, i) => `Scene ${i + 1}: ${s}`)
    .join(". ");

  const base = `Create background music for a video with the following scenes: ${sceneContext}`;
  const styleHint = style ? ` Style: ${style}.` : " Style: cinematic, modern, emotionally resonant.";
  return `${base}.${styleHint} The music should flow naturally across all scenes with smooth transitions.`;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed, remaining } = checkRateLimit(`music:${email}`, 10);
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

    // Build or use the provided prompt
    const prompt =
      parsed.data.prompt ??
      buildMusicPrompt(parsed.data.scenes ?? [], parsed.data.style);

    // Forward to .ai audio generation endpoint
    const res = await fetch(`${API_BASE}/api/v1/generate/audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        prompt,
        duration: parsed.data.duration ?? 30,
        style: parsed.data.style ?? "cinematic",
        mode: "generate",
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? "Music generation failed" },
        { status: res.status },
      );
    }

    // .ai returns 202 with generationId + streamUrl
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
      error instanceof Error ? error.message : "Music generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
