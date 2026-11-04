"""How many days DOL takes to decide a number of cases, walked day by day over its calendar.

The twin of `daysToClear` and `seasonFactor` in convex/lib/perm/calculators/decisionPace.ts, held to the same
answers by scripts/fixtures/pace_walk.json (scripts/test_pace_walk.py and decisionPace.test.ts both read it).

A DOL working day decides cases at the working-day rate; a weekend or federal holiday at the off-day rate (DOL is
closed; a handful still post). Around the year's end DOL decides less even on the days it works:

  the Friday after Thanksgiving   0.43 of a normal working day
  December 21 to 31               0.67
  January 2 to 5                  0.67

Each is the median of the ten seasons 2015 to 2024 in DOL's own disclosure files (`daily_decisions`, source
dol-disclosure), against the working days of the five weeks before Thanksgiving. Tested out of sample, each
season against the other nine's medians, from every week mid-October to mid-December (540 starts, 10 to 90 days
of work): typically 6.0 days off against 6.5 for a flat calendar pace, 8.2 against 9.2 on average, a lean of 1
day early against 3, and at two months of work 10 days against 13 (Nov 3 2026).
"""
from __future__ import annotations

from datetime import date, timedelta

from lib_holidays import is_dol_workday

DAY_AFTER_THANKSGIVING = 0.43
LATE_DECEMBER = 0.67
EARLY_JANUARY = 0.67
MAX_WALK_DAYS = 1400  # MAX_HORIZON_DAYS in decisionPace.ts


def thanksgiving(year: int) -> date:
    d = date(year, 11, 1)
    while d.weekday() != 3:
        d += timedelta(days=1)
    return d + timedelta(days=21)


def season_factor(d: date) -> float:
    """A DOL working day's share of a normal one's decisions."""
    if d.month == 12 and d.day >= 21:
        return LATE_DECEMBER
    if d.month == 1 and 2 <= d.day <= 5:
        return EARLY_JANUARY
    if d.month == 11 and d == thanksgiving(d.year) + timedelta(days=1):
        return DAY_AFTER_THANKSGIVING
    return 1.0


def days_to_clear(t0: date, cases: float, workday: float, offday: float) -> int | None:
    """Days after `t0` until DOL has decided `cases`, or None past the horizon or with no rate."""
    if not workday > 0:
        return None
    left = cases
    for i in range(1, MAX_WALK_DAYS + 1):
        d = t0 + timedelta(days=i)
        left -= workday * season_factor(d) if is_dol_workday(d) else max(0.0, offday)
        if left <= 0:
            return i
    return None


def working_rates(days: list[tuple[date, float]]) -> tuple[float, float] | None:
    """(working-day rate, off-day rate) over a window: a season day counts at its own share."""
    work = [n / season_factor(d) for d, n in days if is_dol_workday(d)]
    off = [n for d, n in days if not is_dol_workday(d)]
    if len(work) < 6 or not off:
        return None
    return sum(work) / len(work), sum(off) / len(off)
