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
second look. An independent check against permtrack's published July figure put
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
from lib_flag_serials import case_number, day_code, prefix_of  # noqa: E402
import ingest_case_status_direct as core  # noqa: E402

# Every prefix we have ever seen on this counter, in measured hit-rate order.
# A serial belongs to exactly one of them; the walk drops it the moment one
# claims it, so asking in frequency order keeps the request count down.
PREFIXES = ("G-100-", "I-200-", "P-100-", "G-200-", "I-203-",
            "I-201-", "I-202-", "G-300-")

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


def holes(serials: list[int], skip: set[int] | None = None) -> list[int]:
    """Serials inside the day's own span that we neither hold nor have retired.

    The span is bounded by what we hold on BOTH ends on purpose: past the
    highest serial we know for a day there is no way to tell a hole from the
    end of that day's issuance, and probing past the edge is how a prober
    spends its whole budget on numbers that were never issued.
    """
    if len(serials) < 2:
        return []
    have = set(serials)
    skip = skip or set()
    return [s for s in range(serials[0], serials[-1] + 1)
            if s not in have and s not in skip]


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


def sweep(db, codes: list[str], *, cap: int, lookup=None, dry: bool = False) -> dict:
    lookup = lookup or core.lookup_with_retry
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(core.time.time() * 1000)
    requests = probed = found = ins_perm = ins_other = retired = 0
    if not dry:
        db.execute(MISS_DDL, [])
    per_day: list[tuple[str, int, int]] = []
    for code in codes:
        if requests >= cap:
            break
        gaps = holes(held_serials(db, code), settled_misses(db, code))
        if not gaps:
            continue
        day_found = 0
        day_missed: list[int] = []
        for i in range(0, len(gaps), SERIALS_PER_REQUEST):
            if requests >= cap:
                break
            chunk = gaps[i:i + SERIALS_PER_REQUEST]
            nums = [case_number(p, code, s) for s in chunk for p in PREFIXES]
            probed += len(chunk)
            requests += 1
            hits = lookup(nums)
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
            "days_with_finds": per_day, "capped": requests >= cap}


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
        codes = [str(c) for c in range(int(a.frm), int(a.to) + 1)]
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
    if r["capped"]:
        core.log("  stopped on the request cap; the next run resumes from the same window")
    if r["probed"] and not r["found"]:
        core.log("  every hole probed was genuinely unissued - the walk is not missing cases here")

    if not a.dry_run:
        record_run(db, "sweep_serial_gaps.py",
                   status="partial" if r["capped"] else "ok",
                   # `probed`, NOT `found`. A sweep that finds nothing is the
                   # SUCCESS case once the corpus is contiguous, so recording
                   # finds here would make a healthy sweep look dead. Probes
                   # only reach zero when the walk left no holes at all, or
                   # when `held_serials` broke - and the second is the defect
                   # this number exists to expose.
                   rows_written=r["probed"],
                   note=f"probed {r['probed']}, found {r['found']}, "
                        f"inserted {r['inserted_perm']}+{r['inserted_other']}, "
                        f"missed {r['missed']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
