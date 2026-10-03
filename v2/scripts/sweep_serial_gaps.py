#!/usr/bin/env python3
"""Re-ask DOL about the serials the nightly walk skipped.

FLAG issues case numbers from one counter shared by every program, so the
serials held for a filing day should be contiguous. They aren't quite: the
walk advances a cursor and never goes back, so a case missed on the night (or
indexed by DOL after the walk passed it) is otherwise missed for good.

This is the second look. It reads the holes out of our own tables, asks DOL
about each one under every prefix, and inserts what comes back. Nothing here
guesses: a hole is filled only when DOL answers.

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
from lib_turso import Turso, query_rows, record_run  # noqa: E402
from lib_flag_serials import (  # noqa: E402
    ALL_FLAG_PREFIXES, PERM_OFFICE_PREFIXES, case_number, day_code, prefix_of,
)
import ingest_case_status_direct as core  # noqa: E402
import ingest_pwd_status_direct as programs  # noqa: E402

# A day's own span only. Holes are read BETWEEN the lowest and highest serial we
# already hold for that day: outside that range we cannot tell a hole from the
# end of the day's issuance, and guessing past the edge is how a prober burns
# its budget on numbers DOL never issued.
DEFAULT_WINDOW = 60
DEFAULT_CAP = 1200              # requests per run; ~7 min at the module's pace

# Without a memory this sweep never converges: most holes are serials DOL never
# issued, and re-asking every one of them each night would spend the whole
# budget on known absences. But a miss is not permanent either, since DOL's index
# lags and a case can appear after the walk went past it. So a serial is retired
# only after MISS_LIMIT separate empty answers.
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
# A day's holes are asked one prefix at a time (lib_flag_serials.ALL_FLAG_PREFIXES),
# busiest first, 50 numbers to a request, and a serial one prefix claims is not
# asked again. A serial counts as never issued only after every prefix came
# back empty. Asking all 17 prefixes per serial in one request carried 2
# serials a request; rounds carry 50 for most of them, because a serial belongs
# to exactly one prefix and the busiest one usually claims it first.

# Every table that holds a FLAG case, read from the program list rather than
# typed out, so a program added later is never a hole re-asked every night.
CASE_TABLES = ("perm_case_status", *(cfg["table"] for cfg in programs.PROGRAMS.values()))
# DOL's published files (decided cases) count as held too: a number one of them
# lists exists, so asking DOL about it is a wasted question. Measured Oct 3 2026:
# most gaps in 2025's numbers were other programs' decided cases we never kept
# live, and 3,550 decided PERM cases were in DOL's file but not our live table.
PUBLISHED_TABLES = ("perm_cases", "pwd_cases", "lca_cases")


def case_tables(db) -> tuple[str, ...]:
    """The live and published case tables this database actually has."""
    have = {str(r[0]) for r in query_rows(
        db, "SELECT name FROM sqlite_master WHERE type = 'table'", [])}
    return tuple(t for t in (*CASE_TABLES, *PUBLISHED_TABLES) if t in have)


def held_by_prefix(db, code: str, tables: tuple[str, ...] | None = None) -> dict[str, set[int]]:
    """{prefix: serials} we hold for one day code, live or published.

    A range on the case number per prefix, so each read is an index seek on the
    primary key rather than a scan of the table (the old form compared
    CAST(substr(...)) and read every row of every table for every day).
    """
    tables = tables if tables is not None else case_tables(db)
    parts: list[str] = []
    args: list[str] = []
    for t in tables:
        for p in ALL_FLAG_PREFIXES:
            parts.append(f"SELECT substr(case_number, 1, 6) p, substr(case_number, 13) s FROM {t} "
                         "WHERE case_number >= ? AND case_number < ?")
            # '.' sorts right after '-', so this is every number of the day.
            args += [f"{p}{code}-", f"{p}{code}."]
    out: dict[str, set[int]] = {}
    if not parts:
        return out
    # libSQL hands values back as strings, and sorting or ranging over strings
    # compares lexically ("9" > "10"), so this coercion is load-bearing.
    for pfx, ser in query_rows(db, "\n      UNION ".join(parts), args):
        if ser is not None and str(ser).isdigit():
            out.setdefault(str(pfx), set()).add(int(ser))
    return out


def held_serials(db, code: str, tables: tuple[str, ...] | None = None) -> list[int]:
    """Every serial we hold for one day code, in any program, live or published."""
    return sorted(set().union(*held_by_prefix(db, code, tables).values()))


def prefix_order(held: dict[str, set[int]], prefixes: tuple[str, ...]) -> list[str]:
    """`prefixes`, busiest first for this day: by how many of the day's numbers
    we already hold under each, then by the overall order. A day's own mix is
    the best guess at its holes' mix (an H-2A season, a quiet PERM week), and
    it updates itself as the tables fill."""
    rank = {p: i for i, p in enumerate(prefixes)}
    return sorted(prefixes, key=lambda p: (-len(held.get(p, ())), rank[p]))


def settled_misses(db, code: str, limit: int = MISS_LIMIT) -> set[int]:
    """Serials DOL has denied `limit` times. Asking again buys nothing."""
    rows = query_rows(
        db, "SELECT serial FROM perm_serial_misses WHERE day_code = ? AND misses >= ?",
        [int(code), limit])
    # Integers arrive as strings here too.
    return {int(r[0]) for r in rows if r[0] is not None}


# A span this wide is a wrap, not a day: the counter rolls at 1,000,000, so the
# day it rolls on reads MIN 1 / MAX 999,997.
MAX_PLAUSIBLE_SPAN = 200_000


def day_bounds(db) -> dict[int, tuple[int, int, int]]:
    """{day_code: (min_serial, max_serial, held_count)} for every day we hold.

    One query for the whole history: the caller needs every day, not just the
    ones being swept, because a day's true span is defined by its neighbours.
    """
    union = "\n        UNION ".join(
        f"SELECT CAST(substr(case_number,7,5) AS INT) d, "
        f"CAST(substr(case_number,13) AS INT) n FROM {t} "
        # Only this counter's numbers: the old form's A- numbers are another series.
        f"WHERE substr(case_number,1,6) IN ({','.join(repr(p) for p in ALL_FLAG_PREFIXES)})"
        for t in case_tables(db))
    sql = f"""
      WITH s AS (
        {union})
      SELECT d, MIN(n), MAX(n), COUNT(*) FROM s GROUP BY d ORDER BY d
    """
    out: dict[int, tuple[int, int, int]] = {}
    for r in query_rows(db, sql, []):
        # libSQL returns integers as STRINGS. Comparing or ranging over those
        # compares lexically ("9" > "10"), so the coercion is load-bearing.
        d, lo, hi, n = (int(x) for x in r[:4])
        out[d] = (lo, hi, n)
    return out


def true_span(bounds: dict[int, tuple[int, int, int]], code: str) -> tuple[int, int] | None:
    """The serial range day `code` really owns, bounded by its neighbours.

    FLAG issues case numbers from one global sequential counter, so every serial
    between the previous day's highest and the next day's lowest belongs to this
    day. That makes the span exact, including the serials before the first case
    we happen to hold and after the last, which a day's own MIN/MAX can't see.
    A wrap day has no usable span and returns None.
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
        # The day the counter wraps has no usable span: its own MIN/MAX are 0 and
        # 999,999, and its serials sit in two clusters with no way to say which
        # unissued numbers between them belong to it. So it is skipped and named
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
    # One statement per batch, never one per serial: the cost is per statement.
    for i in range(0, len(serials), 200):
        chunk = serials[i:i + 200]
        values = ", ".join(f"({int(code)}, {s}, 1, {stamp})" for s in chunk)
        db.execute(
            f"INSERT INTO perm_serial_misses (day_code, serial, misses, last_probed_at) "
            f"VALUES {values} "
            f"ON CONFLICT(day_code, serial) DO UPDATE SET "
            f"misses = misses + 1, last_probed_at = excluded.last_probed_at", [])


# A stop on the sweep's own cap is not a failure: it records `ok` and names the
# stop in its note. check_ingest_health.py reads this exact string (a test pins
# the two equal).
CAP_NOTE = "stopped on the request cap"

# A refusal from DOL (an HTTP 403 after the retries) is a stop too, usually on
# the tail of the main sweep's own requests, and nothing anyone can act on: the
# sweep keeps what it found, records only the misses DOL actually answered,
# names the refusal and resumes tomorrow. A refusal that recurs is still caught:
# the main sweep fails first on a persistent one, and check_gap_sweep fires
# when three runs probe nothing.
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
          bounds: dict[int, tuple[int, int, int]] | None = None,
          prefixes: tuple[str, ...] = ALL_FLAG_PREFIXES, recheck: bool = False,
          settle_after: int = MISS_LIMIT) -> dict:
    """Probe each day's holes under `prefixes`.

    `recheck` is the one-off mode for a prefix added after the fact: it asks
    only the new prefixes, re-asks serials the miss ledger already retired
    (they were retired under the OLD prefix set, so "never issued" was a
    claim about the prefixes asked, not about DOL), and writes no misses,
    because an empty answer under three prefixes says nothing about the
    other nine.
    """
    lookup = lookup or core.lookup_with_retry
    # Built once for the whole run. Without it each day is probed only between
    # its own known serials and the inter-day regions are never asked about.
    if bounds is None:
        bounds = day_bounds(db)
    tables = case_tables(db)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(core.time.time() * 1000)
    requests = probed = found = ins_perm = ins_other = retired = 0
    skipped: list[str] = []
    if not dry and not recheck:
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
        skip = set() if recheck else settled_misses(db, code, settle_after)
        held = held_by_prefix(db, code, tables)
        gaps = holes(sorted(set().union(*held.values())), skip, span)
        if not gaps:
            continue
        day_found = 0
        pending = list(gaps)        # not claimed by any prefix asked so far
        complete = True             # every prefix asked about every pending serial
        first_round = True
        for pfx in prefix_order(held, prefixes):
            if not pending:
                break
            still: list[int] = []
            for i in range(0, len(pending), core.BATCH):
                if requests >= cap:
                    complete = False
                    break
                chunk = pending[i:i + core.BATCH]
                nums = [case_number(pfx, code, s) for s in chunk]
                requests += 1
                try:
                    hits = lookup(nums)
                except RuntimeError as exc:
                    # The HTTP-status shape `lookup` raises, after its retries.
                    # Only that: a code defect in the insert path must still
                    # propagate, or a bug becomes a quiet nightly "ok". The day
                    # is left unfinished, so none of its serials is retired;
                    # what it found is kept, and the next run asks the rest.
                    refused = str(exc)
                    complete = False
                    break
                # Only exact matches count. The endpoint is a search: asked about
                # numbers that don't exist, it answers with scored near matches
                # from other serials, days and prefixes, which must be neither
                # counted nor stored. The walk keeps exact matches only, and so
                # does this.
                wanted = set(nums)
                hits = [h for h in hits if h.get("caseNumber") in wanted]
                if first_round:
                    probed += len(chunk)
                claimed = {int(h["caseNumber"][12:]) for h in hits
                           if h.get("caseNumber") and h["caseNumber"][12:].isdigit()}
                still.extend(s for s in chunk if s not in claimed)
                if not hits:
                    continue
                found += len(hits)
                day_found += len(hits)
                if dry:
                    continue
                perm = [h for h in hits if prefix_of(h["caseNumber"]) in PERM_OFFICE_PREFIXES]
                other = [h for h in hits if h not in perm]
                ins_perm += core._insert_perm_hits(db, perm, now_iso, stamp)
                ins_other += core._insert_other_hits(db, other)
            if not complete:
                break
            pending = still
            first_round = False
        # A serial is a miss only when every prefix was asked and none claimed it.
        day_missed = pending if complete else []
        if not dry and not recheck:
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
    ap.add_argument("--recheck-prefixes", metavar="P,P",
                    help="one-off: ask ONLY these prefixes (e.g. H-300-,H-400-,P-400-), "
                         "including serials the miss ledger retired; writes no misses")
    ap.add_argument("--pace", type=float, default=0.0,
                    help="seconds between requests (a long one-off run should be polite)")
    a = ap.parse_args()

    db = Turso()
    # The program tables must exist before held_serials can read them, and a
    # program added later has none until something creates it.
    programs.ensure_schema(db)
    recheck = tuple(p.strip() for p in (a.recheck_prefixes or "").split(",") if p.strip())
    unknown = [p for p in recheck if p not in ALL_FLAG_PREFIXES]
    if unknown:
        raise SystemExit(f"--recheck-prefixes: not a known prefix: {', '.join(unknown)}")
    today = datetime.date.today()
    if a.frm and a.to:
        # Newest first here too, matching the default path below, so a run
        # that is interrupted or capped has already covered the recent days.
        codes = [str(c) for c in range(int(a.to), int(a.frm) - 1, -1)]
    else:
        # Newest first: a hole in the last fortnight matters more than one in a
        # day code from three months ago, and a capped run should spend its
        # budget where the data is most used.
        codes = [day_code(today - datetime.timedelta(days=i))
                 for i in range(a.window)]
    core.log(f"gap sweep over {len(codes)} day code(s), cap {a.cap} requests"
             + (" (dry run)" if a.dry_run else ""))

    def paced(nums):
        core.time.sleep(a.pace)
        return core.lookup_with_retry(nums)
    lookup = paced if a.pace > 0 else None
    r = sweep(db, codes, cap=a.cap, dry=a.dry_run, lookup=lookup,
              **({"prefixes": recheck, "recheck": True} if recheck else {}))
    core.log(f"  probed {r['probed']:,} holes in {r['requests']:,} requests")
    core.log(f"  DOL confirmed {r['found']:,} of them as real cases")
    core.log(f"  inserted {r['inserted_perm']:,} PERM, {r['inserted_other']:,} PWD/LCA")
    if recheck:
        core.log(f"  {r['missed']:,} serials came back empty under {', '.join(recheck)}; "
                 "no misses recorded (a recheck never retires a serial)")
    else:
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
        # `probed`, not `found`: a sweep that finds nothing is the success case
        # once the corpus is contiguous. Probes reach zero only when there were
        # no holes, or when `held_serials` broke, which is the defect this number
        # exists to expose. A recheck run is a one-off backfill and keeps its own
        # key, so it never moves the nightly sweep's health line.
        record_run(db, "sweep_serial_gaps.py" + (" --recheck-prefixes" if recheck else ""),
                   status=status, rows_written=r["probed"], note=note)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
