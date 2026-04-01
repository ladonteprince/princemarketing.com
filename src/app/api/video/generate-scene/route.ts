import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

const requestSchema = z.object({
  prompt: z.string().min(1),
  referenceImages: z.array(z.string()).optional(),
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

    const { prompt, referenceImages } = parsed.data;

    // TODO: Integrate with the .ai API (Seedance/Veo) for actual video generation
    // For now, this is a stub that returns a placeholder
    //
    // In production, this would:
    // 1. Call the PrinceMarketing.ai video generation API
    // 2. Poll for completion
    // 3. Return the final video URL + thumbnail
    //
    // Example integration:
    // const res = await fetch(`${process.env.AI_ENGINE_URL}/api/video/generate`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${process.env.AI_ENGINE_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     prompt,
    //     referenceImages,
    //     model: "seedance-2.0",
    //     duration: 5,
    //     resolution: "720p",
    //   }),
    // });

    return NextResponse.json({
      videoUrl: null, // Will be a real URL once .ai API is connected
      thumbnailUrl: null,
      duration: 5,
      prompt,
      status: "queued",
      message: "Video generation is queued. Connect the .ai API to enable real video generation.",
    });
  } catch (error) {
    console.error("Video generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 },
    );
  }
}
