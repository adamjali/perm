#!/usr/bin/env python3
"""Where H-1B prevailing wages come from: OES, a private survey, or a union contract.

DOL's LCA file names, for each application, where the prevailing wage the
employer attested to came from (Section F): PW_OES_YEAR when it was OES, or
PW_OTHER_SOURCE ("Survey", "CBA", "SCA", "DBA") with, for a survey, its
publisher and name. Under 20 CFR 655.731(a)(2) a union contract's rate applies
where one covers the occupation; otherwise an employer may use "a wage obtained
from an OFLC NPC (OES), an independent authoritative source, or other
legitimate sources of wage data". This counts what each application used.

Writes perm_docs['lca_wage_sources']: the split by fiscal year, the survey
publishers (spellings of one firm grouped, each spelling kept), the survey
names, and the employers that use private surveys most, with their share of
their own LCAs. Counts only rows the LCA detail backfill has reached (a
prevailing wage on file); the doc says how many.

Usage:
    python3 scripts/build_wage_sources.py            # rebuild the doc
    python3 scripts/build_wage_sources.py --dry-run  # print it
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, record_run, rows_of, write_doc  # noqa: E402

DOC_KEY = "lca_wage_sources"
KINDS = ("OES", "Survey", "CBA", "SCA", "DBA", "Other")
TOP_PUBLISHERS = 15
TOP_SURVEYS = 25
TOP_EMPLOYERS = 25
MIN_EMPLOYER_LCAS = 20

# Spellings of one survey firm, grouped. Matched on the publisher's letters
# with company words dropped; anything not listed stands as its own group.
# Radford is part of Aon, and its surveys carry its own name, so it's its own
# group; "AON Radford" goes with Radford.
# The needles were read off production's own spellings (Oct 4 2026): "Willis
# Tower Watson", "Wills Towers Watson", "WTW", five spellings of the AAMC and
# four of CUPA-HR. Mercer publishes the MBD/TRS surveys.
PUBLISHER_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ("Radford (Aon)", ("radford",)),
    ("Aon", ("aon",)),
    ("Willis Towers Watson", ("willis towers watson", "willis tower watson", "wills towers watson",
                              "towers watson", "wtw")),
    ("Mercer", ("mercer", "mbd trs")),
    ("Pearl Meyer", ("pearl meyer",)),
    ("Association of American Medical Colleges", ("aamc", "association of american medical colleges",
                                                  "american association of medical colleges")),
    ("CUPA-HR", ("cupa", "college and university professional", "college university professional",
                 "coll and univ prof")),
    ("DC SHRM", ("dc shrm", "dc society for human resource management")),
    ("U.S. Bureau of Labor Statistics", ("bureau of labor statistics",)),
    ("American Institute of Architects", ("american institute of architects",)),
    ("Economic Research Institute", ("economic research institute", "eri")),
    ("Culpepper", ("culpepper",)),
    ("Payscale", ("payscale",)),
    ("Salary.com", ("salary com", "salarycom")),
]
_COMPANY_WORDS = re.compile(r"\b(inc|llc|plc|ltd|corp|corporation|company|co|data services|hewitt|partners)\b")


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def _letters(name: str) -> str:
    letters = re.sub(r"[^a-z0-9 ]+", " ", name.lower())
    return " ".join(_COMPANY_WORDS.sub(" ", letters).split())


def publisher_group(name: str) -> str:
    letters = _letters(name)
    for label, needles in PUBLISHER_GROUPS:
        if any(re.search(rf"\b{re.escape(n)}\b", letters) for n in needles):
            return label
    return " ".join(name.split())


def publisher_key(name: str) -> str:
    """A listed firm groups by its label; anything else by its letters, so "DC
    Shrm" and "DC SHRM" are one row."""
    label = publisher_group(name)
    return label if any(label == g for g, _ in PUBLISHER_GROUPS) else f"~{_letters(name)}"


def read(db: Turso) -> dict:
    by_year: dict[int, Counter] = defaultdict(Counter)
    for fy, oes, other, n in rows_of(db.execute(
            "SELECT fiscal_year, pw_oes_year IS NOT NULL, pw_other_source, COUNT(*) FROM lca_cases "
            "WHERE pw_wage IS NOT NULL GROUP BY 1, 2, 3")):
        if num(oes):
            kind = "OES"
        else:
            kind = {"SURVEY": "Survey", "CBA": "CBA", "SCA": "SCA", "DBA": "DBA"}.get(
                str(other or "").strip().upper(), "Other")
        by_year[num(fy)][kind] += num(n)
    publishers = Counter()
    for name, n in rows_of(db.execute(
            "SELECT pw_survey_publisher, COUNT(*) FROM lca_cases WHERE pw_other_source = 'Survey' "
            "AND pw_survey_publisher IS NOT NULL GROUP BY 1")):
        publishers[str(name)] += num(n)
    surveys = Counter()
    for name, n in rows_of(db.execute(
            "SELECT pw_survey_name, COUNT(*) FROM lca_cases WHERE pw_other_source = 'Survey' "
            "AND pw_survey_name IS NOT NULL GROUP BY 1")):
        surveys[" ".join(str(name).split())] += num(n)
    emp_total = Counter()
    emp_survey = Counter()
    names: dict[str, str] = {}
    for slug, name, n, s in rows_of(db.execute(
            "SELECT employer_slug, MAX(employer_name), COUNT(*), SUM(pw_other_source = 'Survey') FROM lca_cases "
            "WHERE pw_wage IS NOT NULL AND employer_slug IS NOT NULL GROUP BY employer_slug")):
        emp_total[str(slug)] += num(n)
        emp_survey[str(slug)] += num(s)
        names.setdefault(str(slug), str(name or slug))
    page_of: dict[str, str] = {}
    try:
        for src, page in rows_of(db.execute("SELECT source_slug, page_slug FROM employer_page_map")):
            page_of[str(src)] = str(page)
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    return {"by_year": by_year, "publishers": publishers, "surveys": surveys, "emp_total": emp_total,
            "emp_survey": emp_survey, "names": names, "page_of": page_of}


def plan(d: dict, as_of: str) -> dict:
    """The doc. Pure, for the test."""
    years = []
    for fy in sorted(d["by_year"]):
        c = d["by_year"][fy]
        total = sum(c.values())
        years.append({"fy": fy, "total": total, **{k: c.get(k, 0) for k in KINDS}})
    groups: dict[str, Counter] = defaultdict(Counter)
    for name, n in d["publishers"].items():
        groups[publisher_key(name)][name] += n
    # An unlisted firm is named by its most common spelling.
    publishers = sorted(
        ({"name": g if not g.startswith("~") else " ".join(c.most_common(1)[0][0].split()),
          "n": sum(c.values()), "spellings": [s for s, _ in c.most_common(5)]} for g, c in groups.items()),
        key=lambda p: (-p["n"], p["name"]),
    )[:TOP_PUBLISHERS]
    surveys = [{"name": s, "n": n} for s, n in d["surveys"].most_common(TOP_SURVEYS)]
    # Employers by page, so a page's spellings count once.
    total = Counter()
    survey = Counter()
    label: dict[str, str] = {}
    for slug, n in d["emp_total"].items():
        page = d["page_of"].get(slug)
        key = page or f"name:{slug}"
        total[key] += n
        survey[key] += d["emp_survey"].get(slug, 0)
        label.setdefault(key, d["names"].get(slug, slug))
    employers = sorted(
        ({"slug": k if not k.startswith("name:") else None, "name": label[k], "survey": survey[k], "lcas": total[k]}
         for k in total if survey[k] > 0 and total[k] >= MIN_EMPLOYER_LCAS),
        key=lambda e: (-e["survey"], e["name"]),
    )[:TOP_EMPLOYERS]
    return {"asOf": as_of, "years": years, "publishers": publishers, "surveys": surveys, "employers": employers,
            "rows": sum(y["total"] for y in years)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Turso()
    as_of = str(rows_of(db.execute("SELECT MAX(decision_date) FROM lca_cases WHERE pw_wage IS NOT NULL"))[0][0] or "")[:10]
    doc = plan(read(db), as_of)
    log(f"LCAs with a prevailing wage on file {doc['rows']:,}; years {[y['fy'] for y in doc['years']]}; "
        f"top publisher {doc['publishers'][0]['name'] if doc['publishers'] else '-'}")
    if args.dry_run:
        print(json.dumps(doc, indent=1)[:3000])
        return 0
    write_doc(db, DOC_KEY, json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    record_run(db, "build_wage_sources.py", status="ok", rows_written=1,
               note=f"{doc['rows']:,} LCAs with a prevailing wage source", started_at=started)
    log("  ok  written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
