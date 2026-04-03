import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { isValidPlatform, PLATFORMS } from "@/lib/social/platforms";
import { publishToplatform } from "@/lib/social/publish";
import type { PlatformKey } from "@/lib/social/platforms";

// Per-platform content can be a plain string or an object with title + description (YouTube)
const platformContentValue = z.union([
  z.string(),
  z.object({
    title: z.string().max(100, "YouTube title must be 100 characters or less"),
    description: z.string().max(5000, "YouTube description must be 5000 characters or less"),
  }),
]);

const publishSchema = z.object({
  content: z.string().min(1, "Content is required"),
  platforms: z.array(z.string()).min(1, "At least one platform required"),
  platformContent: z.record(z.string(), platformContentValue).optional(),
  mediaUrl: z.string().url().optional(),
  mediaUrls: z.array(z.string().url()).max(20).optional(),
  mediaType: z.enum(["image", "video", "carousel", "reel", "story"]).optional(),
  scheduled: z.number().optional(),
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

    const { content, platforms, platformContent, mediaUrl, mediaUrls, mediaType, scheduled, calendarEntryId } = parsed.data;

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

    // Also fetch Facebook token (needed for Instagram publishing via Graph API)
    const fbPlatform = await db.platform.findFirst({
      where: { userId: session.user.id, type: "FACEBOOK", connected: true },
    });

    for (const platformKey of platforms as PlatformKey[]) {
      const dbType = PLATFORMS[platformKey].dbType;
      let connected = connectedPlatforms.find((p) => p.type === dbType);

      // Instagram publishing uses Facebook's token (Graph API requires it)
      if (platformKey === "instagram" && fbPlatform?.accessToken) {
        connected = { ...connected!, accessToken: fbPlatform.accessToken };
      }

      if (!connected || !connected.accessToken) {
        results[platformKey] = {
          success: false,
          error: `${PLATFORMS[platformKey].name} is not connected. Connect it in Settings first.`,
        };
        continue;
      }

      // Resolve per-platform content: use platformContent override if provided, else fall back to default
      const override = platformContent?.[platformKey];
      let resolvedContent = content;
      let resolvedTitle: string | undefined;

      if (override) {
        if (typeof override === "string") {
          resolvedContent = override;
        } else {
          // Object form with title + description (YouTube)
          resolvedTitle = override.title;
          resolvedContent = override.description;
        }
      }

      const result = await publishToplatform(platformKey, {
        content: resolvedContent,
        title: resolvedTitle,
        mediaUrl,
        mediaUrls,
        mediaType,
        scheduled,
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
