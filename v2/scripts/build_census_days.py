#!/usr/bin/env python3
"""perm_census_days: the PERM census as it stood at the end of each DOL day.

What /perm-queue's day picker draws (owner, Oct 27 2026: see the queue on any
past day). The live table holds each case's status now and perm_case_events
every change our sweep saw, so a past day replays backward from the present:
a case's status at the end of day D is the from_status of its first change
dated after D, else its status now. A change is dated to the day DOL worked (observed_day: seen before
7 AM Eastern, it's the day before's work), as the change feed and the decision
counts date it. Only the sweep's own changes count; the retired mirror's rows
corrected our record and moved nothing at DOL.

A case counts from its filing day on, whether or not our record held it yet:
DOL held it. So a case the walk finds late joins the days it belonged to, and
the next run rewrites those days' rows and no others (lib_reference.sync_rows
writes only what changed).

Days start at START: Aug 28 and 29 2026 carried the one-time backfill of
expired certifications and the reconciliation of the mirror's statuses, so a
replay before them would draw the mirror's record. The newest day written is
yesterday; today is the live census.

Runs after the full sweep (case-status-direct.yml) and by hand:
  python3 scripts/build_census_days.py [--dry-run]
"""
from __future__ import annotations

import argparse
import bisect
import datetime
import pathlib
import sys
import time
from collections import Counter, defaultdict
from collections.abc import Iterable

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from ingest_case_status_direct import FINAL_STATUSES, SOURCE, observed_day  # noqa: E402
from lib_db import Database, et_today, query_rows, record_run  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

START = "2026-08-30"
TABLE = "perm_census_days"
COLS = ["day", "month", "status", "is_final", "n"]
DDL = (f"CREATE TABLE IF NOT EXISTS {TABLE} (day TEXT NOT NULL, month TEXT NOT NULL, status TEXT NOT NULL, "
       "is_final INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, month, status, is_final))")

# (month, status, is_final) -> cases, per day.
Census = dict[str, Counter]


def log(msg: str) -> None:
    print(msg, flush=True)


def is_final_status(status: str) -> bool:
    """DOL's final statuses, as the sweep reads them (FINAL_STATUSES)."""
    return status.strip().upper() in FINAL_STATUSES


def day_range(first: str, last: str) -> list[str]:
    """Every ISO day from `first` to `last`, both included; empty when last comes first."""
    a, b = datetime.date.fromisoformat(first), datetime.date.fromisoformat(last)
    return [(a + datetime.timedelta(days=i)).isoformat() for i in range((b - a).days + 1)]


def read_cases(db: Database) -> dict[str, tuple[str, str, int]]:
    """case -> (filing day, status now, final now), for every case with a filing day."""
    return {
        str(c): (str(f), str(s or "").strip().upper(), int(x or 0))
        for c, f, s, x in query_rows(db, "SELECT case_number, filing_date, current_status, is_final FROM perm_case_status "
                                         "WHERE filing_date IS NOT NULL AND filing_date <> ''")
    }


def read_events(db: Database) -> dict[str, list[tuple[str, str, str, int]]]:
    """case -> its changes in order, each (DOL day, from status, to status, to final)."""
    out: dict[str, list[tuple[str, str, str, int]]] = defaultdict(list)
    for c, at, frm, to, fin in query_rows(
            db, "SELECT case_number, changed_at, from_status, to_status, to_final FROM perm_case_events "
                "WHERE source = ? ORDER BY case_number, changed_at", [SOURCE]):
        out[str(c)].append((observed_day(int(at)), str(frm).strip().upper(), str(to).strip().upper(), int(fin or 0)))
    return out


def replay(cases: dict[str, tuple[str, str, int]], events: dict[str, list[tuple[str, str, str, int]]],
           days: list[str]) -> Census:
    """Each day's census. A case that never changed is counted by filing day and summed over the days it
    belongs to, so the cost follows the cases that moved, not every case times every day."""
    census: Census = {d: Counter() for d in days}
    still: Counter = Counter()  # (filing day, month, status, final) -> cases that never changed
    for case, (filed, status, final) in cases.items():
        month = filed[:7]
        changes = events.get(case)
        if not changes:
            still[(filed, month, status, final)] += 1
            continue
        on = [c[0] for c in changes]
        for d in days:
            if filed > d:
                continue
            i = bisect.bisect_right(on, d)  # the first change dated after d
            if i < len(changes):
                s = changes[i][1]
                census[d][(month, s, int(is_final_status(s)))] += 1
            else:
                # Nothing changed after d, so d holds the status now. A correction made without an event
                # (`--reconcile`) still reaches the newest days this way, which keeps them equal to the live table.
                census[d][(month, status, final)] += 1
    for (filed, month, status, final), n in still.items():
        for d in days[bisect.bisect_left(days, filed):]:
            census[d][(month, status, final)] += n
    return census


def to_rows(census: Census) -> list[list]:
    return [[d, m, s, f, n] for d, counts in sorted(census.items()) for (m, s, f), n in sorted(counts.items()) if n]


def write(db: Database, rows: Iterable[list]) -> dict[str, int]:
    """Make the table hold exactly these rows for the days they cover, writing only what changed."""
    rows = list(rows)
    if not rows:
        return {"written": 0, "deleted": 0, "unchanged": 0}
    first = min(r[0] for r in rows)
    return sync_rows(db, TABLE, COLS[:4], COLS, rows, scope_sql="day >= ?", scope_args=[first])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true", help="replay and report, write nothing")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    last = (datetime.date.fromisoformat(et_today()) - datetime.timedelta(days=1)).isoformat()
    days = day_range(START, last)
    cases = read_cases(db)
    events = read_events(db)
    census = replay(cases, events, days)
    rows = to_rows(census)
    pending = {d: sum(n for (_, _, f), n in c.items() if not f) for d, c in census.items()}
    log(f"{len(cases):,} cases, {len(events):,} with changes; {len(days)} days {days[0] if days else '-'} to {last}; "
        f"{len(rows):,} rows; pending on the newest day {pending.get(last, 0):,}")
    if args.dry_run:
        return 0
    db.execute(DDL)
    got = write(db, rows)
    note = f"{len(days)} days to {last}: {got['written']:,} rows written, {got['deleted']:,} removed"
    log(f"  ok  {TABLE} {note}")
    record_run(db, "build_census_days.py", status="ok", rows_written=got["written"], note=note, started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
