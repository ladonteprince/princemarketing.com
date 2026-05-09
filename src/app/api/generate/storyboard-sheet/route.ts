import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { resolveCast } from "@/lib/cast-resolver";
import { z } from "zod";
import {
  aspectToOpenAISize,
  buildSheetPrompt,
} from "@/lib/storyboard-sheet-prompt";

// WHY: Production single-call storyboard sheet. One gpt-image-2 call draws all
// panels in a unified composite — @aimikoda's technique — instead of N
// per-panel calls. Cost: $0.04 / ~50s for the whole sheet vs $0.04 × N. Use
// for cheap initial-ideation passes; iterate weak panels with the existing
// per-panel /api/generate/storyboard route afterward.
//
// Auth-protected, rate-limited. Returns a data URL (base64-inlined PNG) for
// inline display. TODO: pipe through GCS for durable HTTPS URLs once the
// firstFrameUrl handoff to downstream Seedance i2v needs sheet-derived crops.

const annotationsSchema = z
  .object({
    body: z.string().max(400).optional(),
    camera: z.string().max(400).optional(),
    framing: z.string().max(400).optional(),
    lighting: z.string().max(400).optional(),
    vocal: z.string().max(400).optional(),
    ipa: z.string().max(400).optional(),
    facs: z.string().max(400).optional(),
  })
  .optional();

const schema = z.object({
  videoProjectId: z.string().optional(),
  scenes: z
    .array(
      z.object({
        sceneIndex: z.number().int().min(0).max(50),
        prompt: z.string().min(3).max(2000),
        annotations: annotationsSchema,
      }),
    )
    .min(2)
    .max(16),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  style: z.enum(["rough-pencil", "photoreal"]).default("rough-pencil"),
  globalContext: z.string().max(1500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    // WHY: Lower than per-panel limit because each call burns ~$0.04 and ~50s
    // and you typically only fire the sheet once or twice per ideation pass.
    const { allowed, remaining } = checkRateLimit(`sheet:${email}`, 5);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not set on server" },
        { status: 500 },
      );
    }

    // WHY: Resolve @handle references in each scene before building the master
    // prompt. The sheet endpoint is OpenAI direct (text-only — no reference
    // image input), so resolved sheet URLs are unused here; we still expand
    // @handle to the canonical label so the prose names the cast correctly.
    const userId = session.user.id;
    const scenesResolved = userId
      ? await Promise.all(
          parsed.data.scenes.map(async (scene) => {
            const resolved = await resolveCast({
              userId,
              prompt: scene.prompt,
            });
            return { ...scene, prompt: resolved.prompt };
          }),
        )
      : parsed.data.scenes;

    const prompt = buildSheetPrompt({ ...parsed.data, scenes: scenesResolved });

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: aspectToOpenAISize(parsed.data.aspectRatio),
        quality: "high",
      }),
    });

    const result = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? `OpenAI returned ${res.status}` },
        { status: 502 },
      );
    }

    const datum = result.data?.[0];
    const imageUrl = datum?.b64_json
      ? `data:image/png;base64,${datum.b64_json}`
      : (datum?.url ?? null);

    if (!imageUrl) {
      return NextResponse.json(
        { error: "OpenAI returned no image data" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      model: "gpt-image-1",
      panelCount: parsed.data.scenes.length,
      aspectRatio: parsed.data.aspectRatio,
      style: parsed.data.style,
      videoProjectId: parsed.data.videoProjectId ?? null,
      imageUrl,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Sheet generation failed",
      },
      { status: 500 },
    );
  }
}
