import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Score-first production. The AI emits CREATE_SCORE with up to 3 track
// options; this route fires Lyria in parallel and returns all results so the
// user can pick one in the inline track picker. Each track becomes a
// candidate timeline skeleton — the chosen one locks scene durations.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const schema = z.object({
  videoProjectId: z.string(),
  trackOptions: z
    .array(
      z.object({
        prompt: z.string().min(5).max(2000),
        genre: z.string().max(100).optional(),
        bpm: z.number().min(40).max(220).optional(),
        duration: z.number().min(5).max(180),
      }),
    )
    .min(1)
    .max(3),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`score:${email}`, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fire all tracks in parallel. Each call goes through the existing
    // Lyria proxy on .ai which handles the Gemini credentials.
    const results = await Promise.allSettled(
      parsed.data.trackOptions.map(async (opt) => {
        const promptWithHints = [
          opt.prompt,
          opt.genre ? `Genre: ${opt.genre}.` : "",
          opt.bpm ? `Tempo: ~${opt.bpm} BPM.` : "",
        ]
          .filter(Boolean)
          .join(" ");

        const res = await fetch(`${API_BASE}/api/v1/generate/lyria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
          },
          body: JSON.stringify({
            prompt: promptWithHints,
            duration: opt.duration,
            model: "pro",
            outputFormat: "mp3",
          }),
        });

        if (!res.ok) {
          throw new Error(`Lyria failed: ${res.status}`);
        }
        const data = await res.json();
        const audioUrl =
          data?.audioUrl ??
          data?.url ??
          data?.data?.audioUrl ??
          data?.data?.url;
        if (!audioUrl) throw new Error("Lyria returned no audio URL");
        return {
          prompt: opt.prompt,
          genre: opt.genre,
          bpm: opt.bpm,
          duration: opt.duration,
          audioUrl,
        };
      }),
    );

    const tracks = results.map((r, i) => {
      const opt = parsed.data.trackOptions[i];
      if (r.status === "fulfilled") {
        return {
          id: crypto.randomUUID(),
          prompt: opt.prompt,
          genre: opt.genre,
          bpm: opt.bpm,
          duration: opt.duration,
          audioUrl: r.value.audioUrl,
          status: "ready" as const,
        };
      }
      console.error("[GenerateScore] Track failed:", r.reason);
      return {
        id: crypto.randomUUID(),
        prompt: opt.prompt,
        genre: opt.genre,
        bpm: opt.bpm,
        duration: opt.duration,
        status: "failed" as const,
      };
    });

    return NextResponse.json({
      videoProjectId: parsed.data.videoProjectId,
      tracks,
      count: tracks.filter((t) => t.status === "ready").length,
    });
  } catch (err) {
    console.error("[GenerateScore] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Score generation failed" },
      { status: 500 },
    );
  }
}
