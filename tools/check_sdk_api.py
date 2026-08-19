#!/usr/bin/env python3
"""The bridge in this repository must have the same shape as the real SDK.

Every JavaScript listing in this book is extracted from an application in
`apps/`, and those applications call `emulator/app-bridge.js`. A reader copies
one of those listings into an application built on `@modelcontextprotocol/
ext-apps` and expects it to run.

It did not. `downloadFile` here took an array of contents; `App.downloadFile`
in the SDK takes `{ contents: [...] }`. A reader copying the book's export
example got `params.contents === undefined`, a request the host could not act
on, and a download that silently never happened. Four of the five request
methods had diverged the same way, each of them pleasant to write and wrong to
publish.

So the shapes are compared. For each method the SDK exposes, this checks that
ours exists and takes the request's `params` object rather than a convenience
argument of its own invention.

Skips cleanly when `proto/` is absent, like the other specification checks.

    python3 tools/check_sdk_api.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SDK = ROOT / "proto" / "ext-apps" / "src" / "app.ts"
OURS = ROOT / "emulator" / "app-bridge.js"

# Methods whose argument is the request's params object in the SDK. Anything
# the SDK declares as `(params: X["params"], options?)` belongs here, and the
# pattern below finds them rather than trusting this list to stay current.
SDK_METHOD = re.compile(
    r"^  (?P<name>[a-zA-Z]+)\(\s*(?P<arg>params)\s*:\s*"
    r"(?P<type>Mcp[A-Za-z]+)\[\"params\"\]",
    re.M)

OUR_METHOD = re.compile(r"^  (?P<name>[a-zA-Z]+)\((?P<args>[^)]*)\)\s*\{", re.M)


def main() -> int:
    if not SDK.exists():
        print("proto/ext-apps absent; skipping the SDK comparison")
        return 0

    sdk_text = SDK.read_text(encoding="utf-8")
    ours_text = OURS.read_text(encoding="utf-8")

    sdk_methods = {}
    for match in SDK_METHOD.finditer(sdk_text):
        sdk_methods[match.group("name")] = match.group("type")
    # Multi-line signatures: `name(\n  params: X["params"],`
    for match in re.finditer(
            r"^  (?P<name>[a-zA-Z]+)\(\s*\n\s*params:\s*(?P<type>Mcp[A-Za-z]+)"
            r"\[\"params\"\]", sdk_text, re.M):
        sdk_methods.setdefault(match.group("name"), match.group("type"))

    ours = {m.group("name"): m.group("args").strip()
            for m in OUR_METHOD.finditer(ours_text)}

    problems: list[str] = []
    checked = 0
    for name, request_type in sorted(sdk_methods.items()):
        if name not in ours:
            # Not everything in the SDK has to exist here; the emulator is a
            # teaching implementation. What must not happen is a method that
            # exists with a different shape.
            continue
        checked += 1
        args = ours[name]
        if args.split(",")[0].strip() not in {"params", ""}:
            problems.append(
                f"{OURS.relative_to(ROOT)}: {name}({args}) takes its own "
                f"argument; the SDK takes {request_type}[\"params\"], so a "
                f"listing copied from this book will not run against it")

    for line in problems:
        print(f"  {line}")
    print(f"{checked} bridge method(s) compared against the SDK, "
          f"{len(problems)} divergent")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
