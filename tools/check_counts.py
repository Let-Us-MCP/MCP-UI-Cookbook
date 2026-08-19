#!/usr/bin/env python3
"""Numbers the book asserts about its own artefacts must still be true.

A sentence that says "fourteen capabilities have no mechanism" is a claim that
goes stale the moment somebody moves one, and nothing in a normal build
notices. Each entry below names a fact, computes it from the repository, and
lists the spellings the prose may use. Digits and words both count, because
the prose uses both.

Fenced code blocks and captured output are skipped: a listing is a record of a
moment and is allowed to disagree with the present.

    python3 tools/check_counts.py
    python3 tools/check_counts.py --show
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"
REGISTRY = json.loads((ROOT / "capabilities" / "registry.json").read_text())

WORDS = {
    3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
    9: "nine", 10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen",
    14: "fourteen", 15: "fifteen", 16: "sixteen", 17: "seventeen",
    18: "eighteen", 19: "nineteen", 20: "twenty", 28: "twenty-eight",
    19: "nineteen", 22: "twenty-two", 23: "twenty-three",
    24: "twenty-four", 58: "fifty-eight", 61: "sixty-one",
    86: "eighty-six", 88: "eighty-eight", 89: "eighty-nine",
    29: "twenty-nine", 42: "forty-two", 69: "sixty-nine",
    71: "seventy-one", 20: "twenty",
    30: "thirty", 32: "thirty-two", 41: "forty-one", 59: "fifty-nine",
    67: "sixty-seven", 68: "sixty-eight",
    85: "eighty-five", 87: "eighty-seven",
}

caps = REGISTRY["capabilities"]
grounds = Counter(c["ground"] for c in caps)
tags = Counter(c["tag"] for c in caps)
demos = sum(1 for group in ("labs", "recipes")
            for p in (ROOT / "apps" / group).iterdir() if p.is_dir())
claims = sum(len(c["wire"]) for c in caps)
core_gaps = sum(1 for c in caps if c["ground"] == "gap" and c["tag"] == "core")
levels = Counter(c["level"] for c in caps)

RENDER = ROOT / "conformance" / "render"
render_cases = sorted(RENDER.glob("*.json"))
render_assertions = sum(
    len(step.get("expect", []))
    + len(step.get("evalExpect", []))
    + len(step.get("pageExpect", []))
    + (1 if step.get("expectMessage") else 0)
    for case in render_cases
    for step in json.loads(case.read_text()).get("steps", []))

TAG = re.compile(r"^<!-- listing:\s*(extracted|captured|illustrative)", re.M)
listing_tags = Counter()
for page in sorted(BOOK.rglob("*.md")):
    listing_tags.update(TAG.findall(page.read_text(encoding="utf-8")))

FACTS = {
    "capabilities": len(caps),
    "recipes": len(REGISTRY["recipes"]),
    "wire capabilities": grounds["wire"],
    "platform capabilities": grounds["platform"],
    "app capabilities": grounds["app"],
    "gap capabilities": grounds["gap"],
    "core capabilities": tags["core"],
    "core gaps": core_gaps,
    "demonstrations": demos,
    "specification claims": claims,
    "labs": sum(1 for p in (ROOT / "apps" / "labs").iterdir() if p.is_dir()),
    "extended capabilities": tags["extended"],
    "level 1 capabilities": levels[1],
    "level 2 capabilities": levels[2],
    "level 3 capabilities": levels[3],
    "level 4 capabilities": levels[4],
    "render cases": len(render_cases),
    "render assertions": render_assertions,
    "listings": sum(listing_tags.values()),
    "extracted listings": listing_tags["extracted"],
    "captured listings": listing_tags["captured"],
    "illustrative listings": listing_tags["illustrative"],
}

def facts() -> dict[str, int]:
    """The numbers the repository knows about itself.

    Imported by `tools/build_site.py` so that a page can render a count
    instead of asserting one. A number that is generated cannot be stale, and
    the patterns below then only have to police the numbers still written by
    hand.
    """
    return dict(FACTS)


# fact -> phrases the prose may use for it. NUMBER stands for digits or the
# spelled form, and every pattern is anchored by enough surrounding words that
# it cannot match an ordinary sentence about capabilities.
PATTERNS = {
    "capabilities": [
        r"NUMBER named operations",
        r"NUMBER capabilities in the registry",
        r"NUMBER named primitives",
        r"NUMBER capabilities by thirteen recipes",
        r"of the NUMBER capabilities are Core",
        r"NUMBER-row index",
    ],
    "recipes": [
        # Anchored on a determiner: "four recipes" in a sentence about how many
        # recipes a defect touched is not a claim about how many exist.
        r"(?:all|the|these|its|of) NUMBER recipes",
        r"NUMBER recipes,? (?:in|and) ",
        r"NUMBER recognisable applications",
        r"NUMBER recipe apps",
    ],
    "gap capabilities": [
        r"NUMBER capabilities carry this label",
        r"all NUMBER of these",
        r"NUMBER of them had to be worked around",
        r"this book has NUMBER gaps",
        r"NUMBER capabilities with no mechanism",
        r"NUMBER doors that are shut",
        r"NUMBER capabilities that recognisable applications need",
        r"NUMBER current findings",
        r"NUMBER findings, each attached",
    ],
    "core gaps": [
        r"NUMBER of them are\s+Core",
        r"NUMBER Core capabilities across all levels",
        r"NUMBER of them are Core",
    ],
    "demonstrations": [
        r"all NUMBER demonstrations",
        r"NUMBER applications that run",
        r"NUMBER demonstrations in this book",
        r"NUMBER applications, their sources",
        r"NUMBER applications next to their own source",
    ],
    "specification claims": [
        r"NUMBER claims, checked",
        r"NUMBER claims verified",
    ],
    "core capabilities": [
        r"NUMBER of the eighty-five capabilities are Core",
        r"accounts for NUMBER of the 87",
        r"NUMBER of the 87 are Core",
    ],
    "labs": [
        r"The NUMBER labs",
    ],
    "wire capabilities": [
        r"the NUMBER wire\s+claims",
    ],
    "extended capabilities": [
        r"work without it\. NUMBER of\s+the 87",
        r"accounts for the other NUMBER",
    ],
    "level 1 capabilities": [
        r"NUMBER capabilities sit at level 1",
    ],
    "level 2 capabilities": [
        r"NUMBER at level 2",
    ],
    "level 3 capabilities": [
        r"NUMBER at\s+level 3",
        r"NUMBER at level 3",
    ],
    "level 4 capabilities": [
        r"NUMBER at level 4",
    ],
    "listings": [
        r"of the NUMBER listings",
    ],
    "render assertions": [
        r"NUMBER assertion\(s\) against real servers",
        r"runs NUMBER of these against real servers",
        r"NUMBER assertions across the thirteen recipes",
    ],
    "render cases": [
        r"NUMBER case\(s\) against real servers",
    ],
    "extracted listings": [
        r"all NUMBER extracted listings",
    ],
    "captured listings": [
        r"NUMBER listings in this book are captured",
    ],
    "illustrative listings": [
        r"NUMBER of the \d+ listings",
    ],
}

FENCE = re.compile(r"^```.*?^```", re.S | re.M)


def spellings(value: int) -> str:
    forms = [str(value)]
    if value in WORDS:
        forms.append(WORDS[value])
    return "(?:" + "|".join(re.escape(f) for f in forms) + ")"


NUMBERISH = r"(?P<n>\d+|" + "|".join(sorted(
    set(WORDS.values()) | {"eighty", "sixty", "seventy", "forty", "fifty",
                           "thirty", "twenty", "sixty eight", "twenty eight"},
    key=len, reverse=True)) + r")"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--show", action="store_true")
    args = ap.parse_args()

    if args.show:
        for name, value in FACTS.items():
            print(f"  {value:>4}  {name}")
        return 0

    problems: list[str] = []
    checked = 0

    for path in sorted(BOOK.rglob("*.md")):
        # The prose is hard wrapped at about 78 columns, so a claim can be
        # split across a line break. Flatten first, or a wrapped claim is one
        # this checker silently never reads.
        text = " ".join(FENCE.sub("", path.read_text(encoding="utf-8")).split())
        rel = path.relative_to(ROOT)
        for fact, patterns in PATTERNS.items():
            correct = FACTS[fact]
            for pattern in patterns:
                # Any number in this phrase position must be the right one.
                loose = pattern.replace("NUMBER", NUMBERISH)
                for match in re.finditer(loose, text, re.I):
                    checked += 1
                    found = match.group("n").lower().replace(" ", "-")
                    allowed = {str(correct), WORDS.get(correct, "")}
                    if found not in allowed:
                        problems.append(
                            f"{rel}: {fact} is {correct}, prose says "
                            f"{found!r} in \"{match.group(0)[:70]}\"")

    for line in problems:
        print(f"  {line}")
    print(f"{checked} numeric claim(s) checked, {len(problems)} wrong")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
