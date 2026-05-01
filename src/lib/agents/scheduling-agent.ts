// Scheduling agent — picks the best `scheduledAt` per platform per piece of content.
//
// Priority order:
//   1. manifest.schedulingHint.mode === "specific" → use manifest.specificAt as-is
//   2. user-specific heatmap (when Analytics has ≥ MIN_HISTORY samples for the platform)
//   3. cold-start benchmark (below)
//
// Always respects: User.quietHours, daily platform caps, min-spacing between platforms.

import { db } from "@/lib/db";
import type { PlatformType } from "@prisma/client";

const MIN_HISTORY = 10; // min Analytics rows on a platform before we trust the heatmap

type PlatformKeyLower = "instagram" | "tiktok" | "youtube" | "snapchat" | "facebook" | "twitter" | "linkedin";

export type SchedulingHint = {
  mode: "smart" | "now" | "specific";
  specificAt?: string | null;
  minHoursBetweenPlatforms?: number;
  peakHold?: boolean;
};

export type SchedulingRequest = {
  userId: string;
  platforms: PlatformKeyLower[];
  earliestAt?: Date;
  hint?: SchedulingHint;
  timezone?: string; // IANA tz; defaults to America/New_York
  quietHours?: { start: number; end: number }; // local hours, [start, end)
  dailyCaps?: Partial<Record<PlatformKeyLower, number>>;
};

export type PlatformSchedule = {
  platform: PlatformKeyLower;
  scheduledAt: Date;
  rationale: string;
  slot: { hour: number; dayOfWeek: number };
};

const COLD_START: Record<PlatformKeyLower, Array<{ hour: number; dow: number[]; weight: number }>> = {
  instagram: [
    { hour: 11, dow: [2, 3, 5], weight: 1.0 },
    { hour: 14, dow: [2, 3, 5], weight: 0.9 },
    { hour: 20, dow: [2, 3, 5], weight: 1.2 },
    { hour: 21, dow: [2, 3, 5], weight: 1.1 },
  ],
  tiktok: [
    { hour: 7, dow: [2, 4, 5], weight: 1.0 },
    { hour: 9, dow: [2, 4, 5], weight: 1.1 },
    { hour: 19, dow: [2, 4, 5], weight: 1.2 },
    { hour: 22, dow: [2, 4, 5], weight: 1.0 },
  ],
  youtube: [
    { hour: 12, dow: [5, 6, 0], weight: 1.0 },
    { hour: 17, dow: [5, 6, 0], weight: 1.1 },
    { hour: 20, dow: [5, 6, 0], weight: 1.2 },
  ],
  snapchat: [
    { hour: 19, dow: [0, 1, 2, 3, 4, 5, 6], weight: 1.0 },
    { hour: 21, dow: [0, 1, 2, 3, 4, 5, 6], weight: 1.1 },
  ],
  facebook: [
    { hour: 12, dow: [2, 3, 4], weight: 1.0 },
    { hour: 17, dow: [2, 3, 4], weight: 0.9 },
  ],
  twitter: [
    { hour: 9, dow: [2, 3, 4], weight: 1.0 },
    { hour: 13, dow: [2, 3, 4], weight: 1.0 },
    { hour: 17, dow: [2, 3, 4], weight: 0.9 },
  ],
  linkedin: [
    { hour: 9, dow: [2, 3, 4], weight: 1.0 },
    { hour: 12, dow: [2, 3, 4], weight: 1.1 },
  ],
};

const DEFAULT_DAILY_CAPS: Record<PlatformKeyLower, number> = {
  instagram: 3,
  tiktok: 4,
  youtube: 3,
  snapchat: 10,
  facebook: 3,
  twitter: 8,
  linkedin: 2,
};

const DEFAULT_QUIET = { start: 23, end: 7 }; // 11pm–7am local

function mapPlatformEnum(p: PlatformKeyLower): PlatformType {
  return p.toUpperCase() as PlatformType;
}

/** True if hour is inside the (start, end] quiet window (wraps midnight if start > end). */
function inQuietHours(hour: number, q: { start: number; end: number }): boolean {
  if (q.start === q.end) return false;
  if (q.start < q.end) return hour >= q.start && hour < q.end;
  return hour >= q.start || hour < q.end;
}

/**
 * Build a per-user heatmap of engagement-per-post by (dayOfWeek, hour) for a platform.
 * Returns null if history is too thin to trust.
 */
async function userHeatmap(userId: string, platform: PlatformKeyLower) {
  const platformEnum = mapPlatformEnum(platform);
  const rows = await db.calendarEntry.findMany({
    where: {
      userId,
      platform: platformEnum,
      publishedAt: { not: null },
    },
    include: { analytics: true },
    orderBy: { publishedAt: "desc" },
    take: 200,
  });

  const enough = rows.filter((r) => r.analytics.length > 0).length >= MIN_HISTORY;
  if (!enough) return null;

  const cells: Record<string, { total: number; count: number }> = {};
  for (const row of rows) {
    if (!row.publishedAt) continue;
    const stats = row.analytics[0];
    if (!stats) continue;
    const dow = row.publishedAt.getDay();
    const hour = row.publishedAt.getHours();
    const engagement = stats.engagement || 0;
    const impressions = Math.max(stats.impressions || 1, 1);
    const rate = engagement / impressions;
    const key = `${dow}:${hour}`;
    const cell = cells[key] ?? { total: 0, count: 0 };
    cell.total += rate;
    cell.count += 1;
    cells[key] = cell;
  }

  const averaged: Array<{ hour: number; dow: number; weight: number }> = [];
  for (const [key, v] of Object.entries(cells)) {
    const [dow, hour] = key.split(":").map(Number);
    averaged.push({ hour, dow, weight: v.total / v.count });
  }
  return averaged.sort((a, b) => b.weight - a.weight);
}

async function dailyPostCount(userId: string, platform: PlatformKeyLower, day: Date): Promise<number> {
  const platformEnum = mapPlatformEnum(platform);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return db.calendarEntry.count({
    where: {
      userId,
      platform: platformEnum,
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
  });
}

/** Find the next datetime that matches the slot (hour, dayOfWeek) >= earliest. */
function nextSlotAfter(slot: { hour: number; dow: number[] }, earliest: Date): Date {
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(earliest);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(slot.hour, 0, 0, 0);
    if (!slot.dow.includes(candidate.getDay())) continue;
    if (candidate >= earliest) return candidate;
  }
  // Fallback: simply add 1 hour
  const fallback = new Date(earliest);
  fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
  return fallback;
}

/** Core scheduler. Returns one `PlatformSchedule` per requested platform. */
export async function schedule(req: SchedulingRequest): Promise<PlatformSchedule[]> {
  const earliest = req.earliestAt ?? new Date();
  const quiet = req.quietHours ?? DEFAULT_QUIET;
  const minGapHours = req.hint?.minHoursBetweenPlatforms ?? 2;
  const dailyCaps = { ...DEFAULT_DAILY_CAPS, ...(req.dailyCaps ?? {}) };
  const schedules: PlatformSchedule[] = [];

  let cursor = new Date(earliest);

  for (const platform of req.platforms) {
    // 1) specific override
    if (req.hint?.mode === "specific" && req.hint.specificAt) {
      schedules.push({
        platform,
        scheduledAt: new Date(req.hint.specificAt),
        rationale: "User-specified timestamp",
        slot: { hour: new Date(req.hint.specificAt).getHours(), dayOfWeek: new Date(req.hint.specificAt).getDay() },
      });
      continue;
    }

    // 2) now override
    if (req.hint?.mode === "now") {
      schedules.push({
        platform,
        scheduledAt: cursor,
        rationale: "Publish immediately (now mode)",
        slot: { hour: cursor.getHours(), dayOfWeek: cursor.getDay() },
      });
      cursor = new Date(cursor.getTime() + minGapHours * 60 * 60 * 1000);
      continue;
    }

    // 3) smart mode — build candidate slots
    const heatmap = await userHeatmap(req.userId, platform);
    const candidates = heatmap
      ? heatmap.slice(0, 8).map((h) => ({ hour: h.hour, dow: [h.dow], weight: h.weight, source: "user" as const }))
      : COLD_START[platform].map((s) => ({ ...s, source: "cold-start" as const }));

    // Pick first valid slot
    let chosen: PlatformSchedule | null = null;
    const cap = dailyCaps[platform] ?? 3;

    for (const c of candidates) {
      if (inQuietHours(c.hour, quiet)) continue;
      const slotAt = nextSlotAfter({ hour: c.hour, dow: c.dow }, cursor);
      const todaysCount = await dailyPostCount(req.userId, platform, slotAt);
      if (todaysCount >= cap) continue;

      chosen = {
        platform,
        scheduledAt: slotAt,
        rationale:
          c.source === "user"
            ? `User heatmap winner: hour ${c.hour} dow ${c.dow[0]} (engagement rate)`
            : `Cold-start benchmark: hour ${c.hour} for ${platform}`,
        slot: { hour: c.hour, dayOfWeek: slotAt.getDay() },
      };
      break;
    }

    if (!chosen) {
      // Fallback — 2 hours from cursor, skipping quiet hours
      const fallback = new Date(cursor);
      fallback.setHours(fallback.getHours() + 2, 0, 0, 0);
      while (inQuietHours(fallback.getHours(), quiet)) {
        fallback.setHours(fallback.getHours() + 1);
      }
      chosen = {
        platform,
        scheduledAt: fallback,
        rationale: "Fallback: no candidate slot matched daily caps + quiet hours",
        slot: { hour: fallback.getHours(), dayOfWeek: fallback.getDay() },
      };
    }

    schedules.push(chosen);
    cursor = new Date(chosen.scheduledAt.getTime() + minGapHours * 60 * 60 * 1000);
  }

  return schedules;
}
