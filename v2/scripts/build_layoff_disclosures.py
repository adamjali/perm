#!/usr/bin/env python3
"""What employers told DOL about layoffs on their PERM applications: `/perm-layoff-disclosures`.

THE QUESTION. Form 9089 asks whether the employer "had a layoff in the occupation
involved in this application or in a related occupation within the six (6) months
immediately preceding the filing" (Section G, Item 12 on the new form; Section I.e,
Item 26 on the old one). DOL's quarterly files print each answer as Y or N
(`perm_cases.layoff`, `perm_cases_history.layoff`). A yes doesn't bar a filing: the
employer must have notified and considered the laid-off workers (20 CFR 656.17(k)).

WHAT IT CARRIES (perm_docs['layoff_disclosures']):

* every fiscal year held (FY2016 on): decided cases, how many carry an answer, the
  yeses, and how the yes and the no cases ended (certified, denied, withdrawn);
* the newest fiscal year's employers that answered yes at least once, each with its
  yeses, its answered cases and its certified yeses, busiest first;
* that year's jobs (SOC groups) by yeses;
* each year's ten employers with the most yeses.

Every count is DOL's own answer on a decided case; a blank or unreadable answer is
counted as unanswered, never as no. An employer reaches its page through
`employer_page_map`; one with no page keeps its name and isn't linked.

Usage:
    python3 scripts/build_layoff_disclosures.py            # rebuild the doc
    python3 scripts/build_layoff_disclosures.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
import time
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, read_doc, record_run, rows_of, write_doc  # noqa: E402

DOC_KEY = "layoff_disclosures"
TABLES = ("perm_cases", "perm_cases_history")
OUTCOMES = ("certified", "denied", "withdrawn")
TOP_PER_YEAR = 10
JOBS_SHOWN = 15
# A year is shown only when most of its decided cases carry an answer: a year whose
# file doesn't print the question would read as an employer-wide zero.
MIN_ANSWERED_SHARE = 0.5


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def blank_year() -> dict:
    return {"cases": 0, "answered": 0, "yes": 0, "from": None, "through": None,
            "yesOutcomes": dict.fromkeys(OUTCOMES, 0), "noOutcomes": dict.fromkeys(OUTCOMES, 0)}


def fold_year(year: dict, status: str, layoff, n: int) -> None:
    """One (status, answer) count into its fiscal year."""
    year["cases"] += n
    if layoff not in ("Y", "N"):
        return
    year["answered"] += n
    if layoff == "Y":
        year["yes"] += n
    bucket = year["yesOutcomes" if layoff == "Y" else "noOutcomes"]
    if status in bucket:
        bucket[status] += n


def read_years(db: Database) -> dict[int, dict]:
    years: dict[int, dict] = defaultdict(blank_year)
    for table in TABLES:
        # TABLES is this module's constant, never input.
        # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
        for fy, status, layoff, n, lo, hi in rows_of(db.execute(
                f"SELECT fiscal_year, status, layoff, COUNT(*), MIN(decision_date), MAX(decision_date) "
                f"FROM {table} GROUP BY fiscal_year, status, layoff")):
            y = num(fy)
            if not y:
                continue
            year = years[y]
            fold_year(year, str(status or ""), layoff, num(n))
            lo, hi = str(lo or "")[:10] or None, str(hi or "")[:10] or None
            if lo and (year["from"] is None or lo < year["from"]):
                year["from"] = lo
            if hi and (year["through"] is None or hi > year["through"]):
                year["through"] = hi
    return years


def shown_years(years: dict[int, dict]) -> list[int]:
    """The years whose files print the question for most of their cases, oldest first."""
    return sorted(y for y, v in years.items() if v["cases"] and v["answered"] >= v["cases"] * MIN_ANSWERED_SHARE)


def table_for(fy: int) -> str:
    """perm_cases holds FY2024 on, the history table the years before (the two never overlap)."""
    return "perm_cases" if fy >= 2024 else "perm_cases_history"


def employer_key(slug, name) -> tuple[str, str]:
    """A page's slug, or for a filing with no page, its name as DOL printed it."""
    s = str(slug or "")
    return (s, "") if s else ("", " ".join(str(name or "").split()))


def read_employers(db: Database, fy: int, page_of: dict[str, str], names: dict[str, str]) -> tuple[list[dict], int]:
    """Every employer with at least one yes in `fy` (yeses, answered cases, certified yeses), and how
    many employers answered at all, each counted once across its spellings."""
    agg: dict[tuple[str, str], dict] = defaultdict(lambda: {"yes": 0, "answered": 0, "certified": 0, "spell": {}})
    # table_for returns one of this module's two table names, never input.
    # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
    for slug, name, layoff, status, n in rows_of(db.execute(
            f"SELECT employer_slug, MAX(employer_name), layoff, status, COUNT(*) FROM {table_for(fy)} "
            "WHERE fiscal_year = ? AND layoff IN ('Y', 'N') "
            "GROUP BY employer_slug, CASE WHEN employer_slug = '' OR employer_slug IS NULL THEN employer_name END, "
            "layoff, status", [str(fy)])):
        raw, label = employer_key(slug, name)
        page = page_of.get(raw, raw) if raw else ""
        a = agg[(page, label)]
        n = num(n)
        a["answered"] += n
        spelled = " ".join(str(name or "").split())
        a["spell"][spelled] = a["spell"].get(spelled, 0) + n
        if layoff == "Y":
            a["yes"] += n
            if status == "certified":
                a["certified"] += n
    out = []
    for (page, label), a in agg.items():
        if a["yes"] <= 0:
            continue
        linked = bool(page) and page in names
        shown = names.get(page) if linked else (label or max(a["spell"], key=a["spell"].get))
        out.append({"slug": page if linked else None, "name": shown, "yes": a["yes"],
                    "answered": a["answered"], "certified": a["certified"]})
    out.sort(key=lambda r: (-r["yes"], -r["answered"], r["name"]))
    return out, len(agg)


def read_jobs(db: Database, fy: int) -> list[dict]:
    """The SOC groups with the most yeses in `fy`, each with its answered cases."""
    jobs: dict[str, dict] = {}
    # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
    for code, title, layoff, n in rows_of(db.execute(
            f"SELECT substr(soc_code, 1, 7), MAX(soc_title), layoff, COUNT(*) FROM {table_for(fy)} "
            "WHERE fiscal_year = ? AND layoff IN ('Y', 'N') AND soc_code IS NOT NULL AND soc_code != '' "
            "GROUP BY substr(soc_code, 1, 7), layoff", [str(fy)])):
        c = str(code or "")
        if len(c) != 7:
            continue
        j = jobs.setdefault(c, {"code": c, "title": " ".join(str(title or "").split()), "yes": 0, "answered": 0})
        j["answered"] += num(n)
        if layoff == "Y":
            j["yes"] += num(n)
    out = [j for j in jobs.values() if j["yes"] > 0]
    out.sort(key=lambda j: (-j["yes"], j["code"]))
    return out[:JOBS_SHOWN]


def read_top_by_year(db: Database, fys: list[int], page_of: dict[str, str], names: dict[str, str]) -> dict:
    return {str(fy): [{k: r[k] for k in ("slug", "name", "yes", "answered")}
                      for r in read_employers(db, fy, page_of, names)[0][:TOP_PER_YEAR]] for fy in fys}


def plan(years: dict[int, dict], fys: list[int], employers: list[dict], answering: int, jobs: list[dict],
         top: dict) -> dict:
    newest = fys[-1] if fys else None
    return {
        "years": [{"fy": fy, **years[fy]} for fy in fys],
        "newestFy": newest,
        "newestThrough": years[newest]["through"] if newest else None,
        "employersAnswering": answering,
        "employersYes": len(employers),
        "employers": employers,
        "jobs": jobs,
        "topByYear": top,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    from build_h1b_ranks import read_pages
    page_of, names = read_pages(db)
    years = read_years(db)
    fys = shown_years(years)
    for fy in sorted(years):
        v = years[fy]
        log(f"  FY{fy}: {v['cases']:,} decided, {v['answered']:,} answered, {v['yes']:,} yes"
            f"{'' if fy in fys else '  (not shown: too few answers)'}")
    if not fys:
        log("FATAL: no fiscal year carries the layoff answer; the column may not be loaded")
        if not args.dry_run:
            record_run(db, "build_layoff_disclosures.py", status="failed", note="no layoff answers",
                       started_at=started)
        return 1
    newest = fys[-1]
    employers, answering = read_employers(db, newest, page_of, names)
    doc = plan(years, fys, employers, answering, read_jobs(db, newest),
               read_top_by_year(db, fys, page_of, names))
    doc["builtOn"] = dt.date.today().isoformat()
    log(f"FY{newest} through {doc['newestThrough']}: {doc['employersYes']:,} of {doc['employersAnswering']:,} "
        f"answering employers said yes at least once")
    for r in employers[:8]:
        log("  " + json.dumps(r, ensure_ascii=False))
    if args.dry_run:
        return 0
    write_doc(db, DOC_KEY, doc)
    back = read_doc(db, DOC_KEY)
    ok = bool(back and back.get("newestFy") == newest and len(back.get("employers") or []) == len(employers))
    log(f"  {'ok' if ok else 'MISMATCH'} {DOC_KEY}: {len(fys)} years, {len(employers):,} employers")
    record_run(db, "build_layoff_disclosures.py", status="ok" if ok else "failed", rows_written=1,
               note=f"FY{fys[0]} to FY{newest}, {len(employers):,} employers said yes in FY{newest}",
               started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
