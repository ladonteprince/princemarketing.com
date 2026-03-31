import { z } from "zod";

export const campaignStatuses = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type CampaignStatus = (typeof campaignStatuses)[number];

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().positive().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
  budget: number | null;
  createdAt: Date;
  updatedAt: Date;
};
