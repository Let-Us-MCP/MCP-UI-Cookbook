#!/usr/bin/env python3
"""Every listing tagged `extracted` must actually appear in the file it names.

The book claims its code comes from applications the tests run. This checks
the claim, line by line, ignoring leading whitespace so a listing may be
un-indented for the page. Listings tagged `illustrative` are not checked, and
listings with no tag are reported, because an untagged listing is a claim
nobody can evaluate.

    python3 tools/check_listings.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"

TAGGED = re.compile(
    r"<!--\s*listing:\s*(?P<kind>extracted|captured|illustrative)"
    r"(?P<rest>[^>]*?)-->\s*```(?P<lang>\w*)\n(?P<body>.*?)```", re.S)
ANY_FENCE = re.compile(r"(?P<prev>(?:<!--[^>]*-->\s*)?)```\w*\n.*?```", re.S)
FILE_REF = re.compile(r"`([^`]+)`")


def normalise(text: str) -> list[str]:
    return [line.strip() for line in text.strip().splitlines() if line.strip()]


def main() -> int:
    problems: list[str] = []
    counts = {"extracted": 0, "captured": 0, "illustrative": 0, "untagged": 0}

    for path in sorted(BOOK.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)

        for match in ANY_FENCE.finditer(text):
            if "listing:" not in match.group("prev"):
                counts["untagged"] += 1

        for match in TAGGED.finditer(text):
            kind = match.group("kind")
            counts[kind] += 1
            if kind != "extracted":
                continue

            names = FILE_REF.findall(match.group("rest"))
            if not names:
                problems.append(f"{rel}: extracted listing names no file")
                continue

            source = ROOT / names[0]
            if not source.exists():
                problems.append(f"{rel}: {names[0]} does not exist")
                continue

            haystack = normalise(source.read_text(encoding="utf-8"))
            needle = normalise(match.group("body"))
            joined = "\n".join(haystack)
            if "\n".join(needle) in joined:
                continue

            missing = [line for line in needle if line not in haystack]
            if missing:
                problems.append(
                    f"{rel}: listing does not match {names[0]}; "
                    f"{len(missing)} line(s) absent, first is {missing[0][:60]!r}")

    for line in problems:
        print(f"  {line}")
    total = sum(counts.values())
    print(f"{total} listings: " + ", ".join(f"{v} {k}" for k, v in counts.items())
          + f", {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
