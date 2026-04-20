// Project manifest contract — mirrors ~/.claude/plugins/limerence-system/reference/manifest-contract.md.
// Any pipeline (prince-production or third-party) emits {project}/10_delivery/manifest.json
// conforming to this schema. Limerence System reads it to publish + schedule.

import { z } from "zod";

export const AspectRatio = z.enum(["9:16", "1:1", "4:5", "16:9"]);

export const PlatformKey = z.enum(["instagram", "tiktok", "youtube", "snapchat", "facebook", "twitter", "linkedin"]);

export const ManifestAssetVariant = z.object({
  aspectRatio: AspectRatio,
  path: z.string(),
  durationSec: z.number().optional(),
  gradedFor: z.string().optional(),
  coverFrameSec: z.number().optional(),
});

export const ManifestCaptionEntry = z.union([
  z.object({
    caption: z.string(),
    hashtags: z.array(z.string()).optional(),
    placement: z.string().optional(),
    coverFrameSec: z.number().optional(),
    manualMode: z.boolean().optional(),
  }),
  z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).optional(),
    placement: z.string().optional(),
    coverFrameSec: z.number().optional(),
  }),
]);

export const ManifestSchema = z.object({
  version: z.literal("1.0"),
  projectId: z.string(),
  projectName: z.string(),
  episode: z.number().int().optional(),
  title: z.string(),
  archetype: z.string().optional(),
  archetypeMode: z.string().optional(),
  bibleRef: z.string().optional(),
  assets: z.object({
    final: z.string(),
    poster: z.string().optional(),
    poemText: z.string().optional(),
    narration: z.string().optional(),
    variants: z.array(ManifestAssetVariant).optional(),
  }),
  track: z
    .object({
      path: z.string(),
      bpm: z.number().optional(),
      key: z.string().optional(),
      peakAt: z.array(z.number()).optional(),
      durationSec: z.number().optional(),
    })
    .optional(),
  voice: z
    .object({
      narratorVoiceId: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  captions: z
    .object({
      default: z.string().optional(),
      instagram: ManifestCaptionEntry.optional(),
      tiktok: ManifestCaptionEntry.optional(),
      youtube: ManifestCaptionEntry.optional(),
      snapchat: ManifestCaptionEntry.optional(),
    })
    .optional(),
  targetPlatforms: z.array(PlatformKey).default(["instagram", "tiktok", "youtube", "snapchat"]),
  schedulingHint: z
    .object({
      mode: z.enum(["smart", "now", "specific"]).default("smart"),
      specificAt: z.string().nullable().optional(),
      minHoursBetweenPlatforms: z.number().default(2),
    })
    .optional(),
  bpmBeatGrid: z
    .object({
      bpm: z.number(),
      cutPoints: z.array(z.number()).optional(),
      voiceStart: z.number().optional(),
    })
    .optional(),
  moments: z
    .array(
      z.object({
        tStart: z.number(),
        tEnd: z.number(),
        label: z.string(),
        tier: z.string().optional(),
      }),
    )
    .optional(),
  pinecone: z
    .object({
      indexName: z.string().default("prince-media"),
      namespace: z.string().default("content"),
    })
    .optional(),
  metadata: z
    .object({
      producedAt: z.string().optional(),
      duration: z.number().optional(),
      tools: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export function parseManifest(raw: unknown): Manifest {
  return ManifestSchema.parse(raw);
}
