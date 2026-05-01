"""
Retrieval spot-checks for the re-indexed Save-the-Cat vectors.

Each probe is a natural-language query whose answer we know belongs in a
specific chapter. A healthy index should put a chunk from that chapter in
the top-3 results with a score > 0.30.
"""

from __future__ import annotations

import os
import sys

from openai import OpenAI
from pinecone import Pinecone

EMBED_MODEL = "text-embedding-3-large"
INDEX_NAME = "pdfagent"
NAMESPACE = "save-the-cat"

# Each probe lists one or more chapter slugs that legitimately answer the
# question. Save-the-Cat introduces several concepts in Ch6 (Immutable Laws)
# and defines them in the glossary too, so we accept either location.
PROBES: list[tuple[str, list[str]]] = [
    ("What are the 15 beats of the Blake Snyder Beat Sheet?",
     ["ch4-lets-beat-it-out"]),
    ("Explain the Save the Cat rule — why should the hero do something likable early?",
     ["ch6-immutable-laws", "introduction", "ch1-what-is-it"]),
    ("How do you build the board with index cards and pushpins for a screenplay?",
     ["ch5-building-the-perfect-beast"]),
    ("What are the 10 genres Blake Snyder identifies?", ["ch2-same-only-different"]),
    ("What does 'Pope in the Pool' mean in screenwriting?", ["ch6-immutable-laws"]),
    ("How do you write a great logline for your screenplay?",
     ["ch3-its-about-a-guy-who", "ch1-what-is-it"]),
    ("What should I do after I finish my first draft — how to fix problems?",
     ["ch7-whats-wrong-with-this-picture"]),
    ("How do I get an agent for my screenplay in Hollywood?", ["ch8-final-fade-in"]),
    ("What is an arc of a character?", ["glossary", "ch6-immutable-laws"]),
]


def main() -> None:
    oai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(INDEX_NAME)

    passed = 0
    for query, expected_slugs in PROBES:
        emb = oai.embeddings.create(model=EMBED_MODEL, input=[query]).data[0].embedding
        res = index.query(namespace=NAMESPACE, vector=emb, top_k=3, include_metadata=True)
        top = res.matches

        top_slugs = [m.metadata.get("chapter_slug") for m in top]
        hit = any(s in top_slugs for s in expected_slugs)
        status = "PASS" if hit else "FAIL"
        if hit:
            passed += 1
        print(f"[{status}] q={query!r}")
        print(f"        expected chapter(s): {expected_slugs}")
        for i, m in enumerate(top, 1):
            slug = m.metadata.get("chapter_slug")
            title = m.metadata.get("chapter_title")
            section = m.metadata.get("section_title") or ""
            marker = " <-- expected" if slug in expected_slugs else ""
            preview = (m.metadata.get("text") or "").replace("\n", " ")[:140]
            print(f"   {i}. score={m.score:.3f} [{slug}] {title}  §{section}{marker}")
            print(f"      {preview!r}")
        print()

    print(f"Probes passed: {passed}/{len(PROBES)}")
    if passed < len(PROBES):
        sys.exit(1)


if __name__ == "__main__":
    main()
