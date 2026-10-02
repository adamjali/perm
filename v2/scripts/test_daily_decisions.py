#!/usr/bin/env python3
"""The disclosure half of `daily_decisions` is built from both case tables.

Runs build_daily_decisions against in-memory SQLite and asserts:

1. a day's counts come from both tables, by status;
2. a case in both tables is counted once, on perm_cases' date;
3. a day no case carries any more loses its row, and other sources are untouched;
4. a dry run writes nothing, and an empty read leaves the series as it was.

Run:  python3 scripts/test_daily_decisions.py
"""
from __future__ import annotations

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_daily_decisions as b  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []


def check(label: str, ok: bool) -> None:
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        FAILS.append(label)


def fresh() -> SqliteTurso:
    db = SqliteTurso()
    db.url = "sqlite://memory"
    for t in ("perm_cases", "perm_cases_history"):
        db.execute(f"CREATE TABLE {t} (case_number TEXT PRIMARY KEY, status TEXT, decision_date TEXT)")
    db.execute("""CREATE TABLE daily_decisions (date TEXT NOT NULL, source TEXT NOT NULL,
        total INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
        fetched_at INTEGER NOT NULL, PRIMARY KEY (date, source))""")
    return db


def series(db, source="dol-disclosure"):
    return {str(r[0]): [int(x) for x in r[1:]] for r in b.query_rows(
        db, "SELECT date, total, certified, denied, withdrawn FROM daily_decisions WHERE source = ? ORDER BY date",
        [source])}


db = fresh()
db.execute("INSERT INTO perm_cases VALUES ('A-1','certified','2024-01-02'),('A-2','denied','2024-01-02'),"
           "('G-100-1','certified','2024-01-03')")
db.execute("INSERT INTO perm_cases_history VALUES ('A-9','certified','2016-03-01'),('A-8','withdrawn','2016-03-01'),"
           "('G-100-1','certified','2019-05-05')")
db.execute("INSERT INTO daily_decisions VALUES ('2012-01-01','dol-disclosure',5,5,0,0,1),"
           "('2026-09-01','sweep-observed',7,7,0,0,1)")

check("a dry run writes nothing", b.build(db, dry_run=True) == 0 and series(db) == {"2012-01-01": [5, 5, 0, 0]})

b.build(db)
got = series(db)
check("history days are added, by status", got.get("2016-03-01") == [2, 1, 0, 1])
check("current days come from perm_cases", got.get("2024-01-02") == [2, 1, 1, 0])
check("a case in both tables counts once, on perm_cases' date",
      "2019-05-05" not in got and got.get("2024-01-03") == [1, 1, 0, 0])
check("a day no case carries loses its row", "2012-01-01" not in got)
check("another source's rows are untouched", series(db, "sweep-observed") == {"2026-09-01": [7, 7, 0, 0]})
check("the series sums to the cases it was built from", sum(v[0] for v in got.values()) == 5)

empty = fresh()
empty.execute("INSERT INTO daily_decisions VALUES ('2024-01-02','dol-disclosure',3,3,0,0,1)")
check("an empty read leaves the series as it was",
      b.build(empty) == 1 and series(empty) == {"2024-01-02": [3, 3, 0, 0]})

print()
print(f"{len(FAILS)} failure(s)")
sys.exit(1 if FAILS else 0)
