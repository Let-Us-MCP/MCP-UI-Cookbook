#!/usr/bin/env python3
"""Check every protocol claim in the registry against the specification text.

The registry says which capabilities are grounded in a wire message. This
script proves it. Each `wire` anchor is a literal string that must appear in
the pinned specification:

    apps -> proto/ext-apps/specification/draft/apps.mdx
    core -> proto/modelcontextprotocol/docs/specification/2026-07-28/**

It also reports which anchors are present in the draft but not in the last
dated release (2026-01-26), because the book has to say which is which.

`proto/` is a pair of specification clones and is never committed. Without it
the script skips cleanly so CI stays green; run it locally before publishing.

    python3 tools/check_claims.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROTO = ROOT / "proto"
DRAFT = PROTO / "ext-apps" / "specification" / "draft" / "apps.mdx"
RELEASED = PROTO / "ext-apps" / "specification" / "2026-01-26" / "apps.mdx"
CORE = PROTO / "modelcontextprotocol" / "docs" / "specification" / "2026-07-28"


def core_text() -> str:
    return "\n".join(p.read_text(encoding="utf-8")
                     for p in sorted(CORE.rglob("*.mdx")))


def main() -> int:
    if not DRAFT.exists() or not CORE.exists():
        print("proto/ not present; skipping specification claim check")
        return 0

    registry = json.loads((ROOT / "capabilities" / "registry.json").read_text())
    draft = DRAFT.read_text(encoding="utf-8")
    released = RELEASED.read_text(encoding="utf-8") if RELEASED.exists() else ""
    core = core_text()

    missing: list[str] = []
    draft_only: set[str] = set()
    checked = 0

    for cap in registry["capabilities"]:
        for claim in cap["wire"]:
            checked += 1
            anchor, spec = claim["anchor"], claim["spec"]
            haystack = draft if spec == "apps" else core
            if anchor not in haystack:
                missing.append(f"{cap['id']}: {spec} spec has no {anchor!r}")
            elif spec == "apps" and released and anchor not in released:
                draft_only.add(anchor)

        if cap["ground"] in ("wire", "core") and not cap["wire"]:
            missing.append(f"{cap['id']}: ground is {cap['ground']!r} "
                           "with no anchors")
        if cap["ground"] not in ("wire", "core") and cap["wire"]:
            missing.append(f"{cap['id']}: anchors on a {cap['ground']!r} "
                           "capability")

    for line in missing:
        print(f"  {line}")
    (ROOT / "capabilities" / "draft-only.json").write_text(
        json.dumps(sorted(draft_only), indent=2) + "\n", encoding="utf-8")
    if draft_only:
        print(f"draft-only anchors ({len(draft_only)}): "
              + ", ".join(sorted(draft_only)))
    print(f"{checked} claims checked against the specification, "
          f"{len(missing)} unsupported")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
