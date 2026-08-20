#!/usr/bin/env python3
"""Every server-directed MUST in the pinned specification, accounted for.

Two defects reached the book because nothing compared the servers against the
specification's own obligations: `initialize` answered with its own protocol
version whatever the client asked for, and `server/discover` did not exist.
Both are MUSTs. Neither was reachable from a host that already spoke
`2026-07-28`, so every check in this repository stayed green over them.

This extracts the MUST and MUST NOT sentences that bind a server from the
pinned specification and requires each one to be classified in
`conformance/musts.json` as `implemented`, `not-applicable` or `open`, with a
note saying where it is met or why it does not apply. An unclassified MUST
fails the build, so a specification update surfaces new obligations instead of
passing silently.

The key is a hash of the sentence, so an edited MUST resurfaces for
reclassification rather than keeping a stale verdict.

Skips cleanly when `proto/` is absent, like the other specification checks.

    python3 tools/check_musts.py
    python3 tools/check_musts.py --list-open
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "proto" / "modelcontextprotocol" / "docs" / "specification" / "2026-07-28"
LEDGER = ROOT / "conformance" / "musts.json"

# What a stdio server implementing tools, resources and the UI extension is
# bound by. The HTTP transport, the authorization framework and the
# client-side features are out of scope for these servers and are excluded
# here rather than marked not-applicable ninety times over.
SCOPE = [
    "basic/index.mdx",
    "basic/versioning.mdx",
    "basic/transports/index.mdx",
    "basic/transports/stdio.mdx",
    "basic/patterns/cancellation.mdx",
    "basic/patterns/progress.mdx",
    "basic/patterns/subscriptions.mdx",
    "server/index.mdx",
    "server/tools.mdx",
    "server/resources.mdx",
    "server/discover.mdx",
    "server/utilities/pagination.mdx",
    "server/utilities/logging.mdx",
    "server/utilities/caching.mdx",
    "server/utilities/completion.mdx",
]

VERDICTS = {"implemented", "not-applicable", "open"}
MUST = re.compile(r"\*\*MUST(?: NOT)?\*\*")
# Sentences that bind only the client are not this repository's obligation,
# but they are kept when a server is named too.
CLIENT_ONLY = re.compile(r"^\s*(?:The\s+)?Clients?\b(?!.*\bservers?\b)", re.I)


def sentences(text: str) -> list[str]:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)          # code blocks
    text = re.sub(r"<Note>|</Note>", " ", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)        # link targets
    text = text.replace("\n", " ")
    parts = re.split(r"(?<=[.:])\s+(?=[A-Z`\[*])", text)
    return [re.sub(r"\s+", " ", p).strip() for p in parts]


def collect() -> dict[str, dict]:
    found = {}
    for rel in SCOPE:
        path = SPEC / rel
        if not path.exists():
            continue
        for sentence in sentences(path.read_text()):
            if not MUST.search(sentence) or CLIENT_ONLY.match(sentence):
                continue
            trimmed = sentence[:400]
            key = hashlib.sha1(
                f"{rel}:{trimmed}".encode()).hexdigest()[:12]
            found[key] = {"file": rel, "text": trimmed}
    return found


def main() -> int:
    if not SPEC.exists():
        print("proto/ absent, skipping the MUST ledger check")
        return 0

    found = collect()
    ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {}

    unclassified = sorted(k for k in found if k not in ledger)
    stale = sorted(k for k in ledger if k not in found)
    bad = sorted(k for k, v in ledger.items()
                 if v.get("verdict") not in VERDICTS or not v.get("note"))

    if "--list-open" in sys.argv:
        for key, entry in sorted(ledger.items()):
            if entry.get("verdict") == "open":
                print(f"{key}  {found.get(key, entry).get('file', '?')}")
                print(f"    {found.get(key, entry).get('text', '')[:160]}")
                print(f"    note: {entry['note']}")
        return 0

    problems = []
    for key in unclassified:
        problems.append(
            f"unclassified MUST in {found[key]['file']} ({key})\n"
            f"      {found[key]['text'][:180]}")
    for key in stale:
        problems.append(
            f"ledger entry {key} no longer matches any MUST; the sentence "
            f"changed or moved, so reclassify it: {ledger[key]['note'][:80]}")
    for key in bad:
        problems.append(f"ledger entry {key} needs a verdict in "
                        f"{sorted(VERDICTS)} and a note")

    counts = {v: sum(1 for e in ledger.values() if e.get("verdict") == v)
              for v in sorted(VERDICTS)}
    for problem in problems:
        print(f"  {problem}")
    print(f"{len(found)} server-directed MUST(s) in scope, "
          + ", ".join(f"{n} {v}" for v, n in counts.items())
          + f", {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
