#!/usr/bin/env python3
"""Gates for lib_holidays.py: DOL's working days and the day DOL decided.

Held to scripts/fixtures/federal_holidays.json, which the site's own
getFederalHolidays is held to by src/lib/__tests__/dol-workdays-parity.test.ts,
so the backtest and the page count the same days."""
from __future__ import annotations

import json
import pathlib
import sys
from datetime import date, datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lib_holidays import (add_workdays, decided_on, federal_holidays, is_dol_workday,  # noqa: E402
                          next_workday, workdays_between)

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


fixture = json.loads((HERE / "fixtures/federal_holidays.json").read_text())["years"]
check(len(fixture) >= 5, "the fixture holds several years")
for y, want in fixture.items():
    got = sorted([d.isoformat(), n] for n, d in federal_holidays(int(y)))
    check(got == want, f"{y}: the holidays are the fixture's")

check(not is_dol_workday(date(2026, 10, 12)), "Columbus Day 2026 is no working day")
check(not is_dol_workday(date(2026, 7, 3)), "July 4 2026 is a Saturday, observed Friday the 3rd")
check(is_dol_workday(date(2026, 10, 13)) and not is_dol_workday(date(2026, 10, 10)), "a Tuesday works, a Saturday doesn't")
check(next_workday(date(2026, 10, 10)) == date(2026, 10, 13), "after Saturday the 10th, DOL next works Tuesday the 13th")
check(add_workdays(date(2026, 10, 9), 1) == date(2026, 10, 13), "one working day after Friday the 9th is Tuesday the 13th")
check(add_workdays(date(2026, 11, 24), 3) == date(2026, 11, 30), "three after Tue Nov 24: Wed, Fri (Thanksgiving skipped), Mon")
check(workdays_between(date(2026, 10, 9), date(2026, 10, 13)) == 1, "Friday to Tuesday over Columbus Day is 1")
check(workdays_between(date(2026, 10, 14), date(2026, 10, 9)) == -2, "and backwards, Wednesday to Friday before is -2")
check(workdays_between(date(2026, 10, 10), date(2026, 10, 14)) == 1, "a Saturday counts as the working day after it")


def ms(y, m, d, h, mi=0):
    return int(datetime(y, m, d, h, mi, tzinfo=timezone.utc).timestamp() * 1000)


# The same instants as the TypeScript test (decidedOnFromSeen).
check(decided_on(ms(2026, 10, 13, 9, 40)) == date(2026, 10, 12), "seen 5:40 AM EDT, decided the day before")
check(decided_on(ms(2026, 10, 9, 21, 5)) == date(2026, 10, 9), "seen 5:05 PM EDT, decided that day")
check(decided_on(ms(2026, 10, 14, 15, 59)) == date(2026, 10, 13), "11:59 AM is still the morning's reading")
check(decided_on(ms(2026, 10, 14, 16, 0)) == date(2026, 10, 14), "noon is not")
check(decided_on(ms(2027, 1, 2, 6, 0)) == date(2027, 1, 1), "1 AM EST on Jan 2, the day before, across a year")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
