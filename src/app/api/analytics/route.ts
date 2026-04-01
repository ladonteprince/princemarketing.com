import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/analytics — Returns real analytics data from the database
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get aggregated analytics across all user's calendar entries
    const entries = await db.calendarEntry.findMany({
      where: {
        userId,
        status: "PUBLISHED",
      },
      include: {
        analytics: true,
      },
      orderBy: { publishedAt: "desc" },
    });

    let totalImpressions = 0;
    let totalEngagement = 0;
    let totalClicks = 0;
    let totalShares = 0;
    let totalComments = 0;

    const postsWithAnalytics: {
      id: string;
      title: string;
      platform: string;
      impressions: number;
      engagement: number;
    }[] = [];

    for (const entry of entries) {
      let entryImpressions = 0;
      let entryEngagement = 0;

      for (const a of entry.analytics) {
        totalImpressions += a.impressions;
        totalEngagement += a.engagement;
        totalClicks += a.clicks;
        totalShares += a.shares;
        totalComments += a.comments;
        entryImpressions += a.impressions;
        entryEngagement += a.engagement;
      }

      if (entry.analytics.length > 0) {
        postsWithAnalytics.push({
          id: entry.id,
          title: entry.title,
          platform: entry.platform,
          impressions: entryImpressions,
          engagement: entryEngagement,
        });
      }
    }

    // Sort by impressions, take top 5
    const topPosts = postsWithAnalytics
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    return NextResponse.json({
      totalImpressions,
      totalEngagement,
      totalClicks,
      totalShares,
      totalComments,
      postsPublished: entries.length,
      topPosts,
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
