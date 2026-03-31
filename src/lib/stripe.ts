import Stripe from "stripe";

// WHY: Single Stripe instance for all server-side usage.
// Initialized with the secret key from environment variables.

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

// WHY: Plan definitions matching the landing page pricing tiers.
// These use price_data so no pre-created Stripe Price objects are needed.
export const PLANS = {
  STARTER: {
    name: "Starter",
    priceInCents: 2900,
    interval: "month" as const,
    description: "For solo owners just getting started with consistent marketing.",
  },
  GROWTH: {
    name: "Growth",
    priceInCents: 7900,
    interval: "month" as const,
    description: "For businesses ready to scale their online presence.",
  },
  SCALE: {
    name: "Scale",
    priceInCents: 19900,
    interval: "month" as const,
    description: "For businesses that want a full marketing engine on autopilot.",
  },
} as const;

export type PlanKey = keyof typeof PLANS;
