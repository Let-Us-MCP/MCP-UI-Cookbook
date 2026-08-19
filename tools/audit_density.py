#!/usr/bin/env python3
"""Does a sentence carry anything, or is it prose about the subject?

Sentence length is a proxy and optimising it produces staccato waffle. This
measures the thing that actually matters to a reader who came for an answer:
what proportion of sentences contain something they could act on or be wrong
about.

A sentence counts as concrete when it contains any of:

  - an identifier in backticks (`ui/open-link`, `hostCapabilities`)
  - a number (a size, a count, a timeout, a level)
  - a filename
  - an instruction verb (send, check, never, must, omit, prefer)

Everything else is commentary. Some commentary is necessary; a chapter that is
three quarters commentary is a chapter nobody can use.

Also flags meta-commentary, which is the specific failure mode of writing about
the book instead of about the subject: "worth noticing", "that is the point",
"the honest answer".

    python3 tools/audit_density.py
    python3 tools/audit_density.py --show book/chapters/ch03.md
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"

FRONT = re.compile(r"\A---\n.*?\n---\n", re.S)
FENCE = re.compile(r"^```.*?^```", re.S | re.M)

CONCRETE = re.compile(
    r"`[^`]+`"
    r"|\b\d+\b"
    r"|\b\w+\.(?:js|mjs|css|html|json|py|ts)\b"
    r"|\b(?:call|send|check|read|declare|set|use|put|keep|never|always|must|"
    r"write|return|add|remove|render|listen|assert|press|omit|prefer|bind|"
    r"store|report|answer|forward|validate|clamp|debounce|cancel|retry)\b",
    re.I)

META = re.compile(
    r"worth (?:noticing|stating|naming|dwelling|having)"
    r"|that is the (?:point|whole|shape|reason|difference)"
    r"|is the (?:whole|entire) (?:point|argument|story)"
    r"|the (?:honest|interesting|useful) (?:answer|part|thing|question)"
    r"|stated (?:here|plainly)"
    r"|the shape (?:of|worth|to)"
    r"|and that is (?:the|what|why)"
    r"|this (?:chapter|section) is (?:about|here)",
    re.I)

# Reference pages are lists by nature and score differently from prose.
FLOOR = {"chapters": 0.28, "recipes": 0.30, "frontmatter": 0.16,
         "appendices": 0.20}


def sentences(path: Path) -> list[str]:
    """Prose sentences, with paragraphs unwrapped first.

    The Markdown is hard wrapped at about 78 columns, so splitting on a
    newline-excluding pattern measures line fragments rather than sentences.
    Join each paragraph into one line before splitting.
    """
    raw = FENCE.sub(" ", FRONT.sub("", path.read_text(encoding="utf-8")))
    kept = [line for line in raw.splitlines()
            if not line.startswith(("#", "|", "@", "<!--", "!["))]
    paragraphs = re.split(r"\n\s*\n", "\n".join(kept))
    out: list[str] = []
    for para in paragraphs:
        flat = " ".join(para.split())
        if len(flat) < 25:
            continue
        out += [" ".join(s.split())
                for s in re.findall(r"[^.!?]{25,}[.!?]", flat)]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--show", metavar="FILE")
    ap.add_argument("--warnings", action="store_true")
    args = ap.parse_args()

    if args.show:
        path = Path(args.show)
        for s in sentences(path):
            mark = "  " if CONCRETE.search(s) else "??"
            if META.search(s):
                mark = "!!"
            print(f"{mark} {s}")
        return 0

    problems: list[str] = []
    total = concrete = metas = 0
    rows = []

    for path in sorted(BOOK.rglob("*.md")):
        sents = sentences(path)
        if not sents:
            continue
        group = path.parent.name
        c = sum(1 for s in sents if CONCRETE.search(s))
        m = [s for s in sents if META.search(s)]
        total += len(sents)
        concrete += c
        metas += len(m)
        ratio = c / len(sents)
        rows.append((ratio, len(sents), path))

        floor = FLOOR.get(group, 0.25)
        if ratio < floor:
            problems.append(
                f"{path.relative_to(ROOT)}: {ratio:.0%} of {len(sents)} "
                f"sentences carry anything concrete, floor is {floor:.0%}")
        for s in m:
            problems.append(
                f"{path.relative_to(ROOT)}: writing about the book, not the "
                f"subject: \"{s[:70]}\"")

    rows.sort()
    for line in problems:
        print(f"  {line}")
    if args.warnings:
        print("\nleast concrete:")
        for ratio, n, path in rows[:10]:
            print(f"  {ratio:5.0%}  {n:4} sentences  {path.name}")

    print(f"{total} sentences, {concrete} concrete ({concrete/total:.0%}), "
          f"{metas} meta-commentary, {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
