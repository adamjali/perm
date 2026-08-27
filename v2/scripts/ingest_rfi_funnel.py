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
from lib_turso import Turso  # noqa: E402

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
    if not f or not f.get("ever_rfi"):
        log("  rfi-funnel unreadable, skipping")
    else:
        cols = ["total_tracked", "ever_rfi", "ever_audit", "ever_reconsideration",
                "ever_balca", "current_rfi", "current_audit", "rfi_resolved",
                "rfi_certified", "rfi_denied", "rfi_withdrawn",
                "median_days_to_decision"]
        db.execute("INSERT OR REPLACE INTO rfi_funnel VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   [stamp, *[int(f.get(c) or 0) for c in cols], SOURCE])
        pct = round(f["rfi_certified"] / max(f["rfi_resolved"], 1) * 100)
        log(f"  rfi funnel: {f['ever_rfi']:,} ever issued, {f['rfi_resolved']:,} resolved, "
            f"{pct}% certified, {f['median_days_to_decision']}d median")

    # -- Daily decisions -----------------------------------------------------
    db.execute("""CREATE TABLE IF NOT EXISTS daily_decisions (
        date TEXT NOT NULL, source TEXT NOT NULL,
        total INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
        fetched_at INTEGER NOT NULL, PRIMARY KEY (date, source))""")
    d = get("daily-summary")
    days = (d or {}).get("days") or []
    kept = 0
    for row in days:
        # has_data false is "we did not observe that day", not "zero decisions
        # happened". Storing it as zero would draw a real trough.
        if not row.get("has_data"):
            continue
        db.execute("INSERT OR REPLACE INTO daily_decisions VALUES (?,?,?,?,?,?,?)",
                   [row["date"], "flag-live", int(row.get("total") or 0),
                    int(row.get("certified") or 0), int(row.get("denied") or 0),
                    int(row.get("withdrawn") or 0), stamp])
        kept += 1
    log(f"  daily decisions: {kept} observed days stored "
        f"({len(days) - kept} skipped as unobserved)")

    total_days = int(db.scalar(
        "SELECT count(DISTINCT date) FROM daily_decisions") or 0)
    log(f"  VERIFY daily_decisions spans {total_days} distinct days across all sources")

    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    newest = db.scalar("SELECT max(date) FROM daily_decisions WHERE source='flag-live'")
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               ["rfi-funnel", str(newest), stamp, SOURCE, "Daily",
                "RFI outcomes and observed daily decisions. Needs cases watched "
                "over time, which a single snapshot cannot yield.", 7])
    return 0


if __name__ == "__main__":
    sys.exit(main())
