#!/usr/bin/env python3
"""Fail loudly when a dataset stops refreshing.

WHY THIS EXISTS. Every ingest already records an `as_of` and a `max_age_days`
in `data_freshness`, and `DataProvenance` renders a warning when a dataset is
overdue. But that warning appears on a PAGE, and nobody watches pages. The
other channel is GitHub emailing on a red scheduled run - and FOUR of the six
ingests mark their step `continue-on-error: true`, so a failed ingest exits
green and sends nothing.

Net effect before this script: if permtrack changed shape, or DOL moved a file,
or a token expired, the site would keep serving the last good numbers under
their own as-of date and NOTHING would tell us. That is worse than an outage,
because an outage is visible.

This runs in CI on a schedule and EXITS NON-ZERO when any dataset is past its
own declared budget, which turns the run red and triggers GitHub's own
notification. No new alerting infrastructure, no extra credential.

TWO CHECKS, BECAUSE FRESHNESS ALONE MISSES A RUN THAT FAILED LATE. A sweep
stamps `data_freshness` when its own work is done and then writes several
precomputed docs; on 2026-09-03 the case-status sweep stamped itself fresh at
13:58:50 and died at 14:00:11, and every one of the 36 rows in `ingest_runs`
said `ok` while two ingests had failed that morning. So this also reads the
audit trail and fails when an ingest's MOST RECENT run did not finish clean.

THE BUDGET COMES FROM THE DATA, NOT FROM HERE. Each row carries the
`max_age_days` its own ingest set, because only that ingest knows whether it is
daily, quarterly or event-driven. A threshold hardcoded in the checker would
drift from the thing it checks - the same defect class as a gate holding its
own copy of the list it is checking.
"""
from __future__ import annotations

import datetime
import json
import re
import statistics
import time
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from lib_flag_serials import code_to_date  # noqa: E402
from lib_turso import Turso  # noqa: E402


def parse_as_of(raw: str) -> datetime.date | None:
    """`as_of` is not one format, on purpose - it says what the source says.

    "2026-08-26" is a day, "2026-08" is a month, "2026Q2" is a quarter. Each is
    the real granularity of its publication, and flattening them would invent
    precision. A month or quarter is resolved to its LAST day, because that is
    the earliest moment the period could be complete.
    """
    raw = (raw or "").strip()
    try:
        if len(raw) == 10:
            return datetime.date.fromisoformat(raw)
        if len(raw) == 7 and raw[4] == "-":
            y, m = int(raw[:4]), int(raw[5:7])
            nxt = datetime.date(y + (m == 12), 1 if m == 12 else m + 1, 1)
            return nxt - datetime.timedelta(days=1)
        if len(raw) == 6 and raw[4] in "Qq":
            y, qn = int(raw[:4]), int(raw[5])
            end_m = qn * 3
            nxt = datetime.date(y + (end_m == 12), 1 if end_m == 12 else end_m + 1, 1)
            return nxt - datetime.timedelta(days=1)
    except (ValueError, IndexError):
        return None
    return None


NOW_MS = time.time() * 1000

# How far back a failed run still counts. Matched to the daily ingests' own
# `max_age_days=3` so the two checks agree about what "recent" means. An older
# failure ages out on purpose: if the script never ran again, that is a
# STOPPED ingest, and `data_freshness` is the check that says so.
RUN_FAILURE_WINDOW_DAYS = 3

# WHICH OUTCOMES ARE A BREAK, and which are merely worth recording.
#
# `cancelled` is deliberately NOT here. Both DOL workflows set
# `cancel-in-progress: false`, so a newer run never cancels an older one and a
# cancellation is almost always a person pressing stop. Turning that red would
# train the reader to skim past the alert inside a week, which costs more than
# the cancellation it reported. The row is still written and still printed
# below - a cancellation mid-sweep IS worth seeing in the history - it just
# does not fail the check.
#
# A genuine HANG is not a cancellation here either: both workflows wrap the
# sweep in `timeout` set below the job cap precisely so a hang exits 124 and
# lands as `failed`.
BROKEN_STATUSES = frozenset({"failed", "partial"})


def check_runs(db) -> int:
    """Fail when an ingest's most recent run did not finish clean.

    KEYED ON THE SCRIPT FILENAME PLUS ITS MODE FLAG (see run_key). It used
    to key on the filename alone, so that any later clean run of the script
    cleared the flag. That answered "has this script recovered?" for a
    script with one job and was wrong for one with two: on Sun Sep 6 2026
    the weekly PWD/LCA full sweep died on its timeout at 12:38 PM, Monday's
    daily pending pass ran clean at 5:40 AM, this check ran at 6:00 AM and
    saw only the pass. The weekly job could fail every week and never be
    reported. The workflow failure hooks now pass the mode too, so a killed
    run and its later clean run share a key.
    """
    cutoff = int(NOW_MS - RUN_FAILURE_WINDOW_DAYS * 86_400_000)
    try:
        res = db.execute(
            "SELECT script, status, note, finished_at FROM ingest_runs "
            "WHERE finished_at >= ? ORDER BY finished_at DESC", [cutoff])
    except RuntimeError as exc:
        # A database that has never run an ingest has no such table. That is
        # not a failure, and it must not read as one - but say so out loud,
        # because "no rows" and "no table" look identical from a pass.
        print(f"ingest_runs      : unreadable ({str(exc)[:120]})")
        return 0
    rows = [[None if c["type"] == "null" else c["value"] for c in r]
            for r in res["response"]["result"]["rows"]]

    newest: dict[str, tuple[str, str, int]] = {}
    for script, status, note, finished in rows:
        key = run_key(script)
        if key not in newest:                       # rows arrive newest first
            newest[key] = (str(status), str(note or ""), int(finished))

    # A LEGACY ROW HAS NO MODE, SO NO LATER RUN CAN SHARE ITS KEY. The failure
    # hooks recorded the bare filename until Sep 6 2026; a failure written in
    # that shape would stay BROKEN for the whole window even after the script
    # ran clean in every mode, because nothing keys on the bare name any more.
    # Any later clean run of the same FILENAME supersedes it. Mode-keyed rows
    # keep their exact-key rule: that is the whole point of keying by mode.
    for key in list(newest):
        status, note, finished = newest[key]
        if " " in key or status not in BROKEN_STATUSES:
            continue
        later = [(k, v) for k, v in newest.items()
                 if k.startswith(key + " ") and v[0] == "ok" and v[2] > finished]
        if later:
            by = ", ".join(k.split()[1] for k, _ in later)
            newest[key] = ("ok", f"legacy failure superseded by a clean {by} run", finished)

    print(f"\ningests with a run in {RUN_FAILURE_WINDOW_DAYS}d: {len(newest)} "
          f"({len(rows)} runs)")
    bad = []
    for key in sorted(newest):
        status, note, finished = newest[key]
        age_h = (NOW_MS - finished) / 3_600_000
        broken = status in BROKEN_STATUSES
        verdict = "BROKEN" if broken else ("ok" if status == "ok" else status)
        print(f"{key:38s} {status:8s} {age_h:5.1f}h ago  {verdict}")
        if broken:
            bad.append((key, status, note))
    if not bad:
        return 0
    print(f"\nRUNS BROKEN: {len(bad)}")
    for key, status, note in bad:
        print(f"  {key}: last run finished '{status}' - {note[:160]}")
    print("\nThe ingest's own work may have succeeded; something after it did "
          "not. Read the note, then the Actions run it names.")
    return 1


def run_key(script) -> str:
    """'ingest_pwd_status_direct.py --full --program all' -> 'ingest_pwd_status_direct.py --full'.

    The filename plus the first mode flag, so the daily and the weekly pass
    of one script are separate recovery questions. A bare filename (the old
    failure-hook shape) keys on its own.
    """
    if not script:
        return "?"
    parts = str(script).split()
    if len(parts) > 1 and parts[1].startswith("--"):
        return f"{parts[0]} {parts[1]}"
    return parts[0]


# Measured normal lag between a filing and the walk recording it: 0 to 2
# days. A Friday filing first seen after a Monday holiday is 4. Five is the
# smallest budget that never fires on a calendar.
FRONTIER_MAX_DAYS = 5
FRONTIER_DOC = "discovery_frontier"
# Consecutive discovery walks that inserted nothing before that is an alarm.
# A three-day weekend is three quiet walks at most.
DISCOVERY_DRY_RUNS = 4


def check_frontier(db) -> int:
    """Fail when the discovery walk's cursor has not moved in FRONTIER_MAX_DAYS.

    WHY THIS IS ITS OWN CHECK. Every other line in this report measures that
    a JOB RAN: `data_freshness` is stamped by the sweep, `ingest_runs` says
    it exited clean. From Aug 31 to Sep 6 2026 the PERM prober ran every
    night, exited 0, stamped itself fresh, and recorded nothing, because it
    was asking DOL for case numbers that could not exist. Seven days, all
    green. The walk's cursor is the one number that only moves when a
    filing is actually recorded, so it is the one to judge.

    MAX(filing_date) on the PWD/LCA tables is printed for context and NOT
    judged: a visitor looking up a fresh case inserts a row with a fresh
    filing date, so that number stays green with the prober dead (the two
    G-200-26246 rows found on Sep 6 were exactly that).
    """
    today = datetime.date.today()
    try:
        res = db.execute("SELECT json FROM perm_docs WHERE key = ?", [FRONTIER_DOC])
        rows = res["response"]["result"]["rows"]
    except RuntimeError as exc:
        print(f"frontier          : unreadable ({str(exc)[:120]})")
        return 1
    if not rows or rows[0][0].get("type") == "null":
        print("frontier          : MISSING - the discovery walk has never recorded a cursor")
        return 1
    try:
        doc = json.loads(rows[0][0]["value"])
        code, serial = str(doc["day_code"]), int(doc["serial"])
    except (ValueError, KeyError, TypeError) as exc:
        print(f"frontier          : unreadable doc ({type(exc).__name__}: {exc})")
        return 1
    d = code_to_date(code)
    if d is None:
        print(f"frontier          : impossible day code {code!r}")
        return 1
    age = (today - d).days
    stalled = age > FRONTIER_MAX_DAYS
    print(f"frontier          : {code}:{serial:06d} = {d.isoformat()}  "
          f"{age:>3}d  budget {FRONTIER_MAX_DAYS}d  {'STALLED' if stalled else 'ok'}")
    for table in ("pwd_case_status", "lca_case_status"):
        try:
            r = db.execute(f"SELECT MAX(filing_date) FROM {table}")["response"]["result"]["rows"]
            print(f"  {table:18s} newest filing {r[0][0].get('value') if r else None}  (context only)")
        except RuntimeError:
            pass
    if stalled:
        print(f"\nDiscovery has not recorded a filing newer than {d.isoformat()}. The "
              f"sweeps can run clean forever over a corpus that stopped growing; "
              f"this is the line that says so.")
        return 1
    return 0


def check_discovery_yield(db) -> int:
    """Fail when the last DISCOVERY_DRY_RUNS walks all recorded zero insertions.

    A second, independent view of the same failure: the cursor above could
    in principle move on hits that INSERT OR IGNORE then discards (a visitor
    found them first). Zero insertions across four walks means the corpus
    is not growing through this path whatever the cursor says.
    """
    try:
        res = db.execute(
            "SELECT status, rows_written, finished_at FROM ingest_runs WHERE script = ? "
            "ORDER BY finished_at DESC LIMIT ?",
            ["ingest_case_status_direct.py --discover", DISCOVERY_DRY_RUNS])
        rows = [[None if c["type"] == "null" else c["value"] for c in r]
                for r in res["response"]["result"]["rows"]]
    except RuntimeError as exc:
        print(f"discovery yield   : unreadable ({str(exc)[:120]})")
        return 0
    if len(rows) < DISCOVERY_DRY_RUNS:
        print(f"discovery yield   : {len(rows)} walk(s) on record; {DISCOVERY_DRY_RUNS} needed to judge")
        return 0
    writes = [int(r[1] or 0) for r in rows]
    dry = not any(writes)
    print(f"discovery yield   : last {len(rows)} walks inserted {writes}  {'DRY' if dry else 'ok'}")
    if dry:
        print(f"\nThe discovery walk has inserted nothing on its last {DISCOVERY_DRY_RUNS} "
              f"runs. Either DOL stopped issuing (it has not) or the walk is asking "
              f"for numbers that cannot exist.")
        return 1
    return 0


# A backfill that has not advanced its frontier in this long has stopped
# chaining and the daily resumer (pwd-status-direct.yml) is not reviving it.
BACKFILL_STALL_DAYS = 7


def check_backfill(db) -> int:
    """Report an incomplete PWD/LCA backfill, and fail when it has stalled.

    The record is `perm_docs['flag_backfill_progress']`, written by the
    backfill legs. `lastDayDoneAt` moves only when the frontier does, so a
    leg that restarts every day and dies before moving cannot keep this green.
    """
    try:
        res = db.execute("SELECT json FROM perm_docs WHERE key = ?", ["flag_backfill_progress"])
        rows = res["response"]["result"]["rows"]
    except RuntimeError as exc:
        print(f"backfill          : unreadable ({str(exc)[:120]})")
        return 0
    if not rows:
        print("backfill          : none on record")
        return 0
    try:
        doc = json.loads(rows[0][0]["value"])
    except (TypeError, ValueError, KeyError):
        print("backfill          : record unreadable")
        return 1
    if doc.get("complete"):
        print(f"backfill          : complete through {doc.get('to')}  ok")
        return 0
    moved_at = doc.get("lastDayDoneAt")
    if not moved_at:
        print(f"backfill          : incomplete at {doc.get('lastDayDone')}, no movement stamp "
              "(pre-dates the resumer); cannot judge")
        return 0
    age = (NOW_MS - int(moved_at)) / 86_400_000
    stalled = age > BACKFILL_STALL_DAYS
    print(f"backfill          : incomplete, frontier {doc.get('lastDayDone')} last moved "
          f"{age:.1f}d ago (target {doc.get('to')})  {'STALLED' if stalled else 'ok'}")
    if stalled:
        print(f"\nThe PWD/LCA backfill has not advanced in {BACKFILL_STALL_DAYS} days and the "
              "daily resumer is not reviving it. Dispatch pwd-status-direct.yml with "
              "mode=backfill by hand and read that run's log.")
        return 1
    return 0


# Lookup demand: the count of live DOL lookups the case page made, per UTC
# day, in perm_docs['discovery_budget_<date>']. It is the number a crawler on
# `/perm-case-status?case=` moves - Meta's spent 2,000 a day before 5 AM in
# September 2026 - and the one thing on this site that alerts on nothing
# else. Vercel's only firewall alert fires at 100,000 requests per 10
# minutes, ten times that crawler's rate. Judged against the site's own
# recent median with a floor, because the organic rate is single digits.
LOOKUP_DEMAND_FLOOR = 500
LOOKUP_DEMAND_MULTIPLE = 5
LOOKUP_DEMAND_HISTORY = 30


def check_lookup_demand(db) -> int:
    try:
        res = db.execute(
            "SELECT key, json FROM perm_docs WHERE key LIKE 'discovery_budget_%' "
            "ORDER BY key DESC LIMIT ?", [LOOKUP_DEMAND_HISTORY + 1])
        rows = [[c["value"] for c in r] for r in res["response"]["result"]["rows"]]
    except RuntimeError as exc:
        print(f"lookup demand     : unreadable ({str(exc)[:120]})")
        return 0
    counts = []
    for key, raw in rows:
        try:
            counts.append((str(key)[-10:], int(str(raw).strip('"'))))
        except (TypeError, ValueError):
            continue
    if len(counts) < 8:
        print(f"lookup demand     : {len(counts)} day(s) on record; 8 needed to judge")
        return 0
    (day, latest), history = counts[0], [n for _, n in counts[1:]]
    median = statistics.median(history)
    limit = max(LOOKUP_DEMAND_FLOOR, LOOKUP_DEMAND_MULTIPLE * median)
    spike = latest > limit
    print(f"lookup demand     : {latest:,} DOL lookups on {day} (median of the last "
          f"{len(history)} days {median:.0f}, limit {limit:,.0f})  {'SPIKE' if spike else 'ok'}")
    if spike:
        print("\nSomething is driving live case lookups far above this site's own rate. "
              "Read the Vercel Firewall Traffic tab grouped by ASN and JA4 before "
              "anything else; the last time this happened it was one crawler on "
              "rotating addresses.")
        return 1
    return 0


def check_coverage_stated(db) -> int:
    """Every registered dataset says what it CONTAINS, not just how often it arrives.

    The provenance line under every data page has always carried a source, an
    as-of date and a cadence. Cadence is not coverage, and the gap between them
    is where this project's two recurring errors live: "quarterly" does not say
    DOL's files hold only DECIDED cases, and "daily" does not say our sweep
    includes pending but carries no wage.

    The sentences live in `src/lib/datasetCoverage.ts`. A vitest gate holds
    their shape, but it cannot see the full registry - most ingests write
    `data_freshness` with a plain SQL tuple rather than a helper, so scraping
    finds only a subset. This check has the live registry, so it is the one
    that can say a NEW dataset shipped without a sentence.
    """
    src = (pathlib.Path(__file__).resolve().parent.parent
           / "src" / "lib" / "datasetCoverage.ts")
    if not src.is_file():
        print("coverage: datasetCoverage.ts not found; skipping")
        return 0
    text = src.read_text(encoding="utf8", errors="ignore")
    stated = set(re.findall(r'^\s*"?([a-z0-9-]+)"?:\s*$|^\s*"?([a-z0-9-]+)"?:\s*"',
                            text, re.M))
    have = {a or b for a, b in stated if (a or b)}
    registered = {str(r[0]) for r in db.rows("SELECT dataset FROM data_freshness")}
    missing = sorted(registered - have)
    if missing:
        print(f"COVERAGE: {len(missing)} dataset(s) registered with no coverage "
              f"sentence: {', '.join(missing)}")
        print("  A reader sees its cadence and has to guess whether it holds "
              "pending cases. Add a line to src/lib/datasetCoverage.ts.")
        return 1
    print(f"coverage: all {len(registered)} registered datasets state what they contain")
    return 0


def main() -> int:
    db = Turso()
    res = db.execute(
        "SELECT dataset, as_of, max_age_days, source, cadence, fetched_at "
        "FROM data_freshness "
        "ORDER BY dataset"
    )
    rows = [
        [None if c["type"] == "null" else c["value"] for c in r]
        for r in res["response"]["result"]["rows"]
    ]

    # A checker that cannot see its subject reads exactly like a pass. This has
    # bitten this project twice today alone.
    print(f"datasets registered : {len(rows)}")
    if not rows:
        print("FAIL: data_freshness is empty - the checker has no subject")
        return 2

    today = datetime.date.today()
    stale, unparseable = [], []
    print(f"{'dataset':22s} {'as_of':12s} {'age':>6s} {'budget':>7s}  verdict")
    for dataset, as_of, max_age, source, _cadence, fetched_at in rows:
        d = parse_as_of(str(as_of))
        if d is None or max_age is None:
            unparseable.append((dataset, as_of))
            print(f"{dataset:22s} {str(as_of):12s} {'?':>6s} {str(max_age):>7s}  UNREADABLE")
            continue
        age = (today - d).days
        budget = int(max_age)
        data_stale = age > budget
        bad = data_stale

        # AN `as_of` IN THE FUTURE MAKES THE BUDGET UNTRIPPABLE. The visa
        # bulletin is dated by the month it COVERS, and that month is always
        # ahead of the day it is published: the September bulletin exists in
        # August, so its age reads -34 days and no budget can ever be
        # exceeded. That row was printing `ok` for a reason that had nothing
        # to do with the ingest still running.
        #
        # `as_of` answers "is the SOURCE still publishing". `fetched_at`
        # answers "is OUR INGEST still running", and only the second one is
        # monotonic. Check both, and let either trip.
        run_age = None
        if fetched_at is not None:
            run_age = (NOW_MS - int(fetched_at)) / 86_400_000
            # A run budget of twice the data budget, floored at a week: an
            # ingest is allowed to be idle between publications, but not
            # forever. This is what would have caught a dead ingest behind a
            # future-dated row.
            run_budget = max(7, budget * 2)
            if run_age > run_budget:
                bad = True
                stale.append((dataset + " (has not RUN)", int(run_age),
                              run_budget, source))
        # Report the as_of line ONLY when the as_of is genuinely over budget.
        # Keying it off `bad` printed "visa-bulletin: -34 days old" in an
        # alert - a false statement, and the fastest way to teach someone to
        # skim past the true line sitting next to it.
        if data_stale:
            stale.append((dataset, age, budget, source))
        print(f"{dataset:22s} {str(as_of):12s} {age:>5}d {budget:>6}d  "
              f"{'STALE' if bad else 'ok'}")

    # RUN BEFORE THE EARLY RETURNS BELOW. A stale dataset and a failed run
    # are independent defects and the report must show both, or fixing the
    # loud one hides the quiet one until tomorrow.
    runs_bad = check_runs(db)
    print()
    frontier_bad = check_frontier(db)
    yield_bad = check_discovery_yield(db)
    backfill_bad = check_backfill(db)
    demand_bad = check_lookup_demand(db)
    coverage_bad = check_coverage_stated(db)

    print()
    if unparseable:
        print(f"UNREADABLE as_of on {len(unparseable)}: "
              + ", ".join(f"{d} ({v!r})" for d, v in unparseable))
    if stale:
        print(f"STALE: {len(stale)} dataset(s) past their own budget")
        for dataset, age, budget, source in stale:
            print(f"  {dataset}: {age} days old, budget {budget} - source: {source}")
        print("\nAn ingest has stopped, or its source changed shape. The site is "
              "still serving the last good numbers under their own as-of date, "
              "which is why nothing else would have told us.")
        return 1
    # An unreadable date is a real defect too: it means DataProvenance cannot
    # compute an age either, so the page silently stops warning about that row.
    if (runs_bad or frontier_bad or yield_bad or backfill_bad or demand_bad
            or coverage_bad or unparseable):
        return 1
    print("All datasets within their declared freshness budgets, every ingest's "
          "most recent run finished clean, the discovery frontier is moving, no "
          "backfill has stalled, and lookup demand is at its normal rate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
