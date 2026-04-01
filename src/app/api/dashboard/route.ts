import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard — Returns overview data for the dashboard home page
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user, analytics, upcoming entries in parallel
    const [user, publishedEntries, upcomingEntries, weekEntries] =
      await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: { name: true, tier: true },
        }),
        db.calendarEntry.findMany({
          where: { userId, status: "PUBLISHED" },
          include: { analytics: true },
        }),
        db.calendarEntry.findMany({
          where: {
            userId,
            scheduledAt: { gte: new Date() },
            status: { in: ["SCHEDULED", "DRAFT"] },
          },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          select: {
            id: true,
            title: true,
            platform: true,
            scheduledAt: true,
            status: true,
          },
        }),
        // Posts this week
        (() => {
          const now = new Date();
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          startOfWeek.setDate(startOfWeek.getDate() + diff);
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 7);

          return db.calendarEntry.count({
            where: {
              userId,
              scheduledAt: { gte: startOfWeek, lt: endOfWeek },
            },
          });
        })(),
      ]);

    // Aggregate analytics
    let totalImpressions = 0;
    let totalEngagement = 0;

    for (const entry of publishedEntries) {
      for (const a of entry.analytics) {
        totalImpressions += a.impressions;
        totalEngagement += a.engagement;
      }
    }

    return NextResponse.json({
      userName: user?.name ?? "there",
      tier: user?.tier ?? "STARTER",
      totalImpressions,
      totalEngagement,
      postsThisWeek: weekEntries,
      postsPublished: publishedEntries.length,
      upcomingEntries,
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
