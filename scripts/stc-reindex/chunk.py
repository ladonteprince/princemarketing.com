"""
Faithful heading-aware chunker for Save the Cat! using the clean JSON parse.

Source: /Users/black/Downloads/Save-the-Cat-by-Blake-Snyder.json
  Structured per-page items with types: header (page running head), heading
  (## / ###), text, list, image, footer. We keep text / heading / list.

Design:
  - Chunks never summarize — text is verbatim from the parsed markdown.
  - A chunk carries the heading hierarchy in force at its start:
    chapter / section (nearest H1-or-H2) / subsection (nearest H3).
  - A new chunk starts when we hit a section-level heading OR the running
    chunk exceeds TARGET_CHARS.
  - Small trailing paragraphs are folded forward unless they'd push the
    chunk above MAX_CHARS.

Output: out/chunks.jsonl
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Optional

from structure import CHAPTERS, ChapterSpan


ROOT = Path(__file__).parent
JSON_PATH = Path("/Users/black/Downloads/Save-the-Cat-by-Blake-Snyder.json")
CHUNKS_PATH = ROOT / "out" / "chunks.jsonl"

BOOK_TITLE = "Save the Cat!"
BOOK_AUTHOR = "Blake Snyder"
BOOK_YEAR = 2005

# text-embedding-3-large limit is 8191 tokens; we target well under.
TARGET_TOKENS = 700
MAX_TOKENS = 900
MIN_TOKENS = 120
CHARS_PER_TOKEN = 4.0
TARGET_CHARS = int(TARGET_TOKENS * CHARS_PER_TOKEN)
MAX_CHARS = int(MAX_TOKENS * CHARS_PER_TOKEN)
MIN_CHARS = int(MIN_TOKENS * CHARS_PER_TOKEN)


# ---------------------------------------------------------------------------
# Markdown helpers — we strip structural markdown so the stored text reads
# naturally and cross-platform embedders don't weight the "**" and "*" chars.
# ---------------------------------------------------------------------------
_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_ITALIC = re.compile(r"\*([^*]+)\*")
_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")


def normalize_md(s: str) -> str:
    s = _IMAGE.sub("", s)
    s = _LINK.sub(r"\1", s)
    s = _BOLD.sub(r"\1", s)
    s = _ITALIC.sub(r"\1", s)
    return s.strip()


def heading_level(md: str) -> Optional[int]:
    m = re.match(r"^(#{1,6})\s", md)
    return len(m.group(1)) if m else None


def heading_text(md: str) -> str:
    m = re.match(r"^#{1,6}\s+(.+)", md)
    return normalize_md(m.group(1).strip() if m else md.strip())


@dataclass
class Item:
    page: int
    idx: int
    type: str
    md: str
    text: str  # normalized, ready-to-embed text (empty for images/headers)


def load_items() -> list[Item]:
    with JSON_PATH.open() as f:
        data = json.load(f)
    all_items: list[Item] = []
    for page in data["pages"]:
        pno = page["page_number"]
        for i, raw in enumerate(page["items"]):
            t = raw.get("type", "text")
            md = raw.get("md", "")
            # Skip running page headers/footers — they are layout furniture.
            if t in {"header", "footer", "image"}:
                all_items.append(Item(pno, i, t, md, ""))
                continue
            all_items.append(Item(pno, i, t, md, normalize_md(md)))
    return all_items


def items_for_chapter(ch: ChapterSpan, items: list[Item]) -> list[Item]:
    out: list[Item] = []
    for it in items:
        if it.page < ch.start_page or it.page > ch.end_page:
            continue
        if it.page == ch.start_page and ch.start_item_index is not None and it.idx < ch.start_item_index:
            continue
        if it.page == ch.end_page and ch.end_item_index is not None and it.idx >= ch.end_item_index:
            continue
        out.append(it)
    return out


# ---------------------------------------------------------------------------
# Chunk assembly
# ---------------------------------------------------------------------------
@dataclass
class Chunk:
    id: str
    book_title: str
    book_author: str
    book_year: int
    chapter_slug: str
    chapter_number: int | None
    chapter_title: str
    section_title: str | None
    subsection_title: str | None
    page_start: int
    page_end: int
    chunk_index: int
    text: str
    char_count: int
    approx_tokens: int


def _flush(buf: list[str], pages: list[int]) -> tuple[str, int, int]:
    text = "\n\n".join(s for s in buf if s).strip()
    if pages:
        return text, min(pages), max(pages)
    return text, 0, 0


def chunk_chapter(ch: ChapterSpan, items: list[Item]) -> list[Chunk]:
    chunks: list[Chunk] = []
    buf: list[str] = []
    buf_pages: list[int] = []
    section: Optional[str] = None
    subsection: Optional[str] = None
    chunk_section: Optional[str] = None
    chunk_subsection: Optional[str] = None
    chunk_idx = 0

    def commit():
        nonlocal buf, buf_pages, chunk_section, chunk_subsection, chunk_idx
        text, pstart, pend = _flush(buf, buf_pages)
        if not text or len(text) < 20:
            buf = []
            buf_pages = []
            return
        chunks.append(Chunk(
            id=f"stc_{ch.slug}_{chunk_idx:03d}",
            book_title=BOOK_TITLE,
            book_author=BOOK_AUTHOR,
            book_year=BOOK_YEAR,
            chapter_slug=ch.slug,
            chapter_number=ch.number,
            chapter_title=ch.title,
            section_title=chunk_section,
            subsection_title=chunk_subsection,
            page_start=pstart or ch.start_page,
            page_end=pend or ch.end_page,
            chunk_index=chunk_idx,
            text=text,
            char_count=len(text),
            approx_tokens=int(len(text) / CHARS_PER_TOKEN),
        ))
        chunk_idx += 1
        buf = []
        buf_pages = []

    def running_len() -> int:
        return sum(len(s) for s in buf) + max(0, (len(buf) - 1) * 2)

    for it in items:
        # Track heading state.
        lvl = heading_level(it.md) if it.type in {"heading"} or it.md.startswith("#") else None
        if lvl is not None:
            htext = heading_text(it.md)
            if lvl <= 2:
                # Entering a new major section → flush current chunk first.
                if buf:
                    commit()
                section = htext
                subsection = None
                chunk_section = section
                chunk_subsection = None
                # Do NOT include chapter-level H1 repeats or skeletal H1s that are
                # just book titles / page refs in body text.
                if lvl == 2:
                    buf.append(f"## {htext}")
                    buf_pages.append(it.page)
                continue
            else:  # H3+
                # Softer break: flush only if we already have a sizeable chunk.
                if buf and running_len() >= MIN_CHARS:
                    commit()
                subsection = htext
                chunk_section = section
                chunk_subsection = subsection
                buf.append(f"### {htext}")
                buf_pages.append(it.page)
                continue

        # text / list items.
        if not it.text:
            continue
        # If adding would exceed TARGET and buf is already meaningful, commit.
        if buf and running_len() + len(it.text) > TARGET_CHARS and running_len() >= MIN_CHARS:
            commit()
            # Carry the heading state into the new chunk.
            chunk_section = section
            chunk_subsection = subsection

        buf.append(it.text)
        buf_pages.append(it.page)

        # Hard cap — in the (rare) case a single item balloons the chunk.
        if running_len() > MAX_CHARS:
            commit()
            chunk_section = section
            chunk_subsection = subsection

    if buf:
        commit()

    return chunks


def main() -> None:
    items = load_items()
    print(f"Loaded {len(items)} structured items from {JSON_PATH.name}")

    all_chunks: list[Chunk] = []
    for ch in CHAPTERS:
        ch_items = items_for_chapter(ch, items)
        chunks = chunk_chapter(ch, ch_items)
        mean = int(sum(c.approx_tokens for c in chunks) / max(len(chunks), 1)) if chunks else 0
        sections = sorted({c.section_title for c in chunks if c.section_title})
        print(f"{ch.slug:>36}  p{ch.start_page:>3}-{ch.end_page:<3}  "
              f"items={len(ch_items):>3}  chunks={len(chunks):>2}  "
              f"mean_tokens={mean:>3}  sections={len(sections)}")
        all_chunks.extend(chunks)

    CHUNKS_PATH.parent.mkdir(exist_ok=True)
    with CHUNKS_PATH.open("w") as f:
        for c in all_chunks:
            f.write(json.dumps(asdict(c)) + "\n")
    total_chars = sum(c.char_count for c in all_chunks)
    print(f"\nWrote {len(all_chunks)} chunks -> {CHUNKS_PATH}")
    print(f"Total text indexed: {total_chars:,} chars (~{int(total_chars / CHARS_PER_TOKEN):,} tokens)")


if __name__ == "__main__":
    main()
