#!/usr/bin/env python3
"""Gates for the full-history gap backfill (backfill_serial_gaps.py)."""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import backfill_serial_gaps as b  # noqa: E402

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


# ---- day codes ------------------------------------------------------------
check(b.code_date(26276) == datetime.date(2026, 10, 3), "26276 is Oct 3 2026")
check(b.code_date(19274) == datetime.date(2019, 10, 1), "19274 is Oct 1 2019")
check(b.code_date(24366) == datetime.date(2024, 12, 31), "a leap year's day 366 is Dec 31")

# Only days older than the nightly window, newest first: the nightly sweep
# owns the recent ones, and two writers must never sweep the same day.
bounds = {26270: (1, 2, 2), 26100: (1, 2, 2), 25001: (1, 2, 2), 19274: (1, 2, 2)}
todo = b.todo_codes(bounds, datetime.date(2026, 10, 3), 67)
check(todo == [26100, 25001, 19274], f"recent days are left to the nightly sweep, oldest last (got {todo})")

# ---- quiet hours ------------------------------------------------------------
q = b.parse_quiet("3:45-7:45,15:15-18:15")
check(q == [(225, 465), (915, 1095)], f"quiet hours parse to minutes (got {q})")
at = lambda h, m: datetime.datetime(2026, 10, 3, h, m, tzinfo=b.ET)  # noqa: E731
check(b.in_quiet(at(4, 10), q), "4:10 AM, the full sweep's start, is quiet")
check(b.in_quiet(at(15, 40), q), "3:40 PM, the pending sweep's start, is quiet")
check(not b.in_quiet(at(3, 44), q) and not b.in_quiet(at(7, 45), q), "the edges are half-open")
check(not b.in_quiet(at(12, 0), q), "noon is not quiet")

# ---- the loop -------------------------------------------------------------
saved: list[dict] = []
slept: list[float] = []
calls: list[int] = []


def run(codes, answers, quiet=(), clock=None, max_days=0, state=None):
    saved.clear(); slept.clear(); calls.clear()
    it = iter(answers)

    def sweep_day(code):
        calls.append(code)
        return next(it)

    return b.run_days(None, codes, state if state is not None else {}, sweep_day=sweep_day,
                      sleep=slept.append, now=clock or (lambda: at(12, 0)), quiet=quiet,
                      max_days=max_days, save=lambda st: saved.append(dict(st)),
                      record=lambda st, note: None)


ok = {"requests": 10, "found": 3, "inserted_perm": 1, "inserted_other": 2, "missed": 5}
st = run([26100, 26099], [ok, ok])
check(calls == [26100, 26099], "each day is swept once, newest first")
check(st["requests"] == 20 and st["found"] == 6 and st["missed"] == 10, f"totals add up ({st})")
check(st["nextDay"] is None and st["finished"], "the last day marks it finished")
check(saved[0]["nextDay"] == 26099, "progress is saved after every day, pointing at the next one")

# A refusal waits half an hour and asks THE SAME day again; it never skips it.
refused = {"requests": 2, "found": 0, "refused": "HTTP 403"}
st = run([26100, 26099], [refused, ok, ok])
check(calls == [26100, 26100, 26099], f"a refused day is asked again, not skipped (got {calls})")
check(slept == [b.REFUSAL_WAIT_S], f"and the retry waits {b.REFUSAL_WAIT_S}s first (got {slept})")
check(saved[0]["nextDay"] == 26100 and "HTTP 403" in saved[0]["lastRefusal"],
      "the refusal is saved, with the day to resume on")
check(st["refusals"] == 1 and st["requests"] == 22, "and counted")

# Quiet hours hold the next day back until they end.
ticks = iter([at(4, 0), at(4, 1), at(8, 0)] + [at(8, 1)] * 10)
st = run([26100], [ok], quiet=q, clock=lambda: next(ticks))
check(slept == [60, 60], f"quiet hours wait a minute at a time (got {slept})")
check(calls == [26100], "then the day is swept")

# A restart resumes from the saved state, adding to its totals.
st = run([26099], [ok], state={"requests": 100, "found": 7, "daysDone": 4, "nextDay": 26099})
check(st["requests"] == 110 and st["daysDone"] == 5, f"a resumed run adds to the saved totals ({st})")

# --max-days stops early and leaves the next day to resume on.
st = run([26100, 26099, 26098], [ok, ok, ok], max_days=1)
check(calls == [26100] and st["nextDay"] == 26099 and not st["finished"],
      "a capped test run stops and points at the next day")

print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
raise SystemExit(1 if fails else 0)
