# Ad Manager Integration Research

> Status: **Research & Scaffold Only** -- No live API calls implemented  
> Last updated: 2026-04-01  
> Author: PrinceMarketing Engineering

## Overview

PrinceMarketing already supports organic publishing to Meta (Facebook/Instagram), Twitter, LinkedIn, TikTok, and YouTube via OAuth. This document covers the **paid advertising** APIs that let customers create and manage ad campaigns directly from the PrinceMarketing dashboard, using AI-generated creative assets.

### How It Works for the Customer

1. Customer generates marketing content (image, video, copy) with PrinceMarketing AI tools
2. Customer selects "Boost" or "Create Ad Campaign" from the content detail page
3. Customer configures objective, budget, audience, duration
4. PrinceMarketing calls the platform's ad API to create the campaign
5. Dashboard shows campaign performance metrics alongside organic analytics

---

## 1. Meta Ads Manager (Facebook & Instagram)

### API

- **Name:** Meta Marketing API (Graph API v19.0+)
- **Base URL:** `https://graph.facebook.com/v19.0/`
- **Docs:** https://developers.facebook.com/docs/marketing-apis

### OAuth Scopes (beyond current)

Current scopes handle organic publishing only. Ads require:

| Scope | Purpose | Current? |
|-------|---------|----------|
| `pages_manage_posts` | Organic posts | Yes |
| `pages_read_engagement` | Read metrics | Yes |
| `ads_management` | Create/edit/delete ad campaigns, ad sets, ads | **No -- NEW** |
| `ads_read` | Read ad performance data | **No -- NEW** |
| `business_management` | Access Business Manager assets (ad accounts) | **No -- NEW** |

### Key Endpoints

```
# 1. List ad accounts accessible to the user
GET /me/adaccounts?fields=name,account_status,currency,business

# 2. Create a campaign
POST /act_{AD_ACCOUNT_ID}/campaigns
Body: {
  name: "Summer Sale 2026",
  objective: "OUTCOME_TRAFFIC",       // or OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES
  status: "PAUSED",                   // Create paused, let user activate
  special_ad_categories: []
}

# 3. Create an ad set (targeting + budget)
POST /act_{AD_ACCOUNT_ID}/adsets
Body: {
  name: "US Women 25-45",
  campaign_id: "{campaign_id}",
  daily_budget: 2000,                 // In cents (USD $20.00)
  billing_event: "IMPRESSIONS",
  optimization_goal: "LINK_CLICKS",
  targeting: {
    age_min: 25,
    age_max: 45,
    genders: [2],
    geo_locations: { countries: ["US"] },
    flexible_spec: [{ interests: [{ id: "6003139266461", name: "Fitness" }] }]
  },
  start_time: "2026-04-15T00:00:00-0700",
  end_time: "2026-04-30T23:59:59-0700",
  status: "PAUSED"
}

# 4. Upload creative (image or video)
POST /act_{AD_ACCOUNT_ID}/adimages
Body (multipart): { filename: <image_bytes> }
-- or for video --
POST /act_{AD_ACCOUNT_ID}/advideos
Body (multipart): { source: <video_bytes> }

# 5. Create ad creative
POST /act_{AD_ACCOUNT_ID}/adcreatives
Body: {
  name: "Summer Sale Creative",
  object_story_spec: {
    page_id: "{PAGE_ID}",
    link_data: {
      link: "https://example.com/sale",
      message: "Shop our summer collection",
      image_hash: "{UPLOADED_IMAGE_HASH}",
      call_to_action: { type: "SHOP_NOW", value: { link: "https://example.com/sale" } }
    }
  }
}

# 6. Create the ad (ties creative to ad set)
POST /act_{AD_ACCOUNT_ID}/ads
Body: {
  name: "Summer Sale Ad 1",
  adset_id: "{adset_id}",
  creative: { creative_id: "{creative_id}" },
  status: "PAUSED"
}

# 7. Read campaign insights
GET /{CAMPAIGN_ID}/insights?fields=impressions,clicks,spend,ctr,cpc&date_preset=last_7d
```

### Generated Content Flow

1. AI generates image/video -> stored in PrinceMarketing CDN
2. Upload to Meta via `adimages` or `advideos` endpoint -> receive `image_hash` or `video_id`
3. Create `adcreative` referencing the hash + customer-written headline/CTA
4. Create `ad` linking creative to ad set

### App Review Requirements

- **Meta App Review required** for `ads_management` and `ads_read` scopes
- Must demonstrate a legitimate use case with screen recordings
- Review takes 5-15 business days
- App must comply with Meta's Advertising Policies
- Business Verification may be required for `business_management` scope

### Estimated Implementation Effort

| Task | Estimate |
|------|----------|
| OAuth scope expansion + re-review | 2-3 weeks (mostly waiting) |
| Ad account selector UI | 2-3 days |
| Campaign creation flow (API + UI) | 5-7 days |
| Creative upload pipeline | 2-3 days |
| Insights dashboard | 3-5 days |
| **Total** | **~3-4 weeks** |

---

## 2. Google Ads

### API

- **Name:** Google Ads API (v17+)
- **Base URL:** `https://googleads.googleapis.com/v17/`
- **Docs:** https://developers.google.com/google-ads/api/docs/start
- **Client Library:** `google-ads-api` npm package (recommended over raw REST)

### Authentication

Google Ads uses a **layered auth model**:

1. **OAuth 2.0** (same flow we use for YouTube/GA) with additional scopes
2. **Developer Token** -- issued per MCC (Manager) account, requires approval
3. **Login Customer ID** -- the MCC account ID managing the ad accounts

| Requirement | Purpose | Current? |
|-------------|---------|----------|
| OAuth scope `https://www.googleapis.com/auth/adwords` | Full Google Ads access | **No -- NEW** |
| Developer Token | API access gate | **No -- must apply** |
| MCC Account (optional) | Manage multiple client ad accounts | **No** |

### Key Endpoints (gRPC/REST)

```
# Google Ads API uses gRPC primarily, but has REST endpoints.
# All queries use GAQL (Google Ads Query Language).

# 1. List accessible customer (ad account) IDs
GET /v17/customers:listAccessibleCustomers

# 2. Create a campaign
POST /v17/customers/{CUSTOMER_ID}/campaigns:mutate
Body: {
  operations: [{
    create: {
      name: "Summer Sale 2026",
      advertisingChannelType: "DISPLAY",    // or SEARCH, VIDEO, SHOPPING
      status: "PAUSED",
      campaignBudget: "customers/{CUSTOMER_ID}/campaignBudgets/{BUDGET_ID}",
      startDate: "2026-04-15",
      endDate: "2026-04-30"
    }
  }]
}

# 2b. Create campaign budget first
POST /v17/customers/{CUSTOMER_ID}/campaignBudgets:mutate
Body: {
  operations: [{
    create: {
      name: "Daily $20",
      amountMicros: 20000000,    // $20.00 in micros
      deliveryMethod: "STANDARD"
    }
  }]
}

# 3. Create an ad group
POST /v17/customers/{CUSTOMER_ID}/adGroups:mutate
Body: {
  operations: [{
    create: {
      name: "Fitness Interest Group",
      campaign: "customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}",
      status: "ENABLED",
      type: "DISPLAY_STANDARD"
    }
  }]
}

# 4. Upload image asset
POST /v17/customers/{CUSTOMER_ID}/assets:mutate
Body: {
  operations: [{
    create: {
      name: "summer-sale-hero",
      type: "IMAGE",
      imageAsset: {
        data: "<base64_encoded_image>"
      }
    }
  }]
}

# 5. Create responsive display ad
POST /v17/customers/{CUSTOMER_ID}/adGroupAds:mutate
Body: {
  operations: [{
    create: {
      adGroup: "customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}",
      ad: {
        responsiveDisplayAd: {
          headlines: [{ text: "Summer Collection" }],
          longHeadline: { text: "Shop Our Biggest Summer Sale Ever" },
          descriptions: [{ text: "Up to 50% off all items" }],
          marketingImages: [{ asset: "customers/{CUSTOMER_ID}/assets/{ASSET_ID}" }],
          callToActionText: "Shop Now",
          businessName: "Your Brand"
        },
        finalUrls: ["https://example.com/sale"]
      },
      status: "PAUSED"
    }
  }]
}

# 6. Query performance metrics (GAQL)
POST /v17/customers/{CUSTOMER_ID}/googleAds:searchStream
Body: {
  query: "SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr FROM campaign WHERE segments.date DURING LAST_7_DAYS"
}
```

### Generated Content Flow

1. AI generates image -> base64 encode -> upload as `imageAsset`
2. AI generates copy -> populate `headlines`, `descriptions` in responsive display ad
3. For video ads: upload as `youtubeVideoAsset` (video must be on YouTube)
4. Create responsive display ad or responsive search ad with asset references

### App Review Requirements

- **Developer Token application** required (Basic or Standard access)
  - Basic: up to 15,000 operations/day, self-approval for own accounts
  - Standard: unlimited, requires Google review (2-4 weeks)
- Must pass a **Technical Implementation Review** for Standard access
- OAuth consent screen must be verified for production use

### Estimated Implementation Effort

| Task | Estimate |
|------|----------|
| Developer Token application + approval | 2-4 weeks (waiting) |
| OAuth scope expansion | 1 day |
| Google Ads client library integration | 2-3 days |
| Campaign creation flow (API + UI) | 5-7 days |
| Asset upload pipeline | 2-3 days |
| GAQL reporting dashboard | 3-5 days |
| **Total** | **~4-5 weeks** |

---

## 3. TikTok Ads

### API

- **Name:** TikTok Marketing API (v1.3)
- **Base URL:** `https://business-api.tiktok.com/open_api/v1.3/`
- **Docs:** https://business-api.tiktok.com/portal/docs

### Authentication

TikTok Ads uses a separate auth system from TikTok Login Kit (which we use for organic posting).

| Requirement | Purpose | Current? |
|-------------|---------|----------|
| TikTok for Business account | Access to ad platform | **No -- separate from Login Kit** |
| Marketing API App | Different app type than Login Kit | **No -- NEW app needed** |
| `advertiser_management` scope | List ad accounts | **No -- NEW** |
| `campaign_creation` scope | Create campaigns | **No -- NEW** |
| `ad_creation` scope | Create ads | **No -- NEW** |
| `reporting` scope | Read performance data | **No -- NEW** |

### Key Endpoints

```
# 1. List advertiser accounts
GET /advertiser/info/
Headers: { Access-Token: "{MARKETING_ACCESS_TOKEN}" }
Params: advertiser_ids=["{ADV_ID}"]

# 2. Create campaign
POST /campaign/create/
Body: {
  advertiser_id: "{ADV_ID}",
  campaign_name: "Summer Sale 2026",
  objective_type: "TRAFFIC",            // or REACH, VIDEO_VIEWS, CONVERSIONS, APP_INSTALL
  budget_mode: "BUDGET_MODE_DAY",
  budget: 20.00,                        // Daily budget in account currency
  operation_status: "DISABLE"           // Create paused
}

# 3. Create ad group
POST /adgroup/create/
Body: {
  advertiser_id: "{ADV_ID}",
  campaign_id: "{CAMPAIGN_ID}",
  adgroup_name: "US Women 25-45",
  placement_type: "PLACEMENT_TYPE_AUTOMATIC",
  budget_mode: "BUDGET_MODE_DAY",
  budget: 20.00,
  schedule_type: "SCHEDULE_START_END",
  schedule_start_time: "2026-04-15 00:00:00",
  schedule_end_time: "2026-04-30 23:59:59",
  optimization_goal: "CLICK",
  bid_type: "BID_TYPE_NO_BID",
  billing_event: "CPC",
  location_ids: [6252001],              // US country code
  age_groups: ["AGE_25_34", "AGE_35_44"],
  gender: "GENDER_FEMALE",
  interest_category_ids: [26001]        // Fitness & wellness
}

# 4. Upload video creative
POST /file/video/ad/upload/
Body (multipart): {
  advertiser_id: "{ADV_ID}",
  upload_type: "UPLOAD_BY_URL",
  video_url: "https://cdn.princemarketing.com/video.mp4"
}
-- or for images --
POST /file/image/ad/upload/
Body (multipart): {
  advertiser_id: "{ADV_ID}",
  upload_type: "UPLOAD_BY_URL",
  image_url: "https://cdn.princemarketing.com/image.jpg"
}

# 5. Create ad
POST /ad/create/
Body: {
  advertiser_id: "{ADV_ID}",
  adgroup_id: "{ADGROUP_ID}",
  creatives: [{
    ad_name: "Summer Sale Ad 1",
    ad_text: "Shop our summer collection",
    video_id: "{UPLOADED_VIDEO_ID}",
    image_ids: ["{THUMBNAIL_IMAGE_ID}"],
    call_to_action: "SHOP_NOW",
    landing_page_url: "https://example.com/sale",
    display_name: "Your Brand"
  }]
}

# 6. Get campaign reporting
GET /report/integrated/get/
Params: {
  advertiser_id: "{ADV_ID}",
  report_type: "BASIC",
  dimensions: ["campaign_id"],
  metrics: ["impressions", "clicks", "spend", "ctr", "cpc"],
  data_level: "AUCTION_CAMPAIGN",
  start_date: "2026-04-15",
  end_date: "2026-04-22"
}
```

### Generated Content Flow

1. AI generates video -> upload via `file/video/ad/upload` with `UPLOAD_BY_URL` -> receive `video_id`
2. AI generates thumbnail image -> upload via `file/image/ad/upload` -> receive `image_id`
3. AI generates ad copy -> populate `ad_text`, `display_name` in ad creation
4. Link creative to ad group via `ad/create`

### App Review Requirements

- **Separate Marketing API app** required (different from Login Kit app)
- Must apply through TikTok for Business Developer Portal
- Review process: 3-10 business days
- Must demonstrate legitimate advertising use case
- Sandbox environment available for testing before review

### Estimated Implementation Effort

| Task | Estimate |
|------|----------|
| Marketing API app creation + approval | 1-2 weeks |
| Separate OAuth flow for Marketing API | 2-3 days |
| Campaign creation flow (API + UI) | 5-7 days |
| Video/image upload pipeline | 2-3 days |
| Reporting dashboard | 3-4 days |
| **Total** | **~3-4 weeks** |

---

## 4. LinkedIn Campaign Manager

### API

- **Name:** LinkedIn Marketing Solutions API (Versioned: v202404+)
- **Base URL:** `https://api.linkedin.com/rest/`
- **Docs:** https://learn.microsoft.com/en-us/linkedin/marketing/

### Authentication

| Requirement | Purpose | Current? |
|-------------|---------|----------|
| `w_member_social` scope | Organic posting | Yes |
| `r_ads` scope | Read ad campaigns | **No -- NEW** |
| `rw_ads` scope | Create/edit ad campaigns | **No -- NEW** |
| `r_ads_reporting` scope | Read ad performance | **No -- NEW** |
| Marketing Developer Platform access | Gate for ads API | **No -- must apply** |

### Key Endpoints

```
# LinkedIn uses versioned API headers:
# Headers: { LinkedIn-Version: "202404", Authorization: "Bearer {TOKEN}" }

# 1. List ad accounts
GET /adAccounts?q=search&search.type.values[0]=BUSINESS&search.status.values[0]=ACTIVE

# 2. Create campaign group (optional container)
POST /adCampaignGroups
Body: {
  account: "urn:li:sponsoredAccount:{AD_ACCOUNT_ID}",
  name: "Summer 2026 Campaigns",
  status: "DRAFT"
}

# 3. Create campaign (equivalent to ad set)
POST /adCampaigns
Body: {
  account: "urn:li:sponsoredAccount:{AD_ACCOUNT_ID}",
  name: "Summer Sale Traffic",
  objectiveType: "WEBSITE_VISIT",         // or BRAND_AWARENESS, ENGAGEMENT, VIDEO_VIEWS, LEAD_GENERATION
  type: "SPONSORED_UPDATES",
  costType: "CPM",
  dailyBudget: { amount: "20", currencyCode: "USD" },
  runSchedule: {
    start: 1744675200000,                 // epoch ms
    end: 1746057600000
  },
  targetingCriteria: {
    include: {
      and: [
        { or: { "urn:li:adTargetingFacet:locations": ["urn:li:geo:103644278"] } },   // US
        { or: { "urn:li:adTargetingFacet:ageRanges": ["urn:li:ageRange:(25,34)"] } },
        { or: { "urn:li:adTargetingFacet:industries": ["urn:li:industry:4"] } }       // Marketing & Advertising
      ]
    }
  },
  status: "PAUSED"
}

# 4. Upload image for ad creative
POST /images?action=uploadImage
Body: {
  initUploadRequest: {
    owner: "urn:li:sponsoredAccount:{AD_ACCOUNT_ID}"
  }
}
# Returns an upload URL -- PUT image bytes there, get back image URN

# 5. Create ad creative (sponsored content)
POST /adCreatives
Body: {
  campaign: "urn:li:sponsoredCampaign:{CAMPAIGN_ID}",
  reference: "urn:li:share:{SHARE_ID}",    // Must first create a share/post
  status: "ACTIVE",
  type: "SPONSORED_STATUS_UPDATE"
}
# NOTE: LinkedIn requires creating an organic share first, then sponsoring it.
# Alternatively, use Direct Sponsored Content which doesn't appear on the company page.

# 6. Create Direct Sponsored Content
POST /adDirectSponsoredContents
Body: {
  account: "urn:li:sponsoredAccount:{AD_ACCOUNT_ID}",
  contentReference: "urn:li:ugcPost:{POST_ID}",
  name: "Summer Sale Direct Sponsored"
}

# 7. Get campaign analytics
POST /adAnalytics?q=analytics&pivot=CAMPAIGN
Params: {
  dateRange.start.year: 2026,
  dateRange.start.month: 4,
  dateRange.start.day: 15,
  dateRange.end.year: 2026,
  dateRange.end.month: 4,
  dateRange.end.day: 22,
  timeGranularity: "DAILY",
  campaigns[0]: "urn:li:sponsoredCampaign:{CAMPAIGN_ID}",
  fields: "impressions,clicks,costInLocalCurrency,clickThroughRate"
}
```

### Generated Content Flow

1. AI generates image -> upload via LinkedIn image upload -> receive image URN
2. AI generates copy -> create a UGC post (or direct sponsored content) with image URN
3. Create `adCreative` referencing the post
4. Link creative to campaign

**Important quirk:** LinkedIn ads are based on "sponsoring" existing content. You create a post first, then turn it into an ad. Direct Sponsored Content skips the company page but still requires creating a content object.

### App Review Requirements

- **Marketing Developer Platform** access required
  - Apply at https://www.linkedin.com/developers/
  - Must be a LinkedIn Marketing Partner or demonstrate legitimate use
  - Review: 2-4 weeks
- App must be associated with a LinkedIn Company Page
- Rate limits are stricter than the standard API (100 calls/day for some endpoints on basic tier)

### Estimated Implementation Effort

| Task | Estimate |
|------|----------|
| Marketing Developer Platform application + approval | 2-4 weeks |
| OAuth scope expansion | 1 day |
| Ad account selector UI | 2-3 days |
| Campaign creation flow (API + UI) | 5-7 days |
| Image upload + sponsored content pipeline | 3-4 days |
| Analytics dashboard | 3-4 days |
| **Total** | **~4-5 weeks** |

---

## 5. Implementation Priority

Ranked by customer value, market share, and implementation complexity:

| Priority | Platform | Reason |
|----------|----------|--------|
| 1 | **Meta Ads** | Largest ad platform (Facebook + Instagram combined), most customers will want this first |
| 2 | **Google Ads** | Second largest, covers Search + Display + YouTube |
| 3 | **TikTok Ads** | Fastest growing ad platform, strong for e-commerce and younger demographics |
| 4 | **LinkedIn Ads** | Niche (B2B), highest CPMs, but valuable for professional services customers |

### Shared Infrastructure Needed

Before implementing any individual platform:

1. **Ad Account Selector** -- UI component for users to pick which ad account to use
2. **Campaign Builder** -- Shared form for objective, budget, schedule, audience targeting
3. **Creative Preview** -- Show how the AI-generated asset will look as an ad on each platform
4. **Budget Guardrails** -- Minimum/maximum budget enforcement, spending alerts
5. **Performance Dashboard** -- Unified view of ad metrics across all platforms
6. **Database Models** -- `AdCampaign`, `AdSet`, `Ad`, `AdCreative`, `AdInsight` tables in Prisma

### Database Schema Addition (Prisma)

```prisma
model AdCampaign {
  id              String   @id @default(cuid())
  userId          String
  platform        String   // META, GOOGLE, TIKTOK, LINKEDIN
  platformCampaignId String?
  name            String
  objective       String
  status          String   @default("DRAFT")  // DRAFT, PAUSED, ACTIVE, COMPLETED
  dailyBudgetCents Int
  startDate       DateTime
  endDate         DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  adSets          AdSet[]
  user            User     @relation(fields: [userId], references: [id])

  @@index([userId, platform])
}

model AdSet {
  id              String   @id @default(cuid())
  campaignId      String
  platformAdSetId String?
  name            String
  targetAgeMin    Int?
  targetAgeMax    Int?
  targetLocations String[] // Country/region codes
  targetInterests String[] // Platform-specific interest IDs
  status          String   @default("PAUSED")
  createdAt       DateTime @default(now())
  campaign        AdCampaign @relation(fields: [campaignId], references: [id])
  ads             Ad[]
}

model Ad {
  id              String   @id @default(cuid())
  adSetId         String
  platformAdId    String?
  name            String
  headline        String
  description     String?
  callToAction    String?
  destinationUrl  String
  mediaUrl        String   // PrinceMarketing CDN URL
  platformMediaId String?  // Image hash, video ID, etc.
  status          String   @default("PAUSED")
  createdAt       DateTime @default(now())
  adSet           AdSet    @relation(fields: [adSetId], references: [id])
}
```

---

## 6. Security and Compliance Notes

- **Never store ad account billing info** -- all billing is handled by the platform
- **Budget confirmation** -- always require explicit user confirmation before activating a campaign that spends money
- **Audit trail** -- log every ad creation/modification with user ID and timestamp
- **Terms of Service** -- each platform requires displaying their ToS during ad setup
- **Rate limiting** -- implement per-platform rate limiting to avoid API bans
- **Sandbox testing** -- Meta, Google, and TikTok all offer sandbox/test accounts; use these during development

---

## 7. File Reference

- Scaffold: `/src/lib/social/ad-managers.ts`
- Organic publishing: `/src/lib/social/publish.ts`
- Platform config: `/src/lib/social/platforms.ts`
- Content distribution: `/src/lib/social/distributor.ts`
- Token refresh: `/src/lib/social/token-refresh.ts`
- Analytics: `/src/lib/social/analytics.ts`
