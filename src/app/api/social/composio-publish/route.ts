import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeComposioAction } from "@/lib/composio";
import { z } from "zod";

// WHY: Unified publish route that maps platform + type → Composio action.
// This replaces hand-built per-platform publish logic with Composio's 43+ tools.

const schema = z.object({
  platform: z.enum([
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "tiktok",
    "youtube",
  ]),
  type: z.enum(["text", "photo", "video"]),
  content: z.string().max(10000),
  mediaUrl: z.string().url().optional(),
  pageId: z.string().optional(),
  title: z.string().max(200).optional(),
  scheduled: z.number().optional(), // Unix timestamp
});

// Map platform + post type → Composio action slug
const PLATFORM_ACTIONS: Record<string, Record<string, string>> = {
  facebook: {
    text: "FACEBOOK_CREATE_POST",
    photo: "FACEBOOK_CREATE_PHOTO_POST",
    video: "FACEBOOK_CREATE_VIDEO_POST",
  },
  instagram: {
    photo: "INSTAGRAM_CREATE_MEDIA_POST",
    video: "INSTAGRAM_CREATE_VIDEO_POST",
  },
  twitter: {
    text: "TWITTER_CREATE_TWEET",
    photo: "TWITTER_CREATE_TWEET_WITH_MEDIA",
  },
  linkedin: {
    text: "LINKEDIN_CREATE_TEXT_POST",
    photo: "LINKEDIN_CREATE_IMAGE_POST",
  },
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { platform, type, content, mediaUrl, pageId, title, scheduled } =
    parsed.data;

  const actionSlug = PLATFORM_ACTIONS[platform]?.[type];
  if (!actionSlug) {
    return NextResponse.json(
      {
        error: `${type} posts not yet supported for ${platform} via Composio`,
      },
      { status: 400 },
    );
  }

  // Build params based on platform + type
  const params: Record<string, unknown> = {};

  if (platform === "facebook") {
    if (pageId) params.page_id = pageId;

    if (type === "text") {
      params.message = content;
      if (scheduled) {
        params.published = false;
        params.scheduled_publish_time = scheduled;
      }
    } else if (type === "photo") {
      params.message = content;
      params.url = mediaUrl;
      if (scheduled) {
        params.published = false;
        params.scheduled_publish_time = scheduled;
      }
    } else if (type === "video") {
      params.description = content;
      params.title = title || content.slice(0, 100);
      params.file_url = mediaUrl;
      if (scheduled) {
        params.published = false;
        params.scheduled_publish_time = scheduled;
      }
    }
  } else if (platform === "twitter") {
    params.text = content;
    if (mediaUrl) params.media_url = mediaUrl;
  } else if (platform === "instagram") {
    params.caption = content;
    if (mediaUrl) params.image_url = mediaUrl;
  } else if (platform === "linkedin") {
    params.text = content;
    if (mediaUrl) params.image_url = mediaUrl;
  }

  const result = await executeComposioAction(actionSlug, params);

  return NextResponse.json(result);
}
