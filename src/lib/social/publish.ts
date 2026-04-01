// Real social media publishing via platform APIs
// WHY: Each platform has different API conventions. This module handles the differences.

import type { PlatformKey } from "./platforms";

type PublishParams = {
  content: string;
  title?: string;
  mediaUrl?: string;
  accessToken: string;
};

type PublishResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

// Facebook: Graph API v19.0
async function publishToFacebook({ content, accessToken }: PublishParams): Promise<PublishResult> {
  try {
    // First get page ID
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`,
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data?.[0]) {
      return { success: false, error: "No Facebook pages found. Connect a page first." };
    }

    const page = pagesData.data[0];
    const pageToken = page.access_token;
    const pageId = page.id;

    const postRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, access_token: pageToken }),
      },
    );

    const postData = await postRes.json();
    if (postData.error) {
      return { success: false, error: postData.error.message };
    }

    return { success: true, postId: postData.id };
  } catch (err) {
    return { success: false, error: `Facebook API error: ${(err as Error).message}` };
  }
}

// Instagram: Graph API via Facebook Pages
async function publishToInstagram({ content, mediaUrl, accessToken }: PublishParams): Promise<PublishResult> {
  try {
    // Get Instagram business account ID via Facebook page
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`,
    );
    const pagesData = await pagesRes.json();
    const igAccountId = pagesData.data?.[0]?.instagram_business_account?.id;

    if (!igAccountId) {
      return { success: false, error: "No Instagram business account linked. Link one in Facebook Page settings." };
    }

    if (!mediaUrl) {
      return { success: false, error: "Instagram requires an image or video URL to publish." };
    }

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: mediaUrl,
          caption: content,
          access_token: accessToken,
        }),
      },
    );
    const containerData = await containerRes.json();

    if (containerData.error) {
      return { success: false, error: containerData.error.message };
    }

    // Step 2: Publish container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      },
    );
    const publishData = await publishRes.json();

    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    return { success: true, postId: publishData.id };
  } catch (err) {
    return { success: false, error: `Instagram API error: ${(err as Error).message}` };
  }
}

// Twitter (X): v2 API with OAuth 2.0
async function publishToTwitter({ content, accessToken }: PublishParams): Promise<PublishResult> {
  try {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text: content }),
    });

    const data = await res.json();

    if (data.errors) {
      return { success: false, error: data.errors[0]?.message ?? "Twitter API error" };
    }

    return { success: true, postId: data.data?.id };
  } catch (err) {
    return { success: false, error: `Twitter API error: ${(err as Error).message}` };
  }
}

// LinkedIn: Share API v2
async function publishToLinkedin({ content, accessToken }: PublishParams): Promise<PublishResult> {
  try {
    // Get user profile URN
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const personUrn = `urn:li:person:${profile.sub}`;

    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: content },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    const postData = await postRes.json();

    if (postData.status && postData.status >= 400) {
      return { success: false, error: postData.message ?? "LinkedIn API error" };
    }

    return { success: true, postId: postData.id };
  } catch (err) {
    return { success: false, error: `LinkedIn API error: ${(err as Error).message}` };
  }
}

async function publishToTiktok({ content, accessToken, mediaUrl }: PublishParams): Promise<PublishResult> {
  if (!mediaUrl) {
    return { success: false, error: "TikTok requires video content. Provide a mediaUrl." };
  }
  if (!accessToken) {
    return { success: false, error: "TikTok access token is required." };
  }

  try {
    // TikTok Content Posting API - initiate video publish
    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: content.slice(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: mediaUrl,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      return { success: false, error: `TikTok upload failed: ${(err as any)?.error?.message ?? initRes.status}` };
    }

    const data = await initRes.json();
    return { success: true, postId: data.data?.publish_id ?? "pending" };
  } catch (err) {
    return { success: false, error: `TikTok API error: ${(err as Error).message}` };
  }
}

async function publishToYoutube({ content, title: explicitTitle, accessToken, mediaUrl }: PublishParams): Promise<PublishResult> {
  if (!mediaUrl) {
    return { success: false, error: "YouTube requires video content. Provide a mediaUrl." };
  }
  if (!accessToken) {
    return { success: false, error: "YouTube access token is required." };
  }

  try {
    // Use explicit title if provided, otherwise extract from first line or first 100 chars
    const lines = content.split("\n").filter(Boolean);
    const title = explicitTitle ?? (lines[0] ?? content).slice(0, 100);
    const description = content;

    // Step 1: Initiate resumable upload
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            categoryId: "22", // People & Blogs
          },
          status: {
            privacyStatus: "public",
          },
        }),
      },
    );

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      return { success: false, error: `YouTube upload init failed: ${(err as any)?.error?.message ?? initRes.status}` };
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return { success: false, error: "YouTube did not return an upload URL." };
    }

    // Step 2: Download the video
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      return { success: false, error: `Failed to download video from ${mediaUrl}` };
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // Step 3: Upload video to YouTube
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBuffer.length),
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      return { success: false, error: `YouTube upload failed: ${(err as any)?.error?.message ?? uploadRes.status}` };
    }

    const videoData = await uploadRes.json();
    return { success: true, postId: videoData.id };
  } catch (err) {
    return { success: false, error: `YouTube API error: ${(err as Error).message}` };
  }
}

async function publishToGoogleAnalytics(): Promise<PublishResult> {
  return { success: false, error: "Google Analytics is an analytics platform — it does not support publishing." };
}

const publishers: Record<PlatformKey, (params: PublishParams) => Promise<PublishResult>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  twitter: publishToTwitter,
  linkedin: publishToLinkedin,
  tiktok: publishToTiktok,
  youtube: publishToYoutube,
  "google-analytics": publishToGoogleAnalytics,
};

export async function publishToplatform(
  platform: PlatformKey,
  params: PublishParams,
): Promise<PublishResult> {
  const publisher = publishers[platform];
  if (!publisher) {
    return { success: false, error: `Publishing not supported for ${platform}` };
  }
  return publisher(params);
}
