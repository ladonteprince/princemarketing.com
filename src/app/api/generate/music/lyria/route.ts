import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Proxy route that gates Lyria 3 music generation behind a NextAuth
// session, then forwards to the .ai engine which holds the GEMINI_API_KEY.
// The .com side never sees credentials — the API key lives only in env on .ai.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

// WHY mirror the .ai schema exactly (plus optional scenes helper):
//   Keeps validation symmetrical so the proxy fails fast on malformed input
//   instead of forwarding garbage and surfacing a confusing 400 from .ai.
const schema = z.object({
  prompt: z.string().min(1).optional(),
  duration: z.number().min(5).max(180).optional(),
  model: z.enum(["clip", "pro"]).optional(),
  outputFormat: z.enum(["mp3", "wav"]).optional(),
  // WHY up to 10 images: matches Lyria's image-to-music max
  images: z.array(z.string().url()).max(10).optional(),
  // Optional scene-based prompt builder (parity with Suno proxy)
  projectId: z.string().optional(),
  scenes: z.array(z.string()).optional(),
  style: z.string().optional(),
});

/** Build a music generation prompt from scene descriptions */
function buildMusicPrompt(scenes: string[], style?: string): string {
  const sceneContext = scenes
    .map((s, i) => `Scene ${i + 1}: ${s}`)
    .join(". ");

  const base = `Create background music for a video with the following scenes: ${sceneContext}`;
  const styleHint = style
    ? ` Style: ${style}.`
    : " Style: cinematic, modern, emotionally resonant.";
  return `${base}.${styleHint} The music should flow naturally across all scenes with smooth transitions.`;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";

    // WHY a "lyria:" prefixed bucket: Lyria has its own quota separate from
    // Suno so users can use both pipelines without one starving the other.
    const { allowed, remaining } = checkRateLimit(`lyria:${email}`, 10);
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

    // WHY default duration 30: matches Lyria clip's max length and is the
    // safest single-shot value for users who don't specify.
    const duration = parsed.data.duration ?? 30;
    const model = parsed.data.model ?? (duration > 30 ? "pro" : "clip");

    // Forward to .ai Lyria endpoint
    const res = await fetch(`${API_BASE}/api/v1/generate/audio/lyria`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        prompt,
        duration,
        model,
        outputFormat: parsed.data.outputFormat ?? "mp3",
        images: parsed.data.images,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? "Lyria generation failed" },
        { status: res.status },
      );
    }

    // WHY shape the response for the frontend:
    //   Lyria is synchronous — audioUrl is ready immediately. We surface it
    //   at the top level so the UI can play it without waiting on the
    //   stream/poll endpoints used by Suno's async flow.
    const data = result?.data ?? {};
    const generationId = data.generationId ?? result?.meta?.generationId;

    return NextResponse.json(
      {
        generationId,
        status: data.status ?? "passed",
        audioUrl: data.audioUrl,
        lyrics: data.lyrics,
        model: data.model,
        outputFormat: data.outputFormat,
        // Provided for symmetry with Suno proxy — UI can ignore for sync flow
        streamUrl: generationId ? `/api/stream/${generationId}` : null,
        pollUrl: generationId ? `/api/stream/${generationId}` : null,
      },
      { status: res.status },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lyria generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
