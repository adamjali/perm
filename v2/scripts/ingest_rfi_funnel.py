#!/usr/bin/env python3
"""RFI outcomes and the daily decision series.

WHY THESE TWO CANNOT COME FROM OUR OWN TABLE. `perm_case_status` is a
SNAPSHOT: it says 906 cases sit at RFI ISSUED right now. It cannot say what
happened to the 3,000-odd cases that passed through an RFI and came out the
other side, because it holds one observation per case and no history. The
same is true of decisions-per-day - counting them needs cases watched over
time, not counted once.

That history is the one thing a snapshot can never be made to yield, and it
is the genuine remainder of the competitor's advantage. Mirrored here as two
small aggregate reads (two requests, not a row dump), authorised by Adam with
the reviewing attorney requesting it, with the source recorded on every row.

Our own equivalent arrives once the mirror runs on a schedule and we can diff
consecutive snapshots - at which point these become a cross-check rather than
a source. That is deliberately the same shape as the visa-bulletin backfill.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, stamp_freshness  # noqa: E402

BASE = "https://permtrack.app/api/watchlist"
SOURCE = "permtrack.app/api/watchlist (mirror; underlying: flag.dol.gov case status)"


def log(m: str) -> None:
    print(m, flush=True)


def get(path: str):
    """curl, not urllib: Cloudflare fronts this host and answers python-urllib
    with `error code: 1010`, a 403 that reads like an auth failure and is a
    browser-signature ban. Learned the same day on Resend's API."""
    out = subprocess.run(
        ["curl", "-s", "--max-time", "40", "-H", "Accept: application/json",
         "-A", "permtracker.app mirror (contact: notifications@permtracker.app)",
         f"{BASE}/{path}"], capture_output=True, timeout=60)
    if out.returncode != 0:
        return None
    try:
        return json.loads(out.stdout)
    except Exception:
        return None


def main() -> int:
    db = Turso()
    stamp = int(time.time() * 1000)

    # -- RFI funnel: one row per observation, so the series accumulates ------
    db.execute("""CREATE TABLE IF NOT EXISTS rfi_funnel (
        observed_at INTEGER PRIMARY KEY,
        total_tracked INTEGER, ever_rfi INTEGER, ever_audit INTEGER,
        ever_reconsideration INTEGER, ever_balca INTEGER,
        current_rfi INTEGER, current_audit INTEGER,
        rfi_resolved INTEGER, rfi_certified INTEGER, rfi_denied INTEGER,
        rfi_withdrawn INTEGER, median_days_to_decision INTEGER,
        source TEXT NOT NULL)""")
    f = get("rfi-funnel")
    wrote_funnel = False
    if not f or not f.get("ever_rfi"):
        log("  rfi-funnel unreadable, skipping")
    else:
        cols = ["total_tracked", "ever_rfi", "ever_audit", "ever_reconsideration",
                "ever_balca", "current_rfi", "current_audit", "rfi_resolved",
                "rfi_certified", "rfi_denied", "rfi_withdrawn",
                "median_days_to_decision"]
        db.execute("INSERT OR REPLACE INTO rfi_funnel VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   [stamp, *[int(f.get(c) or 0) for c in cols], SOURCE])
        wrote_funnel = True
        pct = round(f["rfi_certified"] / max(f["rfi_resolved"], 1) * 100)
        log(f"  rfi funnel: {f['ever_rfi']:,} ever issued, {f['rfi_resolved']:,} resolved, "
            f"{pct}% certified, {f['median_days_to_decision']}d median")

    # -- Daily decisions: DELIBERATELY NOT WRITTEN ANY MORE ------------------
    #
    # This block used to read permtrack's `daily-summary` endpoint and store
    # it in `daily_decisions` under the source name `flag-live`, which reads
    # as our own per-case scan of flag.dol.gov. It was not. Measured
    # 2026-09-03: all 14 rows carried one `fetched_at` of
    # 2026-08-27T03:25:19Z, and our first sweep of DOL did not write an event
    # until 2026-08-27T21:16Z - so every one of those days predated any
    # observation we ever made. `src/lib/turso/activity.ts` listed it in
    # FIRST_PARTY_SOURCES under the comment "Never the rival's".
    #
    # We now measure this ourselves. `ingest_case_status_direct.py` derives
    # the series from `perm_case_events` on every sweep and writes it under
    # `sweep-observed`, a name that says the dating is ours rather than DOL's.
    # Two writers with different notions of truth pointed at one table is a
    # flip-flop, not redundancy - the same reason `mirror_case_status.py` lost
    # its schedule - so this one writes nothing.
    #
    # The RFI funnel above IS still mirrored, on purpose and by Adam's call:
    # it is a FROZEN historical base that our own `perm_case_events` history
    # is blended with by count, and it is re-read by nobody on a schedule.

    # `as_of` is the observation this run just recorded, not a series it no
    # longer writes. It used to be `max(date) WHERE source='flag-live'`, which
    # against a table that no longer holds that source would have stamped the
    # literal string "None" and shown up as UNREADABLE in the health check.
    # ONLY ON A RUN THAT DID THE WORK. Stamping after a failed read keeps a
    # broken ingest reporting itself healthy forever, which is the one thing
    # lib_turso.stamp_freshness's own docstring asks callers not to do - and
    # the read above fails softly, by design, on a host fronted by Cloudflare.
    if not wrote_funnel:
        log("  not stamping freshness: nothing was written this run")
        return 0
    stamp_freshness(
        db, "rfi-funnel", as_of=time.strftime("%Y-%m-%d"),
        source=SOURCE,
        cadence="One-off historical base (not scheduled)",
        note="RFI outcomes mirrored once and frozen. Ongoing RFI history "
             "comes from our own perm_case_events; the daily decision series "
             "is written by ingest_case_status_direct.py as 'sweep-observed'.",
        max_age_days=3650)
    return 0


if __name__ == "__main__":
    sys.exit(main())
