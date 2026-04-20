// POST /api/social/schedule-smart
// Takes an Asset + target platforms + scheduling hint, creates CalendarEntry rows
// at algorithmically-chosen timestamps. The existing /api/cron/publish drains them.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { schedule, type PlatformSchedule } from "@/lib/agents/scheduling-agent";
import { variantForPlatform } from "@/lib/manifest/runner";
import type { PlatformType } from "@prisma/client";

const PlatformEnum = z.enum(["instagram", "tiktok", "youtube", "snapchat", "facebook", "twitter", "linkedin"]);
type PlatformKeyLower = z.infer<typeof PlatformEnum>;

const bodySchema = z.object({
  assetId: z.string(),
  platforms: z.array(PlatformEnum).min(1),
  hint: z
    .object({
      mode: z.enum(["smart", "now", "specific"]).default("smart"),
      specificAt: z.string().nullable().optional(),
      minHoursBetweenPlatforms: z.number().default(2),
    })
    .optional(),
  captions: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { assetId, platforms, hint, captions, campaignId } = parsed.data;

  const userId = session.user.id;
  const asset = await db.asset.findFirst({
    where: { id: assetId, userId },
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const scheduleResults = await schedule({
    userId,
    platforms,
    hint,
    timezone: "America/New_York", // TODO: read from User.timezone when we add it
  });

  const entries = await Promise.all(
    scheduleResults.map(async (s: PlatformSchedule) => {
      // variantForPlatform expects the PlatformKey (used by publish.ts); snapchat uses same resolution rules
      const variant = await variantForPlatform(
        assetId,
        (s.platform === "snapchat" ? "instagram" : s.platform) as Parameters<typeof variantForPlatform>[1],
      );
      const platformEnum = s.platform.toUpperCase() as PlatformType;
      const per = (captions?.[s.platform] as Record<string, unknown> | undefined) ?? undefined;
      const content =
        (per?.caption as string | undefined) ??
        (per?.description as string | undefined) ??
        asset.poemText ??
        asset.title ??
        "";
      const title = (per?.title as string | undefined) ?? asset.title ?? "Untitled";

      return db.calendarEntry.create({
        data: {
          userId,
          campaignId,
          platform: platformEnum,
          platforms: [platformEnum],
          placement:
            s.platform === "instagram" ? "REEL" :
            s.platform === "tiktok" ? "SHORT" :
            s.platform === "youtube" ? "SHORT" :
            s.platform === "snapchat" ? "SPOTLIGHT" : "FEED",
          title,
          content,
          perPlatform: captions as object | undefined,
          mediaUrl: variant?.gcsUri ?? asset.gcsUri,
          assetId,
          variantId: variant?.id,
          trackId: asset.trackId ?? undefined,
          scheduledAt: s.scheduledAt,
          status: hint?.mode === "now" ? "PUBLISHED" : "SCHEDULED",
          source: "manifest",
        },
      });
    }),
  );

  return NextResponse.json({
    scheduled: entries.map((e, i) => ({
      calendarEntryId: e.id,
      platform: scheduleResults[i].platform,
      scheduledAt: scheduleResults[i].scheduledAt,
      rationale: scheduleResults[i].rationale,
    })),
  });
}
