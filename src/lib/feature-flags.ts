export type FeatureFlag =
  | "multi_platform_publish"    // Publish to 3+ platforms at once
  | "video_generation"          // Access video generation
  | "auto_publish"              // Cron auto-publish
  | "analytics_dashboard"       // Full analytics with platform data
  | "approval_workflow"         // Content approval queue
  | "caption_editor"            // Per-platform caption customization
  | "google_analytics"          // Connect Google Analytics
  | "bulk_scheduling";          // Schedule 30+ posts at once

type Plan = "starter" | "growth" | "scale";

const PLAN_FEATURES: Record<Plan, FeatureFlag[]> = {
  starter: [
    "analytics_dashboard",
  ],
  growth: [
    "analytics_dashboard",
    "multi_platform_publish",
    "video_generation",
    "auto_publish",
    "caption_editor",
  ],
  scale: [
    "analytics_dashboard",
    "multi_platform_publish",
    "video_generation",
    "auto_publish",
    "caption_editor",
    "approval_workflow",
    "google_analytics",
    "bulk_scheduling",
  ],
};

/**
 * Check if a given plan tier has access to a specific feature.
 * Defaults to "starter" if the plan is unrecognized.
 */
export function hasFeature(plan: string, feature: FeatureFlag): boolean {
  const tier = (plan?.toLowerCase() ?? "starter") as Plan;
  return PLAN_FEATURES[tier]?.includes(feature) ?? false;
}

/**
 * Get the full list of features available for a given plan tier.
 * Defaults to starter features if the plan is unrecognized.
 */
export function getAvailableFeatures(plan: string): FeatureFlag[] {
  const tier = (plan?.toLowerCase() ?? "starter") as Plan;
  return PLAN_FEATURES[tier] ?? PLAN_FEATURES.starter;
}

/**
 * Get all plan tiers that include a specific feature.
 * Useful for upgrade prompts — tells the user which plans unlock a feature.
 */
export function getPlansWithFeature(feature: FeatureFlag): Plan[] {
  return (Object.keys(PLAN_FEATURES) as Plan[]).filter((plan) =>
    PLAN_FEATURES[plan].includes(feature),
  );
}
