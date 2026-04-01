import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

const requestSchema = z.object({
  projectId: z.string(),
  scenes: z.array(
    z.object({
      videoUrl: z.string(),
      trimStart: z.number(),
      trimEnd: z.number(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`stitch:${email}`, 5);
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

    const { projectId, scenes } = parsed.data;

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "No scenes to stitch" },
        { status: 400 },
      );
    }

    // TODO: Integrate with ffmpeg or the .ai API for video stitching
    // In production, this would:
    // 1. Download each scene video
    // 2. Apply trim points (trimStart, trimEnd) to each clip
    // 3. Concatenate all clips with ffmpeg
    // 4. Upload the final video
    // 5. Return the URL
    //
    // Example ffmpeg approach:
    // for each scene, create a trimmed segment:
    //   ffmpeg -i scene.mp4 -ss trimStart -to trimEnd -c copy trimmed_scene.mp4
    // then concat:
    //   ffmpeg -f concat -i filelist.txt -c copy final.mp4
    //
    // Or delegate to .ai API:
    // const res = await fetch(`${process.env.AI_ENGINE_URL}/api/video/stitch`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${process.env.AI_ENGINE_API_KEY}`,
    //   },
    //   body: JSON.stringify({ projectId, scenes }),
    // });

    return NextResponse.json({
      videoUrl: null,
      projectId,
      totalScenes: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + (s.trimEnd - s.trimStart), 0),
      status: "queued",
      message:
        "Video stitching is queued. Connect the .ai API or configure ffmpeg to enable real stitching.",
    });
  } catch (error) {
    console.error("Video stitch error:", error);
    return NextResponse.json(
      { error: "Failed to stitch video" },
      { status: 500 },
    );
  }
}
