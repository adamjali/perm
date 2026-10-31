#!/usr/bin/env python3
"""Tests for build_wait_trends.py's pure parts. No database.

    python3 scripts/test_wait_trends.py
"""
from __future__ import annotations

import datetime
import pathlib
import sys
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_wait_trends as w  # noqa: E402

failures = 0


def check(cond: bool, msg: str) -> None:
    global failures
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures += 1


ET = ZoneInfo("America/New_York")


def ms(day: str, hour: int = 10) -> int:
    d = datetime.date.fromisoformat(day)
    return int(datetime.datetime(d.year, d.month, d.day, hour, tzinfo=ET).timestamp() * 1000)


# Percentile positions match the SQL's: p25 at n/4, p50 at (n+1)/2, p75 at 3n/4.
q = w.nearest_rank([5, 1, 4, 2, 3, 8, 7, 6])
check(q == {"p25": 2, "p50": 4, "p75": 6}, "nearest rank at the SQL's positions, values sorted first")
check(w.nearest_rank([9]) == {"p25": 9, "p50": 9, "p75": 9}, "one value is every percentile")
check(w.nearest_rank([]) is None, "no values, no percentiles")

rows = [("2026-05", 499, 1, 2, 3), ("2026-06", 500, 70, 84, 99), (None, 900, 1, 2, 3), ("2026-04", "800", "60", "78", "95")]
got = w.months_from_rows(rows, "files", min_cases=500)
check([r["m"] for r in got] == ["2026-06", "2026-04"], "a month under the floor and an undated row are left out")
check(got[1] == {"m": "2026-04", "n": 800, "p25": 60, "p50": 78, "p75": 95, "from": "files"},
      "numbers, not the strings a database may return")

# The sweep's months: first decision per case, bulk stamps and early months out.
filed = "2026-01-10"
dec = []
for i in range(w.MIN_MONTH_CASES):
    dec.append((ms("2026-10-15"), f"c{i}", filed))
dec.append((ms("2026-10-20"), "c0", filed))  # a second decision on the same case
dec.append((ms("2026-08-20"), "old", filed))  # before LIVE_FROM
dec.append((ms("2026-10-16"), "bulk1", filed))
bulk = {ms("2026-10-16")}
live = w.live_months(dec, bulk, today="2026-10-31", after_month="2026-06")
check(len(live) == 1 and live[0]["m"] == "2026-10" and live[0]["n"] == w.MIN_MONTH_CASES,
      "one month, each case once, the bulk stamp and the pre-LIVE_FROM month left out")
check(live[0]["p50"] == (datetime.date(2026, 10, 15) - datetime.date(2026, 1, 10)).days,
      "days from the filing day to the day DOL worked")
check(live[0].get("partial") is True and live[0]["from"] == "sweep", "the month under way is marked partial")
early = [(ms("2026-10-15", 5), f"e{i}", filed) for i in range(w.MIN_MONTH_CASES)]
le = w.live_months(early, set(), today="2026-11-30", after_month="2026-06")
check(le and le[0]["p50"] == (datetime.date(2026, 10, 14) - datetime.date(2026, 1, 10)).days and "partial" not in le[0],
      "a decision seen before 7 AM counts on the day before; a past month isn't partial")
check(w.live_months(dec, bulk, today="2026-10-31", after_month="2026-10") == [],
      "a month the published files already cover isn't read from the sweep")
few = [(ms("2026-10-15"), f"f{i}", filed) for i in range(w.MIN_MONTH_CASES - 1)]
check(w.live_months(few, set(), "2026-10-31", "2026-06") == [], "a month under the floor is left out, not filled")

print(f"\n{failures} failure(s)")
sys.exit(1 if failures else 0)
