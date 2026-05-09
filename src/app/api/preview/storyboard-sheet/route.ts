import { NextResponse } from "next/server";
import { z } from "zod";
import {
  aspectToOpenAISize,
  buildSheetPrompt,
} from "@/lib/storyboard-sheet-prompt";

// WHY: @aimikoda-style single-call storyboard sheet — dev preview variant.
// Calls OpenAI gpt-image-2 directly with no auth and inlines the result as a
// data URL. Refuses to run in production. Pair with /storyboard-preview.
// Production-equivalent lives at /api/generate/storyboard-sheet.

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

  const prompt = buildSheetPrompt(parsed.data);

  try {
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
      promptUsed: prompt,
      imageUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 502 },
    );
  }
}
