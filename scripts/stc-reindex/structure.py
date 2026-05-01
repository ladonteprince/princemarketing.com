"""
Chapter + sub-section boundaries for Save the Cat! (Blake Snyder, 2005).

Page numbers are 1-indexed physical PDF pages. When a chapter begins or ends
mid-page, we use item-level indexing into the structured JSON parse
(Save-the-Cat-by-Blake-Snyder.json → pages[i]['items'][j]) to pick the exact
boundary — the same image that serves as the chapter cover graphic is the
natural split marker.

- Intro ends mid-p10 before the Ch1 cover image (item index 7).
- Ch4 EXERCISES end mid-p58 before the Ch5 cover image (item index 7).
- Ch7 EXERCISES end mid-p91 before the Ch8 cover image (item index 3).
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ChapterSpan:
    slug: str
    number: Optional[int]                  # None for front/back matter
    title: str
    start_page: int                        # 1-indexed PDF page
    end_page: int                          # inclusive
    start_item_index: Optional[int] = None # include items from this index on start_page
    end_item_index: Optional[int] = None   # exclude items from this index onward on end_page


CHAPTERS: list[ChapterSpan] = [
    ChapterSpan("front-matter",     None, "Front Matter (Praise, Title Page)",        1,  3),
    ChapterSpan("toc",              None, "Table of Contents",                        4,  4),
    ChapterSpan("acknowledgments",  None, "Acknowledgments",                          5,  5),
    ChapterSpan("foreword",         None, "Foreword",                                 6,  6),
    ChapterSpan("introduction",     None, "Introduction",                             7, 10,
                end_item_index=7),
    ChapterSpan("ch1-what-is-it",   1,    "What Is It?",                             10, 19,
                start_item_index=7),
    ChapterSpan("ch2-same-only-different", 2, "Give Me the Same Thing... Only Different!", 20, 32),
    ChapterSpan("ch3-its-about-a-guy-who",  3, "It's About a Guy Who...",                33, 42),
    ChapterSpan("ch4-lets-beat-it-out", 4, "Let's Beat It Out!",                     43, 58,
                end_item_index=7),
    ChapterSpan("ch5-building-the-perfect-beast", 5, "Building the Perfect Beast (The Board)",
                58, 68,
                start_item_index=7),
    ChapterSpan("ch6-immutable-laws",       6, "The Immutable Laws of Screenplay Physics", 69, 80),
    ChapterSpan("ch7-whats-wrong-with-this-picture", 7, "What's Wrong with This Picture?", 81, 91,
                end_item_index=3),
    ChapterSpan("ch8-final-fade-in",        8, "Final Fade In",                         91, 100,
                start_item_index=3),
    ChapterSpan("glossary",         None, "Glossary",                               101, 106),
    ChapterSpan("about-the-author", None, "About the Author",                       107, 108),
]


def chapter_by_slug(slug: str) -> ChapterSpan:
    for c in CHAPTERS:
        if c.slug == slug:
            return c
    raise KeyError(slug)
