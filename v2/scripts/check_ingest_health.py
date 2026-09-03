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
import time
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
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

    KEYED ON THE SCRIPT FILENAME, not the full argv. `record_run` writes
    "ingest_pwd_status_direct.py --pending --program all" on one pass and
    "... --backfill" on another, and the workflow's failure hook cannot know
    which mode was running when the runner was killed. Normalising on the
    filename means any later successful run of that script clears the flag,
    which is the question worth answering: has this ingest recovered?

    The per-pass distinction is not lost, it is just the OTHER check's job -
    `data_freshness` carries `perm-case-status-full` and `perm-case-status`
    separately, so a full pass that fails every night while the pending pass
    succeeds still trips the budget above.
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
        key = str(script).split()[0] if script else "?"
        if key not in newest:                       # rows arrive newest first
            newest[key] = (str(status), str(note or ""), int(finished))

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
    if runs_bad:
        return 1
    # An unreadable date is a real defect too: it means DataProvenance cannot
    # compute an age either, so the page silently stops warning about that row.
    if unparseable:
        return 1
    if runs_bad:
        return 1
    print("All datasets within their declared freshness budgets, and every "
          "ingest's most recent run finished clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
