#!/usr/bin/env python3
"""Every protocol identifier the prose puts in backticks must exist somewhere.

`check_claims.py` proves the registry's wire anchors are real. This proves the
same thing for the prose, which is where invented field names actually creep
in: a plausible-looking `hostContext.viewState` reads as fact and is not one.

An identifier passes if it appears in the pinned specification text, in the
SDK's types, or in this repository's own source. Anything else is reported,
and the allowlist below is for the handful of names this book deliberately
proposes, each of which is a gap in Appendix B.

`proto/` is a pair of specification clones and is never committed. Without it
the script skips cleanly.

    python3 tools/check_identifiers.py
    python3 tools/check_identifiers.py --list
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"
PROTO = ROOT / "proto"

# Names this book proposes rather than reports. Each is a gap in Appendix B and
# is introduced in the prose with "what a mechanism would look like".
PROPOSED = {
    "ui/request-focus", "ui/notifications/focus-granted", "ui/request-reveal",
    "ui/request-attention", "ui/set-view-state", "ui/get-state", "ui/set-state",
    "ui/intent", "ui/notifications/tool-result-partial", "ui/request-approval",
    "ui/elicit", "ui/print", "ui/share", "viewState", "clipboardRead",
    "widgetAccessible",
}

# Identifiers that belong to the web platform or to this repository's own
# vocabulary rather than to MCP.
PLATFORM = re.compile(
    r"^(window|document|navigator|element|event|localstorage|sessionstorage"
    r"|indexeddb|intl|resizeobserver|intersectionobserver|abortcontroller"
    r"|abortsignal|filereader|datatransfer|math|json|promise|number|array"
    r"|keycode|innerhtml|inerttext|textcontent)\b",
    re.I)


def corpus() -> str:
    parts = []
    for path in [
        PROTO / "ext-apps" / "specification" / "draft" / "apps.mdx",
        PROTO / "ext-apps" / "specification" / "2026-01-26" / "apps.mdx",
    ]:
        if path.exists():
            parts.append(path.read_text(encoding="utf-8"))
    core = PROTO / "modelcontextprotocol" / "docs" / "specification" / "2026-07-28"
    if core.exists():
        parts += [p.read_text(encoding="utf-8") for p in core.rglob("*.mdx")]
    sdk = PROTO / "ext-apps" / "src"
    if sdk.exists():
        parts += [p.read_text(encoding="utf-8") for p in sdk.rglob("*.ts")]
    for group in ("apps", "emulator", "tools", "capabilities"):
        base = ROOT / group
        if base.exists():
            parts += [p.read_text(encoding="utf-8", errors="ignore")
                      for p in base.rglob("*")
                      if p.is_file() and p.suffix in
                      {".js", ".mjs", ".ts", ".html", ".css", ".py", ".json"}]
    return "\n".join(parts)


# What counts as a protocol identifier in prose: a slashed method name, or a
# dotted or camelCase field path.
CANDIDATE = re.compile(
    r"`([a-zA-Z][\w-]*(?:/[\w.-]+)+|[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z][\w]*)+"
    r"|[a-z]+[A-Z][a-zA-Z]*)`")

SKIP = re.compile(r"^(https?|text/|application/|file:|ui://|and/or)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if not (PROTO / "ext-apps").exists():
        print("proto/ not present; skipping the identifier check")
        return 0

    haystack = corpus()
    seen: dict[str, list[str]] = {}

    for path in sorted(BOOK.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        rel = str(path.relative_to(ROOT))
        for name in CANDIDATE.findall(text):
            if SKIP.match(name) or PLATFORM.match(name):
                continue
            seen.setdefault(name, []).append(rel)

    if args.list:
        for name in sorted(seen):
            print(f"  {name}")
        return 0

    problems = []
    for name, where in sorted(seen.items()):
        if name in PROPOSED:
            continue
        # A dotted path is checked by its last segment too, because the spec
        # writes `hostContext.locale` as a field called `locale`.
        tail = name.split(".")[-1]
        if name in haystack or tail in haystack:
            continue
        problems.append(f"{where[0]}: `{name}` appears in no specification, "
                        "SDK or source file")

    for line in problems:
        print(f"  {line}")
    print(f"{len(seen)} identifiers in the prose, {len(problems)} unsupported")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
