// Ad Manager Integration Scaffold
// WHY: Customers need to create paid ad campaigns on Meta, Google, TikTok, and LinkedIn
// directly from PrinceMarketing using AI-generated creative assets.
// These require additional API approvals beyond basic social publishing.
//
// STATUS: Scaffold only -- no live API calls. Each platform needs:
//   - Additional OAuth scopes (see docs/AD_MANAGER_INTEGRATION.md)
//   - App review / developer token approval
//   - Platform-specific ad account linking
//
// ARCHITECTURE: Mirrors the pattern in publish.ts -- one function per platform,
// a unified dispatch function, and shared types.

import type { PlatformKey } from "./platforms";

// --- Types ---

export type AdObjective = "awareness" | "traffic" | "conversions" | "engagement" | "video_views" | "lead_generation";

export type AdTargetAudience = {
  ageRange: [number, number];
  genders?: ("male" | "female" | "all")[];
  interests: string[];          // Platform-specific interest IDs/names
  locations: string[];          // Country codes (ISO 3166-1 alpha-2)
  languages?: string[];         // Language codes
  customAudiences?: string[];   // Platform-specific custom audience IDs
};

export type AdCreative = {
  mediaUrl: string;             // PrinceMarketing CDN URL (image or video)
  mediaType: "image" | "video";
  headline: string;
  description: string;
  callToAction: string;         // e.g. "SHOP_NOW", "LEARN_MORE", "SIGN_UP"
  destinationUrl: string;
  displayName?: string;         // Brand name shown on the ad
};

export type AdCampaignRequest = {
  platform: AdPlatform;
  name: string;
  objective: AdObjective;
  budget: number;               // Daily budget in cents (USD)
  currency?: string;            // ISO 4217, defaults to USD
  duration: number;             // Days
  startDate?: string;           // ISO date, defaults to now
  targetAudience: AdTargetAudience;
  creative: AdCreative;
};

export type AdCampaignResult = {
  success: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  platformUrl?: string;         // Link to manage the campaign in the platform's UI
  error?: string;
  requiresReview?: boolean;     // Some platforms review ads before serving
};

export type AdPlatform = "meta" | "google" | "tiktok" | "linkedin";

export type AdInsight = {
  platform: AdPlatform;
  campaignId: string;
  impressions: number;
  clicks: number;
  spend: number;                // In cents
  ctr: number;                  // Click-through rate (0.0 - 1.0)
  cpc: number;                  // Cost per click in cents
  conversions?: number;
  period: string;               // e.g. "2026-04-15 to 2026-04-22"
};

// --- Platform objective mapping ---
// WHY: Each platform uses different objective names. This maps our unified
// objectives to platform-specific values so the UI can stay consistent.

export const PLATFORM_OBJECTIVES: Record<AdPlatform, Record<AdObjective, string>> = {
  meta: {
    awareness: "OUTCOME_AWARENESS",
    traffic: "OUTCOME_TRAFFIC",
    conversions: "OUTCOME_SALES",
    engagement: "OUTCOME_ENGAGEMENT",
    video_views: "OUTCOME_AWARENESS",
    lead_generation: "OUTCOME_LEADS",
  },
  google: {
    awareness: "BRAND_AWARENESS_AND_REACH",
    traffic: "WEBSITE_TRAFFIC",
    conversions: "SALES",
    engagement: "PRODUCT_AND_BRAND_CONSIDERATION",
    video_views: "PRODUCT_AND_BRAND_CONSIDERATION",
    lead_generation: "LEADS",
  },
  tiktok: {
    awareness: "REACH",
    traffic: "TRAFFIC",
    conversions: "CONVERSIONS",
    engagement: "VIDEO_VIEWS",
    video_views: "VIDEO_VIEWS",
    lead_generation: "LEAD_GENERATION",
  },
  linkedin: {
    awareness: "BRAND_AWARENESS",
    traffic: "WEBSITE_VISIT",
    conversions: "WEBSITE_CONVERSIONS",
    engagement: "ENGAGEMENT",
    video_views: "VIDEO_VIEWS",
    lead_generation: "LEAD_GENERATION",
  },
};

// --- Additional OAuth scopes needed per platform ---
// WHY: Documents what scopes must be requested beyond the current organic scopes.
// These are used by the settings page to show what permissions are missing.

export const AD_MANAGER_SCOPES: Record<AdPlatform, string[]> = {
  meta: ["ads_management", "ads_read", "business_management"],
  google: ["https://www.googleapis.com/auth/adwords"],
  tiktok: ["advertiser_management", "campaign_creation", "ad_creation", "reporting"],
  linkedin: ["r_ads", "rw_ads", "r_ads_reporting"],
};

// --- Platform ad manager URLs ---
// WHY: Users may want to manage campaigns directly in the platform's native UI.

export const AD_MANAGER_URLS: Record<AdPlatform, string> = {
  meta: "https://adsmanager.facebook.com",
  google: "https://ads.google.com",
  tiktok: "https://ads.tiktok.com",
  linkedin: "https://www.linkedin.com/campaignmanager",
};

// --- Budget constraints ---
// WHY: Each platform has minimum daily budget requirements. Enforce these
// in the UI before attempting API calls to avoid cryptic error messages.

export const MIN_DAILY_BUDGET_CENTS: Record<AdPlatform, number> = {
  meta: 100,       // $1.00/day minimum
  google: 100,     // $1.00/day minimum (varies by campaign type)
  tiktok: 2000,    // $20.00/day minimum for ad groups
  linkedin: 1000,  // $10.00/day minimum
};

// --- Placeholder implementations ---
// WHY: These stubs define the contract for each platform integration.
// They return structured errors so the UI can show "not yet available" states
// instead of crashing. Implement when API approvals are obtained.

export async function createMetaAd(req: AdCampaignRequest): Promise<AdCampaignResult> {
  // TODO: Implement with Meta Marketing API
  // Steps:
  //   1. Get user's ad account ID via GET /me/adaccounts
  //   2. Create campaign via POST /act_{AD_ACCOUNT_ID}/campaigns
  //   3. Create ad set with targeting via POST /act_{AD_ACCOUNT_ID}/adsets
  //   4. Upload creative media via POST /act_{AD_ACCOUNT_ID}/adimages or /advideos
  //   5. Create ad creative via POST /act_{AD_ACCOUNT_ID}/adcreatives
  //   6. Create ad via POST /act_{AD_ACCOUNT_ID}/ads
  // Required scopes: ads_management, ads_read, business_management
  return {
    success: false,
    error: "Meta Ads integration is not yet available. Requires ads_management scope approval.",
    requiresReview: true,
  };
}

export async function createGoogleAd(req: AdCampaignRequest): Promise<AdCampaignResult> {
  // TODO: Implement with Google Ads API
  // Steps:
  //   1. List accessible customers via GET /customers:listAccessibleCustomers
  //   2. Create campaign budget via POST /customers/{ID}/campaignBudgets:mutate
  //   3. Create campaign via POST /customers/{ID}/campaigns:mutate
  //   4. Create ad group via POST /customers/{ID}/adGroups:mutate
  //   5. Upload image/video asset via POST /customers/{ID}/assets:mutate
  //   6. Create responsive display ad via POST /customers/{ID}/adGroupAds:mutate
  // Required: Developer Token + adwords OAuth scope
  return {
    success: false,
    error: "Google Ads integration is not yet available. Requires Developer Token approval.",
    requiresReview: true,
  };
}

export async function createTikTokAd(req: AdCampaignRequest): Promise<AdCampaignResult> {
  // TODO: Implement with TikTok Marketing API
  // Steps:
  //   1. Get advertiser ID from linked Marketing API account
  //   2. Create campaign via POST /campaign/create/
  //   3. Create ad group with targeting via POST /adgroup/create/
  //   4. Upload video via POST /file/video/ad/upload/ (UPLOAD_BY_URL)
  //   5. Upload thumbnail via POST /file/image/ad/upload/
  //   6. Create ad via POST /ad/create/
  // Required: Separate Marketing API app + scopes
  return {
    success: false,
    error: "TikTok Ads integration is not yet available. Requires Marketing API app approval.",
    requiresReview: true,
  };
}

export async function createLinkedInAd(req: AdCampaignRequest): Promise<AdCampaignResult> {
  // TODO: Implement with LinkedIn Marketing Solutions API
  // Steps:
  //   1. List ad accounts via GET /adAccounts
  //   2. Create campaign group (optional) via POST /adCampaignGroups
  //   3. Create campaign with targeting via POST /adCampaigns
  //   4. Upload image via POST /images?action=uploadImage
  //   5. Create sponsored content (post) referencing the image
  //   6. Create ad creative linking to the sponsored content
  // Required: Marketing Developer Platform access + rw_ads scope
  // NOTE: LinkedIn ads are "sponsored posts" — must create content first, then sponsor it
  return {
    success: false,
    error: "LinkedIn Ads integration is not yet available. Requires Marketing Developer Platform access.",
    requiresReview: true,
  };
}

// --- Unified dispatch ---

const adCreators: Record<AdPlatform, (req: AdCampaignRequest) => Promise<AdCampaignResult>> = {
  meta: createMetaAd,
  google: createGoogleAd,
  tiktok: createTikTokAd,
  linkedin: createLinkedInAd,
};

/**
 * Create an ad campaign on the specified platform.
 *
 * Validates budget minimums and delegates to the platform-specific creator.
 * All creators are currently stubs returning structured errors — implement
 * each one as API approvals are obtained.
 */
export async function createAdCampaign(req: AdCampaignRequest): Promise<AdCampaignResult> {
  const creator = adCreators[req.platform];
  if (!creator) {
    return { success: false, error: `Unsupported ad platform: ${req.platform}` };
  }

  // Validate minimum budget
  const minBudget = MIN_DAILY_BUDGET_CENTS[req.platform];
  if (req.budget < minBudget) {
    return {
      success: false,
      error: `Minimum daily budget for ${req.platform} is $${(minBudget / 100).toFixed(2)}. You specified $${(req.budget / 100).toFixed(2)}.`,
    };
  }

  // Validate creative has required fields
  if (!req.creative.mediaUrl) {
    return { success: false, error: "Ad creative must include a media URL (image or video)." };
  }
  if (!req.creative.destinationUrl) {
    return { success: false, error: "Ad creative must include a destination URL." };
  }

  return creator(req);
}

// --- Insight fetchers (stubs) ---

export async function fetchMetaAdInsights(_campaignId: string, _accessToken: string): Promise<AdInsight | null> {
  // TODO: GET /{CAMPAIGN_ID}/insights?fields=impressions,clicks,spend,ctr,cpc
  return null;
}

export async function fetchGoogleAdInsights(_campaignId: string, _accessToken: string): Promise<AdInsight | null> {
  // TODO: POST /customers/{ID}/googleAds:searchStream with GAQL query
  return null;
}

export async function fetchTikTokAdInsights(_campaignId: string, _accessToken: string): Promise<AdInsight | null> {
  // TODO: GET /report/integrated/get/ with campaign dimensions
  return null;
}

export async function fetchLinkedInAdInsights(_campaignId: string, _accessToken: string): Promise<AdInsight | null> {
  // TODO: POST /adAnalytics?q=analytics&pivot=CAMPAIGN
  return null;
}

/**
 * Fetch ad performance insights for a campaign on any supported platform.
 */
export async function fetchAdInsights(
  platform: AdPlatform,
  campaignId: string,
  accessToken: string,
): Promise<AdInsight | null> {
  const fetchers: Record<AdPlatform, typeof fetchMetaAdInsights> = {
    meta: fetchMetaAdInsights,
    google: fetchGoogleAdInsights,
    tiktok: fetchTikTokAdInsights,
    linkedin: fetchLinkedInAdInsights,
  };

  const fetcher = fetchers[platform];
  if (!fetcher) return null;
  return fetcher(campaignId, accessToken);
}
