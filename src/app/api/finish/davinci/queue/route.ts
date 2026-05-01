import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Authenticated chat-side endpoint. ChatPanel calls this when the
// strategist emits a FINISH_IN_DAVINCI action — we persist a row in the
// finishing_jobs table for the local DaVinci agent to claim later via /poll.
// Auth is the user's NextAuth session (same as every other /api/* route).

const sceneSchema = z.object({
  sceneIndex: z.number().int().min(0).max(50),
  videoUrl: z.string().url(),
  durationSec: z.number().min(1).max(120),
});

const requestSchema = z.object({
  videoProjectId: z.string().optional(),
  projectName: z.string().min(1).max(200).optional(),
  scenes: z.array(sceneSchema).min(1).max(20),
  scoreUrl: z.string().url().optional(),
  voiceoverUrl: z.string().url().optional(),
  targetFormats: z
    .array(
      z.enum([
        "tiktok-9x16",
        "reels-9x16",
        "youtube-shorts-9x16",
        "youtube-16x9",
        "feed-1x1",
        "feed-4x5",
        "twitter-16x9",
        "brand-film-16x9",
      ]),
    )
    .min(1)
    .max(8),
  brandLut: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id;
    const { allowed } = checkRateLimit(`finish:queue:${email}`, 20);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const job = await db.finishingJob.create({
      data: {
        userId: session.user.id,
        projectId: parsed.data.videoProjectId ?? null,
        status: "QUEUED",
        spec: parsed.data,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      queuedAt: job.createdAt,
    });
  } catch (err) {
    console.error("[FinishQueue] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Queue failed" },
      { status: 500 },
    );
  }
}
