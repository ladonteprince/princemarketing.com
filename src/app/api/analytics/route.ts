import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchAllPlatformAnalytics, type PlatformAnalytics } from "@/lib/social/analytics";

// GET /api/analytics — Returns combined analytics: DB post metrics + live platform metrics
// WHY: The dashboard needs both historical post-level data (from our Analytics table)
// and live platform-level data (followers, impressions from each platform's API).
// Combining them gives the user a complete picture in one API call.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Run DB queries and platform API calls in parallel
    // WHY: These are independent data sources — no reason to wait for one before the other.
    const [entries, connectedPlatforms] = await Promise.all([
      // 1. Post-level analytics from our database
      db.calendarEntry.findMany({
        where: {
          userId,
          status: "PUBLISHED",
        },
        include: {
          analytics: true,
        },
        orderBy: { publishedAt: "desc" },
      }),

      // 2. Connected platforms with valid tokens for live API calls
      db.platform.findMany({
        where: {
          userId,
          connected: true,
          accessToken: { not: null },
        },
        select: {
          type: true,
          accessToken: true,
          accountName: true,
        },
      }),
    ]);

    // --- Aggregate post-level analytics from DB ---
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

    // --- Fetch live platform analytics ---
    // WHY: Live data gives real-time follower counts and platform-level metrics
    // that aren't tracked per-post in our database.
    let platformAnalytics: PlatformAnalytics[] = [];

    if (connectedPlatforms.length > 0) {
      platformAnalytics = await fetchAllPlatformAnalytics(
        connectedPlatforms
          .filter((p): p is typeof p & { accessToken: string } => p.accessToken !== null)
          .map((p) => ({
            type: p.type.toLowerCase(),
            accessToken: p.accessToken,
          })),
      );
    }

    // --- Aggregate live platform totals ---
    const platformTotals = {
      followers: 0,
      livePosts: 0,
      liveImpressions: 0,
      liveEngagement: 0,
      liveClicks: 0,
    };

    for (const pa of platformAnalytics) {
      platformTotals.followers += pa.followers;
      platformTotals.livePosts += pa.posts;
      platformTotals.liveImpressions += pa.impressions;
      platformTotals.liveEngagement += pa.engagement;
      platformTotals.liveClicks += pa.clicks;
    }

    return NextResponse.json({
      // Post-level metrics from DB
      totalImpressions,
      totalEngagement,
      totalClicks,
      totalShares,
      totalComments,
      postsPublished: entries.length,
      topPosts,

      // Live platform-level metrics
      platforms: platformAnalytics,
      platformTotals,

      // Combined totals (DB + live)
      // WHY: The dashboard can show either granular breakdowns or a single
      // combined number. Providing both lets the frontend decide.
      combined: {
        impressions: totalImpressions + platformTotals.liveImpressions,
        engagement: totalEngagement + platformTotals.liveEngagement,
        clicks: totalClicks + platformTotals.liveClicks,
        followers: platformTotals.followers,
      },
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
