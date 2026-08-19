#!/usr/bin/env python3
"""Build the website from the book's Markdown and the capability registry.

Two sources, one output. Prose lives in `book/`. Every fact about a capability
(its level, its tag, where the behaviour comes from, which specification text
backs it, which recipes cover it) lives in `capabilities/registry.py` and is
injected here. A chapter can describe a capability; it cannot restate its
facts, because it has no way to.

Markers a chapter may use, each on a line of its own:

    @cap surface.resize     the generated header block for one entry
    @demo lab-surface       the live application, its source, its transcript
    @n{listings}            a number computed from the repository, inline
    @index                  the generated capability index
    @matrix                 the generated capability by recipe matrix
    @gaps                   the generated table of unsupported capabilities
    @checklists             the generated per-level conformance checklists
    @recipe r01             the generated header block for one recipe

    python3 tools/build_site.py
"""

from __future__ import annotations

import html
import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "book"
OUT = ROOT / "docs"
REGISTRY = json.loads((ROOT / "capabilities" / "registry.json").read_text())
DRAFT_ONLY = set(json.loads((ROOT / "capabilities" / "draft-only.json").read_text())
                 if (ROOT / "capabilities" / "draft-only.json").exists() else [])

TITLE = "The MCP UI Cookbook"
SUBTITLE = "From atomic UI capabilities to native-like applications"
REPO = "https://github.com/Let-Us-MCP/MCP-UI-Cookbook"

CAPS = {c["id"]: c for c in REGISTRY["capabilities"]}
RECIPES = {r["id"]: r for r in REGISTRY["recipes"]}
GROUNDS = REGISTRY["grounds"]
LEVELS = REGISTRY["levels"]

GROUND_LABEL = {
    "wire": "On the wire",
    "core": "Core MCP",
    "platform": "Platform",
    "app": "Yours to build",
    "gap": "Not standardised",
}

PART_ORDER = [
    "Front matter",
    "Part I - Foundations",
    "Part II - Atomic UI capabilities",
    "Part III - Agent and UI",
    "Part IV - Reusable components",
    "Part V - Application recipes",
    "Part VI - Verification and conformance",
    "Appendices",
]


@dataclass
class Page:
    path: Path
    slug: str
    title: str
    part: str
    summary: str = ""
    number: str = ""
    body: str = ""
    meta: dict = field(default_factory=dict)

    @property
    def href(self) -> str:
        return f"{self.slug}.html"

    @property
    def label(self) -> str:
        if self.part == "Appendices":
            return f"Appendix {self.number}. {self.title}"
        if self.part.startswith("Part V "):
            return f"Recipe {self.number}. {self.title}"
        if self.number:
            return f"{self.number}. {self.title}"
        return self.title


def parse(path: Path) -> Page:
    raw = path.read_text(encoding="utf-8")
    meta: dict = {}
    if raw.startswith("---\n"):
        end = raw.index("\n---\n", 3)
        for line in raw[4:end].splitlines():
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"')
        raw = raw[end + 5:]
    return Page(path=path, slug=meta.get("slug", path.stem),
                title=meta.get("title", path.stem), part=meta.get("part", ""),
                summary=meta.get("summary", ""), number=str(meta.get("number", "")),
                body=raw, meta=meta)


def collect() -> list[Page]:
    pages = [parse(p) for p in sorted(BOOK.rglob("*.md"))]
    pages.sort(key=lambda p: (PART_ORDER.index(p.part) if p.part in PART_ORDER
                              else len(PART_ORDER),
                              int(p.number) if p.number.isdigit() else 0,
                              p.number, p.slug))
    front = {"preface": 0, "how-to-read": 1}
    pages.sort(key=lambda p: (PART_ORDER.index(p.part) if p.part in PART_ORDER
                              else len(PART_ORDER),
                              front.get(p.slug, 2),
                              int(p.number) if p.number.isdigit() else 0,
                              p.number))
    return pages


def pandoc(markdown: str) -> str:
    proc = subprocess.run(
        ["pandoc",
         "--from=markdown+fenced_divs+pipe_tables+backtick_code_blocks"
         "+auto_identifiers+smart+definition_lists-citations",
         "--to=html5", "--no-highlight", "--wrap=none"],
        input=markdown, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"pandoc failed:\n{proc.stderr}")
    return proc.stdout


# --- generated blocks -----------------------------------------------------

def cap_block(cap_id: str) -> str:
    cap = CAPS.get(cap_id)
    if not cap:
        raise SystemExit(f"@cap {cap_id}: not in the registry")
    ground = cap["ground"]
    anchors = "".join(
        f'<code>{html.escape(a["anchor"])}</code>' for a in cap["wire"])
    draft = any(a["anchor"] in DRAFT_ONLY and a["spec"] == "apps"
                for a in cap["wire"])
    recipes = ", ".join(
        f'<a href="{r}.html">{html.escape(RECIPES[r]["name"])}</a>'
        for r in cap["recipes"]) or "none yet"
    lab = (f'<a href="#{cap["lab"]}">{cap["lab"]}</a>' if cap["lab"]
           else "no live demo")
    tag = "Core" if cap["tag"] == "core" else "Extended"
    return (
        f'<div class="cap" id="{cap_id}">'
        f'<div class="cap-head">'
        f'<code class="cap-id">{cap_id}</code>'
        f'<span class="cap-tag {cap["tag"]}">{tag}</span>'
        f'<span class="cap-level">Level {cap["level"]}</span>'
        f'<span class="cap-ground {ground}">{GROUND_LABEL[ground]}</span>'
        + ('<span class="cap-ground draft">Draft only</span>' if draft else "")
        + f'</div>'
        f'<p class="cap-summary">{html.escape(cap["summary"])}</p>'
        f'<dl class="cap-facts">'
        + (f'<dt>Messages</dt><dd>{anchors}</dd>' if anchors else "")
        + f'<dt>Ground</dt><dd>{html.escape(GROUNDS[ground])}</dd>'
        f'<dt>Recipes</dt><dd>{recipes}</dd>'
        f'<dt>Demo</dt><dd>{lab}</dd>'
        f'</dl></div>'
    )


def recipe_block(recipe_id: str) -> str:
    recipe = RECIPES.get(recipe_id)
    if not recipe:
        raise SystemExit(f"@recipe {recipe_id}: not in the registry")
    delta = "".join(f'<code><a href="{CAPS[c]["chapter"]}.html#{c}">{c}</a></code>'
                    for c in recipe["delta"]) or "<em>empty</em>"
    every = "".join(f'<code><a href="{CAPS[c]["chapter"]}.html#{c}">{c}</a></code>'
                    for c in recipe["capabilities"])
    levels = sorted({CAPS[c]["level"] for c in recipe["capabilities"]})
    return (
        f'<div class="cap recipe" id="{recipe_id}">'
        f'<div class="cap-head"><code class="cap-id">{recipe_id}</code>'
        f'<span class="cap-tag core">{html.escape(recipe["name"])}</span>'
        f'<span class="cap-level">Needs level {max(levels)}</span></div>'
        f'<p class="cap-summary">{html.escape(recipe["goal"])}</p>'
        f'<dl class="cap-facts">'
        f'<dt>Capability delta</dt><dd class="ids">{delta}</dd>'
        f'<dt>All capabilities</dt><dd class="ids">{every}</dd>'
        f'</dl></div>'
    )


def demo_block(demo_id: str) -> str:
    return (f'<div class="demo" data-demo="{demo_id}" id="{demo_id}">'
            f'<noscript><p class="demo-error">The live application needs '
            f'JavaScript. Its source is in the repository under '
            f'<code>apps/</code>.</p></noscript></div>')


def index_block() -> str:
    rows = []
    for cap in sorted(REGISTRY["capabilities"], key=lambda c: c["id"]):
        anchors = " ".join(f'<code>{html.escape(a["anchor"])}</code>'
                           for a in cap["wire"]) or "&mdash;"
        rows.append(
            f'<tr><td><a href="{cap["chapter"]}.html#{cap["id"]}">'
            f'<code>{cap["id"]}</code></a></td>'
            f'<td>{cap["level"]}</td>'
            f'<td>{"Core" if cap["tag"] == "core" else "Extended"}</td>'
            f'<td><span class="cap-ground {cap["ground"]}">'
            f'{GROUND_LABEL[cap["ground"]]}</span></td>'
            f'<td>{anchors}</td>'
            f'<td class="num">{len(cap["recipes"])}</td></tr>')
    return ('<div class="table-wrap"><table class="index"><thead><tr>'
            '<th>Capability</th><th>Level</th><th>Tag</th><th>Ground</th>'
            '<th>Messages</th><th class="num">Recipes</th></tr></thead><tbody>'
            + "".join(rows) + "</tbody></table></div>")


def matrix_block() -> str:
    recipes = REGISTRY["recipes"]
    head = "".join(f'<th class="rot"><span>{html.escape(r["name"])}</span></th>'
                   for r in recipes)
    rows = []
    for cap in REGISTRY["capabilities"]:
        cells = "".join(
            f'<td class="{"hit" if r["id"] in cap["recipes"] else "miss"}">'
            f'{"&#x2715;" if r["id"] in cap["recipes"] else ""}</td>'
            for r in recipes)
        rows.append(f'<tr><th><a href="{cap["chapter"]}.html#{cap["id"]}">'
                    f'<code>{cap["id"]}</code></a></th>{cells}</tr>')
    return ('<div class="table-wrap"><table class="matrix"><thead><tr><th></th>'
            + head + "</tr></thead><tbody>" + "".join(rows)
            + "</tbody></table></div>")


def gaps_block() -> str:
    rows = []
    for cap in REGISTRY["capabilities"]:
        if cap["ground"] != "gap":
            continue
        rows.append(
            f'<tr><td><a href="{cap["chapter"]}.html#{cap["id"]}">'
            f'<code>{cap["id"]}</code></a></td>'
            f'<td>{cap["level"]}</td>'
            f'<td>{html.escape(cap["summary"])}</td>'
            f'<td class="num">{len(cap["recipes"])}</td></tr>')
    return ('<div class="table-wrap"><table><thead><tr><th>Capability</th>'
            '<th>Level</th><th>What is missing</th>'
            '<th class="num">Recipes blocked</th></tr></thead><tbody>'
            + "".join(rows) + "</tbody></table></div>")


def checklists_block() -> str:
    out = []
    for level in sorted(LEVELS, key=int):
        info = LEVELS[level]
        caps = [c for c in REGISTRY["capabilities"]
                if c["level"] == int(level) and c["tag"] == "core"]
        items = "".join(
            f'<li><code>{c["id"]}</code> &mdash; {html.escape(c["summary"])}'
            + (' <span class="cap-ground gap">not standardised</span>'
               if c["ground"] == "gap" else "")
            + '</li>' for c in caps)
        extended = [c for c in REGISTRY["capabilities"]
                    if c["level"] == int(level) and c["tag"] == "extended"]
        out.append(
            f'<h3 id="level-{level}">Level {level}: {info["name"]}</h3>'
            f'<p>{html.escape(info["summary"])} A host claiming level {level} '
            f'passes every check below, and the checks for every level under '
            f'it. {len(extended)} further capabilities at this level are '
            f'extended and may be absent.</p>'
            f'<ul class="checklist">{items}</ul>')
    return "".join(out)


MARKERS = {
    "@index": lambda arg: index_block(),
    "@matrix": lambda arg: matrix_block(),
    "@gaps": lambda arg: gaps_block(),
    "@checklists": lambda arg: checklists_block(),
    "@cap": cap_block,
    "@demo": demo_block,
    "@recipe": recipe_block,
}

MARKER_RE = re.compile(r"<p>(@[a-z]+)(?:\s+([^<\s]+))?</p>")

# A number the repository can compute about itself. Written `@n{listings}` in
# the prose and replaced here, so that no chapter can carry a stale total.
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location("check_counts", ROOT / "tools" / "check_counts.py")
_counts = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_counts)
FACTS = _counts.facts()

COUNT_RE = re.compile(r"@n\{([a-z0-9 ]+)\}")


def fill_counts(text: str) -> str:
    def one(m: re.Match) -> str:
        key = m.group(1)
        if key not in FACTS:
            raise SystemExit(f"@n{{{key}}}: not a known fact; "
                             f"known are {', '.join(sorted(FACTS))}")
        return str(FACTS[key])
    return COUNT_RE.sub(one, text)
FIG_RE = re.compile(r'<p><img src="(figures/[^"]+)" alt="([^"]*)"\s*/?></p>')
LISTING_RE = re.compile(
    r"<!--\s*listing:\s*(?P<kind>extracted|captured|illustrative)"
    r"(?P<rest>[^>]*?)-->\s*(?P<pre><(?:pre|div)\b)", re.S)


def transform(body: str) -> str:
    def marker(m: re.Match) -> str:
        name, arg = m.group(1), m.group(2)
        if name not in MARKERS:
            return m.group(0)
        return MARKERS[name](arg)

    def figure(m: re.Match) -> str:
        src, alt = m.group(1), m.group(2)
        return (f'<figure><img src="{src}" alt="{html.escape(alt, quote=True)}"'
                f' loading="lazy"><figcaption>{alt}</figcaption></figure>')

    def listing(m: re.Match) -> str:
        kind = m.group("kind")
        rest = re.sub(r"`([^`]+)`", r"<code>\1</code>", m.group("rest").strip())
        text = {
            "extracted": "Extracted from",
            "captured": "Captured output",
            "illustrative": "Illustrative, not run",
        }[kind] + (" " + rest if rest else "")
        return f'<p class="provenance {kind}">{text}</p>' + m.group("pre")

    body = re.sub(r"<colgroup>.*?</colgroup>\s*", "", body, flags=re.S)
    body = re.sub(r'<tr class="(?:header|odd|even)">', "<tr>", body)
    body = LISTING_RE.sub(listing, body)
    body = MARKER_RE.sub(marker, body)
    body = fill_counts(body)
    body = FIG_RE.sub(figure, body)
    body = body.replace("<table>", '<div class="table-wrap"><table>')
    body = body.replace("</table>", "</table></div>")
    body = body.replace('<div class="table-wrap"><div class="table-wrap">',
                        '<div class="table-wrap">')
    body = body.replace("</table></div></div>", "</table></div>")
    return body


# --- template -------------------------------------------------------------

CSS = (ROOT / "tools" / "book.css").read_text(encoding="utf-8")
COPY_JS = (ROOT / "tools" / "copy.js").read_text(encoding="utf-8")


def sidebar(pages: list[Page], current: str) -> str:
    out = [f'<nav class="toc"><a class="brand" href="index.html">'
           f'{html.escape(TITLE)}</a>',
           f'<p class="tagline">{html.escape(SUBTITLE)}</p>']
    part = None
    for p in pages:
        if p.part != part:
            part = p.part
            out.append(f'<div class="part">{html.escape(part)}</div>')
        cls = ' class="current"' if p.slug == current else ""
        out.append(f'<a href="{p.href}"{cls}>{html.escape(p.label)}</a>')
    out.append(f'<div class="part">Elsewhere</div><a href="{REPO}">Repository</a>')
    out.append("</nav>")
    return "\n".join(out)


def page_html(pages: list[Page], p: Page, body: str, extra_title: str = "",
              needs_demo: bool = False) -> str:
    i = next((k for k, q in enumerate(pages) if q.slug == p.slug), -1)
    prev_p = pages[i - 1] if i > 0 else None
    next_p = pages[i + 1] if 0 <= i < len(pages) - 1 else None
    pager = ""
    if prev_p or next_p:
        left = (f'<a href="{prev_p.href}"><span class="dir">Previous</span>'
                f'{html.escape(prev_p.label)}</a>' if prev_p else "<span></span>")
        right = (f'<a href="{next_p.href}" style="text-align:right">'
                 f'<span class="dir">Next</span>{html.escape(next_p.label)}</a>'
                 if next_p else "<span></span>")
        pager = f'<div class="pager">{left}{right}</div>'

    demo_bits = ('<link rel="stylesheet" href="demos/demo.css">'
                 if needs_demo else "")
    demo_script = ('<script type="module" src="demos/demo.js"></script>'
                   if needs_demo else "")
    head_title = extra_title or p.label
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(head_title)} &middot; {html.escape(TITLE)}</title>
<meta name="description" content="{html.escape(p.summary or SUBTITLE)}">
<meta property="og:title" content="{html.escape(head_title)}">
<meta property="og:description" content="{html.escape(p.summary or SUBTITLE)}">
<link rel="stylesheet" href="book.css">
{demo_bits}
</head>
<body>
<div class="layout">
{sidebar(pages, p.slug)}
<main>
{body}
{pager}
</main>
</div>
{demo_script}
<script src="copy.js"></script>
</body>
</html>
"""


def build_index(pages: list[Page]) -> str:
    parts: dict[str, list[Page]] = {}
    for p in pages:
        parts.setdefault(p.part, []).append(p)

    caps = REGISTRY["capabilities"]
    counts = {g: sum(1 for c in caps if c["ground"] == g) for g in GROUNDS}

    hero = f"""<div class="hero">
<img src="figures/cover.png" alt="Cover of {html.escape(TITLE)}">
<div>
<h1>{html.escape(TITLE)}</h1>
<p class="sub">{html.escape(SUBTITLE)}</p>
<p>An MCP application is a sandboxed iframe that speaks JSON-RPC to a host it
does not trust, on behalf of a user it can see and a model it cannot. This
book takes that surface apart: {len(caps)} atomic capabilities, the components
they compose into, {len(REGISTRY["recipes"])} application recipes that put them
under load, and a conformance suite that decides whether a host really supports
what it claims.</p>
<p>Every capability entry says where its behaviour comes from:
{counts["wire"]} are messages in the MCP Apps extension,
{counts["core"]} come from core MCP,
{counts["platform"]} are the browser inside the sandbox,
{counts["app"]} are yours to build, and
{counts["gap"]} have no standard mechanism at all. The last group is the most
interesting part of the book.</p>
<p>Pinned to core protocol <code>{REGISTRY["protocol"]["core"]}</code>, the MCP
Apps extension <code>{REGISTRY["protocol"]["apps"]}</code>, and SDK
<code>{REGISTRY["protocol"]["sdk"]}</code>. The applications on these pages are
running, not recorded. <a href="{REPO}">Repository</a>.</p>
</div>
</div>"""

    sections = []
    for part, group in parts.items():
        cards = []
        for p in group:
            if p.part == "Appendices":
                n = f"Appendix {p.number}"
            elif p.part.startswith("Part V "):
                n = f"Recipe {p.number}"
            elif p.number:
                n = f"Chapter {p.number}"
            else:
                n = "&nbsp;"
            cards.append(f'<a href="{p.href}"><span class="n">{n}</span>'
                         f'<div class="t">{html.escape(p.title)}</div>'
                         f'<div class="s">{html.escape(p.summary)}</div></a>')
        sections.append(f'<h2>{html.escape(part)}</h2>\n<div class="cards">'
                        + "\n".join(cards) + "</div>")
    return hero + "\n" + "\n".join(sections)


def main() -> int:
    pages = collect()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "book.css").write_text(CSS, encoding="utf-8")
    (OUT / "copy.js").write_text(COPY_JS, encoding="utf-8")
    (OUT / ".nojekyll").write_text("")

    seen_caps: set[str] = set()
    for p in pages:
        for m in re.finditer(r"^@cap\s+(\S+)", p.body, re.M):
            seen_caps.add(m.group(1))

        eyebrow = ""
        if p.number:
            kind = ("Appendix" if p.part == "Appendices"
                    else "Recipe" if p.part.startswith("Part V ") else "Chapter")
            eyebrow = f'<p class="eyebrow">{kind} {p.number}</p>'
        summary = (f'<p class="summary">{html.escape(p.summary)}</p>'
                   if p.summary else "")
        body = (eyebrow + f"<h1>{html.escape(p.title)}</h1>" + summary
                + transform(pandoc(p.body)))
        needs_demo = 'class="demo"' in body
        (OUT / p.href).write_text(page_html(pages, p, body, needs_demo=needs_demo),
                                  encoding="utf-8")

    index = Page(path=Path("index"), slug="index", title="Contents", part="",
                 summary=SUBTITLE)
    (OUT / "index.html").write_text(
        page_html(pages, index, build_index(pages), extra_title="Contents"),
        encoding="utf-8")

    words = sum(len(re.findall(r"[A-Za-z][A-Za-z'-]+", p.body)) for p in pages)
    missing = sorted(set(CAPS) - seen_caps)
    print(f"{len(pages) + 1} pages, ~{words:,} words -> docs/")
    if missing:
        print(f"  {len(missing)} capabilities have no entry yet: "
              + ", ".join(missing[:6]) + ("…" if len(missing) > 6 else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
