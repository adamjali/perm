#!/usr/bin/env python3
"""Ask DOL about every gap in the case-number counter, back to the oldest day we hold.

The nightly gap sweep covers the trailing window (sweep_serial_gaps.py); this
covers everything older, once, so every number in the counter is accounted for:
a case we hold (live, or in one of DOL's published files), or a number DOL has
answered "no case" for. Owner's call, Oct 3 2026: "check ALL, just pace it."

How it behaves:
  * newest day first, so the months that still hold pending cases finish first;
  * one request every --pace seconds, and paused in --quiet hours, when our own
    nightly sweeps are asking DOL (their load and ours never stack);
  * a refusal from DOL is waited out (30 minutes, then the same day again);
  * for days this old DOL's index is settled, so one empty answer retires a
    number (--settle-after 1); the trailing window keeps the 3-asks rule, and
    every decided case also arrives later in DOL's published files;
  * resumable: progress lives in perm_docs['gap_backfill'], so a restart
    carries on from the next day rather than starting again;
  * permanent: once the history is done it stays up and, once a day, sweeps
    the days that have just aged out of the nightly window (which it overlaps
    by three days), so no day is ever left to nobody.

    python3 scripts/backfill_serial_gaps.py             # run (the server's unit)
    python3 scripts/backfill_serial_gaps.py --status    # print progress and exit
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import sys
import time
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, query_rows, record_run, write_doc  # noqa: E402
import sweep_serial_gaps as g  # noqa: E402

SCRIPT = "backfill_serial_gaps.py"
DOC = "gap_backfill"
ET = ZoneInfo("America/New_York")
# Our own DOL-heavy jobs: the full sweep and its gap sweep from 4:10 AM, the
# pending sweep from 3:40 PM (ET). The backfill steps aside for both.
DEFAULT_QUIET = "3:45-7:45,15:15-18:15"
REFUSAL_WAIT_S = 1800
# The nightly gap sweep's window, as case-status-direct.yml passes it
# (`--window 90`, ages 0 to 89 days). The backfill takes every day from 87 days
# old back: an overlap of three days, never a gap, because a day between the
# two would be swept by neither. test_backfill_serial_gaps.py reads the
# workflow and holds the two together.
NIGHTLY_WINDOW = 90
OVERLAP_DAYS = 3
# After the full history, the service stays up and sweeps the days that have
# just aged out of the nightly window, once a day: every night one more day
# leaves it, and nothing else would ever look at that day again.
TAIL_DAYS = 30
TAIL_EVERY_S = 86_400
RECORD_EVERY_S = 3600


def code_date(code: int) -> datetime.date:
    return datetime.date(2000 + code // 1000, 1, 1) + datetime.timedelta(days=code % 1000 - 1)


def parse_quiet(spec: str) -> list[tuple[int, int]]:
    """'3:45-7:45,15:15-18:15' -> [(225, 465), (915, 1095)] in minutes after midnight."""
    out = []
    for part in filter(None, (p.strip() for p in spec.split(","))):
        a, b = part.split("-")
        mins = [int(x.split(":")[0]) * 60 + int(x.split(":")[1]) for x in (a, b)]
        out.append((mins[0], mins[1]))
    return out


def in_quiet(now: datetime.datetime, quiet: list[tuple[int, int]]) -> bool:
    m = now.hour * 60 + now.minute
    return any(a <= m < b for a, b in quiet)


def todo_codes(bounds: dict[int, tuple[int, int, int]], today: datetime.date,
               window_days: int, oldest_days: int | None = None) -> list[int]:
    """Every day we hold at least `window_days` old (and, for the daily tail,
    at most `oldest_days` old), newest first."""
    newest = today - datetime.timedelta(days=window_days)
    oldest = today - datetime.timedelta(days=oldest_days) if oldest_days is not None else None
    return sorted((c for c in bounds if code_date(c) <= newest
                   and (oldest is None or code_date(c) >= oldest)), reverse=True)


def read_state(db) -> dict:
    rows = query_rows(db, "SELECT json FROM perm_docs WHERE key = ?", [DOC])
    try:
        return json.loads(rows[0][0]) if rows and rows[0][0] else {}
    except (TypeError, ValueError):
        return {}


TOTAL_KEYS = (("requests", "requests"), ("found", "found"),
              ("insertedPerm", "inserted_perm"), ("insertedOther", "inserted_other"),
              ("missed", "missed"))


def run_days(db, codes: list[int], state: dict, *, sweep_day, sleep=time.sleep,
             now=lambda: datetime.datetime.now(ET), quiet=(), max_days: int = 0,
             save=None, record=None) -> dict:
    """Sweep `codes` (newest first) one day at a time, keeping `state` current.

    `sweep_day(code)` returns sweep()'s dict for that one day. A refusal waits
    REFUSAL_WAIT_S and asks the same day again (its retired serials stay
    retired, so the retry asks only what is left); quiet hours wait in
    minutes. Progress is saved after every day, so a restart resumes at the
    next one.
    """
    save = save or (lambda st: write_doc(db, DOC, st))
    record = record or (lambda st, note: record_run(
        db, SCRIPT, status="ok", rows_written=st["insertedPerm"] + st["insertedOther"], note=note))
    for k, _ in TOTAL_KEYS:
        state[k] = int(state.get(k, 0))
    state["daysDone"] = int(state.get("daysDone", 0))
    last_record = time.time()
    done_now = 0
    for i, code in enumerate(codes):
        while in_quiet(now(), quiet):
            sleep(60)
        while True:
            r = sweep_day(code)
            for k_out, k_in in TOTAL_KEYS:
                state[k_out] += int(r.get(k_in) or 0)
            if not r.get("refused"):
                break
            state["refusals"] = int(state.get("refusals", 0)) + 1
            state["lastRefusal"] = f"{now():%b %-d, %-I:%M %p} on day {code}: {str(r['refused'])[:120]}"
            state["nextDay"] = code
            save(state)
            sleep(REFUSAL_WAIT_S)
        state["daysDone"] += 1
        done_now += 1
        state.update(nextDay=codes[i + 1] if i + 1 < len(codes) else None,
                     lastDay=code, lastDate=code_date(code).isoformat(),
                     updatedAt=now().isoformat(timespec="seconds"))
        save(state)
        if time.time() - last_record > RECORD_EVERY_S:
            record(state, f"backfill at {code_date(code)}: {state['daysDone']} of "
                          f"{state.get('daysTotal', '?')} days, {state['requests']} requests, "
                          f"{state['found']} found")
            last_record = time.time()
        if max_days and done_now >= max_days:
            break
    state["finished"] = state.get("nextDay") is None
    save(state)
    return state


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--pace", type=float, default=2.0, help="seconds between requests to DOL")
    ap.add_argument("--settle-after", type=int, default=1)
    ap.add_argument("--quiet", default=DEFAULT_QUIET, help="ET hours to pause, e.g. 3:45-7:45,15:15-18:15")
    ap.add_argument("--window", type=int, default=NIGHTLY_WINDOW - OVERLAP_DAYS,
                    help="sweep days at least this old (the nightly sweep owns the newer ones)")
    ap.add_argument("--max-days", type=int, default=0, help="stop after N days and exit (testing)")
    ap.add_argument("--once", action="store_true", help="one pass, then exit (no daily tail)")
    ap.add_argument("--status", action="store_true", help="print progress and exit")
    a = ap.parse_args()

    db = Turso()
    if a.status:
        print(json.dumps(read_state(db), indent=1))
        return 0
    # The program tables must exist before held_serials can read them.
    g.programs.ensure_schema(db)
    g.ensure_miss_ledger(db)
    quiet = parse_quiet(a.quiet)

    def paced(nums):
        time.sleep(a.pace)
        return g.core.lookup_with_retry(nums)

    while True:
        state = read_state(db)
        bounds = g.day_bounds(db)

        def sweep_day(code: int) -> dict:
            return g.sweep(db, [str(code)], cap=10**9, lookup=paced, bounds=bounds,
                           settle_after=a.settle_after)

        today = datetime.date.today()
        if not state.get("finished"):
            codes = todo_codes(bounds, today, a.window)
            if state.get("nextDay") is not None:
                codes = [c for c in codes if c <= int(state["nextDay"])]
            state.setdefault("startedAt", datetime.datetime.now(ET).isoformat(timespec="seconds"))
            state["daysTotal"] = int(state.get("daysDone", 0)) + len(codes)
            g.core.log(f"gap backfill: {len(codes)} day codes to go, newest {codes[0] if codes else '-'}, "
                       f"pace {a.pace}s, retire after {a.settle_after} empty answer(s)")
            state = run_days(db, codes, state, sweep_day=sweep_day, quiet=quiet, max_days=a.max_days)
            if state["finished"]:
                state["finishedAt"] = datetime.datetime.now(ET).isoformat(timespec="seconds")
                write_doc(db, DOC, state)
            record_run(db, SCRIPT, status="ok", rows_written=state["insertedPerm"] + state["insertedOther"],
                       note=("backfill finished: " if state["finished"] else "backfill paused: ")
                            + f"{state['daysDone']} days, {state['requests']} requests, {state['found']} found")
        else:
            # The daily tail: the days that just left the nightly window.
            codes = todo_codes(bounds, today, a.window, a.window + TAIL_DAYS)
            tail = {k: 0 for k, _ in TOTAL_KEYS}
            tail = run_days(db, codes, tail, sweep_day=sweep_day, quiet=quiet,
                            save=lambda _st: None, record=lambda _st, _n: None)
            state["tail"] = {"at": datetime.datetime.now(ET).isoformat(timespec="seconds"),
                             "days": len(codes), "requests": tail["requests"], "found": tail["found"]}
            write_doc(db, DOC, state)
            record_run(db, SCRIPT, status="ok", rows_written=tail["insertedPerm"] + tail["insertedOther"],
                       note=f"daily tail: {len(codes)} days aged out of the nightly window, "
                            f"{tail['requests']} requests, {tail['found']} found")
        print(json.dumps(state, indent=1), flush=True)
        if a.once or a.max_days or not state.get("finished"):
            return 0
        time.sleep(TAIL_EVERY_S)


if __name__ == "__main__":
    sys.exit(main())
