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

Run:  python3 scripts/audit_staleness.py   (with the public database's credentials in the environment)
"""
from __future__ import annotations

import pathlib
import re
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

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
DATED = re.compile(rf"\b(?:{MONTHS})(?: \d{{1,2}},)? 20\d\d\b")
CODE_COMMENT = re.compile(r"//.*?$|/\*[\s\S]*?\*/|\{/\*[\s\S]*?\*/\}", re.M)


def live_figures() -> set[str] | None:
    """Numbers the site publishes, formatted as copy would, from the public
    database's disclosure summary (perm_docs['disclosure_stats']). None when it
    can't be read: then the FIGURE class can't run, and the audit says so and
    fails. (It read a Convex function until that was deleted on Oct 1 2026, and
    for three weeks printed "skipped" and passed.)"""
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        from lib_db import Database, read_doc  # noqa: PLC0415

        d = read_doc(Database(), "disclosure_stats")
    except (Exception, SystemExit) as e:  # noqa: BLE001 - lib_db exits when no credentials are set
        print(f"could not read the published figures: {type(e).__name__}", file=sys.stderr)
        return None
    if not isinstance(d, dict):
        return None
    out: set[str] = set()
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
    if not figures:
        print("FAIL: no published figures to compare against, so the FIGURE class can't run "
              "(needs DATABASE_URL and DATABASE_AUTH_TOKEN for the public database)")
        return 2
    print(f"live figures   : {len(figures)} read from perm_docs['disclosure_stats']")

    fig_hits: list[str] = []
    date_hits: list[str] = []
    year_hits: list[str] = []

    for p in paths:
        raw = p.read_text(errors="replace")
        # Comments are not copy. A date in a comment is a note, not a claim.
        body = CODE_COMMENT.sub(" ", raw)
        rel = p.relative_to(ROOT)

        for fig in figures:
            if len(fig) < 5:
                continue
            for m in re.finditer(re.escape(fig), body):
                # A figure in a sentence that names its month is a dated record ("373,939 decided cases
                # in DOL's files for October 2023 through June 2026"): true for good, not a stale literal.
                start = max(body.rfind(". ", 0, m.start()), body.rfind("\n", 0, m.start())) + 1
                ends = [i for i in (body.find(". ", m.end()), body.find("\n", m.end())) if i >= 0]
                if DATED.search(body[start:min(ends) if ends else len(body)]):
                    continue
                fig_hits.append(f"{rel}: hardcodes {fig!r}, which the site publishes, with no date beside it")
                break

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
