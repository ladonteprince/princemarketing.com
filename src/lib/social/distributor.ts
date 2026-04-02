// Universal Social Distribution Connector
// WHY: Content needs to reach every connected platform simultaneously with per-platform
// optimization. Instead of calling publish for each platform manually, this module
// handles caption optimization, parallel dispatch, and aggregated results.

import { db } from "@/lib/db";
import { PLATFORMS, isValidPlatform } from "./platforms";
import { publishToplatform } from "./publish";
import type { PlatformKey } from "./platforms";

// --- Platform Caption Limits ---
// WHY: Each platform has different character limits and content conventions.
// Exceeding them causes silent failures or truncated posts.
const PLATFORM_CAPTION_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  "google-analytics": 0, // Not a publishing platform
};

// --- Types ---

export type DistributionRequest = {
  content: string;                              // Main caption/copy
  mediaUrl?: string;                            // Image or video URL
  mediaType?: "image" | "video";
  platforms: string[];                          // Which platforms to post to
  scheduledAt?: string;                         // ISO date for scheduled publish
  platformCaptions?: Record<string, string>;    // Per-platform caption overrides
};

export type DistributionResult = {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
  url?: string;  // Link to the published post
};

// --- Caption Optimization ---
// WHY: A generic caption rarely works everywhere. Twitter needs brevity,
// Instagram benefits from hashtags, LinkedIn wants professional tone length.

function optimizeCaptionForPlatform(
  platform: string,
  caption: string,
): string {
  const limit = PLATFORM_CAPTION_LIMITS[platform] ?? 5000;

  if (limit === 0) return caption;

  // Truncate to platform limit, preserving word boundaries when possible
  if (caption.length <= limit) return caption;

  const truncated = caption.slice(0, limit - 3);
  const lastSpace = truncated.lastIndexOf(" ");

  // If we can break at a word boundary within 80% of the limit, do so
  if (lastSpace > limit * 0.8) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}

// --- Post URL Construction ---
// WHY: Users want a direct link to their published post for verification and sharing.

function buildPostUrl(platform: string, postId: string): string | undefined {
  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/${postId}`;
    case "twitter":
      return `https://twitter.com/i/status/${postId}`;
    case "linkedin":
      // LinkedIn post IDs are URNs — extract the activity ID
      return postId.includes("urn:")
        ? `https://www.linkedin.com/feed/update/${postId}`
        : `https://www.linkedin.com/feed/update/urn:li:share:${postId}`;
    case "youtube":
      return `https://www.youtube.com/watch?v=${postId}`;
    case "instagram":
      // Instagram Graph API returns numeric IDs — no direct URL construction without permalink lookup
      return undefined;
    case "tiktok":
      // TikTok publish_id is not a direct video URL — it's a job ID
      return undefined;
    default:
      return undefined;
  }
}

// --- Main Distribution Function ---

export async function distribute(
  userId: string,
  request: DistributionRequest,
): Promise<DistributionResult[]> {
  const { content, mediaUrl, platforms, scheduledAt, platformCaptions } = request;

  // 1. Validate all requested platforms
  const invalidPlatforms = platforms.filter((p) => !isValidPlatform(p));
  if (invalidPlatforms.length > 0) {
    return invalidPlatforms.map((p) => ({
      platform: p,
      success: false,
      error: `Invalid platform: ${p}`,
    }));
  }

  // 2. If scheduled, store in calendar and return pending results
  // WHY: Scheduled posts are stored in the DB and executed by a cron/scheduler later.
  // The distribute function itself does not sleep-wait until the scheduled time.
  if (scheduledAt) {
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return [{ platform: "all", success: false, error: "Invalid scheduledAt date" }];
    }

    try {
      await db.calendarEntry.create({
        data: {
          userId,
          title: content.slice(0, 100),
          content,
          platform: platforms.join(",") as any,
          scheduledAt: scheduledDate,
          status: "SCHEDULED",
          mediaUrl: mediaUrl ?? null,
        },
      });

      return platforms.map((p) => ({
        platform: p,
        success: true,
        postId: undefined,
        url: undefined,
        error: undefined,
      }));
    } catch (err) {
      return [{ platform: "all", success: false, error: `Failed to schedule: ${(err as Error).message}` }];
    }
  }

  // 3. Fetch all connected platforms for this user in a single query
  const connectedPlatforms = await db.platform.findMany({
    where: {
      userId,
      connected: true,
      type: {
        in: platforms.map((p) => PLATFORMS[p as PlatformKey].dbType),
      },
    },
  });

  // 4. Publish to all platforms in parallel
  // WHY: Sequential publishing is slow. Each platform API is independent,
  // so we fire all requests concurrently and collect results.
  const results = await Promise.allSettled(
    platforms.map(async (platformKey): Promise<DistributionResult> => {
      const dbType = PLATFORMS[platformKey as PlatformKey].dbType;
      const connected = connectedPlatforms.find((p) => p.type === dbType);

      if (!connected || !connected.accessToken) {
        return {
          platform: platformKey,
          success: false,
          error: `${PLATFORMS[platformKey as PlatformKey].name} is not connected. Connect it in Settings first.`,
        };
      }

      // Resolve caption: use override if provided, else optimize the default
      const caption = platformCaptions?.[platformKey]
        ? optimizeCaptionForPlatform(platformKey, platformCaptions[platformKey])
        : optimizeCaptionForPlatform(platformKey, content);

      const result = await publishToplatform(platformKey as PlatformKey, {
        content: caption,
        mediaUrl,
        accessToken: connected.accessToken,
      });

      return {
        platform: platformKey,
        success: result.success,
        postId: result.postId,
        error: result.error,
        url: result.postId ? buildPostUrl(platformKey, result.postId) : undefined,
      };
    }),
  );

  // 5. Unwrap Promise.allSettled results
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      platform: platforms[i],
      success: false,
      error: `Unexpected error: ${(r.reason as Error)?.message ?? "unknown"}`,
    };
  });
}
