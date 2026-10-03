#!/usr/bin/env python3
"""The straggler rate (build_straggler_rates.py), against real in-memory SQLite."""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_straggler_rates as b  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


DAY = 86_400_000
NOW = 1_791_000_000_000           # a fixed "now", milliseconds


def fresh_db(front="2025-12") -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE processing_times (perm_as_of TEXT PRIMARY KEY, json TEXT)",
        "CREATE TABLE perm_case_status (case_number TEXT PRIMARY KEY, filing_date TEXT, "
        "current_status TEXT, is_final INTEGER)",
        "CREATE TABLE perm_case_events (case_number TEXT, changed_at INTEGER, from_status TEXT, "
        "to_status TEXT, to_final INTEGER, source TEXT)",
    ])
    if front:
        db.execute("INSERT INTO processing_times VALUES ('2026-09-22', ?)", [json.dumps(
            {"permQueues": [{"queue": "Analyst Review", "priorityDate": front}]})])
    return db


def case(db, n, filed, status="ANALYST REVIEW", final=0):
    db.execute("INSERT INTO perm_case_status VALUES (?, ?, ?, ?)", [n, filed, status, final])


def event(db, n, days_ago, to, final, source=b.EVENT_SOURCE, at=None):
    db.execute("INSERT INTO perm_case_events VALUES (?, ?, 'ANALYST REVIEW', ?, ?, ?)",
               [n, at if at is not None else NOW - int(days_ago * DAY), to, final, source])


check(b.frontier_month(fresh_db()) == "2025-12", "DOL's Analyst Review month is the frontier")
check(b.frontier_month(fresh_db(front=None)) is None, "no reading, no frontier")
check(b.measure(fresh_db(front=None), NOW) is None, "and no measurement without one")

db = fresh_db()
for i in range(10):                         # ten stragglers still pending all window
    case(db, f"G-100-25300-{i:06d}", "2025-10-27")
case(db, "G-100-25330-000100", "2025-11-26", "CERTIFIED", 1)   # decided mid-window
event(db, "G-100-25330-000100", 7, "CERTIFIED", 1)
case(db, "G-100-25330-000101", "2025-11-26", "WITHDRAWN", 1)   # the employer's act
event(db, "G-100-25330-000101", 7, "WITHDRAWN", 1)
case(db, "G-100-25330-000102", "2025-11-26", "RFI ISSUED", 0)  # left the line
event(db, "G-100-25330-000102", 7, "RFI ISSUED", 0)
case(db, "G-100-25340-000200", "2025-12-06")                   # at the front: not a straggler
case(db, "G-100-25340-000201", "2025-12-06", "CERTIFIED", 1)
event(db, "G-100-25340-000201", 3, "CERTIFIED", 1)
case(db, "G-100-25330-000103", "2025-11-26", "CERTIFIED", 1)   # decided before the window
event(db, "G-100-25330-000103", 20, "CERTIFIED", 1)
case(db, "G-100-25330-000104", "2025-11-26", "CERTIFIED", 1)   # another source's row
event(db, "G-100-25330-000104", 2, "CERTIFIED", 1, source="retired mirror")

m = b.measure(db, NOW)
check(m["frontierMonth"] == "2025-12" and m["pending"] == 10, f"ten pending stragglers ({m})")
check(m["decided"] == 1, f"only DOL's decision inside the window counts (got {m['decided']})")
check(m["otherExits"] == 2, f"a withdrawal and an RFI leave the pool undecided (got {m['otherExits']})")
check(m["pool"] == 13, f"the pool is everyone at risk, not only the survivors (got {m['pool']})")
# Exposure: 10 cases x 14 days + three that left 7 days in = 161 case-days.
check(abs(m["dailyRate"] - round(1 / 161, 5)) < 1e-9, f"rate is decided over case-days at risk (got {m['dailyRate']})")
check(m["medianDays"] == b.days_for(1 / 161, 0.5) and m["p80Days"] > m["medianDays"],
      "half and eight-in-ten come from the rate")

# A catch-up write (one timestamp, thousands of rows) is not a day's work.
db2 = fresh_db()
case(db2, "G-100-25300-000001", "2025-10-27")
at = NOW - 3 * DAY
for i in range(b.BULK_WRITE_ROWS + 1):
    case(db2, f"G-100-25301-{i:06d}", "2025-10-28", "CERTIFIED", 1)
    event(db2, f"G-100-25301-{i:06d}", 0, "CERTIFIED", 1, at=at)
m2 = b.measure(db2, NOW)
check(m2["decided"] == 0, f"a bulk catch-up timestamp is left out (got {m2['decided']})")

check(b.days_for(0.5, 0.5) == 1 and b.days_for(0.0, 0.5) is None and b.days_for(1.0, 0.5) is None,
      "days_for refuses a rate it can't turn into days")

print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
raise SystemExit(1 if fails else 0)
