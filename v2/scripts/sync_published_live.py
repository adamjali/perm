#!/usr/bin/env python3
"""Put every case DOL's published files hold into the live tables, where it can still change.

DOL's quarterly files list decided cases; the live tables (perm_case_status and
the program tables) are what the daily sweeps re-check, because a decided case
still moves (certified, then expired; denied, then appealed). A case that is in
the file but was never in a live table is shown on the site but never
re-checked. Measured Oct 3 2026: 4,383 new-form PERM cases (decided 2024 to
2026) and 65 recent wage requests.

What it does, per program:

* PERM: every published new-form number (the G- office codes) the live table
  lacks. The old A- numbers came from DOL's previous system and its live
  service does not know them (four asked, none answered, Oct 3 2026): the
  published row is their only record and their status cannot change.
* Wage requests, LCAs, H-2A/H-2B: published numbers filed inside the program's
  own re-check window (`full_window_days`). Older ones are settled, and the
  published row is the record.

Each number is confirmed with DOL before it is stored, so the row carries the
status as it is today. Storing the file's status instead would make the next
sweep "see" a change that happened months ago and write it as today's event.
No event is written here: a case found this way is an observation, not a move.

Runs after the nightly full sweep; a night with nothing to sync costs four
queries and no request.

    python3 scripts/sync_published_live.py [--dry-run] [--cap 400]
"""
from __future__ import annotations

import argparse
import datetime
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, query_rows, record_run  # noqa: E402
from lib_flag_serials import PERM_OFFICE_PREFIXES, decode_filing_date  # noqa: E402
import ingest_case_status_direct as core  # noqa: E402
import ingest_pwd_status_direct as programs  # noqa: E402

SCRIPT = "sync_published_live.py"
SYNC_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, from the published file)"
DEFAULT_CAP = 400           # requests a night; 20,000 numbers, a backlog clears in a run

# (published table, live table, prefixes, window in days or None for every number)
PUBLISHED_FOR = {"pwd": "pwd_cases", "lca": "lca_cases", "seasonal": "pwd_cases"}


def plan(have_tables: set[str]) -> list[tuple[str, str, tuple[str, ...], int | None]]:
    out = [("perm_cases", "perm_case_status", PERM_OFFICE_PREFIXES, None)]
    for name, cfg in programs.PROGRAMS.items():
        pub = PUBLISHED_FOR.get(name)
        if pub:
            out.append((pub, cfg["table"], tuple(cfg["prefixes"]), int(cfg["full_window_days"])))
    return [p for p in out if p[0] in have_tables and p[1] in have_tables]


def missing(db, published: str, live: str, prefixes: tuple[str, ...], window: int | None,
            today: datetime.date) -> list[str]:
    """Published numbers under `prefixes` that the live table lacks."""
    where = " OR ".join("(p.case_number >= ? AND p.case_number < ?)" for _ in prefixes)
    args: list = [a for p in prefixes for a in (p, p[:-1] + ".")]
    sql = (f"SELECT p.case_number FROM {published} p LEFT JOIN {live} s "
           f"ON s.case_number = p.case_number WHERE s.case_number IS NULL AND ({where})")
    if window is not None:
        sql += " AND p.received_date >= ?"
        args.append((today - datetime.timedelta(days=window)).isoformat())
    return sorted({str(r[0]) for r in query_rows(db, sql + " ORDER BY p.case_number", args)})


def insert_perm(db, hits: list[dict], now_iso: str, stamp: int) -> int:
    """New-form PERM rows, marked disclosed: they came from DOL's file."""
    added = 0
    for v in hits:
        status = (v.get("caseStatus") or "").strip()
        if not status:
            continue
        res = db.execute(
            "INSERT OR IGNORE INTO perm_case_status "
            "(case_number, filing_date, current_status, is_final, is_disclosed, employer_name, "
            " job_title, submitted_date, last_checked_at, verified, source, fetched_at) "
            "VALUES (?,?,?,?,1,?,?,?,?,1,?,?)",
            [v["caseNumber"], decode_filing_date(v["caseNumber"]), status,
             1 if status.upper() in core.FINAL_STATUSES else 0,
             v.get("employerName"), v.get("jobTitle"), v.get("submittedDate"),
             now_iso, SYNC_SOURCE, stamp])
        added += 1 if res.get("response", {}).get("result", {}).get("affected_row_count", 0) else 0
    return added


def sync(db, *, cap: int, lookup=None, dry: bool = False, today: datetime.date | None = None,
         pace: float = core.PACE_S, sleep=time.sleep) -> dict:
    lookup = lookup or core.lookup_with_retry
    today = today or datetime.date.today()
    have = {str(r[0]) for r in query_rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'", [])}
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(time.time() * 1000)
    out = {"requests": 0, "asked": 0, "stored": 0, "unanswered": 0, "by_table": {},
           "capped": False, "refused": None}
    for published, live, prefixes, window in plan(have):
        nums = missing(db, published, live, prefixes, window, today)
        got = stored = 0
        for i in range(0, len(nums), core.BATCH):
            if out["requests"] >= cap:
                out["capped"] = True
                break
            batch = nums[i:i + core.BATCH]
            out["requests"] += 1
            try:
                answer = lookup(batch)
            except RuntimeError as exc:
                out["refused"] = str(exc)
                break
            sleep(pace)
            wanted = set(batch)
            hits = [h for h in answer if h.get("caseNumber") in wanted]
            out["asked"] += len(batch)
            got += len(hits)
            out["unanswered"] += len(batch) - len({h["caseNumber"] for h in hits})
            if dry or not hits:
                continue
            if live == "perm_case_status":
                stored += insert_perm(db, hits, now_iso, stamp)
            else:
                stored += programs.insert_hits(db, hits, SYNC_SOURCE)
        out["stored"] += stored
        out["by_table"][live] = {"missing": len(nums), "confirmed": got, "stored": stored}
        if out["refused"] or out["capped"]:
            break
    return out


def note_of(r: dict) -> str:
    parts = [f"{t}: {v['missing']} missing, {v['stored']} stored" for t, v in r["by_table"].items()
             if v["missing"]]
    note = "; ".join(parts) or "nothing to sync"
    if r["unanswered"]:
        note += f"; {r['unanswered']} published numbers DOL's live service did not answer"
    if r["capped"]:
        note += f"; {core.CAP_NOTE}, the rest go tomorrow"
    if r["refused"]:
        note += f"; stopped on a DOL refusal ({r['refused']}), the rest go tomorrow"
    return note


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--cap", type=int, default=DEFAULT_CAP)
    ap.add_argument("--dry-run", action="store_true", help="ask DOL but store nothing")
    a = ap.parse_args()
    db = Turso()
    programs.ensure_schema(db)
    r = sync(db, cap=a.cap, dry=a.dry_run)
    note = note_of(r)
    core.log(f"published-to-live sync: {r['requests']} requests, {r['stored']} stored. {note}")
    if not a.dry_run:
        # A cap or a refusal is a stop the next night resumes, not a failure.
        record_run(db, SCRIPT, status="ok", rows_written=r["stored"], note=note)
    return 0


if __name__ == "__main__":
    sys.exit(main())
