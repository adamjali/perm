#!/usr/bin/env python3
"""Re-ask DOL about the serials the nightly walk skipped.

WHY THIS EXISTS. FLAG issues case numbers from ONE counter shared by every
program, so for a given filing day the serials we hold should be contiguous.
They are not: measured 12 Sep 2026 we hold 88-92% of the span, and probing the
holes by hand found real PERM cases sitting in them - five G-200 cases in
ANALYST REVIEW on a single day.

The cause is structural rather than a bug. `run_discovery` advances a cursor and
never goes back, so anything missed on the night is missed permanently, as is
anything DOL files into a serial range the walk has already passed. There was no
second look. An independent check against the rival tracker's published July figure put
us 1.2% short; the serial probe put it at up to 5%.

This is the second look. It reads the holes out of our own tables, asks DOL for
each one under every prefix we know, and inserts what comes back. Nothing here
guesses: a hole is only filled when DOL answers.

    python3 scripts/sweep_serial_gaps.py                  # trailing 60 day codes
    python3 scripts/sweep_serial_gaps.py --window 400     # a deeper pass
    python3 scripts/sweep_serial_gaps.py --from 26100 --to 26200
    python3 scripts/sweep_serial_gaps.py --cap 200 --dry-run
"""
from __future__ import annotations

import argparse
import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, record_run  # noqa: E402
from lib_flag_serials import (  # noqa: E402
    ALL_FLAG_PREFIXES, case_number, day_code, prefix_of,
)
import ingest_case_status_direct as core  # noqa: E402

# Every prefix we have ever seen on this counter, in measured hit-rate order.
# A serial belongs to exactly one of them; the walk drops it the moment one
# claims it, so asking in frequency order keeps the request count down.
# Shared with the nightly walk so the two cannot drift: a prefix the sweep
# asks for and the walk does not is a case only one of them can ever find.
PREFIXES = ALL_FLAG_PREFIXES

# A day's own span only. Holes are read BETWEEN the lowest and highest serial we
# already hold for that day: outside that range we cannot tell a hole from the
# end of the day's issuance, and guessing past the edge is how a prober burns
# its budget on numbers DOL never issued.
DEFAULT_WINDOW = 60
DEFAULT_CAP = 1200              # requests per run; ~7 min at the module's pace

# WITHOUT A MEMORY THIS SWEEP NEVER CONVERGES. The first real run probed 7,129
# holes to find 251 cases; the other 6,878 are serials DOL never issued, and a
# sweep with no record re-asks every one of them tomorrow, and the night after,
# forever. The nightly budget would be spent entirely on re-confirming known
# absences and would never reach the holes that have not been looked at.
#
# A miss is NOT recorded as permanent, though, because misses are not
# permanent: the 251 found above were cases that EXISTED and had not been
# indexed when the walk went past. DOL's index lags. So a serial is dropped
# only after it has come back empty MISS_LIMIT separate times, which gives a
# late-indexed case several chances and still bounds the work.
MISS_LIMIT = 3

MISS_DDL = """
  CREATE TABLE IF NOT EXISTS perm_serial_misses (
    day_code INTEGER NOT NULL,
    serial   INTEGER NOT NULL,
    misses   INTEGER NOT NULL DEFAULT 1,
    last_probed_at INTEGER NOT NULL,
    PRIMARY KEY (day_code, serial)
  )
"""
SERIALS_PER_REQUEST = core.BATCH // len(PREFIXES)   # 8 prefixes -> 6 serials


def held_serials(db, code: str) -> list[int]:
    """Every serial we hold for one day code, across all three programs."""
    sql = """
      SELECT CAST(substr(case_number, 13) AS INT) s FROM perm_case_status
       WHERE CAST(substr(case_number, 7, 5) AS INT) = ?
      UNION SELECT CAST(substr(case_number, 13) AS INT) FROM pwd_case_status
       WHERE CAST(substr(case_number, 7, 5) AS INT) = ?
      UNION SELECT CAST(substr(case_number, 13) AS INT) FROM lca_case_status
       WHERE CAST(substr(case_number, 7, 5) AS INT) = ?
    """
    n = int(code)
    # libSQL hands integers back as STRINGS, CAST(... AS INT) included. Sorting
    # or ranging over those silently compares lexically - "9" > "10" - so the
    # coercion is load-bearing, not tidiness. This repo has been bitten by the
    # same thing twice before (live_recent's diff, the WARN change check).
    return sorted(int(r[0]) for r in core._rows(db, sql, [n, n, n]) if r[0] is not None)


def settled_misses(db, code: str) -> set[int]:
    """Serials DOL has denied MISS_LIMIT times. Asking again buys nothing."""
    rows = core._rows(
        db, "SELECT serial FROM perm_serial_misses WHERE day_code = ? AND misses >= ?",
        [int(code), MISS_LIMIT])
    # Integers arrive as strings here too.
    return {int(r[0]) for r in rows if r[0] is not None}


# A span this wide is a WRAP, not a day. The counter rolls at 1,000,000, so the
# day it rolls on reads MIN 1 / MAX 999,997 and its neighbours look absurd too.
# Three such days exist in our history (24136, 25141, 26161).
MAX_PLAUSIBLE_SPAN = 200_000


def day_bounds(db) -> dict[int, tuple[int, int, int]]:
    """{day_code: (min_serial, max_serial, held_count)} for every day we hold.

    ONE query for the whole history rather than three per day. The caller needs
    every day, not just the ones being swept, because a day's true span is
    defined by its NEIGHBOURS.
    """
    sql = """
      WITH s AS (
        SELECT CAST(substr(case_number,7,5) AS INT) d,
               CAST(substr(case_number,13) AS INT) n FROM perm_case_status
        UNION SELECT CAST(substr(case_number,7,5) AS INT),
               CAST(substr(case_number,13) AS INT) FROM pwd_case_status
        UNION SELECT CAST(substr(case_number,7,5) AS INT),
               CAST(substr(case_number,13) AS INT) FROM lca_case_status)
      SELECT d, MIN(n), MAX(n), COUNT(*) FROM s GROUP BY d ORDER BY d
    """
    out: dict[int, tuple[int, int, int]] = {}
    for r in core._rows(db, sql, []):
        # libSQL returns integers as STRINGS. Comparing or ranging over those
        # compares lexically ("9" > "10"), so the coercion is load-bearing.
        d, lo, hi, n = (int(x) for x in r[:4])
        out[d] = (lo, hi, n)
    return out


def true_span(bounds: dict[int, tuple[int, int, int]], code: str) -> tuple[int, int] | None:
    """The serial range day `code` really owns, bounded by its neighbours.

    FLAG issues case numbers from ONE global sequential counter, so every
    serial between the previous day's highest and the next day's lowest
    belongs to this day. That makes the day's true span EXACT rather than
    guessed - which matters because the earlier version read holes only
    between a day's own lowest and highest KNOWN serial, and was therefore
    structurally blind to anything issued before the first case we happen to
    hold or after the last one. Measured over 2026: 1,102 serials sat in
    those inter-day regions, invisible by construction.

    Falls back to the day's own span at a wrap boundary, where the counter
    rolls and MIN/MAX stop meaning anything.
    """
    n = int(code)
    if n not in bounds:
        return None
    lo, hi, _ = bounds[n]
    days = sorted(bounds)
    i = days.index(n)
    if i > 0:
        prev_hi = bounds[days[i - 1]][1]
        if 0 < lo - prev_hi <= MAX_PLAUSIBLE_SPAN:
            lo = prev_hi + 1
    if i + 1 < len(days):
        next_lo = bounds[days[i + 1]][0]
        if 0 < next_lo - hi <= MAX_PLAUSIBLE_SPAN:
            hi = next_lo - 1
    if hi < lo or hi - lo + 1 > MAX_PLAUSIBLE_SPAN:
        # THE DAY THE COUNTER WRAPS HAS NO USABLE SPAN, and falling back to
        # its own MIN/MAX does not help: on a wrap day those ARE 0 and
        # 999,999, so the "fallback" hands back the whole million. Measured
        # 2026-09-13, after this exact fallback sent a sweep to probe
        # 1,000,000 serials on day 26161 and it sat there for 44 minutes.
        #
        # A wrap day's serials sit in two clusters, one before the roll and
        # one after, and there is no way to say which unissued numbers between
        # them belong to this day. Three day codes in the whole history are
        # like this (24136, 25141, 26161), so they are SKIPPED and named
        # rather than guessed at.
        return None
    return lo, hi


def holes(serials: list[int], skip: set[int] | None = None,
          span: tuple[int, int] | None = None) -> list[int]:
    """Serials in the day's span that we neither hold nor have retired.

    `span` is the neighbour-derived range when the caller has one; without it
    the day's own lowest and highest known serial are used, which is correct
    but blind to both inter-day edges.
    """
    if span is None:
        if len(serials) < 2:
            return []
        span = (serials[0], serials[-1])
    lo, hi = span
    if hi < lo:
        return []
    have = set(serials)
    skip = skip or set()
    return [s for s in range(lo, hi + 1) if s not in have and s not in skip]


def record_misses(db, code: str, serials: list[int], stamp: int) -> None:
    """Bump the miss counter for every serial DOL just declined to confirm."""
    if not serials:
        return
    # One statement per batch, never one per serial: the cost here is per
    # STATEMENT, and 500 single-row writes measured 986 rows in 20 seconds
    # against 1,233 rows/s batched.
    for i in range(0, len(serials), 200):
        chunk = serials[i:i + 200]
        values = ", ".join(f"({int(code)}, {s}, 1, {stamp})" for s in chunk)
        db.execute(
            f"INSERT INTO perm_serial_misses (day_code, serial, misses, last_probed_at) "
            f"VALUES {values} "
            f"ON CONFLICT(day_code, serial) DO UPDATE SET "
            f"misses = misses + 1, last_probed_at = excluded.last_probed_at", [])


# A STOP ON THE SWEEP'S OWN CAP IS NOT A FAILURE, AND MUST NOT BE RECORDED AS
# ONE (2026-09-15). This used to write `partial` when the cap stopped the run,
# and the health check counts every `partial` as BROKEN, so a night with many
# holes to probe painted the whole check red and paged the owner for a job
# that had done exactly what it was built to do. Same shape as the WARN
# ingest's browser-only refusal: an expected stop records `ok` and NAMES the
# stop in its note. `CAP_NOTE` is read back by check_ingest_health.py (a test
# pins the two strings equal), so a row written before this change is not
# misread either.
CAP_NOTE = "stopped on the request cap"

# A REFUSAL FROM DOL IS A STOP TOO (2026-09-22). flag.dol.gov answered HTTP
# 403 about eighty seconds into the sweep, on the tail of the ~10,000
# requests the main sweep had just made in the same job, and after the retry
# helper's own 52 seconds of backoff. The sweep crashed, the failure hook
# recorded `failed`, and the health check went red for a refusal nobody can
# act on - the main sweep had succeeded minutes earlier and DOL answered 200
# again by the afternoon. Same rule as the cap: keep what was found, record
# only the misses DOL actually answered, name the refusal, resume tomorrow.
# A refusal that recurs is still caught: the main sweep fails first on a
# persistent one, and check_gap_sweep fires when three runs probe nothing.
REFUSAL_NOTE = "stopped on a DOL refusal"


def run_record(r: dict, cap: int) -> tuple[str, str]:
    """The (status, note) a finished sweep records; `ok` whether or not it capped."""
    note = (f"probed {r['probed']}, found {r['found']}, "
            f"inserted {r['inserted_perm']}+{r['inserted_other']}, "
            f"missed {r['missed']}")
    if r["capped"]:
        note += f"; {CAP_NOTE} ({cap}) and resumes from the same window"
    if r.get("refused"):
        note += (f"; {REFUSAL_NOTE} ({r['refused']}) after {r['requests']} "
                 f"requests and resumes from the same window")
    return "ok", note


def sweep(db, codes: list[str], *, cap: int, lookup=None, dry: bool = False,
          bounds: dict[int, tuple[int, int, int]] | None = None) -> dict:
    lookup = lookup or core.lookup_with_retry
    # Built once for the whole run. Without it each day is probed only between
    # its own known serials and the inter-day regions are never asked about.
    if bounds is None:
        bounds = day_bounds(db)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(core.time.time() * 1000)
    requests = probed = found = ins_perm = ins_other = retired = 0
    skipped: list[str] = []
    if not dry:
        db.execute(MISS_DDL, [])
    per_day: list[tuple[str, int, int]] = []
    refused: str | None = None
    for code in codes:
        if requests >= cap or refused:
            break
        span = true_span(bounds, code)
        if span is None:
            # Either we hold nothing for this day, or it is a wrap day whose
            # span cannot be read. Named, because a silently skipped day and a
            # day with no holes look identical in the totals.
            if int(code) in bounds:
                skipped.append(code)
            continue
        gaps = holes(held_serials(db, code), settled_misses(db, code), span)
        if not gaps:
            continue
        day_found = 0
        day_missed: list[int] = []
        for i in range(0, len(gaps), SERIALS_PER_REQUEST):
            if requests >= cap:
                break
            chunk = gaps[i:i + SERIALS_PER_REQUEST]
            nums = [case_number(p, code, s) for s in chunk for p in PREFIXES]
            requests += 1
            try:
                hits = lookup(nums)
            except RuntimeError as exc:
                # The HTTP-status shape `lookup` raises, after its retries.
                # Only that: a code defect in the insert path must still
                # propagate, or a bug becomes a quiet nightly "ok". The
                # serials in this chunk were never answered, so they are not
                # probed and not misses; the day's answered chunks still
                # reach the miss ledger below.
                refused = str(exc)
                break
            probed += len(chunk)
            # Every serial in the chunk that DOL did not claim under ANY
            # prefix is a miss. Read it off the answer rather than assuming
            # an empty response means the whole chunk was empty.
            claimed = {int(h["caseNumber"][12:]) for h in hits
                       if h.get("caseNumber") and h["caseNumber"][12:].isdigit()}
            day_missed.extend(s for s in chunk if s not in claimed)
            if not hits:
                continue
            found += len(hits)
            day_found += len(hits)
            if dry:
                continue
            perm = [h for h in hits if prefix_of(h["caseNumber"]) in core.PERM_PREFIXES]
            other = [h for h in hits if h not in perm]
            ins_perm += core._insert_perm_hits(db, perm, now_iso, stamp)
            ins_other += core._insert_other_hits(db, other)
        if not dry:
            record_misses(db, code, day_missed, stamp)
        retired += len(day_missed)
        if day_found:
            per_day.append((code, len(gaps), day_found))
    return {"requests": requests, "probed": probed, "found": found,
            "missed": retired,
            "inserted_perm": ins_perm, "inserted_other": ins_other,
            "days_with_finds": per_day, "skipped": skipped,
            "capped": requests >= cap, "refused": refused}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--window", type=int, default=DEFAULT_WINDOW,
                    help="trailing day codes to re-check (default 60)")
    ap.add_argument("--from", dest="frm", help="first day code, e.g. 26100")
    ap.add_argument("--to", dest="to", help="last day code")
    ap.add_argument("--cap", type=int, default=DEFAULT_CAP)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    db = Turso()
    today = datetime.date.today()
    if a.frm and a.to:
        # NEWEST FIRST here too, matching the default path below. An explicit
        # range used to run oldest-first, which puts the days that matter most
        # - the recent ones, where the pending cases are - at the END of a run
        # that can be interrupted or hit its cap. Same work, better order.
        codes = [str(c) for c in range(int(a.to), int(a.frm) - 1, -1)]
    else:
        # Newest first: a hole in the last fortnight matters more than one in a
        # day code from three months ago, and a capped run should spend its
        # budget where the data is most used.
        codes = [day_code(today - datetime.timedelta(days=i))
                 for i in range(a.window)]
    core.log(f"gap sweep over {len(codes)} day code(s), cap {a.cap} requests"
             + (" (dry run)" if a.dry_run else ""))

    r = sweep(db, codes, cap=a.cap, dry=a.dry_run)
    core.log(f"  probed {r['probed']:,} holes in {r['requests']:,} requests")
    core.log(f"  DOL confirmed {r['found']:,} of them as real cases")
    core.log(f"  inserted {r['inserted_perm']:,} PERM, {r['inserted_other']:,} PWD/LCA")
    core.log(f"  {r['missed']:,} serials came back empty and had their miss count bumped "
             f"(retired at {MISS_LIMIT})")
    for code, gaps, found in r["days_with_finds"][:12]:
        core.log(f"    {code}: {found} of {gaps} holes were real")
    if r["skipped"]:
        core.log(f"  skipped {len(r['skipped'])} day code(s) whose serial span is "
                 f"unreadable (the counter wrapped): {', '.join(r['skipped'])}")
    if r["capped"]:
        core.log("  stopped on the request cap; the next run resumes from the same window")
    if r["refused"]:
        core.log(f"  stopped on a DOL refusal ({r['refused']}) after {r['requests']} "
                 "requests; the next run resumes from the same window")
    if r["probed"] and not r["found"]:
        core.log("  every hole probed was genuinely unissued - the walk is not missing cases here")

    if not a.dry_run:
        status, note = run_record(r, a.cap)
        # `probed`, NOT `found`. A sweep that finds nothing is the SUCCESS
        # case once the corpus is contiguous, so recording finds here would
        # make a healthy sweep look dead. Probes only reach zero when the walk
        # left no holes at all, or when `held_serials` broke - and the second
        # is the defect this number exists to expose.
        record_run(db, "sweep_serial_gaps.py", status=status,
                   rows_written=r["probed"], note=note)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
