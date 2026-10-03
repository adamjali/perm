"""Nightly retention for the tables that would otherwise grow without end.

Measured Sep 29 2026 on the server's database, one month after the move:

    perm_serial_misses   78,645 rows in 16 days (~5,000 a day)
    perm_docs            one row per day per counter (discovery_budget_<date>
                         and its PWD, LCA, embed and USCIS siblings)
    ingest_runs          493 rows in a month
    sweep_runs           114 rows in a month

None of it is read past a known horizon, so each keeps a margin past what its
readers use and the rest goes:

    daily counters  check_lookup_demand reads 30 days of discovery_budget.
    run logs        every scheduled job runs at least yearly (the visa limits
                    sheet is the slowest), and the health check reads each
                    job's newest row, so 400 days always keeps one per job.
    API call counts the API reads this month's and today's (src/lib/api/
                    usage.ts); 400 days keeps a year for the admin's view.

What is NOT pruned, on purpose: `perm_case_events` and `estimate_predictions`
ARE the record (the status history and the scorecard); `pwd_`/`lca_case_events`
the same. They grow with DOL's own activity, which is the product.

`perm_serial_misses` is not pruned either, since Oct 3 2026. It was cut at 180
days while only the trailing 90 were ever swept; the full-history backfill
(backfill_serial_gaps.py) made it the record that every number on DOL's
counter is accounted for (held, published, or answered "no case" under every
prefix). Pruning it would undo that and have the backfill ask the old years
again. It holds one row per number DOL never confirmed: at most a few
thousand a day, tens of megabytes a year.

Called from the nightly full sweep as one of its independent tail steps, so a
failure here is logged and never costs the sweep.
"""
from __future__ import annotations

import datetime

DAILY_COUNTER_PREFIXES = (
    "discovery_budget_",
    "pwd_discovery_budget_",
    "lca_discovery_budget_",
    "embed_live_",
    "uscis_budget_",
)
COUNTER_KEEP_DAYS = 90
RUN_LOG_KEEP_DAYS = 400
API_USAGE_KEEP_DAYS = 400

_DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]"


def day_code(d: datetime.date) -> int:
    """DOL's YYDDD day code for a date (2026-09-29 -> 26272)."""
    return int(f"{d:%y}{d.timetuple().tm_yday:03d}")


def _affected(res) -> int:
    return int(res["response"]["result"].get("affected_row_count") or 0)


def prune(db, today: datetime.date) -> dict[str, int]:
    """Delete what is past its horizon. Returns rows deleted per kind."""
    out: dict[str, int] = {}

    counter_cut = (today - datetime.timedelta(days=COUNTER_KEEP_DAYS)).isoformat()
    n = 0
    for prefix in DAILY_COUNTER_PREFIXES:
        # A prefix match by substr, not LIKE: `_` is a LIKE wildcard, and
        # "discovery_budget_" must never match "pwd_discovery_budget_".
        n += _affected(db.execute(
            "DELETE FROM perm_docs WHERE substr(key, 1, ?) = ? "
            "AND substr(key, ? + 1) GLOB ? AND substr(key, ? + 1) < ?",
            [len(prefix), prefix, len(prefix), _DATE_GLOB, len(prefix), counter_cut]))
    out["daily_counters"] = n

    run_cut = int(datetime.datetime.combine(
        today - datetime.timedelta(days=RUN_LOG_KEEP_DAYS), datetime.time(),
        tzinfo=datetime.timezone.utc).timestamp() * 1000)
    for table in ("ingest_runs", "sweep_runs"):
        out[table] = _affected(db.execute(
            f"DELETE FROM {table} WHERE started_at < ?", [run_cut]))
    usage_cut = (today - datetime.timedelta(days=API_USAGE_KEEP_DAYS)).isoformat()
    try:
        out["api_usage"] = _affected(db.execute("DELETE FROM api_usage WHERE day < ?", [usage_cut]))
    except Exception as err:  # noqa: BLE001
        # The site makes the table on its first API call; until then there is
        # nothing to prune.
        if "no such table" not in str(err).lower():
            raise
        out["api_usage"] = 0
    return out
