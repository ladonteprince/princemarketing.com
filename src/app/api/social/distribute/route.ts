import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { distribute } from "@/lib/social/distributor";

// WHY: Strict schema validation prevents malformed requests from reaching the
// distribution pipeline. Each field has sensible limits to block abuse.
const distributeSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  platforms: z.array(z.string()).min(1, "At least one platform required").max(7),
  scheduledAt: z.string().optional(),
  platformCaptions: z.record(z.string(), z.string().max(10000)).optional(),
});

// POST /api/social/distribute — Distribute content to multiple platforms at once
// WHY: The existing /api/social/publish route works but lacks caption optimization
// and scheduled publish support. This route wraps the distributor module which
// handles per-platform caption limits, parallel dispatch, and post URL construction.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = distributeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const results = await distribute(session.user.id, {
      content: parsed.data.content,
      mediaUrl: parsed.data.mediaUrl,
      mediaType: parsed.data.mediaType,
      platforms: parsed.data.platforms,
      scheduledAt: parsed.data.scheduledAt,
      platformCaptions: parsed.data.platformCaptions,
    });

    // Summarize: did everything succeed?
    const allSuccess = results.every((r) => r.success);
    const anySuccess = results.some((r) => r.success);

    return NextResponse.json({
      status: allSuccess ? "success" : anySuccess ? "partial" : "failed",
      results,
    });
  } catch (error) {
    console.error("Distribution error:", error);
    return NextResponse.json(
      { error: "Failed to distribute content" },
      { status: 500 },
    );
  }
}
