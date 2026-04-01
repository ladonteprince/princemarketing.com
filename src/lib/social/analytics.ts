// Platform analytics fetcher library
// WHY: Centralized analytics ingestion from each connected social platform's API.
// Each platform has different endpoints and data shapes — this normalizes them
// into a single PlatformAnalytics type the dashboard can consume.

export type PlatformAnalytics = {
  platform: string;
  followers: number;
  posts: number;
  impressions: number;
  engagement: number;
  clicks: number;
  period: string;
};

/**
 * Fetch analytics from a connected social platform's API.
 * Returns normalized metrics regardless of which platform is queried.
 * On any failure, returns zeroed-out defaults so the dashboard never breaks.
 */
export async function fetchPlatformAnalytics(
  platform: string,
  accessToken: string,
): Promise<PlatformAnalytics> {
  const defaults: PlatformAnalytics = {
    platform,
    followers: 0,
    posts: 0,
    impressions: 0,
    engagement: 0,
    clicks: 0,
    period: "last_30_days",
  };

  try {
    switch (platform.toLowerCase()) {
      case "facebook": {
        // Facebook Page Insights API — requires pages_read_engagement permission
        // WHY: User token → page list → page token → insights. Facebook requires
        // a page-specific token to read page-level metrics.
        const pageRes = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`,
        );
        const pageData = await pageRes.json();
        const page = pageData.data?.[0];
        if (!page) return defaults;

        const insightsRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.id}/insights?metric=page_impressions,page_engaged_users,page_post_engagements&period=days_28&access_token=${page.access_token}`,
        );
        const insights = await insightsRes.json();

        const getMetric = (name: string) =>
          insights.data?.find((d: { name: string; values?: { value: number }[] }) => d.name === name)
            ?.values?.[0]?.value ?? 0;

        // WHY: Also fetch follower count from the page itself
        const pageInfoRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.id}?fields=followers_count,fan_count&access_token=${page.access_token}`,
        );
        const pageInfo = await pageInfoRes.json();

        return {
          ...defaults,
          followers: pageInfo.followers_count ?? pageInfo.fan_count ?? 0,
          impressions: getMetric("page_impressions"),
          engagement: getMetric("page_post_engagements"),
        };
      }

      case "twitter": {
        // Twitter/X API v2 — user public_metrics
        // WHY: The v2 /users/me endpoint includes follower count and tweet count
        // directly in public_metrics when requested via user.fields.
        const meRes = await fetch(
          "https://api.twitter.com/2/users/me?user.fields=public_metrics",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const meData = await meRes.json();
        const metrics = meData.data?.public_metrics;

        return {
          ...defaults,
          followers: metrics?.followers_count ?? 0,
          posts: metrics?.tweet_count ?? 0,
        };
      }

      case "instagram": {
        // Instagram Insights via Facebook Graph API
        // WHY: Instagram Business accounts expose insights through the Graph API.
        // We first get the IG Business Account ID linked to the user's FB page,
        // then query its insights.
        const pageRes = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`,
        );
        const pageData = await pageRes.json();
        const igAccountId = pageData.data?.[0]?.instagram_business_account?.id;
        if (!igAccountId) return defaults;

        // Fetch follower count and media count
        const profileRes = await fetch(
          `https://graph.facebook.com/v19.0/${igAccountId}?fields=followers_count,media_count&access_token=${accessToken}`,
        );
        const profile = await profileRes.json();

        // Fetch impressions and reach for the last 30 days
        const insightsRes = await fetch(
          `https://graph.facebook.com/v19.0/${igAccountId}/insights?metric=impressions,reach&period=days_28&access_token=${accessToken}`,
        );
        const insights = await insightsRes.json();

        const getMetric = (name: string) =>
          insights.data?.find((d: { name: string; values?: { value: number }[] }) => d.name === name)
            ?.values?.[0]?.value ?? 0;

        return {
          ...defaults,
          followers: profile.followers_count ?? 0,
          posts: profile.media_count ?? 0,
          impressions: getMetric("impressions"),
        };
      }

      case "linkedin": {
        // LinkedIn basic profile stats
        // WHY: LinkedIn's Organization Analytics require Marketing Developer Platform
        // approval which most users won't have. Return defaults with a note.
        // Future: Integrate when Marketing API is approved.
        return defaults;
      }

      case "youtube": {
        // YouTube Data API v3 — channel statistics
        // WHY: The channels endpoint with part=statistics gives subscriber count,
        // video count, and total view count in a single call.
        const channelRes = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const channelData = await channelRes.json();
        const stats = channelData.items?.[0]?.statistics;

        return {
          ...defaults,
          followers: parseInt(stats?.subscriberCount ?? "0", 10),
          posts: parseInt(stats?.videoCount ?? "0", 10),
          impressions: parseInt(stats?.viewCount ?? "0", 10),
        };
      }

      case "tiktok": {
        // TikTok User Info API
        // WHY: TikTok's v2 user info endpoint returns follower count and
        // video count when the user.info.basic scope is granted.
        const userRes = await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,video_count",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const userData = await userRes.json();
        const user = userData.data?.user;

        return {
          ...defaults,
          followers: user?.follower_count ?? 0,
          posts: user?.video_count ?? 0,
        };
      }

      case "google_analytics": {
        // Google Analytics Data API v1beta — last 30 days metrics
        // First get the user's GA4 property ID
        const summaryRes = await fetch(
          "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const summaryData = await summaryRes.json();
        const property = summaryData.accountSummaries?.[0]?.propertySummaries?.[0];
        if (!property?.property) return { ...defaults, platform: "google_analytics" };

        const propertyId = property.property.replace("properties/", "");

        // Run a report for the last 30 days
        const reportRes = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
              metrics: [
                { name: "activeUsers" },
                { name: "sessions" },
                { name: "screenPageViews" },
                { name: "engagedSessions" },
              ],
            }),
          },
        );
        const reportData = await reportRes.json();
        const row = reportData.rows?.[0]?.metricValues;

        return {
          ...defaults,
          platform: "google_analytics",
          followers: parseInt(row?.[0]?.value ?? "0", 10),    // activeUsers
          impressions: parseInt(row?.[2]?.value ?? "0", 10),   // pageViews
          engagement: parseInt(row?.[3]?.value ?? "0", 10),    // engagedSessions
          posts: parseInt(row?.[1]?.value ?? "0", 10),         // sessions
        };
      }

      default:
        return defaults;
    }
  } catch (err) {
    console.error(`[Analytics] Failed to fetch ${platform}:`, err);
    return defaults;
  }
}

/**
 * Fetch analytics for multiple platforms in parallel.
 * WHY: Dashboard needs all platform data at once — parallel fetching
 * keeps the response time bounded by the slowest platform, not the sum.
 */
export async function fetchAllPlatformAnalytics(
  platforms: { type: string; accessToken: string }[],
): Promise<PlatformAnalytics[]> {
  const results = await Promise.allSettled(
    platforms.map(({ type, accessToken }) =>
      fetchPlatformAnalytics(type, accessToken),
    ),
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    console.error(`[Analytics] Platform ${platforms[i].type} failed:`, result.reason);
    return {
      platform: platforms[i].type,
      followers: 0,
      posts: 0,
      impressions: 0,
      engagement: 0,
      clicks: 0,
      period: "last_30_days",
    };
  });
}
