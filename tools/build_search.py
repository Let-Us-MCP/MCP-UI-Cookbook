#!/usr/bin/env python3
"""Build the search index from the rendered pages.

Indexed from `docs/*.html` rather than from the Markdown, deliberately. A
large share of what a reader wants to find is generated: capability headers,
the coverage matrix, the gap table, the recipe blocks. None of that exists in
the Markdown, so an index built from the source would silently fail to find
`surface.resize` on the page that defines it.

One entry per section, keyed to the heading anchor the page already carries,
so a result links to the paragraph rather than to the top of a chapter.

    python3 tools/build_search.py
    python3 tools/build_search.py --check   # fail if the index is stale
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
INDEX = OUT / "search-index.json"

# Sections shorter than this carry no answer and only dilute the results.
MIN_WORDS = 6

SKIP_TAGS = {"script", "style", "nav", "svg"}
HEADING = {"h2", "h3"}


class Blocks(HTMLParser):
    """Collect generated entry blocks as searchable units of their own.

    A capability entry renders as `<div class="cap" id="surface.resize">`,
    which is not a heading, so the section splitter folds it into whatever
    prose surrounds it. Somebody searching for the identifier then lands on
    the nearest heading instead of on the entry that defines it. Collected
    separately so the identifier is the entry's own title.
    """

    WANTED = {"cap", "recipe"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.blocks: list[dict] = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag != "div":
            return
        if self.current is not None:
            self.depth += 1
            return
        a = dict(attrs)
        classes = set((a.get("class") or "").split())
        if classes & self.WANTED and a.get("id"):
            self.current = {"anchor": a["id"], "parts": []}
            self.depth = 1

    def handle_endtag(self, tag):
        if tag != "div" or self.current is None:
            return
        self.depth -= 1
        if self.depth:
            return
        text = " ".join(" ".join(self.current["parts"]).split())
        self.blocks.append({"heading": self.current["anchor"],
                            "anchor": self.current["anchor"],
                            "text": text})
        self.current = None

    def handle_data(self, data):
        if self.current is not None:
            self.current["parts"].append(data)


class Sections(HTMLParser):
    """Split one page's <main> into (heading, anchor, text) sections."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_main = 0
        self.skip = 0
        self.sections: list[dict] = []
        self.current = {"heading": "", "anchor": "", "parts": []}
        self.capturing_heading = False
        self.page_title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "main":
            self.in_main += 1
            return
        if tag in SKIP_TAGS:
            self.skip += 1
            return
        if tag == "h1" and self.in_main:
            self.in_title = True
            return
        if tag in HEADING and self.in_main and not self.skip:
            self._flush()
            self.current = {"heading": "", "anchor": a.get("id", ""), "parts": []}
            self.capturing_heading = True

    def handle_endtag(self, tag):
        if tag == "main" and self.in_main:
            self.in_main -= 1
            return
        if tag in SKIP_TAGS and self.skip:
            self.skip -= 1
            return
        if tag == "h1":
            self.in_title = False
            return
        if tag in HEADING:
            self.capturing_heading = False

    def handle_data(self, data):
        if self.skip:
            return
        if self.in_title:
            self.page_title += data
            return
        if not self.in_main:
            return
        if self.capturing_heading:
            self.current["heading"] += data
        else:
            self.current["parts"].append(data)

    def _flush(self):
        text = " ".join(" ".join(self.current["parts"]).split())
        heading = " ".join(self.current["heading"].split())
        if len(text.split()) >= MIN_WORDS or heading:
            self.sections.append({"heading": heading,
                                  "anchor": self.current["anchor"],
                                  "text": text})

    def close(self):
        super().close()
        self._flush()


def build() -> dict:
    pages = sorted(p for p in OUT.glob("*.html"))
    entries = []
    for path in pages:
        raw = path.read_text(encoding="utf-8")
        parser = Sections()
        parser.feed(raw)
        parser.close()
        blocks = Blocks()
        blocks.feed(raw)
        blocks.close()
        title = " ".join(parser.page_title.split()) or path.stem
        for section in parser.sections + blocks.blocks:
            if len(section["text"].split()) < MIN_WORDS:
                continue
            entries.append({
                "p": path.name,
                "t": title,
                "h": section["heading"],
                "a": section["anchor"],
                "x": section["text"],
            })
    return {"built_from": "docs/*.html", "sections": entries}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="fail if the committed index is stale")
    args = ap.parse_args()

    if not any(OUT.glob("*.html")):
        print("no rendered pages; run `make site` first")
        return 1

    index = build()
    text = json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n"
    words = sum(len(s["x"].split()) for s in index["sections"])
    size = len(text.encode("utf-8")) / 1024

    before = INDEX.read_text(encoding="utf-8") if INDEX.exists() else None
    if args.check:
        if before != text:
            print(f"  search index is stale; run `make site`")
            return 1
        print(f"{len(index['sections'])} sections indexed, {size:.0f} kB, current")
        return 0

    INDEX.write_text(text, encoding="utf-8")
    print(f"{len(index['sections'])} sections, {words:,} words -> "
          f"{INDEX.relative_to(ROOT)} ({size:.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
