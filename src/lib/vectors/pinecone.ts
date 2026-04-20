// Pinecone client for `prince-media` index (3072-dim, cosine, GCP us-central1).
//
// Namespaces:
//   content   - published video segments + captions
//   archive   - unpublished archive clips
//   inbound   - comments + DMs (for semantic dedup)
//   references - scraped inspiration

import { Pinecone } from "@pinecone-database/pinecone";

const API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX ?? "prince-media";

export type Namespace = "content" | "archive" | "inbound" | "references";

export type VectorRecord = {
  id: string;
  values: number[];
  metadata: {
    userId: string;
    kind: "video_segment" | "text_caption" | "comment" | "dm" | "archive_clip" | "inspiration" | "idea";
    gcsUri?: string;
    assetId?: string;
    projectId?: string;
    episode?: number;
    segStart?: number;
    segEnd?: number;
    platforms?: string[];
    archetype?: string;
    mode?: string;
    publishedAt?: string;
    engagement?: Record<string, number>;
    text?: string; // short preview of associated text
  };
};

let _pc: Pinecone | null = null;
function client(): Pinecone {
  if (_pc) return _pc;
  if (!API_KEY) {
    throw new Error("PINECONE_API_KEY is required");
  }
  _pc = new Pinecone({ apiKey: API_KEY });
  return _pc;
}

function index() {
  return client().index(INDEX_NAME);
}

export async function upsert(namespace: Namespace, records: VectorRecord[]): Promise<void> {
  if (records.length === 0) return;
  await index()
    .namespace(namespace)
    .upsert({
      records: records.map((r) => ({
        id: r.id,
        values: r.values,
        metadata: r.metadata as unknown as Record<string, string | number | boolean | string[]>,
      })),
    } as unknown as Parameters<ReturnType<ReturnType<typeof index>["namespace"]>["upsert"]>[0]);
}

export async function query(params: {
  namespace: Namespace;
  vector: number[];
  topK?: number;
  filter?: Record<string, unknown>;
  includeMetadata?: boolean;
}): Promise<Array<{ id: string; score: number; metadata?: VectorRecord["metadata"] }>> {
  const res = await index()
    .namespace(params.namespace)
    .query({
      vector: params.vector,
      topK: params.topK ?? 10,
      filter: params.filter,
      includeMetadata: params.includeMetadata ?? true,
    });
  return (res.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: m.metadata as unknown as VectorRecord["metadata"] | undefined,
  }));
}

export async function deleteByAssetId(namespace: Namespace, assetId: string): Promise<void> {
  await index().namespace(namespace).deleteMany({ filter: { assetId } });
}

export async function deleteByIds(namespace: Namespace, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await index().namespace(namespace).deleteMany(ids);
}

export function makeVectorId(parts: { assetId?: string; segStart?: number; kind: string; suffix?: string }): string {
  const base = parts.assetId
    ? `${parts.kind}_${parts.assetId}${parts.segStart != null ? `_s${Math.round(parts.segStart)}` : ""}`
    : `${parts.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return parts.suffix ? `${base}_${parts.suffix}` : base;
}
