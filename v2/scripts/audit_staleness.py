#!/usr/bin/env python3
"""Find figures and dates that will go stale without anyone noticing.

The failure this catches has happened on this codebase: a DOL review count
lived as a literal in thirteen places, so the social card said 367 while the
header said 369. A hardcoded figure is not wrong when it is written. It goes
wrong silently, later, and only a reader notices.

Three classes, in descending severity:

  FIGURE   a number that also appears in the live payload, so there is a
           source of truth it is failing to read
  DATE     a date literal in code that is not a fallback and not a fixture
  YEAR     a bare year in visible copy, which dates the page

Run:  python3 scripts/audit_staleness.py
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN = [ROOT / "src" / "app", ROOT / "src" / "components", ROOT / "content"]
SKIP_PARTS = {"__tests__", "node_modules", ".next", "emails"}
# A file whose whole job is fixtures or generated data is not "stale copy".
SKIP_FILES = {"usStatesGeometry.ts", "socGroups.ts", "usStateNames.ts"}
# Storybook fixtures are SUPPOSED to be literal: a story with a live date
# would render differently every day and its snapshots would never settle.
# The first run of this audit reported 45 dates and roughly 40 were these.
SKIP_SUFFIXES = (".stories.tsx",)

CODE_COMMENT = re.compile(r"//.*?$|/\*[\s\S]*?\*/|\{/\*[\s\S]*?\*/\}", re.M)


def live_figures() -> set[str]:
    """Numbers the payload actually publishes, formatted as copy would."""
    out: set[str] = set()
    try:
        res = subprocess.run(
            ["npx", "--yes", "convex", "run", "permDisclosure:getLatest", "{}", "--prod"],
            capture_output=True, text=True, timeout=180, cwd=ROOT,
        )
        i = res.stdout.find("{")
        if i == -1:
            return out
        d = json.loads(res.stdout[i:])
    except Exception:
        return out
    for key in ("uniqueCases",):
        v = d.get(key)
        if isinstance(v, int):
            out.add(f"{v:,}")
            out.add(str(v))
    base = (d.get("risk") or {}).get("baseline") or {}
    for key in ("decided", "denied"):
        v = base.get(key)
        if isinstance(v, int):
            out.add(f"{v:,}")
    if isinstance(base.get("denialRate"), (int, float)):
        out.add(f"{base['denialRate']}")
    return out


def files() -> list[pathlib.Path]:
    out: list[pathlib.Path] = []
    for base in SCAN:
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.suffix not in (".tsx", ".ts", ".mdx"):
                continue
            if any(part in SKIP_PARTS for part in p.parts):
                continue
            if p.name in SKIP_FILES or p.name.endswith(SKIP_SUFFIXES):
                continue
            out.append(p)
    return out


def main() -> int:
    figures = live_figures()
    paths = files()
    print(f"scanned        : {len(paths)} files under src/app, src/components, content")
    print(f"live figures   : {len(figures)} pulled from the payload"
          f"{' (Convex unreachable, FIGURE class skipped)' if not figures else ''}")

    fig_hits: list[str] = []
    date_hits: list[str] = []
    year_hits: list[str] = []

    for p in paths:
        raw = p.read_text(errors="replace")
        # Comments are not copy. A date in a comment is a note, not a claim.
        body = CODE_COMMENT.sub(" ", raw)
        rel = p.relative_to(ROOT)

        for fig in figures:
            if len(fig) >= 5 and fig in body:
                fig_hits.append(f"{rel}: hardcodes {fig!r}, which the payload publishes")

        # An MDX entry's own frontmatter date is the entry's date. It is a
        # record of when something happened, not a figure that goes stale.
        scan_body = body
        if p.suffix == ".mdx":
            scan_body = re.sub(r"\A---[\s\S]*?---", " ", body)
        for m in re.finditer(r'"(20\d\d-\d\d-\d\d)"', scan_body):
            line = scan_body[:m.start()].count("\n") + 1
            ctx = scan_body[max(0, m.start() - 60):m.start()]
            # `?? "2026-08-24"` is a deliberate fallback; flag the rest.
            if "??" in ctx[-12:] or "||" in ctx[-12:]:
                continue
            date_hits.append(f"{rel}:{line}: date literal {m.group(1)}")

        if p.suffix == ".mdx" or "/app/" in str(rel):
            for m in re.finditer(r"\b(in|for|of|through)\s+(20\d\d)\b", body):
                line = body[:m.start()].count("\n") + 1
                year_hits.append(f"{rel}:{line}: {m.group(0)!r} in copy")

    for name, hits, note in (
        ("FIGURE", fig_hits, "should read the payload, not a literal"),
        ("DATE", date_hits, "a date literal that is not a fallback"),
        ("YEAR", year_hits, "a bare year in copy; fine if the claim is genuinely about that year"),
    ):
        print(f"\n{name}  ({len(hits)})  {note}")
        for h in hits[:12]:
            print(f"    {h}")
        if len(hits) > 12:
            print(f"    ... and {len(hits) - 12} more")

    # FIGURE is the only class that is unambiguously a defect.
    return 1 if fig_hits else 0


if __name__ == "__main__":
    sys.exit(main())
