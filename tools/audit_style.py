#!/usr/bin/env python3
"""Two style audits that catch the failures a prose linter cannot.

**Deferrals.** Prose that waves at a concept and promises to explain it
elsewhere. "Chapter 8 covers the mechanism properly" is fine once as a
cross-reference and fatal as a habit, because the reader is being told that the
thing they are reading is incomplete. A cross-reference that adds something is
allowed; one that substitutes for an explanation is not.

**Contrastive phrasing.** "X is not Y. It is Z." and "not just A but B" read as
arguing with somebody who is not in the room. Occasionally that is the clearest
shape; as a default connective it makes every paragraph sound defensive. There
is a budget per chapter.

    python3 tools/audit_style.py
    python3 tools/audit_style.py --deferrals
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FENCE = re.compile(r"^```.*?^```", re.S | re.M)
FRONT = re.compile(r"\A---\n.*?\n---\n", re.S)

DEFERRAL = [
    ("covers-it-properly",
     re.compile(r"(?:Chapter \d+|Appendix [A-F]) (?:covers|explains|handles|deals with) "
                r"(?:it|this|that|the mechanism|the detail)s? (?:properly|in full|later)", re.I)),
    ("more-on-this-later",
     re.compile(r"\b(?:more on (?:this|that) (?:later|below)|we(?:'ll| will) (?:come back to|"
                r"return to|get to) (?:this|that) (?:later|shortly))\b", re.I)),
    ("beyond-scope-shrug",
     re.compile(r"\b(?:beyond the scope of this (?:book|chapter)|out of scope here)\b", re.I)),
    ("for-now-just",
     re.compile(r"\bfor now,? (?:just|simply) (?:know|assume|accept)\b", re.I)),
]

CONTRASTIVE = [
    ("is-not-it-is", re.compile(r"\b(?:is|was|are|were) not [^.;:]{3,50}\.\s+It(?:'s| is| was)\b")),
    ("not-just-but", re.compile(r"\bnot (?:just|only) [^.;:]{3,60}?,? but\b", re.I)),
    ("rather-than", re.compile(r"\brather than\b", re.I)),
    ("instead-of", re.compile(r"\binstead of\b", re.I)),
]
CONTRASTIVE_BUDGET = 12


def strip(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    raw = FRONT.sub("", raw)
    return FENCE.sub("", raw)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--deferrals", action="store_true", help="deferrals only")
    args = ap.parse_args()

    files = sorted(
        list((ROOT / "book" / "chapters").glob("*.md"))
        + list((ROOT / "book" / "frontmatter").glob("*.md"))
    )
    problems = 0

    print("Deferrals")
    found = False
    for path in files:
        text = strip(path)
        for name, pat in DEFERRAL:
            for m in pat.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                print(f"  {path.name}:{line} [{name}] {m.group(0).strip()}")
                problems += 1
                found = True
    if not found:
        print("  none")

    if args.deferrals:
        return 1 if problems else 0

    print("\nContrastive phrasing (budget %d per chapter)" % CONTRASTIVE_BUDGET)
    over = False
    for path in files:
        text = strip(path)
        counts = {name: len(pat.findall(text)) for name, pat in CONTRASTIVE}
        total = sum(counts.values())
        flag = "  over" if total > CONTRASTIVE_BUDGET else ""
        if total > CONTRASTIVE_BUDGET:
            over = True
            problems += 1
        detail = ", ".join(f"{k} {v}" for k, v in counts.items() if v)
        print(f"  {path.name:<16}{total:>3}{flag}   {detail}")
    if not over:
        print("  all within budget")

    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
