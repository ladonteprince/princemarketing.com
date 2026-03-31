import { z } from "zod";

export const platformTypes = [
  "INSTAGRAM",
  "FACEBOOK",
  "TWITTER",
  "LINKEDIN",
  "TIKTOK",
  "YOUTUBE",
] as const;
export type PlatformType = (typeof platformTypes)[number];

export const contentStatuses = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const createEntrySchema = z.object({
  platform: z.enum(platformTypes),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  scheduledAt: z.string().datetime(),
  campaignId: z.string().optional(),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export type CalendarEntry = {
  id: string;
  platform: PlatformType;
  title: string;
  content: string;
  mediaUrl: string | null;
  scheduledAt: Date;
  publishedAt: Date | null;
  status: ContentStatus;
  createdAt: Date;
};

// Status color mapping for the calendar UI
export const STATUS_COLORS = {
  DRAFT: "text-ash",
  SCHEDULED: "text-royal",
  PUBLISHED: "text-emerald-400",
  FAILED: "text-red-400",
} as const satisfies Record<ContentStatus, string>;
