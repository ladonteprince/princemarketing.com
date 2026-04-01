// Real social media publishing via platform APIs
// WHY: Each platform has different API conventions. This module handles the differences.

import type { PlatformKey } from "./platforms";

type PublishParams = {
  content: string;
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

async function publishToTiktok({ content }: PublishParams): Promise<PublishResult> {
  // TikTok Content Posting API requires video upload — text-only posts not supported
  return { success: false, error: "TikTok publishing requires video content. Use the TikTok video upload API." };
}

const publishers: Record<PlatformKey, (params: PublishParams) => Promise<PublishResult>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  twitter: publishToTwitter,
  linkedin: publishToLinkedin,
  tiktok: publishToTiktok,
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
