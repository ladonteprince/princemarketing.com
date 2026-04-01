import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { isValidPlatform, PLATFORMS } from "@/lib/social/platforms";
import { publishToplatform } from "@/lib/social/publish";
import type { PlatformKey } from "@/lib/social/platforms";

const publishSchema = z.object({
  content: z.string().min(1, "Content is required"),
  platforms: z.array(z.string()).min(1, "At least one platform required"),
  mediaUrl: z.string().url().optional(),
  calendarEntryId: z.string().optional(),
});

// POST /api/social/publish — Publishes content to one or more connected platforms
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = publishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { content, platforms, mediaUrl, calendarEntryId } = parsed.data;

    // Validate all requested platforms
    for (const p of platforms) {
      if (!isValidPlatform(p)) {
        return NextResponse.json(
          { error: `Invalid platform: ${p}` },
          { status: 400 },
        );
      }
    }

    // Fetch connected platforms from DB
    const connectedPlatforms = await db.platform.findMany({
      where: {
        userId: session.user.id,
        connected: true,
        type: { in: platforms.map((p) => PLATFORMS[p as PlatformKey].dbType) },
      },
    });

    const results: Record<string, { success: boolean; postId?: string; error?: string }> = {};

    for (const platformKey of platforms as PlatformKey[]) {
      const dbType = PLATFORMS[platformKey].dbType;
      const connected = connectedPlatforms.find((p) => p.type === dbType);

      if (!connected || !connected.accessToken) {
        results[platformKey] = {
          success: false,
          error: `${PLATFORMS[platformKey].name} is not connected. Connect it in Settings first.`,
        };
        continue;
      }

      const result = await publishToplatform(platformKey, {
        content,
        mediaUrl,
        accessToken: connected.accessToken,
      });

      results[platformKey] = result;
    }

    // If a calendarEntryId was provided, update its status
    if (calendarEntryId) {
      const allSuccess = Object.values(results).every((r) => r.success);
      const anySuccess = Object.values(results).some((r) => r.success);

      await db.calendarEntry.update({
        where: { id: calendarEntryId },
        data: {
          status: allSuccess ? "PUBLISHED" : anySuccess ? "PUBLISHED" : "FAILED",
          publishedAt: anySuccess ? new Date() : undefined,
        },
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish content" },
      { status: 500 },
    );
  }
}
