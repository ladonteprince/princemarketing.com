// Google Cloud Storage client for Limerence media bucket.
// Reads GCP_PROJECT_ID, GCS_BUCKET, GOOGLE_APPLICATION_CREDENTIALS from env.

import { Storage, type UploadOptions } from "@google-cloud/storage";
import * as fs from "node:fs";
import * as path from "node:path";

const BUCKET = process.env.GCS_BUCKET ?? "limerance-ladonte";
const PROJECT_ID = process.env.GCP_PROJECT_ID;

let _storage: Storage | null = null;
function storage() {
  if (!_storage) {
    _storage = new Storage({ projectId: PROJECT_ID });
  }
  return _storage;
}

export type GcsObjectRef = {
  gcsUri: string;
  bucket: string;
  name: string;
};

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
};

function mimeFor(filePath: string): string {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Upload a local file to gs://{bucket}/{destPath}.
 * Returns the canonical gs:// URI.
 */
export async function uploadFile(
  localPath: string,
  destPath: string,
  opts: { cacheControl?: string; metadata?: Record<string, string> } = {},
): Promise<GcsObjectRef> {
  if (!fs.existsSync(localPath)) {
    throw new Error(`uploadFile: file does not exist: ${localPath}`);
  }
  const bucket = storage().bucket(BUCKET);
  const uploadOpts: UploadOptions = {
    destination: destPath,
    resumable: true,
    metadata: {
      contentType: mimeFor(localPath),
      cacheControl: opts.cacheControl ?? "public, max-age=3600",
      metadata: opts.metadata,
    },
  };
  await bucket.upload(localPath, uploadOpts);
  return {
    gcsUri: `gs://${BUCKET}/${destPath}`,
    bucket: BUCKET,
    name: destPath,
  };
}

/** Write in-memory bytes or string to a GCS path. */
export async function uploadBuffer(
  data: Buffer | string,
  destPath: string,
  contentType: string,
): Promise<GcsObjectRef> {
  const bucket = storage().bucket(BUCKET);
  const file = bucket.file(destPath);
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  await file.save(buf, {
    resumable: false,
    metadata: { contentType, cacheControl: "public, max-age=3600" },
  });
  return { gcsUri: `gs://${BUCKET}/${destPath}`, bucket: BUCKET, name: destPath };
}

/** Generate a V4 signed URL that a platform API can fetch within the TTL. */
export async function signedUrl(destPath: string, ttlMinutes = 60 * 24 * 7): Promise<string> {
  const [url] = await storage()
    .bucket(BUCKET)
    .file(destPath)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + ttlMinutes * 60 * 1000,
    });
  return url;
}

/** Delete a GCS object. Use sparingly — most content should be retained. */
export async function deleteObject(destPath: string): Promise<void> {
  await storage().bucket(BUCKET).file(destPath).delete({ ignoreNotFound: true });
}

/**
 * Build a canonical destination path for a project Asset.
 * Example: projects/{projectId}/episodes/1/final.mp4
 */
export function projectPath(parts: {
  projectId: string;
  episode?: number | null;
  kind: "final" | "poster" | "narration" | "variant" | "track" | "asset";
  filename: string;
}): string {
  const { projectId, episode, kind, filename } = parts;
  if (kind === "asset") {
    return `projects/${projectId}/assets/${filename}`;
  }
  const epSeg = episode != null ? `episodes/${episode}/` : "";
  const kindSeg =
    kind === "variant" ? "variants/" :
    kind === "track" ? "tracks/" :
    kind === "narration" ? "narration/" :
    kind === "poster" ? "poster/" : "";
  return `projects/${projectId}/${epSeg}${kindSeg}${filename}`;
}

export function inboundPath(platform: string, externalId: string, ext: string): string {
  return `inbound/media/${platform.toLowerCase()}/${externalId}${ext.startsWith(".") ? ext : "." + ext}`;
}

export function isConfigured(): boolean {
  return !!(PROJECT_ID && BUCKET);
}
