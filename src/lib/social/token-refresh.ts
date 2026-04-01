// OAuth token refresh mechanism
// WHY: Access tokens expire (Google: 1hr, Twitter: 2hrs, Facebook: 60 days).
// Without proactive refresh, connected platforms silently disconnect.
// This module handles per-platform refresh logic using each provider's token refresh endpoint.

import { getPlatformCredentials, type PlatformKey } from "./platforms";

interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Refresh an OAuth access token for a given platform.
 *
 * Returns new tokens on success, or null if:
 *  - The platform doesn't support refresh (LinkedIn)
 *  - The refresh token is invalid/expired (user must re-auth)
 *  - The API call fails
 */
export async function refreshAccessToken(
  platform: PlatformKey,
  refreshToken: string,
  currentAccessToken: string,
): Promise<RefreshResult | null> {
  switch (platform) {
    case "youtube":
    case "google-analytics":
      return refreshGoogle(platform, refreshToken);

    case "twitter":
      return refreshTwitter(refreshToken);

    case "facebook":
    case "instagram":
      return exchangeFacebookLongLived(platform, currentAccessToken);

    case "tiktok":
      return refreshTikTok(refreshToken);

    case "linkedin":
      // LinkedIn OAuth2 tokens last ~2 months with no refresh endpoint.
      // Users must re-authorize when the token expires.
      return null;

    default:
      console.warn(`[TokenRefresh] No refresh strategy for platform: ${platform}`);
      return null;
  }
}

/**
 * Google (YouTube + Google Analytics)
 * Uses refresh_token grant with https://oauth2.googleapis.com/token
 * Google refresh tokens don't expire unless revoked or unused for 6 months.
 */
async function refreshGoogle(
  platform: "youtube" | "google-analytics",
  refreshToken: string,
): Promise<RefreshResult | null> {
  const { clientId, clientSecret } = getPlatformCredentials(platform);
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error(`[TokenRefresh] Google refresh failed for ${platform}:`, data);
      return null;
    }

    return {
      accessToken: data.access_token,
      // Google doesn't rotate refresh tokens by default, but may include a new one
      refreshToken: data.refresh_token ?? undefined,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  } catch (err) {
    console.error(`[TokenRefresh] Google refresh error for ${platform}:`, err);
    return null;
  }
}

/**
 * Twitter (X)
 * Uses refresh_token grant with Basic auth header.
 * Twitter refresh tokens are single-use — each refresh returns a new refresh_token.
 */
async function refreshTwitter(
  refreshToken: string,
): Promise<RefreshResult | null> {
  const { clientId, clientSecret } = getPlatformCredentials("twitter");
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error("[TokenRefresh] Twitter refresh failed:", data);
      return null;
    }

    return {
      accessToken: data.access_token,
      // Twitter rotates refresh tokens — MUST store the new one
      refreshToken: data.refresh_token ?? undefined,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  } catch (err) {
    console.error("[TokenRefresh] Twitter refresh error:", err);
    return null;
  }
}

/**
 * Facebook / Instagram
 * No traditional refresh — instead, exchange a short-lived token for a long-lived one.
 * Short-lived tokens last ~1 hour; long-lived tokens last ~60 days.
 * This should be called shortly after initial auth to extend the token lifetime.
 */
async function exchangeFacebookLongLived(
  platform: "facebook" | "instagram",
  currentAccessToken: string,
): Promise<RefreshResult | null> {
  const { clientId, clientSecret } = getPlatformCredentials(platform);
  if (!clientId || !clientSecret) return null;

  try {
    const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("fb_exchange_token", currentAccessToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!data.access_token) {
      console.error(`[TokenRefresh] Facebook long-lived exchange failed for ${platform}:`, data);
      return null;
    }

    return {
      accessToken: data.access_token,
      // Facebook long-lived tokens can't be further refreshed; user must re-auth after expiry
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  } catch (err) {
    console.error(`[TokenRefresh] Facebook exchange error for ${platform}:`, err);
    return null;
  }
}

/**
 * TikTok
 * Uses refresh_token grant with client_key (TikTok's name for client_id).
 * Refresh tokens last 365 days; access tokens last 24 hours.
 */
async function refreshTikTok(
  refreshToken: string,
): Promise<RefreshResult | null> {
  const { clientId, clientSecret } = getPlatformCredentials("tiktok");
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_key: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error("[TokenRefresh] TikTok refresh failed:", data);
      return null;
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? undefined,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  } catch (err) {
    console.error("[TokenRefresh] TikTok refresh error:", err);
    return null;
  }
}
