// Platform definitions and OAuth configuration
// WHY: Centralized platform config so OAuth flows, UI, and publishing all use the same source of truth

export const PLATFORMS = {
  instagram: {
    name: "Instagram",
    // WHY: Instagram Business Login goes through Facebook's OAuth dialog with a config_id
    // that specifies which permissions are allowed. Config created in Meta Developer Console.
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    // NOTE: instagram_business_* scopes are handled via the config_id in Facebook Login for Business
    // They must be configured in Meta Developer Console under the Login Configuration, not as URL scopes
    configId: "1296730438652781",
    icon: "Instagram",
    envPrefix: "INSTAGRAM",
    dbType: "INSTAGRAM" as const,
  },
  facebook: {
    name: "Facebook",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "pages_manage_metadata", "read_insights", "ads_read", "instagram_basic", "instagram_content_publish"],
    icon: "Facebook",
    envPrefix: "FACEBOOK",
    dbType: "FACEBOOK" as const,
  },
  twitter: {
    name: "X (Twitter)",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read"],
    icon: "Twitter",
    envPrefix: "TWITTER",
    dbType: "TWITTER" as const,
  },
  linkedin: {
    name: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social"],
    icon: "Linkedin",
    envPrefix: "LINKEDIN",
    dbType: "LINKEDIN" as const,
  },
  tiktok: {
    name: "TikTok",
    // TikTok Login Kit uses OAuth2 with PKCE
    // IMPORTANT: The TikTok developer portal requires the redirect_uri to exactly match
    // what is registered in Login Kit. A new redirect URI must be added via the portal
    // by creating a revision in the TikTok Developer Console:
    //   https://princemarketing.com/api/social/callback/tiktok
    // Until that revision is approved, TikTok OAuth will only work with URIs already
    // registered (e.g. ladonteprince.com). This cannot be changed programmatically.
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic"],
    // NOTE: video.publish and video.list scopes need TikTok app review approval
    // Once approved, add them back: ["user.info.basic", "video.publish", "video.list"]
    icon: "Music2",
    envPrefix: "TIKTOK",
    dbType: "TIKTOK" as const,
  },
  youtube: {
    name: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
    icon: "Youtube",
    envPrefix: "GOOGLE",
    dbType: "YOUTUBE" as const,
  },
  "google-analytics": {
    name: "Google Analytics",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    icon: "BarChart3",
    envPrefix: "GOOGLE",
    dbType: "GOOGLE_ANALYTICS" as const,
  },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;

export const VALID_PLATFORMS = Object.keys(PLATFORMS) as PlatformKey[];

export function isValidPlatform(key: string): key is PlatformKey {
  return key in PLATFORMS;
}

// WHY: VPS env uses FACEBOOK_APP_ID / FACEBOOK_APP_SECRET, not FACEBOOK_CLIENT_ID.
// This mapping resolves the mismatch between the VPS .env naming and the code's expectations.
const ENV_VAR_OVERRIDES: Record<string, { clientId: string; clientSecret: string }> = {
  FACEBOOK: {
    clientId: "FACEBOOK_APP_ID",
    clientSecret: "FACEBOOK_APP_SECRET",
  },
  GOOGLE: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
};

export function getPlatformCredentials(platform: PlatformKey) {
  const prefix = PLATFORMS[platform].envPrefix;
  const overrides = ENV_VAR_OVERRIDES[prefix];

  const clientId = overrides
    ? process.env[overrides.clientId]
    : process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = overrides
    ? process.env[overrides.clientSecret]
    : process.env[`${prefix}_CLIENT_SECRET`];

  return { clientId, clientSecret };
}
