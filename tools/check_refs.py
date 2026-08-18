#!/usr/bin/env python3
"""Cross-reference checker.

Every figure the prose asks for must exist. Every capability in the registry
must have exactly one entry, and every entry must name a capability that
exists. Every demonstration must be a directory under `apps/`. Every chapter a
recipe refers to must be a real slug.

    python3 tools/check_refs.py
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"
REGISTRY = json.loads((ROOT / "capabilities" / "registry.json").read_text())

CAPS = {c["id"] for c in REGISTRY["capabilities"]}
CAP_CHAPTER = {c["id"]: c["chapter"] for c in REGISTRY["capabilities"]}
RECIPE_IDS = {r["id"] for r in REGISTRY["recipes"]}
DEMOS = {p.name for group in ("labs", "recipes")
         for p in (ROOT / "apps" / group).iterdir() if p.is_dir()}


def pages() -> list[Path]:
    return sorted(BOOK.rglob("*.md"))


def slug_of(path: Path) -> str:
    m = re.search(r"^slug:\s*(\S+)", path.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else path.stem


def main() -> int:
    problems: list[str] = []
    seen_caps: Counter[str] = Counter()
    slugs = {slug_of(p) for p in pages()} | {"index"}

    for path in pages():
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)

        for figure in re.findall(r"!\[[^\]]*\]\((figures/[^)]+)\)", text):
            if not (ROOT / "docs" / figure).exists():
                problems.append(f"{rel}: missing figure {figure}")

        page_slug = slug_of(path)
        for cap in re.findall(r"^@cap\s+(\S+)", text, re.M):
            if cap not in CAPS:
                problems.append(f"{rel}: @cap {cap} is not in the registry")
                continue
            # An entry counts as the defining one when it sits on the chapter
            # the registry assigns it to. The same block quoted elsewhere is a
            # cross-reference, which is allowed and is how Chapter 1 shows
            # three examples of the ground badge.
            if page_slug == CAP_CHAPTER[cap]:
                seen_caps[cap] += 1

        for demo in re.findall(r"^@demo\s+(\S+)", text, re.M):
            if demo not in DEMOS:
                problems.append(f"{rel}: @demo {demo} has no directory in apps/")

        for recipe in re.findall(r"^@recipe\s+(\S+)", text, re.M):
            if recipe not in RECIPE_IDS:
                problems.append(f"{rel}: @recipe {recipe} is not in the registry")

        for link in re.findall(r"\]\((?!https?:|figures/|#)([a-z0-9-]+)\.html", text):
            if link not in slugs:
                problems.append(f"{rel}: link to unknown page {link}.html")

    for cap in sorted(CAPS - set(seen_caps)):
        problems.append(f"capability {cap} has no entry in "
                        f"{CAP_CHAPTER[cap]}")
    for cap, count in sorted(seen_caps.items()):
        if count > 1:
            problems.append(f"capability {cap} has {count} entries in "
                            f"{CAP_CHAPTER[cap]}; expected one")

    for cap in REGISTRY["capabilities"]:
        if cap["lab"] and cap["lab"] not in DEMOS:
            problems.append(f"{cap['id']}: lab {cap['lab']} has no directory")

    for line in problems:
        print(f"  {line}")
    print(f"{len(pages())} pages, {len(CAPS)} capabilities, {len(DEMOS)} demos, "
          f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
