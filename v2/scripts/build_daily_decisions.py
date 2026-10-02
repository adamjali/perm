"""Rebuild the `dol-disclosure` half of `daily_decisions` from both case tables.

DOL's decisions per day, counted by DOL's own decision date from the published
disclosure files: `perm_cases` (FY2024 on) and `perm_cases_history` (FY2016 to
FY2023). A case in both is counted once, on `perm_cases`' date, the newer file.

It ran once, from `perm_cases` alone, on Aug 26 2026, so the series started
2023-10-01 although the history table reaches 2015-10-01. Run after any load of
either table (the quarterly and history workflows call it).

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
CASES = """
    SELECT decision_date AS d, status FROM perm_cases WHERE decision_date IS NOT NULL
    UNION ALL
    SELECT h.decision_date AS d, h.status FROM perm_cases_history h
     WHERE h.decision_date IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM perm_cases c WHERE c.case_number = h.case_number)
"""

DAYS = f"""
    SELECT d, count(*), sum(status = 'certified'), sum(status = 'denied'), sum(status = 'withdrawn')
      FROM ({CASES}) GROUP BY d ORDER BY d
"""


def log(msg: str) -> None:
    print(msg, flush=True)


def build(db: Turso, dry_run: bool = False) -> int:
    days = [(str(d), int(t), int(c or 0), int(n or 0), int(w or 0))
            for d, t, c, n, w in query_rows(db, DAYS)]
    if not days:
        # Never empty the series because a read came back empty.
        log("::warning::no decided cases read; daily_decisions left as it was")
        return 1
    expected = int(query_rows(db, f"SELECT count(*) FROM ({CASES})")[0][0])
    total = sum(r[1] for r in days)
    if total != expected:
        raise RuntimeError(f"days sum to {total}, cases count {expected}")
    log(f"{len(days)} days, {days[0][0]} to {days[-1][0]}, {total:,} decisions")
    if dry_run:
        log("dry run: nothing written")
        return 0

    stamp = int(time.time() * 1000)
    run_stmts(db, (stmt(
        "INSERT OR REPLACE INTO daily_decisions "
        "(date, source, total, certified, denied, withdrawn, fetched_at) VALUES (?,?,?,?,?,?,?)",
        [d, SOURCE, t, c, n, w, stamp]) for d, t, c, n, w in days))
    # A date no case carries any more (a re-dated case) loses its row.
    kept = {r[0] for r in days}
    stale = [str(r[0]) for r in query_rows(
        db, "SELECT date FROM daily_decisions WHERE source = ?", [SOURCE]) if str(r[0]) not in kept]
    for i in range(0, len(stale), 300):
        chunk = stale[i:i + 300]
        db.execute(f"DELETE FROM daily_decisions WHERE source = ? AND date IN ({','.join('?' * len(chunk))})",
                   [SOURCE, *chunk])

    got = query_rows(db, "SELECT count(*), sum(total) FROM daily_decisions WHERE source = ?", [SOURCE])[0]
    if int(got[0]) != len(days) or int(got[1]) != total:
        raise RuntimeError(f"read back {got[0]} days / {got[1]} decisions, wrote {len(days)} / {total}")
    log(f"written and read back: {len(days)} days, {total:,} decisions ({len(stale)} stale days removed)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="Count and check; write nothing.")
    args = ap.parse_args()
    return build(Turso(), args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
