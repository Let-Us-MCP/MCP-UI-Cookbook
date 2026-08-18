#!/usr/bin/env python3
"""Build every drawn figure into docs/figures/.

Two families:
  figures-src/xkcd/*.py       hand-drawn cartoons, one argument each
  figures-src/diagrams/*.py   straight-line mechanism diagrams
  figures-src/cover.py        the cover

The annotated renders are a third family and they do not live here. They come
from tools/capture_figures.mjs, which drives the gallery in headless Chrome.

    python3 tools/build_figures.py            # what changed
    python3 tools/build_figures.py --force
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "figures"
VENV = ROOT / ".venv" / "bin" / "python"


def python_bin() -> str:
    return str(VENV) if VENV.exists() else sys.executable


def targets() -> list[tuple[Path, Path]]:
    jobs: list[tuple[Path, Path]] = []
    for src in sorted((ROOT / "figures-src" / "xkcd").glob("*.py")):
        jobs.append((src, OUT / f"xkcd-{src.stem}.png"))
    for src in sorted((ROOT / "figures-src" / "diagrams").glob("*.py")):
        jobs.append((src, OUT / f"diag-{src.stem}.png"))
    cover = ROOT / "figures-src" / "cover.py"
    if cover.exists():
        jobs.append((cover, OUT / "cover.png"))
    return jobs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("names", nargs="*")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    shared = (ROOT / "figures-src" / "_style.py").stat().st_mtime
    built = skipped = failed = 0

    for src, dst in targets():
        if args.names and src.stem not in args.names:
            continue
        fresh = dst.exists() and dst.stat().st_mtime > max(src.stat().st_mtime, shared)
        if fresh and not args.force:
            skipped += 1
            continue
        proc = subprocess.run([python_bin(), str(src), str(dst)],
                              capture_output=True, text=True)
        if proc.returncode != 0 or not dst.exists():
            failed += 1
            print(f"FAILED {src.name}\n{proc.stderr[-800:]}", file=sys.stderr)
        else:
            built += 1
            print(f"  {dst.relative_to(ROOT)}")

    print(f"{built} built, {skipped} up to date, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
