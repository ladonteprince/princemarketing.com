import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishToplatform } from "@/lib/social/publish";
import type { PlatformKey } from "@/lib/social/platforms";

// GET /api/cron/publish — Called by cron every minute to auto-publish scheduled posts
// WHY: Posts are scheduled in the calendar but nothing actually publishes them.
// This endpoint bridges the gap — a cron job hits it, and it publishes anything overdue.
// Protected by CRON_SECRET to prevent unauthorized triggering.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find entries scheduled for now or in the past that haven't been published yet
    const pendingEntries = await db.calendarEntry.findMany({
      where: {
        scheduledAt: { lte: now },
        publishedAt: null,
        status: "SCHEDULED",
      },
      include: {
        user: {
          include: {
            platforms: true,
          },
        },
      },
      take: 10, // Process up to 10 per cycle to avoid timeouts
      orderBy: { scheduledAt: "asc" }, // Oldest first
    });

    if (pendingEntries.length === 0) {
      return NextResponse.json({ processed: 0, results: [] });
    }

    const results: Array<{
      id: string;
      title: string;
      platform: string;
      status: "published" | "failed";
      error?: string;
    }> = [];

    for (const entry of pendingEntries) {
      // Find the matching connected platform for this user
      const platform = entry.user.platforms.find(
        (p) => p.type === entry.platform && p.connected,
      );

      if (!platform || !platform.accessToken) {
        // Mark as failed — platform not connected or no token
        await db.calendarEntry.update({
          where: { id: entry.id },
          data: { status: "FAILED" },
        });
        results.push({
          id: entry.id,
          title: entry.title,
          platform: entry.platform,
          status: "failed",
          error: `${entry.platform} is not connected or missing access token.`,
        });
        continue;
      }

      try {
        // Convert DB enum (UPPERCASE) to publish function key (lowercase)
        const platformKey = entry.platform.toLowerCase() as PlatformKey;

        const result = await publishToplatform(platformKey, {
          content: entry.content,
          accessToken: platform.accessToken,
          mediaUrl: entry.mediaUrl ?? undefined,
        });

        if (result.success) {
          await db.calendarEntry.update({
            where: { id: entry.id },
            data: {
              status: "PUBLISHED",
              publishedAt: new Date(),
            },
          });
          results.push({
            id: entry.id,
            title: entry.title,
            platform: entry.platform,
            status: "published",
          });
        } else {
          await db.calendarEntry.update({
            where: { id: entry.id },
            data: { status: "FAILED" },
          });
          results.push({
            id: entry.id,
            title: entry.title,
            platform: entry.platform,
            status: "failed",
            error: result.error,
          });
        }
      } catch (err) {
        await db.calendarEntry.update({
          where: { id: entry.id },
          data: { status: "FAILED" },
        });
        results.push({
          id: entry.id,
          title: entry.title,
          platform: entry.platform,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(
      `[Cron] Auto-publish complete: ${results.filter((r) => r.status === "published").length} published, ${results.filter((r) => r.status === "failed").length} failed`,
    );

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[Cron] Auto-publish error:", error);
    return NextResponse.json(
      { error: "Cron execution failed" },
      { status: 500 },
    );
  }
}
