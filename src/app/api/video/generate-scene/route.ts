import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const requestSchema = z.object({
  prompt: z.string().min(1),
  duration: z.number().optional().default(5),
  mode: z.string().optional(),
  referenceImages: z.array(z.string()).optional(),
  imageLabels: z.array(z.string()).optional(),
  sourceImage: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`video:${email}`, 10);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Call the real .ai backend for video generation
    const res = await fetch(`${API_BASE}/api/v1/generate/video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        prompt: parsed.data.prompt,
        duration: String(parsed.data.duration),
        aspectRatio: "16:9",
        mode: parsed.data.mode ?? "t2v",
        referenceImages: parsed.data.referenceImages,
        imageLabels: parsed.data.imageLabels,
        sourceImage: parsed.data.sourceImage,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? "Video generation failed" },
        { status: res.status },
      );
    }

    const generationId = result?.data?.generationId ?? result?.meta?.generationId;

    return NextResponse.json({
      generationId,
      videoUrl: null, // Will be populated when generation completes
      thumbnailUrl: null,
      duration: parsed.data.duration,
      prompt: parsed.data.prompt,
      status: "processing",
      streamUrl: generationId ? `/api/stream/${generationId}` : null,
    });
  } catch (error) {
    console.error("Video generate-scene error:", error);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 },
    );
  }
}
