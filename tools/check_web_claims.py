#!/usr/bin/env python3
"""Check the web platform and accessibility claims against their own specs.

`check_claims.py` covers MCP. This covers everything else the book leans on:
sandbox tokens, CSP directives, permission policy features, ARIA roles and
attributes, Authoring Practices pattern names, and the WCAG success criteria
the accessibility sections cite.

Every reference is downloaded into `proto/refs/` by `make refs-fetch` and is
never committed. Without them the script skips cleanly.

    python3 tools/check_web_claims.py
    python3 tools/check_web_claims.py --list
"""

from __future__ import annotations

import argparse
import html as htmllib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "proto" / "refs"
BOOK = ROOT / "book"


def text_of(*names: str) -> str:
    out = []
    for name in names:
        path = REFS / name
        if not path.exists():
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        raw = re.sub(r"<script.*?</script>", " ", raw, flags=re.S | re.I)
        raw = re.sub(r"<style.*?</style>", " ", raw, flags=re.S | re.I)
        raw = re.sub(r"<[^>]+>", " ", raw)
        out.append(re.sub(r"\s+", " ", htmllib.unescape(raw)))
    return "\n".join(out)


# term -> (source files, what the book uses it for)
TERMS: dict[str, tuple[tuple[str, ...], str]] = {}


def register(source: tuple[str, ...], kind: str, *terms: str) -> None:
    for term in terms:
        TERMS[term] = (source, kind)


HTML = ("html-sandbox.html", "html-iframe.html", "html-dnd.html",
        "html-dialog.html")
register(HTML, "iframe sandbox token",
         "allow-scripts", "allow-same-origin", "allow-modals",
         "allow-downloads", "allow-top-navigation", "allow-popups")
register(HTML, "drag and drop", "dragover", "dragenter", "dragleave",
         "dataTransfer")
register(HTML, "dialog element", "showModal")

register(("csp3.html",), "CSP directive",
         "default-src", "script-src", "style-src", "img-src", "media-src",
         "font-src", "connect-src", "frame-src", "base-uri", "object-src")

register(("permissions-policy.html",), "permission policy feature",
         "camera", "microphone", "geolocation", "clipboard-write",
         "fullscreen")
# Policy-controlled features are declared by the specs that own them rather
# than by the Permissions Policy document, which defines only the framework.
register(("webshare.html",), "policy-controlled feature", "web-share")

register(("clipboard.html",), "clipboard API", "writeText", "readText")

register(("pointerevents3.html",), "pointer events",
         "setPointerCapture", "releasePointerCapture", "pointerdown",
         "pointermove", "pointerup", "pointerId", "pointerType", "touch-action")

register(("webshare.html",), "web share", "navigator.share")

register(("wai-aria.html",), "ARIA role",
         "listbox", "treeitem", "menuitem", "progressbar", "grid",
         "textbox", "status", "log", "option", "menu", "tree", "tab")
register(("wai-aria.html",), "ARIA attribute",
         "aria-selected", "aria-multiselectable", "aria-activedescendant",
         "aria-live", "aria-pressed", "aria-current", "aria-sort",
         "aria-invalid", "aria-describedby", "aria-expanded", "aria-valuetext",
         "aria-valuenow", "aria-modal", "aria-label", "aria-hidden",
         "aria-multiline")

register(("apg.html",), "APG pattern",
         "Combobox", "Dialog (Modal)", "Listbox", "Menu", "Tabs", "Accordion",
         "Breadcrumb", "Toolbar", "Slider", "Spinbutton", "Switch",
         "Radio Group", "Checkbox", "Button", "Tooltip", "Disclosure",
         "Alert Dialog", "Tree View")

register(("wcag22.html",), "WCAG term",
         "Reflow", "Target Size (Minimum)", "Target Size (Enhanced)",
         "Focus Visible")

# Claims with a number in them, where getting the number wrong is the whole
# failure. Each is a phrase the prose may use and the text that must back it.
NUMERIC = [
    ("320", ("wcag22.html",), r"320 CSS pixel", "reflow width"),
    ("200%", ("wcag22.html",), r"200 ?(?:percent|%)", "resize text"),
    ("24 by 24", ("wcag22.html",), r"24 by 24 CSS pixels", "AA target size"),
    ("44 by 44", ("wcag22.html",), r"44 by 44 CSS pixels", "AAA target size"),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if not REFS.exists() or not (REFS / "csp3.html").exists():
        print("proto/refs not present; skipping the web platform claim check")
        return 0

    prose = "\n".join(p.read_text(encoding="utf-8") for p in BOOK.rglob("*.md"))
    corpora: dict[tuple[str, ...], str] = {}
    problems: list[str] = []
    checked = 0

    used = {t: kind for t, (src, kind) in TERMS.items()
            if re.search(rf"(?<![\w-]){re.escape(t)}(?![\w-])", prose)}

    if args.list:
        for term in sorted(used):
            print(f"  {term}  ({used[term]})")
        print(f"{len(used)} of {len(TERMS)} registered terms appear in the book")
        return 0

    for term, kind in sorted(used.items()):
        source, _ = TERMS[term]
        if source not in corpora:
            corpora[source] = text_of(*source)
        if not corpora[source]:
            continue
        checked += 1
        if not re.search(re.escape(term), corpora[source], re.I):
            problems.append(f"{kind} {term!r} is used in the book and does not "
                            f"appear in {', '.join(source)}")

    for phrase, source, pattern, what in NUMERIC:
        if source not in corpora:
            corpora[source] = text_of(*source)
        if not corpora[source]:
            continue
        checked += 1
        if not re.search(pattern, corpora[source], re.I):
            problems.append(f"{what}: the spec no longer says {phrase!r}")

    for line in problems:
        print(f"  {line}")
    print(f"{checked} web platform claim(s) checked against {len(corpora)} "
          f"reference(s), {len(problems)} unsupported")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
