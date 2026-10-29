#!/usr/bin/env python3
"""What DOL's newest quarterly PERM file says: perm_docs['quarter_report_<fy>q<n>'].

Each quarter DOL publishes its PERM disclosure file through the quarter's last
day. This reads the newest full quarter in `perm_cases` and sets it beside the
quarter before and the same quarter a year earlier, by the day DOL decided each
case. The blog post for that quarter (content/blog/dol-perm-file-fy<fy>-q<n>.mdx)
prints every figure from this doc through `<QuarterNow />`, so no number is typed,
and each quarter keeps its own doc, so an older post never changes under its reader.
`perm_docs['quarter_report']` holds the newest quarter's key.

WHAT IT CARRIES, for each of the three quarters:

* decisions by outcome, and the certified share of those decided (withdrawals
  aren't decisions on the merits);
* the median and 90th-percentile days from filing to certification, and the
  median offered wage on certified cases;
* the wage requests DOL determined and the H-1B LCAs it certified in the same days.

For the newest quarter alone: the busiest employers, law firms, jobs and states,
each with its count the quarter before and a year before; and the employers whose
first decided case in DOL's files (back to October 2015) came that quarter.

Usage:
    python3 scripts/build_quarter_report.py            # the newest full quarter
    python3 scripts/build_quarter_report.py --fy 2026 --q 3
    python3 scripts/build_quarter_report.py --dry-run
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, read_doc, record_run, rows_of, write_doc  # noqa: E402

DOC_PREFIX = "quarter_report"
TOP = 10
NEW_SHOWN = 10
HISTORY_TABLE = "perm_cases_history"


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def quarter_span(fy: int, q: int) -> tuple[str, str]:
    """A federal fiscal quarter's first and last day: Q1 is October to December of the year before."""
    start_month = 10 + (q - 1) * 3
    year = fy - 1
    if start_month > 12:
        start_month -= 12
        year = fy
    start = dt.date(year, start_month, 1)
    end_month = start_month + 2
    end_year = year
    nxt = dt.date(end_year + (1 if end_month == 12 else 0), 1 if end_month == 12 else end_month + 1, 1)
    return start.isoformat(), (nxt - dt.timedelta(days=1)).isoformat()


def quarter_of(day: str) -> tuple[int, int]:
    """The fiscal year and quarter a day falls in."""
    d = dt.date.fromisoformat(day[:10])
    fy = d.year + 1 if d.month >= 10 else d.year
    q = ((d.month - 10) % 12) // 3 + 1
    return fy, q


def shift(fy: int, q: int, by: int) -> tuple[int, int]:
    """The quarter `by` quarters away (negative for earlier)."""
    i = fy * 4 + (q - 1) + by
    return i // 4, i % 4 + 1


def key_of(fy: int, q: int) -> str:
    return f"{fy}q{q}"


def percentile(values: list[float], p: float) -> float | None:
    """Linear interpolation at (n - 1) * p, the way the site's other percentiles read."""
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def outcome_figures(rows: list[tuple[str, int]]) -> dict:
    """status -> count, to the outcome block: each outcome and the certified share of those decided."""
    c = Counter()
    for status, n in rows:
        c[str(status).lower()] += num(n)
    decided = c["certified"] + c["denied"]
    return {
        "certified": c["certified"], "denied": c["denied"], "withdrawn": c["withdrawn"],
        "total": c["certified"] + c["denied"] + c["withdrawn"],
        "certifiedShare": round(c["certified"] / decided, 4) if decided else None,
    }


def ranked(this: Counter, prior: Counter, year_ago: Counter, names: dict, linked: set, top: int = TOP) -> list[dict]:
    """The busiest `top` this quarter, each with its counts a quarter and a year before. Ties go by key."""
    out = []
    for k, n in sorted(this.items(), key=lambda kv: (-kv[1], kv[0]))[:top]:
        out.append({"key": k, "name": names.get(k, k), "linked": k in linked, "n": n,
                    "prior": prior.get(k, 0), "yearAgo": year_ago.get(k, 0)})
    return out


def table_for(fy: int) -> str:
    return HISTORY_TABLE if fy <= 2023 else "perm_cases"


def read_quarter(db: Database, fy: int, q: int, emp_page: dict, firm_page: dict) -> dict:
    """One quarter's figures and its counts by employer, firm, job and state."""
    lo, hi = quarter_span(fy, q)
    table = table_for(fy)
    span = [lo, hi]
    out = outcome_figures(rows_of(db.execute(
        f"SELECT status, COUNT(*) FROM {table} WHERE decision_date >= ? AND decision_date <= ? GROUP BY status", span)))
    days: list[float] = []
    wages: list[float] = []
    for d, w, n in rows_of(db.execute(
            f"SELECT days, ROUND(wage), COUNT(*) FROM {table} WHERE decision_date >= ? AND decision_date <= ? "
            "AND status = 'certified' GROUP BY days, ROUND(wage)", span)):
        n = num(n)
        if d is not None and str(d) != "":
            days += [float(d)] * n
        if w is not None and str(w) != "" and float(w) > 0:
            wages += [float(w)] * n
    p50 = percentile(days, 0.5)
    p90 = percentile(days, 0.9)
    wage = percentile(wages, 0.5)
    out.update(medianDays=None if p50 is None else round(p50), p90Days=None if p90 is None else round(p90),
               medianWage=None if wage is None else round(wage))
    emp, firm, job, state = Counter(), Counter(), Counter(), Counter()
    job_title: dict[str, Counter] = defaultdict(Counter)
    for e, a, soc, title, st, n in rows_of(db.execute(
            f"SELECT employer_slug, attorney_slug, substr(soc_code, 1, 7), soc_title, state, COUNT(*) FROM {table} "
            "WHERE decision_date >= ? AND decision_date <= ? GROUP BY 1, 2, 3, 4, 5", span)):
        n = num(n)
        if e:
            emp[emp_page.get(str(e), str(e))] += n
        if a:
            firm[firm_page.get(str(a), str(a))] += n
        if soc:
            job[str(soc)] += n
            if title:
                job_title[str(soc)][str(title)] += n
        if st:
            state[str(st).upper()[:2]] += n
    out["counts"] = {"employers": emp, "firms": firm, "jobs": job, "states": state}
    out["jobTitles"] = {k: v.most_common(1)[0][0] for k, v in job_title.items()}
    return out


def first_decisions(db: Database, emp_page: dict) -> dict[str, str]:
    """Each employer page's first decided case in DOL's files, history included."""
    first: dict[str, str] = {}
    for table in (HISTORY_TABLE, "perm_cases"):
        # The table name is one of this module's two constants, never input.
        # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
        for slug, d in rows_of(db.execute(
                f"SELECT employer_slug, MIN(decision_date) FROM {table} WHERE employer_slug IS NOT NULL GROUP BY 1")):
            if not d:
                continue
            page = emp_page.get(str(slug), str(slug))
            day = str(d)[:10]
            if page not in first or day < first[page]:
                first[page] = day
    return first


def program_figures(db: Database, table: str, lo: str, hi: str, certified_only: bool = False) -> dict:
    """The wage requests determined, or the H-1B LCAs certified, in a quarter's days."""
    if certified_only:
        got = rows_of(db.execute(
            f"SELECT COUNT(*) FROM {table} WHERE decision_date >= ? AND decision_date <= ? "
            "AND case_status = 'CERTIFIED' AND visa_class = 'H-1B'", [lo, hi]))
        return {"n": num(got[0][0]) if got else 0}
    got = rows_of(db.execute(f"SELECT COUNT(*) FROM {table} WHERE decision_date >= ? AND decision_date <= ?", [lo, hi]))
    return {"n": num(got[0][0]) if got else 0}


def plan(this: dict, prior: dict, year_ago: dict, first: dict[str, str], lo: str, hi: str,
         emp_names: dict, firm_names: dict) -> dict:
    """The doc's lists from the three quarters' counts. Pure: the tests drive it."""
    c, p, y = this["counts"], prior["counts"], year_ago["counts"]
    new = sorted(((page, n) for page, n in c["employers"].items() if lo <= first.get(page, "9999") <= hi),
                 key=lambda kv: (-kv[1], kv[0]))
    return {
        "employers": ranked(c["employers"], p["employers"], y["employers"], emp_names, set(emp_names)),
        "firms": ranked(c["firms"], p["firms"], y["firms"], firm_names, set(firm_names)),
        "jobs": ranked(c["jobs"], p["jobs"], y["jobs"], this["jobTitles"], set()),
        "states": ranked(c["states"], p["states"], y["states"], {}, set()),
        "newEmployers": {
            "count": len(new),
            "cases": sum(n for _, n in new),
            "top": [{"key": k, "name": emp_names.get(k, k), "linked": k in emp_names, "n": n} for k, n in new[:NEW_SHOWN]],
        },
    }


def summary(q: dict) -> dict:
    """A quarter's headline figures, without its per-entity counts."""
    return {k: v for k, v in q.items() if k not in ("counts", "jobTitles")}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--fy", type=int)
    ap.add_argument("--q", type=int)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    if args.fy and args.q:
        fy, q = args.fy, args.q
    else:
        newest = rows_of(db.execute("SELECT MAX(decision_date) FROM perm_cases"))[0][0]
        fy, q = quarter_of(str(newest))
        # A file runs to its quarter's last day; a quarter still loading isn't reported.
        if str(newest)[:10] < quarter_span(fy, q)[1]:
            fy, q = shift(fy, q, -1)
    lo, hi = quarter_span(fy, q)
    from build_h1b_ranks import read_pages as employer_pages  # noqa: E402
    from build_firm_ranks import read_pages as firm_pages  # noqa: E402
    emp_page, emp_names = employer_pages(db)
    firm_page, firm_names = firm_pages(db)
    pfy, pq = shift(fy, q, -1)
    yfy, yq = shift(fy, q, -4)
    this = read_quarter(db, fy, q, emp_page, firm_page)
    prior = read_quarter(db, pfy, pq, emp_page, firm_page)
    year_ago = read_quarter(db, yfy, yq, emp_page, firm_page)
    first = first_decisions(db, emp_page)
    lists = plan(this, prior, year_ago, first, lo, hi, emp_names, firm_names)
    programs = {}
    for label, (f, qq) in (("this", (fy, q)), ("prior", (pfy, pq)), ("yearAgo", (yfy, yq))):
        a, b = quarter_span(f, qq)
        programs[label] = {"pw": program_figures(db, "pwd_cases", a, b),
                           "lca": program_figures(db, "lca_cases", a, b, certified_only=True)}
    doc = {
        "quarter": {"fy": fy, "q": q, "from": lo, "to": hi, "key": key_of(fy, q)},
        "prior": {"fy": pfy, "q": pq, "from": quarter_span(pfy, pq)[0], "to": quarter_span(pfy, pq)[1]},
        "yearAgo": {"fy": yfy, "q": yq, "from": quarter_span(yfy, yq)[0], "to": quarter_span(yfy, yq)[1]},
        "figures": {"this": summary(this), "prior": summary(prior), "yearAgo": summary(year_ago)},
        "programs": programs,
        **lists,
        "builtOn": dt.date.today().isoformat(),
    }
    t = doc["figures"]["this"]
    log(f"FY{fy} Q{q} ({lo} to {hi}): {t['total']:,} decisions, {t['certified']:,} certified, "
        f"share {t['certifiedShare']}, median {t['medianDays']} days, wage {t['medianWage']}; "
        f"{lists['newEmployers']['count']:,} employers new to the files")
    for row in lists["employers"][:3]:
        log("  " + json.dumps(row, ensure_ascii=False))
    if args.dry_run:
        return 0
    key = f"{DOC_PREFIX}_{key_of(fy, q)}"
    write_doc(db, key, doc)
    newest = read_doc(db, DOC_PREFIX)
    # The pointer only moves forward: a history run for an older quarter leaves it.
    if not newest or (newest.get("fy", 0), newest.get("q", 0)) <= (fy, q):
        write_doc(db, DOC_PREFIX, {"key": key, "fy": fy, "q": q})
    back = read_doc(db, key)
    ok = bool(back and back.get("quarter", {}).get("key") == key_of(fy, q))
    record_run(db, "build_quarter_report.py", status="ok" if ok else "failed", rows_written=1,
               note=f"FY{fy} Q{q}", started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
