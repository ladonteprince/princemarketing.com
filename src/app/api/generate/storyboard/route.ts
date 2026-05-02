import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Storyboard-first production. Before burning expensive Seedance video credits
// (~$1/scene × 6 scenes), generate cheap keyframe thumbnails (~$0.04 each) so the
// user — or a paying client — can approve the visual direction. Approved keyframes
// become firstFrameUrl for downstream Seedance i2v generation, locking the visual
// before money gets spent.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const sceneSchema = z.object({
  sceneIndex: z.number().int().min(0).max(50),
  prompt: z.string().min(5).max(2000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  // WHY: Optional refs let the storyboard inherit character/prop/environment locks
  // already established for the project. Keeps episodes visually consistent.
  referenceImages: z.array(z.string().url()).max(10).optional(),
});

const requestSchema = z.object({
  videoProjectId: z.string().optional(),
  // WHY: nano-banana-pro-preview (Gemini direct) is the storyboard default —
  // it accepts multi-image refs (character lock for series consistency) and
  // produces photorealistic keyframes in 9:16. The legacy "nano-banana-pro"
  // alias still routes to the .ai-proxy path for backwards compatibility,
  // and "gpt-image-2" routes to OpenAI direct (no ref support; reserve for
  // text-in-image / hero ad creative where OpenAI is stronger).
  model: z
    .enum(["nano-banana-pro-preview", "nano-banana-pro", "gpt-image-2"])
    .default("nano-banana-pro-preview"),
  scenes: z.array(sceneSchema).min(1).max(10),
});

type StoryboardSceneResult = {
  sceneIndex: number;
  status: "processing" | "ready" | "failed";
  imageUrl: string | null;
  generationId: string | null;
  streamUrl: string | null;
  error?: string;
};

// WHY: Wrap the scene prompt as a single cinematic keyframe — explicitly tell the
// image model this is a STILL, not a video frame. No text overlays, no UI, no
// letterboxing. The aspect ratio hint is repeated in prose because some image
// models honor prompt-level aspect more reliably than param-level.
function buildKeyframePrompt(
  scenePrompt: string,
  aspectRatio: string = "16:9",
): string {
  return (
    `Single cinematic storyboard keyframe, ${aspectRatio} aspect ratio. ` +
    `Composition for video production. No text overlay, no captions, no UI elements, no letterboxing. ` +
    `Photorealistic, sharp focus, studio-grade color grading. ` +
    `Scene: ${scenePrompt}`
  );
}

// WHY: OpenAI Images API only accepts a fixed set of sizes — map our aspect
// ratios to the closest supported size. gpt-image-1 (the API model) supports
// 1024x1024, 1024x1536, 1536x1024, and "auto". 1024x1536 ≈ portrait 9:16.
function aspectToOpenAISize(aspect: string): string {
  switch (aspect) {
    case "9:16":
      return "1024x1536";
    case "1:1":
      return "1024x1024";
    case "16:9":
    default:
      return "1536x1024";
  }
}

async function generateViaOpenAI(
  scene: z.infer<typeof sceneSchema>,
): Promise<StoryboardSceneResult> {
  const aspect = scene.aspectRatio ?? "16:9";
  const prompt = buildKeyframePrompt(scene.prompt, aspect);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      sceneIndex: scene.sceneIndex,
      status: "failed",
      imageUrl: null,
      generationId: null,
      streamUrl: null,
      error: "OPENAI_API_KEY not set on server",
    };
  }

  try {
    // WHY: OpenAI's image API uses model id "gpt-image-1" — that's the public
    // name; what Muapi labels "GPT Image 2" is the next-gen variant exposed
    // through their wrapper. We hit OpenAI direct here so the key in .env
    // does the work instead of routing through Muapi or the .ai backend.
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
        size: aspectToOpenAISize(aspect),
        quality: "high",
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return {
        sceneIndex: scene.sceneIndex,
        status: "failed",
        imageUrl: null,
        generationId: null,
        streamUrl: null,
        error:
          (result?.error?.message as string | undefined) ??
          `OpenAI returned ${res.status}`,
      };
    }

    // WHY: OpenAI returns base64 by default; some responses include a `url`
    // field, others a `b64_json`. Surface url first; for b64 we'd need GCS
    // upload to make it durable — punted to a later iteration.
    const data = result?.data?.[0] as
      | { url?: string; b64_json?: string }
      | undefined;
    const imageUrl = data?.url ?? null;

    if (!imageUrl && data?.b64_json) {
      return {
        sceneIndex: scene.sceneIndex,
        status: "failed",
        imageUrl: null,
        generationId: null,
        streamUrl: null,
        error:
          "OpenAI returned base64 — durable URL upload not yet wired (TODO: pipe through GCS).",
      };
    }

    return {
      sceneIndex: scene.sceneIndex,
      status: imageUrl ? "ready" : "failed",
      imageUrl,
      generationId: null,
      streamUrl: null,
    };
  } catch (err) {
    return {
      sceneIndex: scene.sceneIndex,
      status: "failed",
      imageUrl: null,
      generationId: null,
      streamUrl: null,
      error: err instanceof Error ? err.message : "OpenAI request failed",
    };
  }
}

async function generateViaPrinceAi(
  scene: z.infer<typeof sceneSchema>,
  model: "nano-banana-pro",
): Promise<StoryboardSceneResult> {
  const aspect = scene.aspectRatio ?? "16:9";
  const prompt = buildKeyframePrompt(scene.prompt, aspect);

  try {
    const res = await fetch(`${API_BASE}/api/v1/generate/image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        prompt,
        style: "storyboard-keyframe",
        aspectRatio: aspect,
        referenceImages: scene.referenceImages ?? [],
        model,
        qualityTier: "pro",
      }),
    });

    const result = await res.json();
    const inner = (result?.data ?? result) as Record<string, unknown>;
    const generationId =
      (inner.generationId as string | undefined) ??
      (result?.meta?.generationId as string | undefined) ??
      null;
    const imageUrl =
      (inner.imageUrl as string | undefined) ??
      (inner.resultUrl as string | undefined) ??
      null;

    if (!res.ok) {
      return {
        sceneIndex: scene.sceneIndex,
        status: "failed",
        imageUrl: null,
        generationId: null,
        streamUrl: null,
        error:
          (result?.error?.message as string | undefined) ??
          `Upstream returned ${res.status}`,
      };
    }

    return {
      sceneIndex: scene.sceneIndex,
      status: imageUrl ? "ready" : "processing",
      imageUrl,
      generationId,
      streamUrl: generationId ? `/api/stream/${generationId}` : null,
    };
  } catch (err) {
    return {
      sceneIndex: scene.sceneIndex,
      status: "failed",
      imageUrl: null,
      generationId: null,
      streamUrl: null,
      error: err instanceof Error ? err.message : "Generation failed",
    };
  }
}

// WHY: Branch by model:
//   nano-banana-pro-preview → Gemini direct, multi-ref character lock (default)
//   nano-banana-pro         → legacy .ai-proxy path (backwards compat)
//   gpt-image-2             → OpenAI direct, text-only, hero/ad creative
async function generateOneKeyframe(
  scene: z.infer<typeof sceneSchema>,
  model: "nano-banana-pro-preview" | "nano-banana-pro" | "gpt-image-2",
): Promise<StoryboardSceneResult> {
  if (model === "gpt-image-2") {
    return generateViaOpenAI(scene);
  }
  if (model === "nano-banana-pro-preview") {
    return generateViaGeminiDirect(scene);
  }
  return generateViaPrinceAi(scene, model);
}

// WHY: Direct Gemini call to nano-banana-pro-preview. Accepts multi-image
// refs from scene.referenceImages — the character lock anchors. Without
// refs, falls back to text-prompt-only behavior (fine but less consistent
// across a series). This is what produced the v2 keyframes for the IG Story.
async function generateViaGeminiDirect(
  scene: z.infer<typeof sceneSchema>,
): Promise<StoryboardSceneResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      sceneIndex: scene.sceneIndex,
      status: "failed",
      imageUrl: null,
      generationId: null,
      streamUrl: null,
      error: "GEMINI_API_KEY not set on server",
    };
  }

  const aspect = scene.aspectRatio ?? "16:9";
  const prompt = buildKeyframePrompt(scene.prompt, aspect);

  // WHY: Fetch each ref URL → base64. Capped at scene.referenceImages.max(10)
  // by the schema. Failures on individual refs are non-fatal — we keep going
  // with whatever we got, since text-only is a graceful fallback.
  const refParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];
  for (const url of scene.referenceImages ?? []) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get("content-type") ?? "image/png";
      refParts.push({
        inline_data: { mime_type: ct, data: buf.toString("base64") },
      });
    } catch {
      // skip this ref, continue
    }
  }

  const body = {
    contents: [
      {
        parts: [{ text: prompt }, ...refParts],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      temperature: 0.4,
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const result = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data?: string; mimeType?: string };
            inline_data?: { data?: string; mime_type?: string };
          }>;
        };
      }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        sceneIndex: scene.sceneIndex,
        status: "failed",
        imageUrl: null,
        generationId: null,
        streamUrl: null,
        error: result?.error?.message ?? `Gemini returned ${res.status}`,
      };
    }

    const parts = result.candidates?.[0]?.content?.parts ?? [];
    let b64: string | null = null;
    for (const p of parts) {
      const inline = p.inlineData ?? p.inline_data;
      if (inline?.data) {
        b64 = inline.data;
        break;
      }
    }
    if (!b64) {
      return {
        sceneIndex: scene.sceneIndex,
        status: "failed",
        imageUrl: null,
        generationId: null,
        streamUrl: null,
        error:
          "Gemini returned no image part — TODO: pipe base64 through GCS upload to make a durable URL.",
      };
    }

    // WHY: Same caveat as gpt-image-2 path — Gemini hands us base64, we'd
    // need GCS upload to make a durable URL the rest of the pipeline can
    // consume (Seedance i2v needs an URL, not bytes). v1 returns a data
    // URL inline so the StoryboardStrip at least renders the thumbnail;
    // future iteration: pipe through src/lib/storage/gcs.ts (already
    // exists from the limerence work) and return the gs URL.
    const dataUrl = `data:image/png;base64,${b64}`;
    return {
      sceneIndex: scene.sceneIndex,
      status: "ready",
      imageUrl: dataUrl,
      generationId: null,
      streamUrl: null,
    };
  } catch (err) {
    return {
      sceneIndex: scene.sceneIndex,
      status: "failed",
      imageUrl: null,
      generationId: null,
      streamUrl: null,
      error: err instanceof Error ? err.message : "Gemini request failed",
    };
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    // WHY: 5/min — storyboards fire N keyframes in parallel (up to 10 per call),
    // so the effective per-image rate is much higher than the route limit suggests.
    const { allowed, remaining } = checkRateLimit(`storyboard:${email}`, 5);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // WHY: gpt-image-2 needs OPENAI_API_KEY — guard until it's wired up so we
    // fail loud with a clear message instead of silently routing to a broken
    // upstream. Falls back to nano-banana-pro if the caller asks for gpt-image-2
    // before the env is ready.
    let effectiveModel = parsed.data.model;
    if (effectiveModel === "gpt-image-2" && !process.env.OPENAI_API_KEY) {
      effectiveModel = "nano-banana-pro";
    }

    const results = await Promise.all(
      parsed.data.scenes.map((scene) =>
        generateOneKeyframe(scene, effectiveModel),
      ),
    );

    const readyCount = results.filter((r) => r.status === "ready").length;
    const processingCount = results.filter((r) => r.status === "processing").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return NextResponse.json(
      {
        videoProjectId: parsed.data.videoProjectId ?? null,
        model: effectiveModel,
        modelRequested: parsed.data.model,
        sceneCount: parsed.data.scenes.length,
        readyCount,
        processingCount,
        failedCount,
        scenes: results,
      },
      { status: failedCount === parsed.data.scenes.length ? 502 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Storyboard generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
