// Platform definitions and OAuth configuration
// WHY: Centralized platform config so OAuth flows, UI, and publishing all use the same source of truth

export const PLATFORMS = {
  instagram: {
    name: "Instagram",
    // WHY: Instagram Business Login goes through Facebook's OAuth dialog with a config_id
    // that specifies which permissions are allowed. Config created in Meta Developer Console.
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: ["instagram_manage_comments", "pages_show_list", "pages_read_engagement"],
    configId: "940418525511002",
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
    scopes: ["openid", "profile", "email", "w_member_social"],
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

// WHY: VPS env uses FACEBOOK_APP_ID / FACEBOOK_APP_SECRET, not FACEBOOK_CLIENT_ID.
// This mapping resolves the mismatch between the VPS .env naming and the code's expectations.
const ENV_VAR_OVERRIDES: Record<string, { clientId: string; clientSecret: string }> = {
  FACEBOOK: {
    clientId: "FACEBOOK_APP_ID",
    clientSecret: "FACEBOOK_APP_SECRET",
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
