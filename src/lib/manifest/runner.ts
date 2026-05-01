// Manifest runner — ingests a {project}/10_delivery/manifest.json, uploads assets
// to GCS, creates Asset rows, enqueues embedding, and calls the scheduler/publisher.
//
// Depends on: lib/storage/gcs, lib/social/publish, lib/db, lib/manifest/contract.

import * as fs from "node:fs";
import * as path from "node:path";

import { db } from "@/lib/db";
import { parseManifest, type Manifest } from "./contract";
import * as gcs from "@/lib/storage/gcs";
import { publishToplatform } from "@/lib/social/publish";
import type { PlatformKey } from "@/lib/social/platforms";

export type RunOptions = {
  userId: string;
  projectFolder: string; // absolute path to the project root (parent of 10_delivery/)
  dryRun?: boolean;      // when true: upload, create DB rows, but do NOT publish
  forceMode?: "smart" | "now" | "specific";
};

export type RunResult = {
  manifest: Manifest;
  assetId: string;
  variantIds: string[];
  calendarEntryIds: string[];
  uploadedUris: string[];
  snapchatManualExportPath?: string;
  errors: Array<{ platform: string; message: string }>;
};

/** Load + parse manifest.json. Throws on missing or invalid. */
export function loadManifest(projectFolder: string): Manifest {
  const manifestPath = path.join(projectFolder, "10_delivery", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found at ${manifestPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return parseManifest(raw);
}

function resolveProjectPath(projectFolder: string, relOrAbs: string): string {
  return path.isAbsolute(relOrAbs) ? relOrAbs : path.join(projectFolder, relOrAbs);
}

function epSeg(episode: number | null | undefined): string {
  return episode != null ? `${episode}` : "solo";
}

/**
 * Upload every asset referenced in the manifest to GCS.
 * Returns the GCS URIs indexed by logical role.
 */
export async function uploadManifestAssets(
  projectFolder: string,
  manifest: Manifest,
): Promise<{
  final: gcs.GcsObjectRef;
  poster?: gcs.GcsObjectRef;
  narration?: gcs.GcsObjectRef;
  track?: gcs.GcsObjectRef;
  variants: Array<{ aspectRatio: string; ref: gcs.GcsObjectRef; durationSec?: number; coverFrameSec?: number }>;
}> {
  const projectId = manifest.projectId;
  const ep = manifest.episode ?? null;

  const finalLocal = resolveProjectPath(projectFolder, manifest.assets.final);
  const final = await gcs.uploadFile(
    finalLocal,
    gcs.projectPath({ projectId, episode: ep, kind: "final", filename: path.basename(finalLocal) }),
    { metadata: { projectId, episode: String(ep), kind: "final" } },
  );

  let poster: gcs.GcsObjectRef | undefined;
  if (manifest.assets.poster) {
    const p = resolveProjectPath(projectFolder, manifest.assets.poster);
    if (fs.existsSync(p)) {
      poster = await gcs.uploadFile(
        p,
        gcs.projectPath({ projectId, episode: ep, kind: "poster", filename: path.basename(p) }),
      );
    }
  }

  let narration: gcs.GcsObjectRef | undefined;
  if (manifest.assets.narration) {
    const n = resolveProjectPath(projectFolder, manifest.assets.narration);
    if (fs.existsSync(n)) {
      narration = await gcs.uploadFile(
        n,
        gcs.projectPath({ projectId, episode: ep, kind: "narration", filename: path.basename(n) }),
      );
    }
  }

  let track: gcs.GcsObjectRef | undefined;
  if (manifest.track?.path) {
    const t = resolveProjectPath(projectFolder, manifest.track.path);
    if (fs.existsSync(t)) {
      track = await gcs.uploadFile(
        t,
        gcs.projectPath({ projectId, episode: ep, kind: "track", filename: path.basename(t) }),
      );
    }
  }

  const variants: Array<{ aspectRatio: string; ref: gcs.GcsObjectRef; durationSec?: number; coverFrameSec?: number }> = [];
  for (const v of manifest.assets.variants ?? []) {
    const localV = resolveProjectPath(projectFolder, v.path);
    if (!fs.existsSync(localV)) {
      console.warn(`[manifest] variant missing on disk: ${localV}`);
      continue;
    }
    const ref = await gcs.uploadFile(
      localV,
      gcs.projectPath({ projectId, episode: ep, kind: "variant", filename: `${v.aspectRatio.replace(":", "x")}-${path.basename(localV)}` }),
      { metadata: { aspectRatio: v.aspectRatio } },
    );
    variants.push({ aspectRatio: v.aspectRatio, ref, durationSec: v.durationSec, coverFrameSec: v.coverFrameSec });
  }

  return { final, poster, narration, track, variants };
}

/**
 * Persist the uploaded manifest into DB rows (Asset, AssetVariant, Track).
 * Returns the primary asset id + variant ids for downstream scheduling.
 */
export async function persistManifest(
  userId: string,
  manifest: Manifest,
  uploads: Awaited<ReturnType<typeof uploadManifestAssets>>,
): Promise<{ assetId: string; variantIds: string[]; trackId?: string }> {
  let trackId: string | undefined;
  if (uploads.track && manifest.track) {
    const track = await db.track.create({
      data: {
        userId,
        gcsUri: uploads.track.gcsUri,
        bpm: manifest.track.bpm,
        musicalKey: manifest.track.key,
        peakAt: manifest.track.peakAt ?? [],
        durationSec: manifest.track.durationSec ?? 0,
        licensed: true, // user's own project track — they already handled rights upstream
      },
    });
    trackId = track.id;
  }

  const asset = await db.asset.create({
    data: {
      userId,
      kind: "VIDEO_FINAL",
      projectId: manifest.projectId,
      episode: manifest.episode,
      title: manifest.title,
      archetype: manifest.archetype,
      mode: manifest.archetypeMode,
      gcsUri: uploads.final.gcsUri,
      durationSec: manifest.metadata?.duration,
      bpm: manifest.track?.bpm,
      trackId,
      poemText: manifest.assets.poemText,
      metadata: {
        bibleRef: manifest.bibleRef,
        moments: manifest.moments ?? [],
        tools: manifest.metadata?.tools ?? [],
        posterUri: uploads.poster?.gcsUri,
        narrationUri: uploads.narration?.gcsUri,
      } as object,
      pineconeIds: [],
    },
  });

  const variantIds: string[] = [];
  for (const v of uploads.variants) {
    const variant = await db.assetVariant.create({
      data: {
        assetId: asset.id,
        aspectRatio: v.aspectRatio,
        gcsUri: v.ref.gcsUri,
        durationSec: v.durationSec,
        coverFrameSec: v.coverFrameSec,
      },
    });
    variantIds.push(variant.id);
  }

  return { assetId: asset.id, variantIds, trackId };
}

/**
 * Pick the best variant for a target platform/placement.
 */
export async function variantForPlatform(
  assetId: string,
  platform: PlatformKey,
): Promise<{ id: string; aspectRatio: string; gcsUri: string } | null> {
  const variants = await db.assetVariant.findMany({ where: { assetId } });
  if (variants.length === 0) return null;
  const preferByPlatform: Record<string, string[]> = {
    instagram: ["9:16", "4:5", "1:1"],
    tiktok: ["9:16"],
    youtube: ["9:16", "16:9"],
    snapchat: ["9:16"],
    facebook: ["1:1", "4:5"],
    twitter: ["16:9", "1:1"],
    linkedin: ["16:9", "1:1"],
  };
  const preferred = preferByPlatform[platform] ?? ["9:16"];
  for (const ar of preferred) {
    const v = variants.find((x) => x.aspectRatio === ar);
    if (v) return { id: v.id, aspectRatio: v.aspectRatio, gcsUri: v.gcsUri };
  }
  return { id: variants[0].id, aspectRatio: variants[0].aspectRatio, gcsUri: variants[0].gcsUri };
}

// Re-exports consumed by the /post skill script
export { epSeg };
