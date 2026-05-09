import { NextResponse } from "next/server";
import { z } from "zod";

// WHY: Dev-only preview endpoint. Calls OpenAI gpt-image-1 (a.k.a. "GPT Image 2")
// directly and returns a data URL for the base64 case so the storyboard sandbox
// can show real generated images without needing auth, GCS upload, or burning
// the .ai pipeline. Refuses to run in production. Pair with /storyboard-preview.

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
  scenes: z
    .array(
      z.object({
        sceneIndex: z.number().int().min(0).max(50),
        prompt: z.string().min(3).max(2000),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
        annotations: annotationsSchema,
      }),
    )
    .min(1)
    .max(10),
});

type Annotations = z.infer<typeof annotationsSchema>;

function buildKeyframePrompt(
  scenePrompt: string,
  aspect: string,
  annotations?: Annotations,
): string {
  const parts = [
    `Single cinematic storyboard keyframe, ${aspect} aspect ratio.`,
    "Composition for video production. No text overlay, no captions, no UI elements, no letterboxing.",
    "Photorealistic, sharp focus, studio-grade color grading.",
    `Scene: ${scenePrompt}`,
  ];
  // WHY: Structured annotations get appended as labeled clauses so the model
  // honors each axis (body / camera / framing / lighting / vocal-emotion /
  // FACS) without blurring them. IPA is for downstream video gen — not the
  // still — so we skip it here.
  if (annotations?.body) parts.push(`Body movement: ${annotations.body}.`);
  if (annotations?.camera) parts.push(`Camera: ${annotations.camera}.`);
  if (annotations?.framing) parts.push(`Framing: ${annotations.framing}.`);
  if (annotations?.lighting) parts.push(`Lighting: ${annotations.lighting}.`);
  if (annotations?.vocal)
    parts.push(`Vocal / emotional register: ${annotations.vocal}.`);
  if (annotations?.facs)
    parts.push(`Facial expression (FACS): ${annotations.facs}.`);
  return parts.join(" ");
}

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

type Result = {
  sceneIndex: number;
  status: "ready" | "failed";
  imageUrl: string | null;
  error?: string;
};

async function generateOne(
  sceneIndex: number,
  prompt: string,
  aspect: string,
  apiKey: string,
  annotations?: Annotations,
): Promise<Result> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: buildKeyframePrompt(prompt, aspect, annotations),
        n: 1,
        size: aspectToOpenAISize(aspect),
        quality: "high",
      }),
    });

    const result = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        sceneIndex,
        status: "failed",
        imageUrl: null,
        error: result?.error?.message ?? `OpenAI returned ${res.status}`,
      };
    }

    const datum = result.data?.[0];
    // WHY: OpenAI returns b64_json by default for gpt-image-1. Inline as a data
    // URL — fine for preview; production should still pipe through GCS for
    // durable URLs and downstream video-gen reuse.
    if (datum?.b64_json) {
      return {
        sceneIndex,
        status: "ready",
        imageUrl: `data:image/png;base64,${datum.b64_json}`,
      };
    }
    if (datum?.url) {
      return { sceneIndex, status: "ready", imageUrl: datum.url };
    }
    return {
      sceneIndex,
      status: "failed",
      imageUrl: null,
      error: "OpenAI returned no image data",
    };
  } catch (err) {
    return {
      sceneIndex,
      status: "failed",
      imageUrl: null,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not set on server" },
      { status: 500 },
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

  const scenes = await Promise.all(
    parsed.data.scenes.map((s) =>
      generateOne(s.sceneIndex, s.prompt, s.aspectRatio, apiKey, s.annotations),
    ),
  );

  const readyCount = scenes.filter((s) => s.status === "ready").length;
  const failedCount = scenes.length - readyCount;

  return NextResponse.json({
    model: "gpt-image-1",
    sceneCount: scenes.length,
    readyCount,
    failedCount,
    scenes,
  });
}
