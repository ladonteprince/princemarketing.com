import { z } from "zod";
import type { UserId } from "./ids";

export const subscriptionTiers = ["STARTER", "GROWTH", "SCALE"] as const;
export type SubscriptionTier = (typeof subscriptionTiers)[number];

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export type User = {
  id: UserId;
  email: string;
  name: string | null;
  businessName: string | null;
  businessType: string | null;
  industry: string | null;
  tier: SubscriptionTier;
  onboarded: boolean;
  createdAt: Date;
};

export type SessionUser = Pick<User, "id" | "email" | "name" | "tier">;
