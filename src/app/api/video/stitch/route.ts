import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const requestSchema = z.object({
  projectId: z.string(),
  audioUrl: z.string().optional(),
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

    const { projectId, scenes, audioUrl } = parsed.data;

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "No scenes to stitch" },
        { status: 400 },
      );
    }

    // Resolve proxy URLs back to .ai URLs for the backend
    const resolvedScenes = scenes.map((s) => {
      let videoUrl = s.videoUrl;
      if (videoUrl.startsWith("/api/proxy/image?url=")) {
        videoUrl = decodeURIComponent(videoUrl.split("url=")[1]);
      }
      return { ...s, videoUrl };
    });

    // Call the real .ai stitch endpoint with ffmpeg
    const res = await fetch(`${API_BASE}/api/v1/video/stitch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        projectId,
        scenes: resolvedScenes,
        audioUrl,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error ?? "Stitch failed" },
        { status: res.status },
      );
    }

    // Proxy the video URL through our proxy
    const videoUrl = result?.data?.videoUrl;
    const proxiedUrl = videoUrl
      ? `/api/proxy/image?url=${encodeURIComponent(videoUrl)}`
      : null;

    return NextResponse.json({
      videoUrl: proxiedUrl,
      directUrl: videoUrl,
      projectId,
      totalScenes: scenes.length,
      totalDuration: result?.data?.totalDuration ?? scenes.reduce((sum, s) => sum + (s.trimEnd - s.trimStart), 0),
      status: "completed",
    });
  } catch (error) {
    console.error("Video stitch error:", error);
    return NextResponse.json(
      { error: "Failed to stitch video" },
      { status: 500 },
    );
  }
}
