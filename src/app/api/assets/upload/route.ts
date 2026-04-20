// POST /api/assets/upload
// Accepts multipart form: file + metadata. Uploads to GCS, creates Asset row,
// enqueues embedding (non-blocking).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as gcs from "@/lib/storage/gcs";
import { z } from "zod";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const metadataSchema = z.object({
  kind: z.enum(["VIDEO_FINAL", "VIDEO_VARIANT", "VIDEO_CLIP", "IMAGE_POSTER", "IMAGE_STILL", "AUDIO_NARRATION", "AUDIO_TRACK", "POEM_TEXT", "CAPTION_TEXT"]),
  projectId: z.string().optional(),
  episode: z.number().int().optional(),
  title: z.string().optional(),
  archetype: z.string().optional(),
  mode: z.string().optional(),
  durationSec: z.number().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  bpm: z.number().optional(),
  poemText: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!gcs.isConfigured()) {
    return NextResponse.json({ error: "GCS not configured: set GCP_PROJECT_ID + GCS_BUCKET" }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const metaRaw = form.get("metadata");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file (multipart) is required" }, { status: 400 });
  }
  if (typeof metaRaw !== "string") {
    return NextResponse.json({ error: "metadata (JSON string) is required" }, { status: 400 });
  }

  let meta: z.infer<typeof metadataSchema>;
  try {
    meta = metadataSchema.parse(JSON.parse(metaRaw));
  } catch (err) {
    return NextResponse.json({ error: "Invalid metadata", details: String(err) }, { status: 400 });
  }

  // Write the upload to a temp file so GCS resumable upload works.
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "limerence-"));
  const tmpPath = path.join(tmpDir, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);

  try {
    const projectId = meta.projectId ?? `u_${session.user.id}`;
    const kindForPath =
      meta.kind === "VIDEO_FINAL" ? "final" :
      meta.kind === "IMAGE_POSTER" ? "poster" :
      meta.kind === "AUDIO_NARRATION" ? "narration" :
      meta.kind === "AUDIO_TRACK" ? "track" :
      meta.kind === "VIDEO_VARIANT" ? "variant" : "asset";

    const dest = gcs.projectPath({
      projectId,
      episode: meta.episode ?? null,
      kind: kindForPath,
      filename: file.name,
    });
    const ref = await gcs.uploadFile(tmpPath, dest, {
      metadata: { kind: meta.kind, title: meta.title ?? "" },
    });

    const asset = await db.asset.create({
      data: {
        userId: session.user.id,
        kind: meta.kind,
        projectId: meta.projectId,
        episode: meta.episode,
        title: meta.title,
        archetype: meta.archetype,
        mode: meta.mode,
        gcsUri: ref.gcsUri,
        durationSec: meta.durationSec,
        width: meta.width,
        height: meta.height,
        bpm: meta.bpm,
        poemText: meta.poemText,
        metadata: {},
        pineconeIds: [],
      },
    });

    // Fire-and-forget embed enqueue via header marker — cron drains assets with embeddedAt=null.
    return NextResponse.json({ asset, gcsUri: ref.gcsUri });
  } catch (err) {
    console.error("[assets/upload] failed", err);
    return NextResponse.json({ error: "Upload failed", details: String(err) }, { status: 500 });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
