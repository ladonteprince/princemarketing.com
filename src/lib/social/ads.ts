// Ads Platform Analytics Integration
// WHY: Customers need to see campaign performance data from Meta, Google, TikTok, and LinkedIn
// in a single unified dashboard. Each platform has a different API shape — this normalizes
// them into shared AdCampaign and AdInsight types the dashboard and AI Strategist can consume.
//
// ARCHITECTURE: One fetch function per platform, matching the pattern in analytics.ts.
// Tokens come from our existing OAuth connections stored in the database.

import type { AdPlatform } from "./ad-managers";

// --- Types ---

export type AdCampaign = {
  id: string;
  name: string;
  status: string;
  platform: AdPlatform;
  objective?: string;
  metrics: {
    impressions?: number;
    clicks?: number;
    spend?: number;
    cpc?: number;
    cpm?: number;
    ctr?: number;
    reach?: number;
    conversions?: number;
  };
};

export type AdInsight = {
  platform: AdPlatform;
  spend: number;
  impressions: number;
  clicks: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  reach?: number;
  conversions: number;
};

export type AdsAnalyticsResult = {
  campaigns: AdCampaign[];
  insights: AdInsight | null;
  error?: string;
};

// --- Meta Ads (Facebook + Instagram) ---
// WHY: Uses the Facebook Graph API with the same access token we already have for Facebook Pages.
// The user's Facebook token has page-level access; ad account access requires the ads_read scope
// which we request in ad-managers.ts AD_MANAGER_SCOPES.

export async function getMetaAdsCampaigns(accessToken: string): Promise<AdCampaign[]> {
  try {
    // Step 1: Get ad accounts linked to this user
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`,
    );
    const accountsData = await accountsRes.json();

    if (!accountsData.data?.[0]) return [];
    const adAccountId = accountsData.data[0].id;

    // Step 2: Get campaigns with inline insights
    // WHY: Requesting insights as a nested field avoids a second API call per campaign.
    // The Graph API returns the last 30 days of data by default.
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective,insights{impressions,clicks,spend,cpc,cpm,ctr,reach,actions}&access_token=${accessToken}`,
    );
    const campaignsData = await campaignsRes.json();

    return (campaignsData.data ?? []).map((c: Record<string, unknown>) => {
      const insightRow = (c.insights as { data?: Record<string, string>[] })?.data?.[0];
      return {
        id: String(c.id),
        name: String(c.name),
        status: String(c.status),
        platform: "meta" as const,
        objective: String(c.objective ?? ""),
        metrics: {
          impressions: parseInt(insightRow?.impressions ?? "0"),
          clicks: parseInt(insightRow?.clicks ?? "0"),
          spend: parseFloat(insightRow?.spend ?? "0"),
          cpc: parseFloat(insightRow?.cpc ?? "0"),
          cpm: parseFloat(insightRow?.cpm ?? "0"),
          ctr: parseFloat(insightRow?.ctr ?? "0"),
          reach: parseInt(insightRow?.reach ?? "0"),
        },
      };
    });
  } catch (err) {
    console.error("[Ads] Meta campaigns fetch failed:", err);
    return [];
  }
}

export async function getMetaAdsInsights(
  accessToken: string,
  dateRange?: { since: string; until: string },
): Promise<AdInsight> {
  const empty: AdInsight = { platform: "meta", spend: 0, impressions: 0, clicks: 0, conversions: 0 };

  try {
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id&access_token=${accessToken}`,
    );
    const accountsData = await accountsRes.json();
    if (!accountsData.data?.[0]) return empty;

    const adAccountId = accountsData.data[0].id;
    const dateParam = dateRange
      ? `&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`
      : "";

    // WHY: Account-level insights give a single-row summary across all campaigns.
    // The actions array contains conversion events — we sum them for a total conversions count.
    const insightsRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,actions,conversions&level=account${dateParam}&access_token=${accessToken}`,
    );
    const insightsData = await insightsRes.json();
    const d = insightsData.data?.[0] as Record<string, string> | undefined;

    if (!d) return empty;

    return {
      platform: "meta",
      spend: parseFloat(d.spend ?? "0"),
      impressions: parseInt(d.impressions ?? "0"),
      clicks: parseInt(d.clicks ?? "0"),
      ctr: parseFloat(d.ctr ?? "0"),
      cpc: parseFloat(d.cpc ?? "0"),
      cpm: parseFloat(d.cpm ?? "0"),
      reach: parseInt(d.reach ?? "0"),
      conversions: 0, // TODO: Extract from actions array when available
    };
  } catch (err) {
    console.error("[Ads] Meta insights fetch failed:", err);
    return empty;
  }
}

// --- Google Ads ---
// WHY: Google Ads uses a separate REST API (not the Analytics one) at googleads.googleapis.com.
// It requires an OAuth2 access token (we have from Google login), a developer token (needs
// approval from Google), and a customer ID (the ads account). The GAQL query language is
// used to select campaign data.

export async function getGoogleAdsCampaigns(
  accessToken: string,
  customerId?: string,
): Promise<AdCampaign[]> {
  if (!customerId) return [];

  try {
    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        },
        body: JSON.stringify({
          query:
            "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.conversions FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY metrics.impressions DESC LIMIT 20",
        }),
      },
    );

    if (!res.ok) return [];
    const data = await res.json();

    return (data[0]?.results ?? []).map((r: Record<string, Record<string, string>>) => ({
      id: String(r.campaign?.id ?? ""),
      name: String(r.campaign?.name ?? ""),
      status: String(r.campaign?.status ?? ""),
      platform: "google" as const,
      metrics: {
        impressions: parseInt(r.metrics?.impressions ?? "0"),
        clicks: parseInt(r.metrics?.clicks ?? "0"),
        // WHY: Google Ads returns cost in micros (millionths of the currency unit).
        // Divide by 1,000,000 to get the actual dollar amount.
        spend: parseInt(r.metrics?.costMicros ?? "0") / 1_000_000,
        ctr: parseFloat(r.metrics?.ctr ?? "0") * 100,
        conversions: parseFloat(r.metrics?.conversions ?? "0"),
      },
    }));
  } catch (err) {
    console.error("[Ads] Google campaigns fetch failed:", err);
    return [];
  }
}

export async function getGoogleAdsInsights(
  accessToken: string,
  customerId?: string,
  dateRange?: { since: string; until: string },
): Promise<AdInsight> {
  const empty: AdInsight = { platform: "google", spend: 0, impressions: 0, clicks: 0, conversions: 0 };
  if (!customerId) return empty;

  try {
    // WHY: Account-level aggregation uses segments.date with a WHERE clause for the date range.
    // Without a date filter, it returns lifetime metrics.
    const dateFilter = dateRange
      ? ` AND segments.date BETWEEN '${dateRange.since}' AND '${dateRange.until}'`
      : "";

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        },
        body: JSON.stringify({
          query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.conversions FROM customer${dateFilter}`,
        }),
      },
    );

    if (!res.ok) return empty;
    const data = await res.json();
    const m = data[0]?.results?.[0]?.metrics as Record<string, string> | undefined;
    if (!m) return empty;

    return {
      platform: "google",
      impressions: parseInt(m.impressions ?? "0"),
      clicks: parseInt(m.clicks ?? "0"),
      spend: parseInt(m.costMicros ?? "0") / 1_000_000,
      ctr: parseFloat(m.ctr ?? "0") * 100,
      conversions: parseFloat(m.conversions ?? "0"),
    };
  } catch (err) {
    console.error("[Ads] Google insights fetch failed:", err);
    return empty;
  }
}

// --- TikTok Ads ---
// WHY: TikTok Marketing API at business-api.tiktok.com uses a separate access token
// from the TikTok Login Kit token. The advertiser_id is the ads account identifier.

export async function getTikTokAdsCampaigns(
  accessToken: string,
  advertiserId?: string,
): Promise<AdCampaign[]> {
  if (!advertiserId) return [];

  try {
    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${advertiserId}&page_size=20`,
      {
        headers: { "Access-Token": accessToken },
      },
    );

    const data = await res.json();
    return (data.data?.list ?? []).map((c: Record<string, unknown>) => ({
      id: String(c.campaign_id ?? ""),
      name: String(c.campaign_name ?? ""),
      status: String(c.status ?? ""),
      platform: "tiktok" as const,
      objective: String(c.objective_type ?? ""),
      metrics: {
        spend: parseFloat(String(c.spend ?? "0")),
        impressions: parseInt(String(c.impressions ?? "0")),
        clicks: parseInt(String(c.clicks ?? "0")),
      },
    }));
  } catch (err) {
    console.error("[Ads] TikTok campaigns fetch failed:", err);
    return [];
  }
}

export async function getTikTokAdsInsights(
  accessToken: string,
  advertiserId?: string,
  dateRange?: { since: string; until: string },
): Promise<AdInsight> {
  const empty: AdInsight = { platform: "tiktok", spend: 0, impressions: 0, clicks: 0, conversions: 0 };
  if (!advertiserId) return empty;

  try {
    // WHY: TikTok's integrated report endpoint gives account-level metrics.
    // The date range format is YYYY-MM-DD.
    const dateParams = dateRange
      ? `&start_date=${dateRange.since}&end_date=${dateRange.until}`
      : "";

    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&dimensions=["stat_time_day"]&metrics=["spend","impressions","clicks","conversion","ctr","cpc"]&data_level=AUCTION_ADVERTISER${dateParams}`,
      {
        headers: { "Access-Token": accessToken },
      },
    );

    const data = await res.json();
    const rows = data.data?.list ?? [];

    // WHY: Aggregate across all returned date rows for the total period.
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    for (const row of rows) {
      const m = row.metrics ?? {};
      totalSpend += parseFloat(m.spend ?? "0");
      totalImpressions += parseInt(m.impressions ?? "0");
      totalClicks += parseInt(m.clicks ?? "0");
      totalConversions += parseInt(m.conversion ?? "0");
    }

    return {
      platform: "tiktok",
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalClicks > 0 && totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      conversions: totalConversions,
    };
  } catch (err) {
    console.error("[Ads] TikTok insights fetch failed:", err);
    return empty;
  }
}

// --- LinkedIn Ads ---
// WHY: LinkedIn Marketing Solutions API uses adAccountsV2 and adCampaignsV2 endpoints.
// Analytics require a separate call to the adAnalytics endpoint.

export async function getLinkedInAdsCampaigns(accessToken: string): Promise<AdCampaign[]> {
  try {
    // Step 1: Get ad accounts (only active ones)
    const accountsRes = await fetch(
      "https://api.linkedin.com/v2/adAccountsV2?q=search&search=(status:(values:List(ACTIVE)))",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const accountsData = await accountsRes.json();
    const accountId = accountsData.elements?.[0]?.id;

    if (!accountId) return [];

    // Step 2: Get campaigns for this account
    const campaignsRes = await fetch(
      `https://api.linkedin.com/v2/adCampaignsV2?q=search&search=(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const campaignsData = await campaignsRes.json();

    return (campaignsData.elements ?? []).map((c: Record<string, unknown>) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      status: String(c.status ?? ""),
      platform: "linkedin" as const,
      objective: String(c.objectiveType ?? ""),
      metrics: {}, // WHY: LinkedIn requires a separate analytics call for metrics — see getLinkedInAdsInsights
    }));
  } catch (err) {
    console.error("[Ads] LinkedIn campaigns fetch failed:", err);
    return [];
  }
}

export async function getLinkedInAdsInsights(
  accessToken: string,
  dateRange?: { since: string; until: string },
): Promise<AdInsight> {
  const empty: AdInsight = { platform: "linkedin", spend: 0, impressions: 0, clicks: 0, conversions: 0 };

  try {
    // Step 1: Get the first active ad account
    const accountsRes = await fetch(
      "https://api.linkedin.com/v2/adAccountsV2?q=search&search=(status:(values:List(ACTIVE)))",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const accountsData = await accountsRes.json();
    const accountId = accountsData.elements?.[0]?.id;
    if (!accountId) return empty;

    // Step 2: Query ad analytics at account level
    // WHY: LinkedIn's adAnalytics endpoint with pivot=ACCOUNT gives aggregate metrics.
    // Date range is required — default to last 30 days if not specified.
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const since = dateRange?.since ?? thirtyDaysAgo.toISOString().split("T")[0];
    const until = dateRange?.until ?? now.toISOString().split("T")[0];

    // LinkedIn date format for analytics: (year, month, day) as separate params
    const [sY, sM, sD] = since.split("-").map(Number);
    const [uY, uM, uD] = until.split("-").map(Number);

    const analyticsRes = await fetch(
      `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&pivot=ACCOUNT&dateRange=(start:(year:${sY},month:${sM},day:${sD}),end:(year:${uY},month:${uM},day:${uD}))&accounts=urn:li:sponsoredAccount:${accountId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const analyticsData = await analyticsRes.json();

    // WHY: Aggregate across all returned elements (one per day or per account)
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    for (const el of analyticsData.elements ?? []) {
      totalSpend += parseFloat(el.costInLocalCurrency ?? "0");
      totalImpressions += parseInt(el.impressions ?? "0");
      totalClicks += parseInt(el.clicks ?? "0");
      totalConversions += parseInt(el.externalWebsiteConversions ?? "0");
    }

    return {
      platform: "linkedin",
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      conversions: totalConversions,
    };
  } catch (err) {
    console.error("[Ads] LinkedIn insights fetch failed:", err);
    return empty;
  }
}

// --- Unified fetch across all platforms ---
// WHY: The dashboard and AI Strategist need a single call to get ads data from all
// connected platforms. This runs fetches in parallel for speed.

export type AllAdsData = Record<AdPlatform, AdsAnalyticsResult>;

export async function fetchAllAdsAnalytics(
  connections: {
    platform: AdPlatform;
    accessToken: string;
    advertiserId?: string;
    customerId?: string;
  }[],
  dateRange?: { since: string; until: string },
): Promise<AllAdsData> {
  const results: AllAdsData = {
    meta: { campaigns: [], insights: null },
    google: { campaigns: [], insights: null },
    tiktok: { campaigns: [], insights: null },
    linkedin: { campaigns: [], insights: null },
  };

  const fetchers = connections.map(async (conn) => {
    try {
      switch (conn.platform) {
        case "meta": {
          const [campaigns, insights] = await Promise.all([
            getMetaAdsCampaigns(conn.accessToken),
            getMetaAdsInsights(conn.accessToken, dateRange),
          ]);
          results.meta = { campaigns, insights };
          break;
        }
        case "google": {
          const [campaigns, insights] = await Promise.all([
            getGoogleAdsCampaigns(conn.accessToken, conn.customerId),
            getGoogleAdsInsights(conn.accessToken, conn.customerId, dateRange),
          ]);
          results.google = { campaigns, insights };
          break;
        }
        case "tiktok": {
          const [campaigns, insights] = await Promise.all([
            getTikTokAdsCampaigns(conn.accessToken, conn.advertiserId),
            getTikTokAdsInsights(conn.accessToken, conn.advertiserId, dateRange),
          ]);
          results.tiktok = { campaigns, insights };
          break;
        }
        case "linkedin": {
          const [campaigns, insights] = await Promise.all([
            getLinkedInAdsCampaigns(conn.accessToken),
            getLinkedInAdsInsights(conn.accessToken, dateRange),
          ]);
          results.linkedin = { campaigns, insights };
          break;
        }
      }
    } catch (err) {
      console.error(`[Ads] Failed to fetch ${conn.platform}:`, err);
      results[conn.platform] = {
        campaigns: [],
        insights: null,
        error: `Failed to fetch ${conn.platform} ads data`,
      };
    }
  });

  await Promise.allSettled(fetchers);
  return results;
}

// --- Summary helper for AI consumption ---
// WHY: The AI Strategist needs a text summary it can reason about, not raw JSON.
// This produces a concise natural-language summary of ad performance across platforms.

export function summarizeAdsData(data: AllAdsData): string {
  const lines: string[] = [];
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let activeCampaigns = 0;

  for (const [platform, result] of Object.entries(data) as [AdPlatform, AdsAnalyticsResult][]) {
    if (result.campaigns.length === 0 && !result.insights) continue;

    const active = result.campaigns.filter((c) => c.status === "ACTIVE" || c.status === "ENABLED").length;
    activeCampaigns += active;

    if (result.insights) {
      totalSpend += result.insights.spend;
      totalImpressions += result.insights.impressions;
      totalClicks += result.insights.clicks;
      totalConversions += result.insights.conversions;

      lines.push(
        `${platform.toUpperCase()}: ${result.campaigns.length} campaigns (${active} active), ` +
        `$${result.insights.spend.toFixed(2)} spent, ` +
        `${result.insights.impressions.toLocaleString()} impressions, ` +
        `${result.insights.clicks.toLocaleString()} clicks` +
        (result.insights.ctr ? `, ${result.insights.ctr.toFixed(2)}% CTR` : "") +
        (result.insights.conversions ? `, ${result.insights.conversions} conversions` : ""),
      );
    } else if (result.campaigns.length > 0) {
      lines.push(`${platform.toUpperCase()}: ${result.campaigns.length} campaigns (${active} active), no insights available yet`);
    }
  }

  if (lines.length === 0) {
    return "No ad campaigns found across connected platforms.";
  }

  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";
  const header = `AD PERFORMANCE SUMMARY: ${activeCampaigns} active campaigns, $${totalSpend.toFixed(2)} total spend, ${totalImpressions.toLocaleString()} impressions, ${totalClicks.toLocaleString()} clicks (${overallCtr}% CTR), ${totalConversions} conversions`;

  return [header, "", ...lines].join("\n");
}
