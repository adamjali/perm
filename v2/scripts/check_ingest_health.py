#!/usr/bin/env python3
"""Fail loudly when a dataset stops refreshing.

The staleness warning a data page renders is something nobody watches, and a
failed ingest step is often allowed to exit green, so without this the site
would keep serving its last good numbers under their own as-of date and nothing
would say so.

Run daily in CI, it exits non-zero when our ingest has stopped fetching, or a
source has been silent past SOURCE_PAUSED_GRACE times its budget; a source that
is merely late is a printed `::warning::`. A red run is what triggers GitHub's
notification, so no other alerting is needed.

Freshness alone misses a run that failed after stamping itself fresh, so this
also reads the `ingest_runs` audit trail and fails when an ingest's most recent
run did not finish clean.

The budget comes from the data: each `data_freshness` row carries the
`max_age_days` its own ingest set, because only that ingest knows its cadence.
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
from lib_turso import Turso, query_rows, rows_of  # noqa: E402


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

# Which outcomes are a break. `cancelled` is deliberately not: the DOL
# workflows never cancel an older run, so a cancellation is almost always a
# person pressing stop, and alarming on it would teach the reader to skim past
# the alert. It is still recorded and printed. A genuine hang is not a
# cancellation either: the workflows wrap each sweep in a `timeout` below the
# job cap, so a hang exits 124 and lands as `failed`.
BROKEN_STATUSES = frozenset({"failed", "partial"})
# A run that stops on its own request cap records `ok` and names the cap in its
# note. Byte-identical to CAP_NOTE in sweep_serial_gaps.py and
# ingest_case_status_direct.py (test_ingest_health pins it), so a `partial` row
# carrying it reads as the designed stop it was.
SWEEP_CAP_NOTE = "stopped on the request cap"
# The walk's other designed stop, its time budget. Byte-identical to
# ingest_case_status_direct.BUDGET_NOTE; test_ingest_health.py pins it.
BUDGET_NOTE = "stopped on its time budget"


def check_runs(db) -> int:
    """Fail when an ingest's most recent run did not finish clean.

    Keyed on the script filename plus its mode flag (see run_key), so the
    daily and the weekly pass of one script are separate questions: a clean
    daily pass must never clear a failed weekly one. The workflow failure
    hooks pass the mode too, so a killed run and its later clean run share a
    key.
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
    rows = rows_of(res)

    newest: dict[str, tuple[str, str, int]] = {}
    for script, status, note, finished in rows:
        key = run_key(script)
        if key not in newest:                       # rows arrive newest first
            newest[key] = (str(status), str(note or ""), int(finished))

    # A row with no mode can share no later run's key, so any later clean run
    # of the same filename supersedes it. Mode-keyed rows keep the exact-key
    # rule.
    for key in list(newest):
        status, note, finished = newest[key]
        if " " in key or status not in BROKEN_STATUSES:
            continue
        later = [(k, v) for k, v in newest.items()
                 if k.startswith(key + " ") and v[0] == "ok" and v[2] > finished]
        if later:
            by = ", ".join(k.split()[1] for k, _ in later)
            newest[key] = ("ok", f"legacy failure superseded by a clean {by} run", finished)

    # The reverse: a mode-keyed failure and a clean run recorded under the bare
    # filename with the mode only in its note ("full: 426,112 cases"). A clean
    # bare-keyed run whose note begins with the same mode clears it.
    for key in list(newest):
        status, note, finished = newest[key]
        if " " not in key or status not in BROKEN_STATUSES:
            continue
        base, mode = key.split(" ", 1)
        bare = newest.get(base)
        if bare and bare[0] == "ok" and bare[2] > finished and bare[1].startswith(mode.lstrip("-") + ":"):
            newest[key] = ("ok", f"failure superseded by a clean {mode} run (recorded bare)", finished)

    print(f"\ningests with a run in {RUN_FAILURE_WINDOW_DAYS}d: {len(newest)} "
          f"({len(rows)} runs)")
    bad = []
    for key in sorted(newest):
        status, note, finished = newest[key]
        age_h = (NOW_MS - finished) / 3_600_000
        capped = status == "partial" and SWEEP_CAP_NOTE in note
        broken = status in BROKEN_STATUSES and not capped
        verdict = "BROKEN" if broken else ("ok (capped)" if capped else ("ok" if status == "ok" else status))
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

# A dataset is stale for two opposite reasons, and they get two exit codes. Our
# ingest having stopped fails at once. A source that hasn't republished while
# our ingest keeps reading it is something nobody can act on, so it is a
# `::warning::` until it has been silent for SOURCE_PAUSED_GRACE times its
# budget, when the page may have moved or the parser may be reading a stale
# element, and a human should look.
SOURCE_PAUSED_GRACE = 3


def freshness_verdict(stale):
    """Split stale rows into (failing, watching).

    A row is (dataset, age_days, budget_days, source); the ingest-dead rows
    carry the ` (has not RUN)` suffix the loop below appends. Failing means
    exit 1; watching means a printed warning and a green run.
    """
    failing, watching = [], []
    for row in stale:
        dataset, age, budget, _source = row
        if dataset.endswith("(has not RUN)") or age > budget * SOURCE_PAUSED_GRACE:
            failing.append(row)
        else:
            watching.append(row)
    return failing, watching
FRONTIER_DOC = "discovery_frontier"
# Consecutive discovery walks that inserted nothing before that is an alarm.
# A three-day weekend is three quiet walks at most.
DISCOVERY_DRY_RUNS = 4


def check_frontier(db) -> int:
    """Fail when the discovery walk's cursor has not moved in FRONTIER_MAX_DAYS.

    Every other check measures that a job ran. A walk can run, exit 0 and
    stamp itself fresh while recording nothing; its cursor is the one number
    that moves only when a filing is actually recorded, so it is the one to
    judge.

    MAX(filing_date) on the PWD/LCA tables is printed for context and not
    judged: a visitor looking up a fresh case inserts a fresh row, so that
    number can stay current with the walk dead.
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
    for table in ("pwd_case_status", "lca_case_status", "seasonal_case_status"):
        try:
            r = query_rows(db, f"SELECT MAX(filing_date) FROM {table}")
            print(f"  {table:18s} newest filing {r[0][0] if r else None}  (context only)")
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
        rows = rows_of(res)
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


# Lookup demand: the live DOL lookups the case page made, per UTC day, in
# perm_docs['discovery_budget_<date>']. It is the number a crawler on
# `/perm-case-status?case=` moves first, and nothing else alerts on it. Judged
# against the site's own recent median with a floor, because the organic rate
# is single digits.
LOOKUP_DEMAND_FLOOR = 500
LOOKUP_DEMAND_MULTIPLE = 5
LOOKUP_DEMAND_HISTORY = 30


# The gap sweep rides the daily FULL pass, so two missed days is a real signal
# and a weekend is not: the full pass runs every day.
GAP_SWEEP_MAX_AGE_DAYS = 3


# The docs the site reads instead of a query too slow for a page. Each degrades
# silently: the reader falls back to the slow live query, so the page still
# renders and nobody notices until a build times out. The budget is "rebuilt
# since the data under it last moved", generous where that data is quarterly.
#
# Only docs whose absence is silent belong here. A doc whose absence shows an
# empty state is already visible to readers and to audit_all_pages
# (`lca_live_summary`, `flag_disclosure_summary_lca`).
PRECOMPUTED_DOCS = {
    "lca_filter_options": (100, "the H-1B salary explorer's facets and default view"),
    # Rebuilt nightly by build_wage_sources.py; a week's grace for a missed night.
    "lca_wage_sources": (7, "the H-1B prevailing wage sources page"),
    "live_census": (8, "the case lookup's queue position"),
    "review_stages": (5, "the review-stage cohort pages"),
    "wage_filter_options": (100, "the PERM salary explorer's facets"),
    "alphabet": (100, "the employer-initial chart on /perm-queue (no longer in any estimate)"),
    # Rebuilt after every sweep, daily and weekly respectively.
    "recent_decision_wait": (3, "the employer pages' wait section and the fastest/slowest view"),
    "scorecard_summary": (3, "the estimate scorecard's daily sample"),
    "estimator_backtest": (9, "the estimate scorecard's headline backtest"),
    # Rebuilt after each monthly H-2A, H-2B and CW-1 load (the 10th).
    "seasonal_timing": (45, "the seasonal case page's decision-timing panel"),
}


def check_precomputed_docs(db) -> int:
    """Fail when a doc the read layer depends on has gone missing or stale.

    A missing doc is not an outage, which is the problem: every reader falls
    back to the live query it replaced, so the page is correct and slow, and
    the only symptom is a slow prerender, invisible until a build dies.
    """
    print("precomputed docs")
    bad = 0
    try:
        rows = {
            str(key): (int(at) if at is not None else None, int(size or 0))
            for key, at, size in query_rows(
                db, "SELECT key, computed_at, length(json) AS bytes FROM perm_docs "
                    "WHERE key IN (" + ",".join("?" * len(PRECOMPUTED_DOCS)) + ")",
                list(PRECOMPUTED_DOCS))
        }
    except Exception as e:  # noqa: BLE001 - a probe failing is itself a finding
        print(f"  FAIL: could not read perm_docs: {e}")
        return 1

    for key, (budget, what) in sorted(PRECOMPUTED_DOCS.items()):
        got = rows.get(key)
        if got is None:
            print(f"  {key:22s} MISSING - {what} is being served by its slow fallback")
            bad = 1
            continue
        computed_at, size = got
        if not computed_at or size < 100:
            print(f"  {key:22s} EMPTY ({size} bytes) - {what}")
            bad = 1
            continue
        age = (NOW_MS - computed_at) / 86_400_000
        verdict = "ok" if age <= budget else "STALE"
        if age > budget:
            bad = 1
        print(f"  {key:22s} {age:5.1f}d / {budget}d  {size:>9,}B  {verdict}")

    if bad:
        print("  A doc missing or stale means its page is running the query the "
              "doc exists to replace. Rebuild it before the next deploy.")
    return bad


# Both explorers' precomputed selections (build_wage_views.py). They change
# only when a disclosure file loads, which is quarterly, so the budget is a
# quarter plus a month of slack for DOL publishing late.
WAGE_VIEW_BUDGET_DAYS = 125
WAGE_VIEW_MIN = {"perm": 50, "lca": 300}


def check_wage_views(db) -> int:
    """Fail when a program's precomputed wage selections are missing or stale.

    Same failure shape as a missing doc: every reader falls back to its live
    query, so the explorer still answers, slowly enough to pass its deadline.
    """
    print("wage views")
    try:
        got = {str(prog): (int(n), int(built)) for prog, n, built in query_rows(
            db, "SELECT program, COUNT(*), MAX(built_at) FROM wage_views GROUP BY program")}
    except Exception as e:  # noqa: BLE001 - a missing table is itself the finding
        print(f"  FAIL: could not read wage_views: {e}")
        return 1
    bad = 0
    for program, floor in WAGE_VIEW_MIN.items():
        if program not in got:
            print(f"  {program:5s} MISSING - the {program} explorer runs every selection live")
            bad = 1
            continue
        n, built = got[program]
        age = (NOW_MS - built) / 86_400_000
        ok = n >= floor and age <= WAGE_VIEW_BUDGET_DAYS
        bad |= 0 if ok else 1
        print(f"  {program:5s} {n:5d} views, built {age:5.1f}d ago / "
              f"{WAGE_VIEW_BUDGET_DAYS}d  {'ok' if ok else 'STALE OR THIN'}")
    return bad


def check_gap_sweep(db) -> int:
    """Fail when the serial gap sweep has stopped running.

    The number judged is holes probed, not cases found: a sweep that recovers
    nothing is the goal state, since as the corpus closes the holes it probes
    are serials DOL never issued. Probes go to zero only for a bad reason:
    `held_serials` returning nothing (a renamed column, a changed type) makes
    every day look contiguous, and the sweep exits clean having asked DOL
    nothing.
    """
    try:
        res = db.execute(
            "SELECT status, rows_written, finished_at, note FROM ingest_runs "
            "WHERE script = ? ORDER BY finished_at DESC LIMIT 5",
            ["sweep_serial_gaps.py"])
        rows = rows_of(res)
    except RuntimeError as exc:
        print(f"gap sweep         : unreadable ({str(exc)[:120]})")
        return 0
    if not rows:
        print("gap sweep         : never run")
        return 0

    last_ms = rows[0][2]
    age = (NOW_MS - int(last_ms)) / 86_400_000 if last_ms is not None else None
    probes = [int(r[1] or 0) for r in rows]
    age_s = f"{age:.1f}d" if age is not None else "?"
    print(f"gap sweep         : last run {age_s} ago, probed {probes}")

    if age is not None and age > GAP_SWEEP_MAX_AGE_DAYS:
        print(f"\nThe serial gap sweep has not run in {age:.1f} days. The discovery "
              f"walk only moves forward, so every day it is absent is a day whose "
              f"skipped serials nothing will ever re-ask for.")
        return 1
    if len(probes) >= 3 and not any(probes):
        print("\nThe gap sweep has probed ZERO holes on its last three runs. Either "
              "every day code we hold is perfectly contiguous (possible, and worth "
              "confirming by hand) or `held_serials` has stopped returning rows.")
        return 1
    return 0


# A job that stops on its own budget every run is not keeping up. One capped
# run is a job doing its work and records `ok`; a streak of them is capacity
# running short, the leading signal a generous lag budget misses. A warning,
# not a failure: the frontier check still fails if the lag itself gets long.
CAP_STREAK_RUNS = 3
CAP_STREAK_JOBS = (("walk", "ingest_case_status_direct.py --discover"),
                   ("gap sweep", "sweep_serial_gaps.py"))


def check_cap_streak(db) -> int:
    """Warn when a job has stopped on its own cap or time budget on each of
    its last CAP_STREAK_RUNS runs. Never fails the check; see above."""
    for label, script in CAP_STREAK_JOBS:
        try:
            notes = [r[0] or "" for r in query_rows(
                db, "SELECT note FROM ingest_runs WHERE script = ? ORDER BY finished_at DESC LIMIT ?",
                [script, CAP_STREAK_RUNS])]
        except RuntimeError as exc:
            print(f"cap streak        : {label} unreadable ({str(exc)[:100]})")
            continue
        if len(notes) < CAP_STREAK_RUNS:
            print(f"cap streak        : {label} has {len(notes)} run(s) on record; "
                  f"{CAP_STREAK_RUNS} needed to judge")
            continue
        stopped = sum(1 for n in notes if SWEEP_CAP_NOTE in n or BUDGET_NOTE in n)
        if stopped == len(notes):
            print(f"cap streak        : {label} stopped on its own budget on each of "
                  f"its last {len(notes)} runs  BEHIND")
            print(f"::warning::the {label} has stopped on its own cap or time budget on "
                  f"each of its last {len(notes)} runs, so it is not keeping up with "
                  "DOL; raise its budget or run it more often")
        else:
            print(f"cap streak        : {label} finished its work on "
                  f"{len(notes) - stopped} of its last {len(notes)} runs  ok")
    return 0


def check_lookup_demand(db) -> int:
    try:
        rows = query_rows(db, "SELECT key, json FROM perm_docs WHERE key LIKE 'discovery_budget_%' "
                              "ORDER BY key DESC LIMIT ?", [LOOKUP_DEMAND_HISTORY + 1])
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
              "Read Cloudflare's Security Events for the zone, grouped by ASN and JA4, before "
              "anything else; the last time this happened it was one crawler on "
              "rotating addresses.")
        return 1
    return 0


def check_coverage_stated(db) -> int:
    """Every registered dataset says what it CONTAINS, not just how often it arrives.

    Cadence is not coverage: "quarterly" doesn't say DOL's files hold only
    decided cases, and "daily" doesn't say the sweep includes pending cases but
    no wage. The sentences live in `src/lib/datasetCoverage.ts`; a vitest gate
    holds their shape, but only this check sees the live registry, so it is the
    one that can say a new dataset shipped without a sentence.
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
    registered = {str(r[0]) for r in query_rows(db, "SELECT dataset FROM data_freshness")}
    missing = sorted(registered - have)
    if missing:
        print(f"COVERAGE: {len(missing)} dataset(s) registered with no coverage "
              f"sentence: {', '.join(missing)}")
        print("  A reader sees its cadence and has to guess whether it holds "
              "pending cases. Add a line to src/lib/datasetCoverage.ts.")
        return 1
    print(f"coverage: all {len(registered)} registered datasets state what they contain")
    return 0


# Figures read by hand from a page no script can reach: USCIS's processing-times
# page answers every script with a Cloudflare challenge, so its I-140 figures
# are read in a browser and typed into
# src/lib/processing-times/i140ProcessingTimes.ts with the date read. A warning
# once they are older than USCIS's own six-month window; a failure only when
# they've gone unrefreshed for most of a year.
HAND_READ_WARN_DAYS = 120
HAND_READ_FAIL_DAYS = 270


def hand_read_verdict(as_of: datetime.date, today: datetime.date) -> str:
    age = (today - as_of).days
    if age > HAND_READ_FAIL_DAYS:
        return "fail"
    if age > HAND_READ_WARN_DAYS:
        return "warn"
    return "ok"


def check_hand_read_figures(today: datetime.date | None = None) -> int:
    src = (pathlib.Path(__file__).resolve().parent.parent
           / "src" / "lib" / "processing-times" / "i140ProcessingTimes.ts")
    if not src.is_file():
        print("hand-read figures: i140ProcessingTimes.ts not found; skipping")
        return 0
    m = re.search(r'PROCESSING_TIMES_AS_OF\s*=\s*"(\d{4}-\d{2}-\d{2})"',
                  src.read_text(encoding="utf8", errors="ignore"))
    if not m:
        print("HAND-READ FIGURES: PROCESSING_TIMES_AS_OF unreadable; the pages can't date them")
        return 1
    as_of = datetime.date.fromisoformat(m.group(1))
    today = today or datetime.date.today()
    verdict = hand_read_verdict(as_of, today)
    age = (today - as_of).days
    how = ("read the eight I-140 classes at https://egov.uscis.gov/processing-times/ "
           "in a browser (a script gets a challenge) and update the file and its date")
    if verdict == "fail":
        print(f"HAND-READ FIGURES: USCIS's I-140 processing times are {age} days old "
              f"(read {as_of}); {how}")
        return 1
    if verdict == "warn":
        print(f"::warning::USCIS's I-140 processing times were read {age} days ago "
              f"({as_of}); {how}")
        return 0
    print(f"hand-read figures: USCIS's I-140 processing times read {as_of} ({age} days)")
    return 0


def main() -> int:
    db = Turso()
    res = db.execute(
        "SELECT dataset, as_of, max_age_days, source, cadence, fetched_at "
        "FROM data_freshness "
        "ORDER BY dataset"
    )
    rows = rows_of(res)

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

        # `as_of` answers "is the source still publishing" and can be in the
        # future (the visa bulletin is dated by the month it covers, published
        # the month before), so it alone could never trip. `fetched_at` answers
        # "is our ingest still running". Check both, and let either trip.
        run_age = None
        if fetched_at is not None:
            run_age = (NOW_MS - int(fetched_at)) / 86_400_000
            # A run budget of twice the data budget, floored at a week: an ingest
            # may be idle between publications, but not forever.
            run_budget = max(7, budget * 2)
            if run_age > run_budget:
                bad = True
                stale.append((dataset + " (has not RUN)", int(run_age),
                              run_budget, source))
        # Report the as_of line only when the as_of itself is over budget, so a
        # future-dated row never prints a false "-34 days old".
        if data_stale:
            stale.append((dataset, age, budget, source))
        print(f"{dataset:22s} {str(as_of):12s} {age:>5}d {budget:>6}d  "
              f"{'STALE' if bad else 'ok'}")

    # Before the early returns below: a stale dataset and a failed run are
    # independent defects, and the report shows both.
    runs_bad = check_runs(db)
    print()
    frontier_bad = check_frontier(db)
    yield_bad = check_discovery_yield(db)
    backfill_bad = check_backfill(db)
    gapsweep_bad = check_gap_sweep(db)
    check_cap_streak(db)        # a warning only; see CAP_STREAK_RUNS
    demand_bad = check_lookup_demand(db)
    coverage_bad = check_coverage_stated(db)
    docs_bad = check_precomputed_docs(db)
    views_bad = check_wage_views(db)
    handread_bad = check_hand_read_figures()

    print()
    if unparseable:
        print(f"UNREADABLE as_of on {len(unparseable)}: "
              + ", ".join(f"{d} ({v!r})" for d, v in unparseable))
    if stale:
        print(f"STALE: {len(stale)} dataset(s) past their own budget")
        for dataset, age, budget, source in stale:
            print(f"  {dataset}: {age} days old, budget {budget} - source: {source}")
        # Name which half broke: our ingest stopped running (fix us), or the
        # source stopped publishing while our ingest keeps reading it (watch
        # it). `(has not RUN)` is appended above only for the first.
        failing, watching = freshness_verdict(stale)
        not_run = [d for d, *_ in failing if d.endswith("(has not RUN)")]
        silent = [d for d, *_ in failing if not d.endswith("(has not RUN)")]
        if not_run:
            print(f"\nOUR INGEST HAS STOPPED for: {', '.join(not_run)}. It has not "
                  "fetched in twice its data budget, so this is ours to fix.")
        if watching:
            names = ", ".join(d for d, *_ in watching)
            print(f"\nTHE SOURCE HAS NOT REPUBLISHED for: {names}. "
                  "Our ingest is still fetching (it has a recent run above); the "
                  "agency's own as-of stamp has not moved. Check the agency's page "
                  "before touching any code - the site is meanwhile serving the last "
                  "good numbers under their own as-of date, which is honest but "
                  "invisible. This is a WARNING, not a failure, until "
                  f"{SOURCE_PAUSED_GRACE}x the budget.")
            for d, age, budget, _src in watching:
                print(f"::warning::{d} is {age} days old against a {budget}-day "
                      "budget; the agency has not republished and our ingest is "
                      f"fine. Becomes a failure at {budget * SOURCE_PAUSED_GRACE} days.")
        if silent:
            print(f"\nTHE SOURCE HAS BEEN SILENT PAST {SOURCE_PAUSED_GRACE}x ITS BUDGET "
                  f"for: {', '.join(silent)}. Long enough that the page may have moved "
                  "or the parser may be reading a stale element: a human should look.")
        if failing:
            return 1
    # An unreadable date is a real defect too: it means DataProvenance cannot
    # compute an age either, so the page silently stops warning about that row.
    if (runs_bad or frontier_bad or yield_bad or backfill_bad or demand_bad
            or coverage_bad or gapsweep_bad or docs_bad or views_bad or handread_bad or unparseable):
        return 1
    print("All datasets within their declared freshness budgets, every ingest's "
          "most recent run finished clean, the discovery frontier is moving, the "
          "gap sweep is re-asking what the walk skipped, no backfill has "
          "stalled, every precomputed doc is present and current, and lookup "
          "demand is at its normal rate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
