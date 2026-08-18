#!/usr/bin/env python3
"""Density audit: is this a book, or a stack of LinkedIn posts?

The failure mode this measures is real and easy to fall into. Short paragraphs,
bulleted lists with bolded lead-ins, a header every two hundred words, and one
punchy assertion per line. It reads fluently and it teaches nothing, because
every claim is stated rather than argued.

The metrics, and why each one:

  bullet share       fraction of prose lines that are list items. High means the
                     argument was chopped into assertions.
  bold lead-ins      "**Thing.** Sentence." openers. The signature move of the
                     format. A few are useful; a page of them is a slide deck.
  mean paragraph     words per paragraph. Sustained reasoning needs paragraphs
                     that develop. Under 40 is a feed, not a chapter.
  longest run        the longest stretch of consecutive prose paragraphs broken
                     only by a heading. Figures, code, and tables do not break a
                     run, because they are evidence rather than interruption.
                     A chapter that never runs five paragraphs together never
                     argues anything at length.
  header interval    words between headings. The framing text runs somewhere
                     around 200, so this book aiming for the same is correct and
                     the earlier 280 threshold here was invented rather than
                     measured. Under 170 is genuinely skimmy.
  evidence           code blocks, tables, figures, and concrete numbers. Claims
                     that carry mechanism.

Thresholds are not invented. They come from measuring the framing text.

    Don't Make Me Think, Revisited, body text, pages 24-170:
      803 paragraphs, mean 46.4 words, median 42, p25/p75 33/57
      about 255 words per page, because the pages are half screenshots
      roughly 200 words per heading (a heuristic on extracted text, so
      treat it as an order of magnitude rather than a figure)

That book is the sparse end of the shelf and it still runs 46 words per
paragraph. A draft at 26 is not concise; it is chopped, and chopped prose states
things instead of arguing them. The targets below are set against that
measurement, and `tools/measure_reference.py` regenerates it.

Thresholds are advisory. Read the numbers, not the verdict.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FENCE = re.compile(r"^```.*?^```", re.S | re.M)
FRONT = re.compile(r"\A---\n.*?\n---\n", re.S)
BOLD_LEAD = re.compile(r"^\*\*[^*]{2,60}\.?\*\*[ ,.]", re.M)
NUMBERS = re.compile(r"\b\d[\d,.]*\s*(?:%|ms|s\b|px|words|pixels|\$|seconds|minutes)|\$\d")


def analyse(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    raw = FRONT.sub("", raw)

    code_blocks = len(FENCE.findall(raw))
    body = FENCE.sub("\n@@CODE@@\n", raw)

    lines = body.split("\n")
    headers = [l for l in lines if l.startswith("#")]
    bullets = [l for l in lines if re.match(r"^\s*[-*]\s+\S", l)]
    table_rows = [l for l in lines if l.startswith("|")]
    figures = len(re.findall(r"^!\[", body, re.M))

    # Paragraph blocks: runs of non-blank lines that are prose.
    paragraphs, run, kinds = [], [], []
    for l in lines + [""]:
        stripped = l.strip()
        if not stripped:
            if run:
                paragraphs.append(" ".join(run))
                run = []
            continue
        if stripped.startswith(("#", "|", ">", "-", "*", ":::", "@@CODE@@", "![")):
            if run:
                paragraphs.append(" ".join(run))
                run = []
            kinds.append("other")
            continue
        run.append(stripped)
        if len(kinds) == 0 or kinds[-1] != "para" or run == [stripped]:
            pass
    # Recompute kinds as an ordered stream for the run-length metric.
    stream = []
    run = []
    for l in lines + [""]:
        stripped = l.strip()
        if not stripped:
            if run:
                stream.append(("para", " ".join(run)))
                run = []
            continue
        if stripped.startswith(("#", "|", ">", "-", "*", ":::", "@@CODE@@", "![")):
            if run:
                stream.append(("para", " ".join(run)))
                run = []
            # Evidence sits inside an argument; a heading ends one.
            kind = "break" if stripped.startswith("#") else "evidence"
            stream.append((kind, stripped))
            continue
        run.append(stripped)

    longest, current = 0, 0
    for kind, _ in stream:
        if kind == "para":
            current += 1
            longest = max(longest, current)
        elif kind == "break":
            current = 0

    paras = [t for k, t in stream if k == "para"]
    words = sum(len(re.findall(r"[A-Za-z][A-Za-z'-]+", p)) for p in paras)
    prose_lines = len([l for l in lines if l.strip() and not l.startswith("#")])

    return {
        "file": path.name,
        "words": words,
        "paragraphs": len(paras),
        "mean_para": round(words / max(1, len(paras)), 1),
        "longest_run": longest,
        "bullets": len(bullets),
        "bullet_share": round(len(bullets) / max(1, prose_lines), 3),
        "bold_leadins": len(BOLD_LEAD.findall(body)),
        "headers": len(headers),
        "header_interval": round(words / max(1, len(headers))),
        "code": code_blocks,
        "tables": len([l for l in lines if l.startswith("|---") or re.match(r"^\|[\s:|-]+\|$", l)]),
        "figures": figures,
        "numbers": len(NUMBERS.findall(body)),
    }


def main() -> int:
    files = sorted((ROOT / "book" / "chapters").glob("*.md"))
    rows = [analyse(f) for f in files]

    print(f"{'file':<10}{'words':>6}{'para':>6}{'mean':>7}{'run':>5}"
          f"{'bul%':>6}{'bold':>6}{'hdr~':>6}{'code':>6}{'fig':>5}{'tbl':>5}{'num':>5}")
    print("-" * 73)
    for r in rows:
        print(f"{r['file']:<10}{r['words']:>6}{r['paragraphs']:>6}{r['mean_para']:>7}"
              f"{r['longest_run']:>5}{r['bullet_share']*100:>5.0f}%{r['bold_leadins']:>6}"
              f"{r['header_interval']:>6}{r['code']:>6}{r['figures']:>5}"
              f"{r['tables']:>5}{r['numbers']:>5}")

    tot = lambda k: sum(r[k] for r in rows)
    n = len(rows)
    print("-" * 73)
    print(f"{'ALL':<10}{tot('words'):>6}{tot('paragraphs'):>6}"
          f"{round(tot('words')/tot('paragraphs'),1):>7}"
          f"{round(sum(r['longest_run'] for r in rows)/n,1):>5}"
          f"{round(100*sum(r['bullet_share'] for r in rows)/n):>5}%"
          f"{tot('bold_leadins'):>6}{round(tot('words')/tot('headers')):>6}"
          f"{tot('code'):>6}{tot('figures'):>5}{tot('tables'):>5}{tot('numbers'):>5}")

    print("\nFlags (advisory):")
    flagged = 0
    for r in rows:
        notes = []
        if r["mean_para"] < 40:
            notes.append(f"mean paragraph {r['mean_para']} words: reads as a feed")
        if r["longest_run"] < 5:
            notes.append(f"longest unbroken run {r['longest_run']} paragraphs: never argues at length")
        if r["bullet_share"] > 0.22:
            notes.append(f"{r['bullet_share']*100:.0f}% of lines are bullets")
        if r["bold_leadins"] > 10:
            notes.append(f"{r['bold_leadins']} bold lead-ins: slide deck cadence")
        if r["header_interval"] < 170:
            notes.append(f"a heading every {r['header_interval']} words")
        evidence = r["code"] + r["figures"] + r["tables"]
        if evidence < 3:
            notes.append(f"only {evidence} pieces of evidence")
        if notes:
            flagged += 1
            print(f"  {r['file']}")
            for note in notes:
                print(f"    - {note}")
    if not flagged:
        print("  none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
