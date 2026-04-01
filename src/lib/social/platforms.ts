// Platform definitions and OAuth configuration
// WHY: Centralized platform config so OAuth flows, UI, and publishing all use the same source of truth

export const PLATFORMS = {
  instagram: {
    name: "Instagram",
    authUrl: "https://api.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    icon: "Instagram",
    envPrefix: "INSTAGRAM",
    dbType: "INSTAGRAM" as const,
  },
  facebook: {
    name: "Facebook",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_read_engagement"],
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
    scopes: ["w_member_social", "r_liteprofile"],
    icon: "Linkedin",
    envPrefix: "LINKEDIN",
    dbType: "LINKEDIN" as const,
  },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;

export const VALID_PLATFORMS = Object.keys(PLATFORMS) as PlatformKey[];

export function isValidPlatform(key: string): key is PlatformKey {
  return key in PLATFORMS;
}

export function getPlatformCredentials(platform: PlatformKey) {
  const prefix = PLATFORMS[platform].envPrefix;
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  return { clientId, clientSecret };
}
