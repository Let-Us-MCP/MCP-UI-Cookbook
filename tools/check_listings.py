#!/usr/bin/env python3
"""Every listing tagged `extracted` must actually appear in the file it names.

The book claims its code comes from applications the tests run. This checks
the claim, line by line, ignoring leading whitespace so a listing may be
un-indented for the page. Listings tagged `illustrative` are not checked, and
listings with no tag are reported, because an untagged listing is a claim
nobody can evaluate.

Three further rules, so that coverage is a build property and not an author's
memory:

**Extracted code must run.** The named file has to live under a directory the
tests execute or the site generates from. A listing quoted out of a scratch
file is an illustration with a filename attached.

**Every chapter carries listings.** A chapter of prose about an interface,
with no code in it, is the failure this book was written against. Each chapter
needs at least two, and at least one extracted from a running file.

**Every recipe quotes its own application.** A recipe entry's extracted
listings must come from that recipe's own directory, because the page beside
them is running exactly those files.

    python3 tools/check_listings.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"

# Directories whose contents are executed by the test suite or read by the
# site generator. An extracted listing may only name a file under one of them.
RUNNING = ("apps/", "tools/", "capabilities/", "conformance/", "emulator/")

CHAPTER_FLOOR = 2

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

            if not names[0].startswith(RUNNING):
                problems.append(
                    f"{rel}: extracted listing names {names[0]}, which is not "
                    f"under a directory the tests run")
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

    for path in sorted((BOOK / "chapters").glob("*.md")):
        text = path.read_text(encoding="utf-8")
        found = [m.group("kind") for m in TAGGED.finditer(text)]
        rel = path.relative_to(ROOT)
        if len(found) < CHAPTER_FLOOR:
            problems.append(
                f"{rel}: {len(found)} listing(s), floor is {CHAPTER_FLOOR}. "
                f"A chapter about an interface with no code in it is prose")
        elif "extracted" not in found:
            problems.append(
                f"{rel}: no extracted listing; every chapter needs at least "
                f"one quotation from a file the tests run")

    for path in sorted((BOOK / "recipes").glob("*.md")):
        own = f"apps/recipes/{path.stem}-"
        for match in TAGGED.finditer(path.read_text(encoding="utf-8")):
            if match.group("kind") != "extracted":
                continue
            names = FILE_REF.findall(match.group("rest"))
            if names and not (names[0].startswith(own)
                              or names[0].startswith("apps/lib/")):
                problems.append(
                    f"{path.relative_to(ROOT)}: extracted listing names "
                    f"{names[0]}, which is not this recipe's own code")

    for line in problems:
        print(f"  {line}")
    total = sum(counts.values())
    print(f"{total} listings: " + ", ".join(f"{v} {k}" for k, v in counts.items())
          + f", {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
