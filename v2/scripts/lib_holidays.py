"""DOL's working days, for the scripts: the site's federal holiday rules and
the day DOL decided something our sweep saw.

The holidays are a port of getFederalHolidays in
convex/lib/perm/dates/holidays.ts (5 U.S.C. 6103, Inauguration Day every
four years from 2021, a weekend holiday observed on the Friday before or the
Monday after). Both are held to scripts/fixtures/federal_holidays.json, the
TypeScript by convex/lib/perm/dates/__tests__/holidays-fixture.test.ts and
this file by scripts/test_holidays.py, so the two can't drift.

The decision day (Oct 15 2026): FLAG shows a wage request's new status the
day DOL decides it, and our morning sweep reads it the next morning (in the
month to Oct 15, 20,803 of 22,425 decisions were first seen between 5 and
6 AM Eastern, and almost all the rest by 10 AM). So a status first seen
before noon Eastern was decided on an earlier day: the day before. A status
seen from noon on (the 5-minute check of watched cases) was decided that day.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from lib_db import ET

# A status first seen before this hour, Eastern, was decided the day before.
SEEN_NEXT_MORNING_BEFORE_HOUR = 12


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """The nth weekday (0 = Monday, as date.weekday) of a month."""
    first = date(year, month, 1)
    return first + timedelta(days=(weekday - first.weekday()) % 7 + (n - 1) * 7)


def _last_weekday(year: int, month: int, weekday: int) -> date:
    nxt = date(year + month // 12, month % 12 + 1, 1)
    last = nxt - timedelta(days=1)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _observed(d: date) -> date:
    """Saturday is observed on Friday, Sunday on Monday."""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def federal_holidays(year: int) -> list[tuple[str, date]]:
    """getFederalHolidays(year): (name, observed date), in the TypeScript's order."""
    out = [
        ("New Year", _observed(date(year, 1, 1))),
        ("Juneteenth", _observed(date(year, 6, 19))),
        ("Independence Day", _observed(date(year, 7, 4))),
        ("Veterans Day", _observed(date(year, 11, 11))),
        ("Christmas", _observed(date(year, 12, 25))),
        ("MLK Day", _nth_weekday(year, 1, 0, 3)),
        ("Presidents Day", _nth_weekday(year, 2, 0, 3)),
        ("Memorial Day", _last_weekday(year, 5, 0)),
        ("Labor Day", _nth_weekday(year, 9, 0, 1)),
        ("Columbus Day", _nth_weekday(year, 10, 0, 2)),
        ("Thanksgiving", _nth_weekday(year, 11, 3, 4)),
    ]
    if year >= 2021 and (year - 2021) % 4 == 0:
        out.append(("Inauguration Day", _observed(date(year, 1, 20))))
    return out


_cache: dict[int, set[date]] = {}


def is_federal_holiday(d: date) -> bool:
    """isFederalHoliday: looks in the date's own year's list, as the TypeScript does."""
    if d.year not in _cache:
        _cache[d.year] = {h for _, h in federal_holidays(d.year)}
    return d in _cache[d.year]


def is_dol_workday(d: date) -> bool:
    """A weekday that isn't a federal holiday (isBusinessDay)."""
    return d.weekday() < 5 and not is_federal_holiday(d)


def decided_on(seen_ms: int) -> date:
    """The day DOL decided a status our sweep first saw at `seen_ms`."""
    t = datetime.fromtimestamp(seen_ms / 1000, ET)
    return t.date() - timedelta(days=1) if t.hour < SEEN_NEXT_MORNING_BEFORE_HOUR else t.date()


def next_workday(d: date) -> date:
    """The first DOL working day on or after d."""
    while not is_dol_workday(d):
        d += timedelta(days=1)
    return d


def add_workdays(d: date, n: int) -> date:
    """n working days after d (n >= 1), counting the first working day after d as 1."""
    while n > 0:
        d += timedelta(days=1)
        if is_dol_workday(d):
            n -= 1
    return d


def workdays_between(a: date, b: date) -> int:
    """Signed working days from a to b. A day DOL doesn't work counts as the
    working day after it, so Saturday to the next Tuesday is 2 and Friday to
    Monday is 1."""
    a2, b2 = next_workday(a), next_workday(b)
    lo, hi, sign = (a2, b2, 1) if b2 >= a2 else (b2, a2, -1)
    n, d = 0, lo
    while d < hi:
        d += timedelta(days=1)
        n += is_dol_workday(d)
    return sign * n
