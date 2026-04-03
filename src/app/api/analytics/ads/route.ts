import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fetchAllAdsAnalytics,
  summarizeAdsData,
  type AllAdsData,
  type AdCampaign,
  type AdInsight,
} from "@/lib/social/ads";
import type { AdPlatform } from "@/lib/social/ad-managers";
import type { PlatformType } from "@prisma/client";

// GET /api/analytics/ads — Returns ad campaign performance data from connected ad platforms
// WHY: The dashboard and AI Strategist need a single endpoint to fetch ads analytics
// across Meta, Google, TikTok, and LinkedIn. This aggregates data from all connected
// platforms in parallel and returns both raw data and a text summary for AI consumption.
//
// Query params:
//   platform — "meta" | "google" | "tiktok" | "linkedin" | "all" (default: "all")
//   since — Start date in YYYY-MM-DD format
//   until — End date in YYYY-MM-DD format

const PLATFORM_TO_DB_TYPE: Record<AdPlatform, PlatformType> = {
  meta: "FACEBOOK",
  google: "GOOGLE_ANALYTICS", // WHY: Google Ads uses the same OAuth token as Google Analytics
  tiktok: "TIKTOK",
  linkedin: "LINKEDIN",
};

const DB_TYPE_TO_PLATFORM: Record<string, AdPlatform> = {
  FACEBOOK: "meta",
  GOOGLE_ANALYTICS: "google",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = (searchParams.get("platform") ?? "all") as AdPlatform | "all";
    const since = searchParams.get("since");
    const until = searchParams.get("until");

    // WHY: We need connected platforms with valid tokens. The ad platform type maps to
    // our database platform type (e.g., "meta" maps to "FACEBOOK" in the DB).
    const dbTypeFilter: PlatformType[] =
      platform === "all"
        ? Object.values(PLATFORM_TO_DB_TYPE)
        : [PLATFORM_TO_DB_TYPE[platform]].filter((v): v is PlatformType => v !== undefined);

    const connections = await db.platform.findMany({
      where: {
        userId: session.user.id,
        connected: true,
        accessToken: { not: null },
        type: { in: dbTypeFilter },
      },
      select: {
        type: true,
        accessToken: true,
      },
    });

    // WHY: Advertiser IDs and customer IDs are platform-specific configuration that
    // lives in environment variables. The Platform model stores OAuth tokens, but these
    // additional identifiers are set during platform onboarding and stored in env.
    const adConnections = connections
      .filter((c): c is typeof c & { accessToken: string } => c.accessToken !== null)
      .map((c) => ({
        platform: DB_TYPE_TO_PLATFORM[c.type] as AdPlatform,
        accessToken: c.accessToken,
        advertiserId: process.env.TIKTOK_ADVERTISER_ID,
        customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
      }))
      .filter((c) => c.platform !== undefined);

    // Build date range if provided
    const dateRange = since && until ? { since, until } : undefined;

    // Fetch ads data from all connected platforms in parallel
    const adsData = await fetchAllAdsAnalytics(adConnections, dateRange);

    // Filter to requested platform if not "all"
    const filteredData: Partial<AllAdsData> =
      platform === "all"
        ? adsData
        : { [platform]: adsData[platform] };

    // Build text summary for AI Strategist consumption
    const summary = summarizeAdsData(adsData);

    // Aggregate totals across all platforms
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    const allCampaigns: AdCampaign[] = [];
    const allInsights: AdInsight[] = [];

    for (const result of Object.values(filteredData)) {
      if (!result) continue;
      allCampaigns.push(...result.campaigns);
      if (result.insights) {
        allInsights.push(result.insights);
        totalSpend += result.insights.spend;
        totalImpressions += result.insights.impressions;
        totalClicks += result.insights.clicks;
        totalConversions += result.insights.conversions;
      }
    }

    return NextResponse.json({
      ads: filteredData,
      campaigns: allCampaigns,
      insights: allInsights,
      totals: {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0",
        activeCampaigns: allCampaigns.filter(
          (c) => c.status === "ACTIVE" || c.status === "ENABLED",
        ).length,
      },
      summary,
      connectedPlatforms: adConnections.map((c) => c.platform),
    });
  } catch (error) {
    console.error("[Ads Analytics] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ads analytics" },
      { status: 500 },
    );
  }
}
