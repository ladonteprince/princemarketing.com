"""
Embed faithful STC chunks with OpenAI text-embedding-3-large (3072-dim)
and upsert to Pinecone `pdfagent` index under namespace `save-the-cat`.

Re-runnable: purges the namespace at the top before upserting.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from openai import OpenAI
from pinecone import Pinecone


ROOT = Path(__file__).parent
CHUNKS_PATH = ROOT / "out" / "chunks.jsonl"
EMBED_MODEL = "text-embedding-3-large"   # 3072-dim, matches pdfagent index
INDEX_NAME = "pdfagent"
NAMESPACE = "save-the-cat"
EMBED_BATCH = 96        # OpenAI batch size
UPSERT_BATCH = 100      # Pinecone upsert batch size

# Pinecone metadata must be str | number | bool | list[str] — no None, no nested.
def sanitize_metadata(c: dict) -> dict:
    md = {
        "book_title": c["book_title"],
        "book_author": c["book_author"],
        "book_year": c["book_year"],
        "chapter_slug": c["chapter_slug"],
        "chapter_title": c["chapter_title"],
        "page_start": c["page_start"],
        "page_end": c["page_end"],
        "chunk_index": c["chunk_index"],
        "char_count": c["char_count"],
        "approx_tokens": c["approx_tokens"],
        "text": c["text"],  # keep full verbatim text in metadata so retrieval
                            # returns the passage without a second lookup
    }
    if c.get("chapter_number") is not None:
        md["chapter_number"] = c["chapter_number"]
    if c.get("section_title"):
        md["section_title"] = c["section_title"]
    if c.get("subsection_title"):
        md["subsection_title"] = c["subsection_title"]
    return md


def load_chunks() -> list[dict]:
    with CHUNKS_PATH.open() as f:
        return [json.loads(line) for line in f]


def main() -> None:
    openai_key = os.environ.get("OPENAI_API_KEY")
    pc_key = os.environ.get("PINECONE_API_KEY")
    if not openai_key:
        sys.exit("OPENAI_API_KEY not set")
    if not pc_key:
        sys.exit("PINECONE_API_KEY not set")

    oai = OpenAI(api_key=openai_key)
    pc = Pinecone(api_key=pc_key)
    index = pc.Index(INDEX_NAME)

    chunks = load_chunks()
    print(f"Loaded {len(chunks)} chunks from {CHUNKS_PATH}")

    stats = index.describe_index_stats()
    dim = stats.get("dimension")
    if dim != 3072:
        sys.exit(f"Expected 3072-dim index, got {dim}. Aborting to avoid schema mismatch.")

    existing = stats.get("namespaces", {}).get(NAMESPACE, {}).get("vector_count", 0)
    if existing:
        print(f"Purging {existing} existing vectors in namespace {NAMESPACE!r}...")
        index.delete(delete_all=True, namespace=NAMESPACE)
        time.sleep(2)  # give Pinecone a moment to propagate the delete

    # ---- Embed in batches --------------------------------------------------
    print(f"Embedding {len(chunks)} chunks with {EMBED_MODEL}...")
    vectors: list[dict] = []
    for i in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[i : i + EMBED_BATCH]
        inputs = [c["text"] for c in batch]
        # Retry with backoff for transient API errors.
        attempt = 0
        while True:
            try:
                resp = oai.embeddings.create(model=EMBED_MODEL, input=inputs)
                break
            except Exception as e:
                attempt += 1
                if attempt > 5:
                    raise
                delay = 2 ** attempt
                print(f"  retry {attempt} after error: {e} (sleeping {delay}s)")
                time.sleep(delay)

        for c, row in zip(batch, resp.data):
            vectors.append({
                "id": c["id"],
                "values": row.embedding,
                "metadata": sanitize_metadata(c),
            })
        print(f"  embedded {i + len(batch)}/{len(chunks)}")

    # ---- Upsert to Pinecone ------------------------------------------------
    print(f"Upserting {len(vectors)} vectors to {INDEX_NAME}[{NAMESPACE}]...")
    for i in range(0, len(vectors), UPSERT_BATCH):
        batch = vectors[i : i + UPSERT_BATCH]
        index.upsert(vectors=batch, namespace=NAMESPACE)
        print(f"  upserted {i + len(batch)}/{len(vectors)}")

    # ---- Verify ------------------------------------------------------------
    time.sleep(3)
    stats = index.describe_index_stats()
    ns_count = stats.get("namespaces", {}).get(NAMESPACE, {}).get("vector_count", 0)
    print(f"\nDone. namespace={NAMESPACE!r} now has {ns_count} vectors.")


if __name__ == "__main__":
    main()
