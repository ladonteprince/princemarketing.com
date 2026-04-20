// POST /api/assets/:id/embed
// Embeds an Asset with Gemini Embedding 2 and upserts to Pinecone.
//
// Videos: segmented into ≤80s windows, one vector per segment.
// Text (POEM_TEXT, CAPTION_TEXT): single vector.
// Namespace: "content" for published assets, "archive" for unpublished.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { embed, segmentBoundaries } from "@/lib/vectors/embed";
import * as pc from "@/lib/vectors/pinecone";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const asset = await db.asset.findFirst({ where: { id, userId: session.user.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const namespace: pc.Namespace = asset.kind === "VIDEO_FINAL" ? "archive" : "archive";

  const vectorIds: string[] = [];
  const records: pc.VectorRecord[] = [];

  try {
    if (asset.kind === "POEM_TEXT" || asset.kind === "CAPTION_TEXT") {
      if (!asset.poemText) {
        return NextResponse.json({ error: "No text to embed" }, { status: 400 });
      }
      const res = await embed({ kind: "text", text: asset.poemText }, { task: "RETRIEVAL_DOCUMENT", title: asset.title ?? undefined });
      const vid = pc.makeVectorId({ assetId: asset.id, kind: "text" });
      records.push({
        id: vid,
        values: res.values,
        metadata: {
          userId: asset.userId,
          kind: "text_caption",
          gcsUri: asset.gcsUri,
          assetId: asset.id,
          projectId: asset.projectId ?? undefined,
          episode: asset.episode ?? undefined,
          archetype: asset.archetype ?? undefined,
          mode: asset.mode ?? undefined,
          text: asset.poemText.slice(0, 256),
        },
      });
      vectorIds.push(vid);
    } else if (asset.kind === "IMAGE_POSTER" || asset.kind === "IMAGE_STILL") {
      const res = await embed({ kind: "image", fileUri: asset.gcsUri }, { task: "RETRIEVAL_DOCUMENT" });
      const vid = pc.makeVectorId({ assetId: asset.id, kind: "image" });
      records.push({
        id: vid,
        values: res.values,
        metadata: {
          userId: asset.userId,
          kind: "archive_clip",
          gcsUri: asset.gcsUri,
          assetId: asset.id,
          projectId: asset.projectId ?? undefined,
          episode: asset.episode ?? undefined,
        },
      });
      vectorIds.push(vid);
    } else {
      // Video (VIDEO_FINAL, VIDEO_VARIANT, VIDEO_CLIP) or Audio — segment if longer than window.
      const dur = asset.durationSec ?? 0;
      const windows = dur > 0 ? segmentBoundaries(dur, 80, 2) : [{ start: 0, end: 80 }];
      for (const w of windows) {
        const res = await embed({ kind: asset.kind.startsWith("AUDIO") ? "audio" : "video", fileUri: asset.gcsUri }, { task: "RETRIEVAL_DOCUMENT" });
        const vid = pc.makeVectorId({ assetId: asset.id, segStart: w.start, kind: "seg" });
        records.push({
          id: vid,
          values: res.values,
          metadata: {
            userId: asset.userId,
            kind: "video_segment",
            gcsUri: asset.gcsUri,
            assetId: asset.id,
            projectId: asset.projectId ?? undefined,
            episode: asset.episode ?? undefined,
            segStart: w.start,
            segEnd: w.end,
            archetype: asset.archetype ?? undefined,
            mode: asset.mode ?? undefined,
          },
        });
        vectorIds.push(vid);
      }
    }

    await pc.upsert(namespace, records);

    await db.asset.update({
      where: { id: asset.id },
      data: {
        pineconeIds: vectorIds,
        embeddedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, assetId: asset.id, vectorCount: vectorIds.length, namespace });
  } catch (err) {
    console.error("[assets/embed] failed", err);
    return NextResponse.json({ error: "Embed failed", details: String(err) }, { status: 500 });
  }
}
