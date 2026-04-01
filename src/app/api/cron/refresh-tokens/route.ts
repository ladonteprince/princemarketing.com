import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshAccessToken } from "@/lib/social/token-refresh";
import type { PlatformType } from "@prisma/client";
import type { PlatformKey } from "@/lib/social/platforms";

// GET /api/cron/refresh-tokens — Proactively refresh OAuth tokens before they expire
// WHY: Tokens expire silently (Google: 1hr, Twitter: 2hrs). If we wait until publish time,
// the post fails. This cron runs every 30 minutes and refreshes tokens that are close to expiry.
// Protected by CRON_SECRET, same pattern as the publish cron.

// Map DB enum values to platform keys used by the refresh module
const DB_TYPE_TO_PLATFORM_KEY: Record<string, PlatformKey> = {
  YOUTUBE: "youtube",
  GOOGLE_ANALYTICS: "google-analytics",
  TWITTER: "twitter",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
};

// How long before expiry each platform should trigger a refresh.
// WHY: We refresh well before actual expiry to avoid race conditions where
// a post is being published at the exact moment the token expires.
const REFRESH_THRESHOLDS_MS: Partial<Record<PlatformKey, number>> = {
  // Google tokens expire in 1 hour — refresh if older than 50 minutes
  youtube: 50 * 60 * 1000,
  "google-analytics": 50 * 60 * 1000,
  // Twitter tokens expire in 2 hours — refresh if older than 1.5 hours
  twitter: 90 * 60 * 1000,
  // Facebook/Instagram: exchange for long-lived token within first hour of auth
  facebook: 55 * 60 * 1000,
  instagram: 55 * 60 * 1000,
  // TikTok tokens expire in 24 hours — refresh if older than 23 hours
  tiktok: 23 * 60 * 60 * 1000,
};

// Platforms that support token refresh
const REFRESHABLE_TYPES: PlatformType[] = [
  "YOUTUBE",
  "GOOGLE_ANALYTICS",
  "TWITTER",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all connected platforms that support refresh
    const platforms = await db.platform.findMany({
      where: {
        connected: true,
        type: { in: REFRESHABLE_TYPES },
        accessToken: { not: null },
      },
    });

    const results: Array<{
      id: string;
      type: string;
      status: "refreshed" | "skipped" | "failed";
      reason?: string;
    }> = [];

    for (const platform of platforms) {
      const platformKey = DB_TYPE_TO_PLATFORM_KEY[platform.type];
      if (!platformKey) {
        results.push({ id: platform.id, type: platform.type, status: "skipped", reason: "Unknown platform type" });
        continue;
      }

      const threshold = REFRESH_THRESHOLDS_MS[platformKey];
      if (!threshold) {
        results.push({ id: platform.id, type: platform.type, status: "skipped", reason: "No refresh threshold defined" });
        continue;
      }

      // Check if the token is old enough to need refreshing.
      // We use `updatedAt` as a proxy for when the token was last set.
      // WHY: The Platform model doesn't have a dedicated `tokenExpiresAt` field (yet).
      // Using updatedAt works because token storage always triggers an update.
      const tokenAge = Date.now() - platform.updatedAt.getTime();

      if (tokenAge < threshold) {
        results.push({ id: platform.id, type: platform.type, status: "skipped", reason: "Token still fresh" });
        continue;
      }

      // For Facebook/Instagram, we only do the long-lived exchange once.
      // After that, the token lasts 60 days and can't be refreshed further.
      // WHY: Facebook's long-lived exchange only works on short-lived tokens.
      // If the token is already older than 2 hours, it was likely already exchanged.
      if ((platformKey === "facebook" || platformKey === "instagram") && tokenAge > 2 * 60 * 60 * 1000) {
        results.push({ id: platform.id, type: platform.type, status: "skipped", reason: "Facebook token likely already long-lived" });
        continue;
      }

      // Attempt refresh
      // NOTE: refreshToken field doesn't exist on the Platform model yet.
      // For now, we pass empty string for platforms that need it (Google, Twitter, TikTok)
      // and rely on currentAccessToken for Facebook/Instagram exchange.
      // TODO: Add `refreshToken` and `tokenExpiresAt` fields to the Platform Prisma model.
      const refreshToken = (platform as Record<string, unknown>).refreshToken as string | undefined;

      if (!refreshToken && (platformKey === "youtube" || platformKey === "google-analytics" || platformKey === "twitter" || platformKey === "tiktok")) {
        results.push({ id: platform.id, type: platform.type, status: "failed", reason: "No refresh token stored — user must re-authorize" });
        continue;
      }

      try {
        const refreshed = await refreshAccessToken(
          platformKey,
          refreshToken ?? "",
          platform.accessToken!,
        );

        if (!refreshed) {
          results.push({ id: platform.id, type: platform.type, status: "failed", reason: "Refresh returned null — token may be revoked" });
          continue;
        }

        // Update the stored token
        // WHY: We update accessToken and updatedAt (auto). If the platform returned
        // a new refresh token (Twitter rotates them), we'd store that too — once the
        // Prisma schema has the refreshToken field.
        const updateData: Record<string, unknown> = {
          accessToken: refreshed.accessToken,
        };

        // Store new refresh token if available and if the field exists on the model
        // TODO: Uncomment when `refreshToken` is added to Prisma schema:
        // if (refreshed.refreshToken) {
        //   updateData.refreshToken = refreshed.refreshToken;
        // }
        // if (refreshed.expiresAt) {
        //   updateData.tokenExpiresAt = refreshed.expiresAt;
        // }

        await db.platform.update({
          where: { id: platform.id },
          data: updateData as Parameters<typeof db.platform.update>[0]["data"],
        });

        results.push({ id: platform.id, type: platform.type, status: "refreshed" });
      } catch (err) {
        results.push({
          id: platform.id,
          type: platform.type,
          status: "failed",
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const refreshed = results.filter((r) => r.status === "refreshed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    console.log(`[Cron] Token refresh complete: ${refreshed} refreshed, ${failed} failed, ${skipped} skipped`);

    return NextResponse.json({
      processed: results.length,
      refreshed,
      failed,
      skipped,
      results,
    });
  } catch (error) {
    console.error("[Cron] Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh cron failed" },
      { status: 500 },
    );
  }
}
