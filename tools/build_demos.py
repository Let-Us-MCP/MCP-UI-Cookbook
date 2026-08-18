#!/usr/bin/env python3
"""Assemble docs/demos/ from the app sources and the emulator.

The live pane of every demo runs the file in `apps/`; the code pane displays
the same file. This script is the only thing between them, and all it does is
copy. If it ever transformed the source, the book's central promise would stop
being true.

    python3 tools/build_demos.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT / "apps"
EMULATOR = ROOT / "emulator"
OUT = ROOT / "docs" / "demos"

HARNESS = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Demo harness</title>
<link rel="stylesheet" href="../book.css">
<link rel="stylesheet" href="demo.css">
<style>body{margin:0;padding:16px;background:var(--paper);color:var(--ink)}</style>
</head>
<body>
<div class="demo" id="mount"></div>
<script type="module">
import { mountDemos } from "./demo.js";
const id = new URLSearchParams(location.search).get("demo");
document.getElementById("mount").dataset.demo = id;
mountDemos("./");
</script>
</body>
</html>
"""


def copy_tree(src: Path, dst: Path) -> int:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    return sum(1 for _ in dst.rglob("*") if _.is_file())


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    files = 0
    ids: list[str] = []
    for group in ("labs", "recipes"):
        base = APPS / group
        if not base.exists():
            continue
        for app in sorted(p for p in base.iterdir() if p.is_dir()):
            files += copy_tree(app, OUT / app.name)
            ids.append(app.name)

    files += copy_tree(APPS / "lib", OUT / "lib")
    for name in ("app-bridge.js",):
        shutil.copy(EMULATOR / name, OUT / "lib" / name)
    for name in ("host.js", "demo.js", "demo.css"):
        shutil.copy(EMULATOR / name, OUT / name)
    (OUT / "harness.html").write_text(HARNESS, encoding="utf-8")
    (OUT / "index.json").write_text(json.dumps(sorted(ids), indent=2) + "\n",
                                    encoding="utf-8")

    print(f"{len(ids)} demos, {files} files -> docs/demos/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
