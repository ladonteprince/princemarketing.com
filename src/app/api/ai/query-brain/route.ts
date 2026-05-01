import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Direct Pinecone query for the engineer pipeline. Each engineer queries
// its own specialty namespace — Storyboard hits cinematography + save-the-cat,
// Score hits music-sound-design + neurochemicals, Voiceover hits spoken-word,
// Video hits cinematography + ladonte-character-refs, etc. Replaces the
// previous proxy-to-.ai pattern that only ever hit production-research.
//
// Embedding: OpenAI text-embedding-3-large (3072d) — matches both
// prince-production-brain and prince-media indexes.

const NAMESPACES = {
  "production-research": {
    index: "prince-production-brain",
    host: "prince-production-brain-ya8e9us.svc.aped-4627-b74a.pinecone.io",
  },
  cinematography: {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  "save-the-cat": {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  neurochemicals: {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  "music-sound-design": {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  "spoken-word": {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  "filmmaking-sop": {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  "ladonte-character-refs": {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
  "limerence-KB": {
    index: "prince-media",
    host: "prince-media-ya8e9us.svc.gcp-us-central1-4a9f.pinecone.io",
  },
} as const;

type NamespaceKey = keyof typeof NAMESPACES;

const schema = z.object({
  query: z.string().min(5).max(500),
  topK: z.number().int().min(1).max(10).optional(),
  namespace: z
    .enum(Object.keys(NAMESPACES) as [NamespaceKey, ...NamespaceKey[]])
    .optional()
    .default("production-research"),
});

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      input: query,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`OpenAI embed failed: ${res.status} — ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

async function pineconeQuery(
  vector: number[],
  namespace: NamespaceKey,
  topK: number,
): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("PINECONE_API_KEY not configured");

  const target = NAMESPACES[namespace];

  const res = await fetch(`https://${target.host}/query`, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": "2024-07",
    },
    body: JSON.stringify({
      vector,
      topK,
      namespace,
      includeMetadata: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(
      `Pinecone query failed (${target.index}/${namespace}): ${res.status} — ${err.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as {
    matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>;
  };
  return (data.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata ?? {},
  }));
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`brain:${email}`, 30);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { query, topK = 5, namespace } = parsed.data;

    const vector = await embedQuery(query);
    const matches = await pineconeQuery(vector, namespace, topK);

    return NextResponse.json({
      namespace,
      index: NAMESPACES[namespace].index,
      query,
      topK,
      matches,
    });
  } catch (err) {
    console.error("[QueryBrain] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Brain query failed",
      },
      { status: 500 },
    );
  }
}
