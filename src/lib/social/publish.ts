// Real social media publishing via platform APIs
// WHY: Each platform has different API conventions. This module handles the differences.

import type { PlatformKey } from "./platforms";

type PublishParams = {
  content: string;
  title?: string;
  mediaUrl?: string;
  mediaUrls?: string[]; // For carousels
  mediaType?: "image" | "video" | "carousel" | "reel" | "story";
  accessToken: string;
  pageId?: string; // For Facebook/Instagram
  scheduled?: number; // Unix timestamp
};

type PublishResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

// Helper: Poll Instagram container status until ready or timeout
async function pollInstagramContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<{ ready: boolean; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return { ready: true };
    if (data.status_code === "ERROR") return { ready: false, error: data.status ?? "Container processing failed" };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ready: false, error: "Container processing timed out" };
}

// Facebook: Graph API v19.0
async function publishToFacebook({ content, mediaUrl, mediaUrls, mediaType, accessToken, scheduled }: PublishParams): Promise<PublishResult> {
  try {
    // First get page ID and token
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`,
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data?.[0]) {
      return { success: false, error: "No Facebook pages found. Connect a page first." };
    }

    // Prefer "LaDonte Prince" page, then any page with "Prince" in the name, then first page
    const page = pagesData.data.find((p: any) => p.name === "LaDonte Prince")
      ?? pagesData.data.find((p: any) => p.name?.toLowerCase().includes("prince"))
      ?? pagesData.data[0];
    const pageToken = page.access_token;
    const pageId = page.id;

    const schedulingParams = scheduled
      ? { published: false, scheduled_publish_time: scheduled }
      : {};

    // Photo post
    if (mediaType === "image" && mediaUrl) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: mediaUrl,
          message: content,
          access_token: pageToken,
          ...schedulingParams,
        }),
      });
      const data = await res.json();
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, postId: data.id || data.post_id };
    }

    // Video post
    if (mediaType === "video" && mediaUrl) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: mediaUrl,
          description: content,
          title: content.slice(0, 100),
          access_token: pageToken,
          ...schedulingParams,
        }),
      });
      const data = await res.json();
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, postId: data.id };
    }

    // Carousel: upload each photo as unpublished, then create post with attached_media
    if (mediaType === "carousel" && mediaUrls && mediaUrls.length > 1) {
      const photoIds: string[] = [];
      for (const url of mediaUrls) {
        const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, published: false, access_token: pageToken }),
        });
        const photoData = await photoRes.json();
        if (photoData.id) photoIds.push(photoData.id);
      }

      if (photoIds.length === 0) return { success: false, error: "Failed to upload carousel images" };

      const attachedMedia = photoIds.reduce((acc, id, i) => {
        acc[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
        return acc;
      }, {} as Record<string, string>);

      const postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          ...attachedMedia,
          access_token: pageToken,
          ...schedulingParams,
        }),
      });
      const postData = await postRes.json();
      if (postData.error) return { success: false, error: postData.error.message };
      return { success: true, postId: postData.id };
    }

    // Default: text post
    const postRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          access_token: pageToken,
          ...schedulingParams,
        }),
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
async function publishToInstagram({ content, mediaUrl, mediaUrls, mediaType, accessToken }: PublishParams): Promise<PublishResult> {
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

    // Story post (image or video)
    if (mediaType === "story" && mediaUrl) {
      const isVideo = mediaUrl.endsWith(".mp4") || mediaUrl.includes("video");
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "STORIES",
            ...(isVideo ? { video_url: mediaUrl } : { image_url: mediaUrl }),
            access_token: accessToken,
          }),
        },
      );
      const containerData = await containerRes.json();
      if (containerData.error) return { success: false, error: containerData.error.message };

      // Poll for readiness if video
      if (isVideo) {
        const poll = await pollInstagramContainer(containerData.id, accessToken);
        if (!poll.ready) return { success: false, error: poll.error ?? "Story processing failed" };
      }

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
      if (publishData.error) return { success: false, error: publishData.error.message };
      return { success: true, postId: publishData.id };
    }

    // Reel / Video post
    if ((mediaType === "reel" || mediaType === "video") && mediaUrl) {
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "REELS",
            video_url: mediaUrl,
            caption: content,
            access_token: accessToken,
          }),
        },
      );
      const containerData = await containerRes.json();
      if (containerData.error) return { success: false, error: containerData.error.message };

      // Poll for upload completion
      const poll = await pollInstagramContainer(containerData.id, accessToken);
      if (!poll.ready) return { success: false, error: poll.error ?? "Reel processing failed" };

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
      if (publishData.error) return { success: false, error: publishData.error.message };
      return { success: true, postId: publishData.id };
    }

    // Carousel post (multiple images/videos)
    if (mediaType === "carousel" && mediaUrls && mediaUrls.length > 1) {
      const childIds: string[] = [];
      for (const url of mediaUrls) {
        const isVideo = url.endsWith(".mp4") || url.includes("video");
        const childRes = await fetch(
          `https://graph.facebook.com/v19.0/${igAccountId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(isVideo
                ? { media_type: "VIDEO", video_url: url }
                : { image_url: url }),
              is_carousel_item: true,
              access_token: accessToken,
            }),
          },
        );
        const childData = await childRes.json();
        if (childData.id) {
          // Poll video children for readiness
          if (isVideo) {
            await pollInstagramContainer(childData.id, accessToken);
          }
          childIds.push(childData.id);
        }
      }

      if (childIds.length === 0) return { success: false, error: "Failed to upload carousel items" };

      // Create carousel container
      const carouselRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            children: childIds,
            caption: content,
            access_token: accessToken,
          }),
        },
      );
      const carouselData = await carouselRes.json();
      if (carouselData.error) return { success: false, error: carouselData.error.message };

      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: carouselData.id,
            access_token: accessToken,
          }),
        },
      );
      const publishData = await publishRes.json();
      if (publishData.error) return { success: false, error: publishData.error.message };
      return { success: true, postId: publishData.id };
    }

    // Default: single image post (existing behavior)
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
// NOTE: Media upload requires OAuth 1.0a which we don't support yet.
// TODO: Add media upload support when OAuth 1.0a is implemented.
// For now, supports text tweets and text + link tweets.
async function publishToTwitter({ content, mediaUrl, mediaType, accessToken }: PublishParams): Promise<PublishResult> {
  try {
    // If media was requested but we can't upload it, append the URL as a link
    let tweetText = content;
    if (mediaUrl && (mediaType === "image" || mediaType === "video")) {
      tweetText = `${content}\n${mediaUrl}`;
    }

    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text: tweetText }),
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
async function publishToLinkedin({ content, mediaUrl, mediaType, accessToken }: PublishParams): Promise<PublishResult> {
  try {
    // Get user profile URN
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const personUrn = `urn:li:person:${profile.sub}`;

    // Image post: register upload, upload binary, then create post with media
    if (mediaType === "image" && mediaUrl) {
      // Step 1: Register upload
      const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: personUrn,
            serviceRelationships: [
              { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
            ],
          },
        }),
      });
      const registerData = await registerRes.json();
      const uploadUrl =
        registerData.value?.uploadMechanism?.[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ]?.uploadUrl;
      const asset = registerData.value?.asset;

      if (uploadUrl && asset) {
        // Step 2: Download image and upload to LinkedIn
        const imageRes = await fetch(mediaUrl);
        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: imageBuffer,
        });

        // Step 3: Create post with media
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
                shareMediaCategory: "IMAGE",
                media: [
                  {
                    status: "READY",
                    description: { text: content.slice(0, 200) },
                    media: asset,
                  },
                ],
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
      }
      return { success: false, error: "Failed to register LinkedIn image upload" };
    }

    // Video post: register upload, upload binary, then create post
    if (mediaType === "video" && mediaUrl) {
      // Step 1: Register upload for video
      const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
            owner: personUrn,
            serviceRelationships: [
              { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
            ],
          },
        }),
      });
      const registerData = await registerRes.json();
      const uploadUrl =
        registerData.value?.uploadMechanism?.[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ]?.uploadUrl;
      const asset = registerData.value?.asset;

      if (uploadUrl && asset) {
        // Step 2: Download video and upload to LinkedIn
        const videoRes = await fetch(mediaUrl);
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: videoBuffer,
        });

        // Step 3: Create post with video
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
                shareMediaCategory: "VIDEO",
                media: [
                  {
                    status: "READY",
                    description: { text: content.slice(0, 200) },
                    media: asset,
                  },
                ],
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
      }
      return { success: false, error: "Failed to register LinkedIn video upload" };
    }

    // Article post: share a URL with commentary
    if (mediaType === "carousel" && mediaUrl) {
      // LinkedIn doesn't support true carousels via API — fall back to article share
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
              shareMediaCategory: "ARTICLE",
              media: [
                {
                  status: "READY",
                  originalUrl: mediaUrl,
                  description: { text: content.slice(0, 200) },
                },
              ],
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
    }

    // Default: text post
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
