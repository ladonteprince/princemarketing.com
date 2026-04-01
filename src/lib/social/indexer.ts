// Social Media Indexer — crawls connected platforms to build user context
// WHY: When the AI knows about a user's existing content, it can give personalized advice
// like "Based on your recent Instagram posts about sneakers..." instead of generic tips.
// This runs after a platform is connected and periodically to stay fresh.

import { db } from "@/lib/db";
import type { PlatformType } from "@prisma/client";

export type SocialPost = {
  content: string;
  mediaType: "text" | "image" | "video" | "carousel" | "reel" | "story";
  engagement: number;
  postedAt: string;
};

export type SocialProfile = {
  platform: string;
  accountName: string;
  followers: number;
  recentPosts: SocialPost[];
  topTopics: string[];
  brandVoice: string; // AI-derived summary of their content style
};

// WHY: Each platform's API is different. These fetchers normalize the data into SocialProfile.
// When a platform's API is restricted (LinkedIn, TikTok), we return sensible defaults
// rather than failing, so the AI still has partial context.

const PLATFORM_FETCHERS: Record<
  string,
  (accessToken: string, accountName: string) => Promise<SocialProfile>
> = {
  FACEBOOK: fetchFacebookProfile,
  INSTAGRAM: fetchInstagramProfile,
  TWITTER: fetchTwitterProfile,
  YOUTUBE: fetchYouTubeProfile,
  LINKEDIN: fetchLinkedInProfile,
  TIKTOK: fetchTikTokProfile,
  GOOGLE_ANALYTICS: fetchGoogleAnalyticsProfile,
};

/**
 * Index a single platform for a user.
 * Fetches recent posts, extracts topics, and summarizes brand voice.
 */
export async function indexPlatform(
  platform: PlatformType,
  accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  const fetcher = PLATFORM_FETCHERS[platform];
  if (!fetcher) {
    return defaultProfile(platform, accountName);
  }

  try {
    return await fetcher(accessToken, accountName);
  } catch (err) {
    console.error(`[SocialIndexer] Failed to index ${platform}:`, err);
    return defaultProfile(platform, accountName);
  }
}

/**
 * Build a single context string from all connected platforms for a user.
 * This string gets injected into the AI chat system prompt.
 */
export async function buildUserContext(userId: string): Promise<string> {
  const platforms = await db.platform.findMany({
    where: { userId, connected: true },
    select: {
      type: true,
      accessToken: true,
      accountName: true,
    },
  });

  if (platforms.length === 0) {
    return "User has no connected social platforms yet.";
  }

  const profiles: SocialProfile[] = [];

  for (const p of platforms) {
    if (!p.accessToken) continue;
    const profile = await indexPlatform(p.type, p.accessToken, p.accountName);
    profiles.push(profile);
  }

  if (profiles.length === 0) {
    return "User has connected platforms but no accessible content yet.";
  }

  // WHY: We build a concise paragraph, not a JSON dump.
  // The AI performs better with natural language context than structured data.
  const parts: string[] = [];

  // Aggregate stats
  const totalFollowers = profiles.reduce((sum, p) => sum + p.followers, 0);
  const platformNames = profiles.map((p) => p.platform).join(", ");
  parts.push(
    `User is active on ${platformNames} with a combined ${formatNumber(totalFollowers)} followers.`,
  );

  // Per-platform summaries
  for (const profile of profiles) {
    const summary: string[] = [];

    if (profile.followers > 0) {
      summary.push(`${formatNumber(profile.followers)} followers`);
    }

    if (profile.topTopics.length > 0) {
      summary.push(`content focuses on ${profile.topTopics.join(", ")}`);
    }

    if (profile.brandVoice) {
      summary.push(`brand voice is ${profile.brandVoice}`);
    }

    if (profile.recentPosts.length > 0) {
      const avgEngagement = Math.round(
        profile.recentPosts.reduce((sum, p) => sum + p.engagement, 0) /
          profile.recentPosts.length,
      );
      summary.push(`avg engagement per post: ${formatNumber(avgEngagement)}`);
    }

    if (summary.length > 0) {
      parts.push(`${profile.platform}: ${summary.join(". ")}.`);
    }
  }

  // Top-performing content hint
  const allPosts = profiles.flatMap((p) =>
    p.recentPosts.map((post) => ({ ...post, platform: p.platform })),
  );
  const topPost = allPosts.sort((a, b) => b.engagement - a.engagement)[0];
  if (topPost && topPost.engagement > 0) {
    const preview =
      topPost.content.length > 80
        ? topPost.content.slice(0, 80) + "..."
        : topPost.content;
    parts.push(
      `Top-performing recent content (${topPost.platform}, ${formatNumber(topPost.engagement)} engagements): "${preview}"`,
    );
  }

  return parts.join(" ");
}

// --- Per-platform fetchers ---

async function fetchFacebookProfile(
  accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: /me/posts returns the user's feed posts with engagement metrics.
  // We request the last 20 posts to get a meaningful sample.
  const postsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/posts?fields=message,created_time,likes.summary(true),shares,comments.summary(true)&limit=20&access_token=${accessToken}`,
  );
  const postsData = await postsRes.json();

  if (!postsData.data) {
    return defaultProfile("Facebook", accountName);
  }

  const recentPosts: SocialPost[] = postsData.data
    .filter((p: Record<string, unknown>) => p.message)
    .map((p: Record<string, unknown>) => ({
      content: String(p.message ?? ""),
      mediaType: "text" as const,
      engagement:
        ((p.likes as Record<string, unknown>)?.summary as Record<string, unknown>)
          ?.total_count
          ? Number(
              ((p.likes as Record<string, unknown>).summary as Record<string, unknown>)
                .total_count,
            )
          : 0,
      postedAt: String(p.created_time ?? ""),
    }));

  return {
    platform: "Facebook",
    accountName,
    followers: 0, // Requires /me?fields=friends.summary(true) — often restricted
    recentPosts,
    topTopics: extractTopics(recentPosts),
    brandVoice: deriveBrandVoice(recentPosts),
  };
}

async function fetchInstagramProfile(
  accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: Instagram Business API requires the IG user ID first, then /media.
  // We get the ID from /me/accounts (Facebook Pages linked to IG).
  const accountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`,
  );
  const accountsData = await accountsRes.json();

  const igAccountId = accountsData.data?.[0]?.instagram_business_account?.id;
  if (!igAccountId) {
    return defaultProfile("Instagram", accountName);
  }

  const [mediaRes, profileRes] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media?fields=caption,timestamp,like_count,comments_count,media_type&limit=20&access_token=${accessToken}`,
    ),
    fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}?fields=followers_count,username&access_token=${accessToken}`,
    ),
  ]);

  const mediaData = await mediaRes.json();
  const profileData = await profileRes.json();

  const recentPosts: SocialPost[] = (mediaData.data ?? []).map(
    (p: Record<string, unknown>) => ({
      content: String(p.caption ?? ""),
      mediaType: mapInstagramMediaType(String(p.media_type ?? "IMAGE")),
      engagement: (Number(p.like_count) || 0) + (Number(p.comments_count) || 0),
      postedAt: String(p.timestamp ?? ""),
    }),
  );

  return {
    platform: "Instagram",
    accountName: profileData.username ?? accountName,
    followers: Number(profileData.followers_count) || 0,
    recentPosts,
    topTopics: extractTopics(recentPosts),
    brandVoice: deriveBrandVoice(recentPosts),
  };
}

async function fetchTwitterProfile(
  accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: Twitter API v2 requires Bearer token auth. We fetch user info + recent tweets.
  const [userRes, tweetsRes] = await Promise.all([
    fetch("https://api.twitter.com/2/users/me?user.fields=public_metrics", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(
      "https://api.twitter.com/2/users/me/tweets?max_results=20&tweet.fields=created_at,public_metrics",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
  ]);

  const userData = await userRes.json();
  const tweetsData = await tweetsRes.json();

  const recentPosts: SocialPost[] = (tweetsData.data ?? []).map(
    (t: Record<string, unknown>) => {
      const metrics = (t.public_metrics ?? {}) as Record<string, number>;
      return {
        content: String(t.text ?? ""),
        mediaType: "text" as const,
        engagement:
          (metrics.like_count || 0) +
          (metrics.retweet_count || 0) +
          (metrics.reply_count || 0),
        postedAt: String(t.created_at ?? ""),
      };
    },
  );

  const userMetrics = (userData.data?.public_metrics ?? {}) as Record<
    string,
    number
  >;

  return {
    platform: "X (Twitter)",
    accountName: userData.data?.username ?? accountName,
    followers: userMetrics.followers_count || 0,
    recentPosts,
    topTopics: extractTopics(recentPosts),
    brandVoice: deriveBrandVoice(recentPosts),
  };
}

async function fetchYouTubeProfile(
  accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: YouTube Data API v3 for channel info and recent videos
  const [channelRes, videosRes] = await Promise.all([
    fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
    fetch(
      "https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=10&order=date",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
  ]);

  const channelData = await channelRes.json();
  const videosData = await videosRes.json();

  const channel = channelData.items?.[0];
  const followers = Number(channel?.statistics?.subscriberCount) || 0;

  const recentPosts: SocialPost[] = (videosData.items ?? []).map(
    (v: Record<string, unknown>) => {
      const snippet = (v.snippet ?? {}) as Record<string, unknown>;
      return {
        content: String(snippet.title ?? ""),
        mediaType: "video" as const,
        engagement: 0, // Would need separate video stats call
        postedAt: String(snippet.publishedAt ?? ""),
      };
    },
  );

  return {
    platform: "YouTube",
    accountName: channel?.snippet?.title ?? accountName,
    followers,
    recentPosts,
    topTopics: extractTopics(recentPosts),
    brandVoice: deriveBrandVoice(recentPosts),
  };
}

async function fetchLinkedInProfile(
  _accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: LinkedIn's API is severely restricted for third-party apps.
  // Post content and engagement metrics require Marketing Developer Platform access
  // which has a long approval process. Return defaults for now.
  return defaultProfile("LinkedIn", accountName);
}

async function fetchTikTokProfile(
  _accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: TikTok's Content API for reading user videos requires additional approval.
  // video.list scope gives access but only to videos posted via the same app.
  // Return defaults until we have full API access.
  return defaultProfile("TikTok", accountName);
}

async function fetchGoogleAnalyticsProfile(
  _accessToken: string,
  accountName: string,
): Promise<SocialProfile> {
  // WHY: Google Analytics is not a social platform — it provides website traffic data.
  // We return a minimal profile. In the future, we could extract top pages/referrers
  // to understand what content drives traffic.
  return {
    platform: "Google Analytics",
    accountName,
    followers: 0,
    recentPosts: [],
    topTopics: [],
    brandVoice: "",
  };
}

// --- Helpers ---

function defaultProfile(
  platform: string,
  accountName: string,
): SocialProfile {
  return {
    platform,
    accountName,
    followers: 0,
    recentPosts: [],
    topTopics: [],
    brandVoice: "",
  };
}

/**
 * Extract top topics from post content using simple keyword frequency.
 * WHY: A lightweight alternative to calling an LLM for topic extraction.
 * Good enough for system prompt context — not meant for user-facing analytics.
 */
function extractTopics(posts: SocialPost[]): string[] {
  const allText = posts.map((p) => p.content.toLowerCase()).join(" ");

  // Remove common stop words and short tokens
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most", "other",
    "some", "such", "no", "only", "own", "same", "than", "too", "very",
    "just", "because", "if", "when", "where", "how", "what", "which", "who",
    "whom", "this", "that", "these", "those", "i", "me", "my", "we", "our",
    "you", "your", "he", "him", "his", "she", "her", "it", "its", "they",
    "them", "their", "about", "up", "like", "get", "got", "new", "one",
  ]);

  const words = allText
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Derive a brief brand voice description from post content.
 * WHY: Gives the AI a sense of tone without needing to read every post.
 */
function deriveBrandVoice(posts: SocialPost[]): string {
  if (posts.length === 0) return "";

  const allText = posts.map((p) => p.content).join(" ");
  const avgLength =
    posts.reduce((sum, p) => sum + p.content.length, 0) / posts.length;

  const traits: string[] = [];

  // Length-based signals
  if (avgLength > 200) traits.push("detailed");
  else if (avgLength < 50) traits.push("concise");

  // Emoji density
  const emojiCount = (allText.match(/[\u{1F600}-\u{1F64F}]/gu) ?? []).length;
  if (emojiCount > posts.length * 2) traits.push("expressive");

  // Question marks = conversational
  const questionCount = (allText.match(/\?/g) ?? []).length;
  if (questionCount > posts.length * 0.5) traits.push("conversational");

  // Hashtag density = promotional
  const hashtagCount = (allText.match(/#/g) ?? []).length;
  if (hashtagCount > posts.length * 2) traits.push("hashtag-heavy");

  // Exclamation marks = energetic
  const exclamationCount = (allText.match(/!/g) ?? []).length;
  if (exclamationCount > posts.length) traits.push("energetic");

  // Uppercase words = bold/loud
  const capsWords = (allText.match(/\b[A-Z]{3,}\b/g) ?? []).length;
  if (capsWords > posts.length) traits.push("bold");

  return traits.length > 0 ? traits.join(", ") : "neutral";
}

function mapInstagramMediaType(
  type: string,
): "image" | "video" | "carousel" {
  switch (type) {
    case "VIDEO":
      return "video";
    case "CAROUSEL_ALBUM":
      return "carousel";
    default:
      return "image";
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
