#!/usr/bin/env python3
"""How long DOL's decisions waited, month by month, for PERM and for wage requests.

"Is it getting faster?" is a question about the cases DOL decided each month:
the days from filing to decision, as a median with the middle half beside it.
Two documents, one per queue:

* perm_docs['perm_wait_trend']: DOL's published PERM files (`perm_cases`,
  certified and denied, its `days` from received to decision) for each month
  with MIN_MONTH_CASES decisions or more; then, for the months after the files
  end, our own sweep: each first decision it saw (to CERTIFIED or DENIED from
  a status still pending), dated by the day DOL worked (`observed_day`), from
  the case's filing day. The sweep's months start at LIVE_FROM: through Aug 29
  2026 its first full sweeps were catching up, so a change seen then says
  where a case stood, not when it moved. A month still under way is marked
  `partial`. A timestamp carrying more than BULK_WRITE_ROWS rows is a catch-up
  write, not a day's work, and is left out (the decision feed's own rule).
* perm_docs['pwd_wait_trend']: PERM wage requests (visa class PERM) in DOL's
  published PW files, received to first determination, withdrawals left out.

Percentiles are nearest-rank, the same positions as `decided_month_percentiles`
(p25 at n/4, p50 at (n+1)/2, p75 at 3n/4). Nothing is typed in: a month with
too few decisions is left out, never filled.

Run after the nightly full sweep (the PERM document's sweep months move every
day) and after a PW disclosure load; both documents are rewritten each time.

    python3 scripts/build_wait_trends.py [--only perm|pwd] [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import sys
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, et_today, query_rows, record_run, write_doc  # noqa: E402
from ingest_case_status_direct import (  # noqa: E402
    BULK_WRITE_ROWS, FINAL_STATUSES, SOURCE, observed_day,
)

SCRIPT = "build_wait_trends.py"
ET = ZoneInfo("America/New_York")
# A month needs this many decisions to say how long a month's decisions waited.
MIN_MONTH_CASES = 500
# The first month of DOL's FY2024, where `perm_cases` and the wage-request files both start in full.
FROM_DAY = "2023-10-01"
# The first month our own sweep's decisions are dated well enough to time.
LIVE_FROM = "2026-09"


def nearest_rank(values: list[int]) -> dict[str, int] | None:
    """p25, p50 and p75 at the same positions the SQL percentiles use."""
    v = sorted(values)
    n = len(v)
    if n == 0:
        return None
    at = lambda rn: v[max(1, min(n, rn)) - 1]  # noqa: E731
    return {"p25": at(max(1, n // 4)), "p50": at((n + 1) // 2), "p75": at(max(1, n * 3 // 4))}


def months_from_rows(rows: list, source: str, min_cases: int = MIN_MONTH_CASES) -> list[dict]:
    """Rows of (month, n, p25, p50, p75) from the percentile SQL, kept when the month has enough."""
    out = []
    for m, n, p25, p50, p75 in rows:
        if not m or n is None or int(n) < min_cases or p50 is None:
            continue
        out.append({"m": str(m), "n": int(n), "p25": int(p25), "p50": int(p50), "p75": int(p75), "from": source})
    return out


# Continues a `WITH f AS (SELECT m, d ...)` the caller opens.
PERCENTILE_SQL = """,
         o AS (SELECT m, d,
                      ROW_NUMBER() OVER (PARTITION BY m ORDER BY d) AS rn,
                      COUNT(*)    OVER (PARTITION BY m)             AS n
                 FROM f)
    SELECT m, MAX(n) AS n,
           MAX(CASE WHEN rn = MAX(1, n / 4)     THEN d END) AS p25,
           MAX(CASE WHEN rn = (n + 1) / 2       THEN d END) AS p50,
           MAX(CASE WHEN rn = MAX(1, n * 3 / 4) THEN d END) AS p75
      FROM o GROUP BY m ORDER BY m"""


def live_months(decisions: list, bulk: set[int], today: str, after_month: str) -> list[dict]:
    """Pure: months of our sweep's first decisions, filing day to DOL's day.

    `decisions` rows are (changed_at ms, case_number, filing_date). A case
    counts once, on its first decision; a bulk stamp is left out; a month at or
    before `after_month` (the files cover it) or before LIVE_FROM is left out."""
    seen: set[str] = set()
    by_month: dict[str, list[int]] = {}
    for ts, cn, filed in sorted(decisions, key=lambda r: int(r[0])):
        if cn in seen:
            continue
        seen.add(cn)
        if int(ts) in bulk or not filed:
            continue
        day = observed_day(int(ts))
        m = day[:7]
        if m < LIVE_FROM or m <= after_month:
            continue
        try:
            d = (datetime.date.fromisoformat(day) - datetime.date.fromisoformat(str(filed)[:10])).days
        except ValueError:
            continue
        if d < 0:
            continue
        by_month.setdefault(m, []).append(d)
    out = []
    for m in sorted(by_month):
        vals = by_month[m]
        if len(vals) < MIN_MONTH_CASES:
            continue
        q = nearest_rank(vals)
        row = {"m": m, "n": len(vals), **q, "from": "sweep"}
        if m == today[:7]:
            row["partial"] = True
        out.append(row)
    return out


def perm_trend(db: Database) -> dict | None:
    files = query_rows(db, f"""
        WITH f AS (SELECT substr(decision_date, 1, 7) AS m, days AS d
                     FROM perm_cases
                    WHERE days IS NOT NULL AND decision_date >= ?
                      AND upper(status) NOT LIKE 'WITHDRAWN%'){PERCENTILE_SQL}""", [FROM_DAY])
    months = months_from_rows(files, "files")
    through = query_rows(db, "SELECT MAX(decision_date) FROM perm_cases")[0][0]
    if not months or not through:
        return None
    files_end = str(through)[:7]
    # A month the files hold only part of (the last one, when DOL's quarter
    # ends mid-month) is still a whole month of their decisions; the sweep
    # picks up from the month after.
    since = datetime.datetime.fromisoformat(f"{LIVE_FROM}-01").replace(tzinfo=ET)
    since_ms = int(since.timestamp() * 1000)
    finals = sorted(FINAL_STATUSES)
    marks = ",".join("?" * len(finals))
    decisions = query_rows(db, f"""
        SELECT e.changed_at, e.case_number, s.filing_date
          FROM perm_case_events e JOIN perm_case_status s ON s.case_number = e.case_number
         WHERE e.source = ? AND e.changed_at >= ?
           AND upper(e.to_status) IN ('CERTIFIED', 'DENIED')
           AND upper(e.from_status) NOT IN ({marks})""", [SOURCE, since_ms, *finals])
    bulk = {int(ts) for ts, _n in query_rows(db, """
        SELECT changed_at, COUNT(*) FROM perm_case_events WHERE changed_at >= ?
         GROUP BY changed_at HAVING COUNT(*) > ?""", [since_ms, BULK_WRITE_ROWS])}
    today = et_today()
    months += live_months(decisions, bulk, today, files_end)
    return {"asOf": today, "filesThrough": str(through)[:10], "liveFrom": LIVE_FROM,
            "minCases": MIN_MONTH_CASES, "months": months}


def pwd_trend(db: Database) -> dict | None:
    cols = {str(r[1]) for r in query_rows(db, "PRAGMA table_info(pwd_cases)")}
    decided = "COALESCE(determined_on, decision_date)" if "determined_on" in cols else "decision_date"
    rows = query_rows(db, f"""
        WITH f AS (SELECT substr({decided}, 1, 7) AS m,
                          CAST(julianday(substr({decided}, 1, 10)) - julianday(substr(received_date, 1, 10)) AS INTEGER) AS d
                     FROM pwd_cases
                    WHERE upper(visa_class) = 'PERM' AND received_date IS NOT NULL
                      AND {decided} >= ?
                      AND upper(case_status) NOT LIKE 'WITHDRAWN%'
                      AND julianday(substr({decided}, 1, 10)) >= julianday(substr(received_date, 1, 10))){PERCENTILE_SQL}""",
                      [FROM_DAY])
    months = months_from_rows(rows, "files")
    through = query_rows(db, f"SELECT MAX({decided}) FROM pwd_cases WHERE upper(visa_class) = 'PERM'")[0][0]
    if not months or not through:
        return None
    return {"asOf": et_today(), "filesThrough": str(through)[:10], "minCases": MIN_MONTH_CASES, "months": months}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--only", choices=["perm", "pwd"])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    db = Database()
    wrote, notes = 0, []
    for key, build in (("perm_wait_trend", perm_trend), ("pwd_wait_trend", pwd_trend)):
        if a.only and not key.startswith(a.only):
            continue
        doc = build(db)
        if doc is None:
            notes.append(f"{key}: nothing to measure")
            continue
        print(json.dumps(doc, indent=1))
        if not a.dry_run:
            write_doc(db, key, json.dumps(doc, separators=(",", ":")))
            wrote += 1
        live = sum(1 for m in doc["months"] if m["from"] == "sweep")
        notes.append(f"{key}: {len(doc['months'])} months, {live} from the sweep, files through {doc['filesThrough']}")
    if not a.dry_run:
        record_run(db, SCRIPT, status="ok", rows_written=wrote, note="; ".join(notes))
    print("; ".join(notes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
