"""Rebuild the published halves of `daily_decisions`: PERM from both case
tables, and H-2A, H-2B and CW-1 from `seasonal_cases`, one source each.

DOL's decisions per day, counted by DOL's own decision date from the published
disclosure files: `perm_cases` (FY2024 on) and `perm_cases_history` (FY2016 to
FY2023). A case in both is counted once, on `perm_cases`' date, the newer file.

It ran once, from `perm_cases` alone, on Aug 26 2026, so the series started
2023-10-01 although the history table reaches 2015-10-01. Run after any load of
either table (the quarterly and history workflows call it).

H-2A, H-2B and CW-1 (Oct 7 2026): `dol-disclosure-h2a`, `-h2b` and `-cw1`,
counted the same way from DOL's own decision date in its seasonal files, so
/seasonal-cases draws them with the chart PERM uses. DOL prints the outcome as
a phrase ("DETERMINATION ISSUED - CERTIFICATION (EXPIRED)"); a certification
in any form counts as certified, a denial or rejection as denied, and a
withdrawal as withdrawn. Every reader names its source, so adding these leaves
PERM's readers untouched. The seasonal workflow runs `--only seasonal`.

Upsert first, delete second, so a reader never sees the series empty; then the
total is read back and must equal the case count it was built from.

    python3 scripts/build_daily_decisions.py [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
import time

from lib_turso import Turso, query_rows, run_stmts, stmt

SOURCE = "dol-disclosure"

# Cases with a decision date, each once: perm_cases wins over the history copy.
PERM_CASES = """
    SELECT decision_date AS d, status FROM perm_cases WHERE decision_date IS NOT NULL
    UNION ALL
    SELECT h.decision_date AS d, h.status FROM perm_cases_history h
     WHERE h.decision_date IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM perm_cases c WHERE c.case_number = h.case_number)
"""


def seasonal_cases(visa: str) -> str:
    """One visa's decided cases from DOL's seasonal files, outcome normalised."""
    return f"""
    SELECT decision_date AS d,
           CASE WHEN upper(case_status) LIKE '%WITHDRAWN%' THEN 'withdrawn'
                WHEN upper(case_status) LIKE '%CERTIFICATION%' THEN 'certified'
                WHEN upper(case_status) LIKE '%DENIED%' OR upper(case_status) LIKE '%REJECTED%' THEN 'denied'
                ELSE 'other' END AS status
      FROM seasonal_cases WHERE decision_date IS NOT NULL AND visa_class = '{visa}'
"""


# source -> the decided cases it counts. Only constants go into the SQL.
SERIES = {
    SOURCE: PERM_CASES,
    "dol-disclosure-h2a": seasonal_cases("H-2A"),
    "dol-disclosure-h2b": seasonal_cases("H-2B"),
    "dol-disclosure-cw1": seasonal_cases("CW-1"),
}
GROUPS = {"perm": [SOURCE], "seasonal": [k for k in SERIES if k != SOURCE]}


def days_sql(cases: str) -> str:
    return f"""
    SELECT d, count(*), sum(status = 'certified'), sum(status = 'denied'), sum(status = 'withdrawn')
      FROM ({cases}) GROUP BY d ORDER BY d
"""


def log(msg: str) -> None:
    print(msg, flush=True)


def build(db: Turso, dry_run: bool = False, source: str = SOURCE) -> int:
    cases = SERIES[source]
    days = [(str(d), int(t), int(c or 0), int(n or 0), int(w or 0))
            for d, t, c, n, w in query_rows(db, days_sql(cases))]
    if not days:
        # Never empty the series because a read came back empty.
        log(f"::warning::{source}: no decided cases read; daily_decisions left as it was")
        return 1
    expected = int(query_rows(db, f"SELECT count(*) FROM ({cases})")[0][0])
    total = sum(r[1] for r in days)
    if total != expected:
        raise RuntimeError(f"{source}: days sum to {total}, cases count {expected}")
    other = total - sum(r[2] + r[3] + r[4] for r in days)
    log(f"{source}: {len(days)} days, {days[0][0]} to {days[-1][0]}, {total:,} decisions"
        + (f" ({other:,} with an outcome that is none of the three)" if other else ""))
    if dry_run:
        log("dry run: nothing written")
        return 0

    stamp = int(time.time() * 1000)
    run_stmts(db, (stmt(
        "INSERT OR REPLACE INTO daily_decisions "
        "(date, source, total, certified, denied, withdrawn, fetched_at) VALUES (?,?,?,?,?,?,?)",
        [d, source, t, c, n, w, stamp]) for d, t, c, n, w in days))
    # A date no case carries any more (a re-dated case) loses its row.
    kept = {r[0] for r in days}
    stale = [str(r[0]) for r in query_rows(
        db, "SELECT date FROM daily_decisions WHERE source = ?", [source]) if str(r[0]) not in kept]
    for i in range(0, len(stale), 300):
        chunk = stale[i:i + 300]
        db.execute(f"DELETE FROM daily_decisions WHERE source = ? AND date IN ({','.join('?' * len(chunk))})",
                   [source, *chunk])

    got = query_rows(db, "SELECT count(*), sum(total) FROM daily_decisions WHERE source = ?", [source])[0]
    if int(got[0]) != len(days) or int(got[1]) != total:
        raise RuntimeError(f"read back {got[0]} days / {got[1]} decisions, wrote {len(days)} / {total}")
    log(f"{source}: written and read back: {len(days)} days, {total:,} decisions ({len(stale)} stale days removed)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="Count and check; write nothing.")
    ap.add_argument("--only", choices=sorted(GROUPS), help="Build one group of series (default: all).")
    args = ap.parse_args()
    db = Turso()
    sources = GROUPS[args.only] if args.only else list(SERIES)
    # Each series stands alone: one that reads nothing keeps its old rows and
    # the others are still built; the exit code reports any that failed.
    return max(build(db, args.dry_run, s) for s in sources)


if __name__ == "__main__":
    sys.exit(main())
