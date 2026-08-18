#!/usr/bin/env python3
"""Prose linter for the book.

Enforces the house rules:

  1. No em dashes. Not one.
  2. No AI slop: a banned-phrase list of the tics that make text read as
     generated.
  3. No saying the same thing twice: near-duplicate sentence detection, within
     a chapter and across the whole book.
  4. Every chapter has a summary and lands in the target word range.

    python3 tools/lint_prose.py
    python3 tools/lint_prose.py --warnings
    python3 tools/lint_prose.py book/chapters/ch05.md
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# --- Rule 1: dashes -------------------------------------------------------

DASH_PATTERNS = [
    ("em dash (U+2014)", re.compile(r"—")),
    ("spaced en dash used as an em dash", re.compile(r"(?<=\w)\s+–\s+(?=\w)")),
    ("spaced double hyphen used as an em dash", re.compile(r"(?<=\w)\s+--\s+(?=\w)")),
]

# --- Rule 2: slop ---------------------------------------------------------

SLOP = [
    r"it(?:'s| is) (?:important|worth|crucial|essential|vital) to (?:note|remember|understand|mention)",
    r"it should be noted that",
    r"needless to say",
    r"as we (?:have )?(?:already )?(?:mentioned|discussed|seen) (?:above|earlier|previously)",
    r"in (?:today|this day and age)'?s? (?:fast[- ]paced|modern|ever[- ]changing|digital) (?:world|landscape|era)",
    r"in the (?:ever[- ]evolving|rapidly changing) (?:world|landscape|field) of",
    r"\bleverage\b(?!s\b)",
    r"\bdelve into\b",
    r"\bdive deep(?:er)? into\b",
    r"\bunlock the (?:power|potential)\b",
    r"\bharness the (?:power|potential)\b",
    r"\bgame[- ]chang(?:er|ing)\b",
    r"\bparadigm shift\b",
    r"\bseamless(?:ly)? integrat",
    r"\brobust and scalable\b",
    r"\bcutting[- ]edge\b",
    r"\bstate-of-the-art\b",
    r"\bbest[- ]in[- ]class\b",
    r"\bsupercharge\b",
    r"\bsynerg",
    r"\bholistic approach\b",
    r"\btreasure trove\b",
    r"\bmyriad of\b",
    r"\bplethora of\b",
    r"\bnavigate the complexit",
    r"\btapestry\b",
    r"\brealm of\b",
    r"\blandscape of\b",
    r"in conclusion,",
    r"to sum(?:mari[sz]e|ming up),",
    r"at the end of the day,",
    r"the (?:bottom|key) (?:line|takeaway) is (?:that|simply)",
    r"only time will tell",
    r"the possibilities are endless",
    r"\bcertainly[,!]",
    r"\bgreat question\b",
    r"let'?s (?:dive|jump) (?:in|right in)\b",
    r"\bi hope this helps\b",
    r"\bfeel free to\b",
    r"\bincredibly powerful\b",
    r"\bextremely important\b",
    r"\bvery unique\b",
    r"\btruly remarkable\b",
]
SLOP_RE = [(p, re.compile(p, re.IGNORECASE)) for p in SLOP]

# "Not just X, but Y" and its relatives are the most recognisable generated
# cadences. Allowed sparingly, flagged past a budget.
CADENCE = [
    ("not-just-but", re.compile(r"\bnot (?:just|only) [^.;:]{3,60}?,? but\b", re.I)),
    ("isnt-about-its-about",
     re.compile(r"\bis(?:n't| not) about [^.;:]{3,60}?[,.] it'?s about\b", re.I)),
    ("thats-not-x-thats-y",
     re.compile(r"\bthat'?s not [^.;:]{3,40}?\. that'?s\b", re.I)),
]
CADENCE_BUDGET = 3

# --- Markdown stripping ---------------------------------------------------

_FENCE_RE = re.compile(r"^```.*?^```", re.S | re.M)
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
_FRONT_RE = re.compile(r"\A---\n.*?\n---\n", re.S)
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_TABLE_RE = re.compile(r"^\|.*\|$", re.M)


def blank(m: re.Match) -> str:
    return re.sub(r"[^\n]", " ", m.group(0))


def strip_md(text: str) -> str:
    """Reduce Markdown to the prose a reader actually reads, preserving lines."""
    text = _FRONT_RE.sub(blank, text)
    text = _FENCE_RE.sub(blank, text)
    text = _IMG_RE.sub(blank, text)
    text = _INLINE_CODE_RE.sub(blank, text)
    text = _TABLE_RE.sub(blank, text)
    text = _LINK_RE.sub(lambda m: m.group(1) + " " * (len(m.group(0)) - len(m.group(1))), text)
    return text


# --- Rule 3: repetition ---------------------------------------------------

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "is",
    "are", "was", "were", "be", "been", "it", "its", "that", "this", "with",
    "as", "at", "by", "from", "you", "your", "we", "our", "not", "if", "then",
    "than", "so", "do", "does", "can", "will", "there", "their", "they", "has",
    "have", "had", "what", "when", "which", "who", "how", "one", "all", "no",
}


def fingerprint(sentence: str) -> frozenset[str]:
    words = re.findall(r"[a-z]+", sentence.lower())
    return frozenset(w for w in words if w not in STOPWORDS and len(w) > 3)


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


@dataclass
class Finding:
    path: Path
    line: int
    rule: str
    message: str
    level: str = "error"

    def render(self) -> str:
        rel = self.path.relative_to(ROOT) if self.path.is_absolute() else self.path
        tag = "error" if self.level == "error" else "warn "
        return f"{rel}:{self.line}: {tag} [{self.rule}] {self.message}"


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def excerpt(text: str, index: int, span: int = 46) -> str:
    lo = max(0, index - span // 2)
    hi = min(len(text), index + span)
    return " ".join(text[lo:hi].split())


# Reference chapters carry entries as well as argument, so the band is wider
# than a pure prose book's. Under the floor usually means an entry was left as
# a stub; over the ceiling usually means two chapters.
TARGET_LOW, TARGET_HIGH = 1500, 3800


def lint_file(path: Path, sentence_index: dict) -> list[Finding]:
    raw = path.read_text(encoding="utf-8")
    prose = strip_md(raw)
    findings: list[Finding] = []
    is_chapter = path.parent.name == "chapters"

    for name, pat in DASH_PATTERNS:
        for m in pat.finditer(raw):
            findings.append(Finding(path, line_of(raw, m.start()), "dash",
                                    f"{name}: ...{excerpt(raw, m.start())}..."))

    for _, pat in SLOP_RE:
        for m in pat.finditer(prose):
            findings.append(Finding(path, line_of(prose, m.start()), "slop",
                                    f'"{m.group(0).strip()}" ...{excerpt(prose, m.start())}...'))

    for name, pat in CADENCE:
        hits = list(pat.finditer(prose))
        for m in hits[CADENCE_BUDGET:]:
            findings.append(Finding(path, line_of(prose, m.start()), "cadence",
                                    f'"{name}" used {len(hits)} times, budget is '
                                    f"{CADENCE_BUDGET}: ...{excerpt(prose, m.start())}..."))

    if not re.search(r"^summary:", raw, re.M):
        findings.append(Finding(path, 1, "front-matter", "no summary in front matter"))

    words = len(re.findall(r"[A-Za-z][A-Za-z'-]+", prose))
    if is_chapter and words < TARGET_LOW:
        findings.append(Finding(path, 1, "length",
                                f"{words} words, under the {TARGET_LOW} target",
                                level="warn"))
    if is_chapter and words > TARGET_HIGH:
        findings.append(Finding(path, 1, "length",
                                f"{words} words, over the {TARGET_HIGH} ceiling; "
                                "a chapter this long is usually hiding two",
                                level="warn"))

    # Closing summaries restate the chapter on purpose, so they are exempt.
    summary = re.search(r"^## What to remember", raw, re.M)
    limit = len(prose) if summary is None else summary.start()

    # Appendices and recipe entries are condensed restatements by design,
    # and every recipe instantiates the same template.
    if path.parent.name in ("appendices", "recipes"):
        return findings

    for m in re.finditer(r"[^.!?\n][^.!?]{40,}[.!?]", prose[:limit]):
        sentence = " ".join(m.group(0).split())
        fp = fingerprint(sentence)
        if len(fp) < 6:
            continue
        sentence_index[path].append((line_of(prose, m.start()), sentence, fp))

    return findings


def lint_repetition(sentence_index: dict, threshold: float = 0.72) -> list[Finding]:
    postings: dict[str, list[tuple]] = defaultdict(list)
    findings: list[Finding] = []
    seen: set[tuple] = set()

    for path, entries in sentence_index.items():
        for line, sentence, fp in entries:
            candidates: set[tuple] = set()
            for word in fp:
                candidates.update(postings.get(word, ()))
            for cpath, cline, csentence, cfp in candidates:
                score = jaccard(fp, cfp)
                if score < threshold:
                    continue
                key = tuple(sorted([(str(path), line), (str(cpath), cline)]))
                if key in seen:
                    continue
                seen.add(key)
                where = (f"line {cline}" if cpath == path
                         else f"{cpath.relative_to(ROOT)}:{cline}")
                findings.append(Finding(
                    path, line, "repetition",
                    f"{score:.0%} overlap with {where}: "
                    f'"{sentence[:70]}..." / "{csentence[:70]}..."', level="warn"))
            for word in fp:
                postings[word].append((path, line, sentence, fp))
    return findings


def collect(paths: list[str]) -> list[Path]:
    if paths:
        return [Path(p).resolve() for p in paths]
    out: list[Path] = []
    for sub in ("frontmatter", "chapters", "recipes", "appendices"):
        out.extend(sorted((ROOT / "book" / sub).glob("*.md")))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--warnings", action="store_true")
    args = ap.parse_args()

    files = collect(args.paths)
    if not files:
        print("no .md files found", file=sys.stderr)
        return 0

    sentence_index: dict[Path, list] = defaultdict(list)
    findings: list[Finding] = []
    for path in files:
        findings.extend(lint_file(path, sentence_index))
    findings.extend(lint_repetition(sentence_index))

    errors = [f for f in findings if f.level == "error"]
    warns = [f for f in findings if f.level == "warn"]

    if not args.quiet:
        for f in sorted(errors + (warns if args.warnings else []),
                        key=lambda f: (str(f.path), f.line)):
            print(f.render())
        words = sum(
            len(re.findall(r"[A-Za-z][A-Za-z'-]+", strip_md(p.read_text(encoding="utf-8"))))
            for p in files
        )
        print(f"\n{len(files)} files, ~{words:,} words of prose, "
              f"{len(errors)} error(s), {len(warns)} warning(s)"
              + ("" if args.warnings else " (use --warnings to list warnings)"))

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
