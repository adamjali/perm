#!/usr/bin/env python3
"""Per-case PERM status, straight from DOL instead of a competitor's mirror.

WHAT THIS REPLACES. `mirror_case_status.py` reads permtrack.app's watchlist
API - their copy of data they scanned out of flag.dol.gov. It works, and it
made us dependent on a competitor continuing to serve us, at whatever
freshness they choose.

DOL serves the same lookup directly:

    POST https://flag.dol.gov/recaptcha/caseStatus
    ["G-100-24339-516453", ...]        <- a JSON array; it BATCHES

    {"value":[{"caseNumber":"...","caseStatus":"CERTIFIED","visaType":"PERM",
               "employerName":"...","jobTitle":"...","submittedDate":"..."}]}

THE PATH IS NAMED `recaptcha` AND NOTHING IN THE FLOW IS A CAPTCHA. Measured
2026-08-27 in a real browser: `grecaptcha` undefined, no captcha scripts, no
[data-sitekey], no challenge iframes, no hidden token. A bare curl with no
cookie and no session gets a 200 in 0.29 s. An earlier note in this project
concluded the opposite FROM THE PATH NAME ALONE, which is not evidence.
`robots.txt` does not disallow it (stock Drupal; blocks /core/, /profiles/,
/README.txt only).

WHAT WE LOSE, AND WHY IT IS NOTHING. permtrack returns four fields DOL does
not, and three of them are derived rather than sourced:
  filing_date     - decodes from the case number's YYDDD segment (94.6% exact,
                    the rest off by one day) and equals submitted_date for
                    409,127 of 414,050 rows.
  is_final        - a function of the status string. We already own that logic.
  is_disclosed    - whether the case appears in the disclosure files, which we
                    hold ourselves in `perm_cases`. We can compute it better.
  last_checked_at - THEIR bookkeeping about when THEY looked. Meaningless once
    /verified       we do the looking.
And DOL returns `visaType`, which permtrack does not.

BATCH CEILING IS 50, MEASURED, AND IT FAILS QUIETLY. Asking for 100 or 200
returns 200 OK with exactly 50 records - no error, no warning. Only 400 is
rejected outright (HTTP 400). A loop that asked for 200 would silently drop
three quarters of every batch and report success, so the batch size is
asserted against the request, not trusted.

Politeness: this is a government system with published maintenance windows.
It is paced, it checkpoints, and it stops rather than hammering when the
far end starts failing.

    python3 scripts/ingest_case_status_direct.py --limit 500     # a taste
    python3 scripts/ingest_case_status_direct.py --pending       # the sweep
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

URL = "https://flag.dol.gov/recaptcha/caseStatus"
BATCH = 50                      # measured ceiling; larger is silently truncated
PACE_S = 0.35                   # ~3 req/s against a .gov
SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

FINAL_STATUSES = {
    "CERTIFIED", "CERTIFIED - EXPIRED", "DENIED", "WITHDRAWN",
    "CERTIFIED-EXPIRED",
}


def log(m: str) -> None:
    print(m, flush=True)


def lookup_with_retry(nums: list[str], attempts: int = 4) -> list[dict]:
    """One batch, with backoff.

    A single transient failure silently skips FIFTY cases, and the caller only
    counts consecutive failures, so one blip in the middle of a sweep would
    leave a 50-case hole that nothing reports. Retry the batch before giving
    up on it.

    The backoff is generous on purpose: the failure this most often sees is
    DOL's published maintenance window, and hammering through one is both
    rude and useless.
    """
    delay = 4
    for attempt in range(1, attempts + 1):
        try:
            return lookup(nums)
        except Exception:  # noqa: BLE001
            if attempt == attempts:
                raise
            time.sleep(delay)
            delay *= 3
    raise SystemExit("unreachable")


def lookup(nums: list[str]) -> list[dict]:
    """One batch. curl, not urllib: this host answers python-urllib with 1010."""
    p = pathlib.Path("/tmp/_csd_batch.json")
    p.write_text(json.dumps(nums))
    r = subprocess.run(
        ["/usr/bin/curl", "-s", "-X", "POST", URL,
         "-H", "Content-Type: application/json",
         "-H", "Origin: https://flag.dol.gov",
         "-H", "Referer: https://flag.dol.gov/case-status-search",
         "-A", UA, "--data", f"@{p}", "--max-time", "60", "-w", "\n%{http_code}"],
        capture_output=True, text=True,
    )
    body, _, code = r.stdout.rpartition("\n")
    if code.strip() != "200":
        raise RuntimeError(f"HTTP {code.strip()}")
    return json.loads(body).get("value", [])


written = {"u": 0, "e": 0}


def flush(db, updates: list, events: list) -> None:
    """Write what we have, then clear it.

    CALLED MID-RUN, NOT ONLY AT THE END. The sweep is ~2,000 requests over a
    quarter of an hour, and DOL publishes maintenance windows it goes down
    for. Holding every result until the last batch means a shutdown at minute
    fourteen throws away fourteen minutes of work, leaves the table exactly as
    it was, and costs the far end 1,900 requests for nothing.
    """
    for i in range(0, len(updates), 200):
        db.pipeline([{"type": "execute", "stmt": {
            "sql": "UPDATE perm_case_status SET current_status=?, is_final=?, "
                   "employer_name=?, job_title=?, source=?, fetched_at=? "
                   "WHERE case_number=?",
            "args": [{"type": "integer", "value": str(a)} if isinstance(a, int)
                     else {"type": "text", "value": str(a)} for a in u]}}
            for u in updates[i:i + 200]] + [{"type": "close"}])
    for i in range(0, len(events), 200):
        db.pipeline([{"type": "execute", "stmt": {
            "sql": "INSERT OR IGNORE INTO perm_case_events (case_number, changed_at, "
                   "from_status, to_status, to_final, source) VALUES (?,?,?,?,?,?)",
            "args": [{"type": "integer", "value": str(a)} if isinstance(a, int)
                     else {"type": "text", "value": str(a)} for a in e]}}
            for e in events[i:i + 200]] + [{"type": "close"}])
    written["u"] += len(updates)
    written["e"] += len(events)
    updates.clear()
    events.clear()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pending", action="store_true",
                    help="Every non-final case (the 12-hourly sweep).")
    ap.add_argument(
        "--full", action="store_true",
        help="EVERY case, decided ones included. A 'final' status is not "
             "actually final: a CERTIFIED case becomes CERTIFIED - EXPIRED "
             "when the 180-day I-140 window lapses, and nothing tells us "
             "except looking. Weekly.",
    )
    ap.add_argument("--limit", type=int, help="Stop after this many cases.")
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument(
        "--reconcile", action="store_true",
        help="Correct statuses but write NO events. Use this for the first "
             "pass against a stale mirror.",
    )
    args = ap.parse_args()

    db = Turso()
    if args.full:
        where = ""
    elif args.pending or not args.limit:
        where = "WHERE is_final=0 OR is_final='0'"
    else:
        where = ""
    sql = (f"SELECT case_number, current_status, employer_name, job_title "
           f"FROM perm_case_status {where} ORDER BY case_number "
           f"LIMIT {args.limit or 10**9} OFFSET {args.offset}")
    res = db.execute(sql)["response"]["result"]
    rows = {x[0]["value"]: [None if c["type"] == "null" else c["value"] for c in x[1:]]
            for x in res["rows"]}
    todo = sorted(rows)
    log(f"{len(todo):,} cases to check, {BATCH} per request "
        f"= {(len(todo)+BATCH-1)//BATCH:,} requests\n")

    checked = moved = missing = 0
    fails = 0
    stamp = int(time.time() * 1000)
    events: list[list] = []
    updates: list[list] = []

    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        try:
            got = lookup_with_retry(chunk)
            fails = 0
        except Exception as exc:  # noqa: BLE001
            fails += 1
            log(f"  batch {i//BATCH+1}: {exc}")
            # DOL publishes maintenance windows. Three failures in a row is the
            # far end being down, and continuing is just noise in their logs.
            if fails >= 3:
                flush(db, updates, events)
                log("  three consecutive failures; stopping cleanly. Re-run to resume.")
                break
            time.sleep(5)
            continue

        # A silently truncated batch would look exactly like "those cases do
        # not exist". Assert the shape rather than trusting it.
        if len(got) > len(chunk):
            raise SystemExit(f"FATAL: asked {len(chunk)}, got {len(got)}")
        seen = set()
        for v in got:
            cn = v.get("caseNumber")
            seen.add(cn)
            old = rows.get(cn)
            if not old:
                continue
            checked += 1
            new_status = (v.get("caseStatus") or "").strip()
            old_status = (old[0] or "").strip()
            if new_status and new_status != old_status:
                moved += 1
                is_final = 1 if new_status.upper() in FINAL_STATUSES else 0
                updates.append([new_status, is_final, v.get("employerName") or old[1],
                                v.get("jobTitle") or old[2], SOURCE, stamp, cn])
                # A RECONCILIATION IS NOT A TRANSITION, AND STAMPING IT AS ONE
                # INVENTS HISTORY. The first direct pass compares DOL against a
                # mirror that was last scanned months ago, so most differences
                # are corrections of stale data, not things that moved today.
                # Writing 98,586 of those into perm_case_events with today's
                # timestamp would fabricate a one-day surge - and that table
                # feeds both the alert sweep and the RFI funnel history.
                #
                # Once our own data IS current, a difference really does mean
                # the case moved since we last looked, and the events are real.
                if not args.reconcile:
                    events.append([cn, stamp, old_status, new_status, is_final, SOURCE])
        missing += len(chunk) - len(seen)

        if (i // BATCH) % 40 == 0 and i:
            flush(db, updates, events)
            log(f"  {i:,}/{len(todo):,}  moved={moved:,}  missing={missing:,}  "
                f"written={written['u']:,}")
        time.sleep(PACE_S)

    flush(db, updates, events)
    log("")
    log(f"checked   {checked:,}")
    log(f"moved     {moved:,}")
    log(f"not found {missing:,}")
    if args.reconcile:
        log("reconcile mode: statuses corrected, NO events written")

    log(f"wrote     {written['u']:,} status changes, {written['e']:,} events")

    # Stamp freshness so `check_ingest_health.py` can see this ingest stop.
    # An ingest that fails silently is worse than one that fails loudly, and
    # this one runs unattended against a host with maintenance windows.
    #
    # Only stamp on a run that actually got somewhere: a run that died on its
    # first batch must NOT refresh the clock, or a permanently broken ingest
    # keeps reporting itself healthy forever.
    if checked:
        n = int(db.scalar("SELECT count(*) FROM perm_case_status") or 0)
        db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
            dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
            source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
        db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
                   ["perm-case-status", time.strftime("%Y-%m-%d"),
                    int(time.time() * 1000), SOURCE, "Every 12 hours",
                    f"{n:,} cases", 3])
        log("stamped   data_freshness")
    else:
        log("NOT stamping freshness: this run checked nothing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
