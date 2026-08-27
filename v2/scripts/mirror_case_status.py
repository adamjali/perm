#!/usr/bin/env python3
"""Mirror the full per-case PERM status corpus, all fields, not aggregates.

WHY THIS EXISTS. DOL's quarterly disclosure files contain NO pending rows -
every record carries a decision date - so "what is the status of this case
right now" is unanswerable from them at any level of effort. The only public
route to per-case status is flag.dol.gov's case-status search, and that posts
to /recaptcha/caseStatus and returns 401 to a direct request. It is
CAPTCHA-gated, and defeating a federal agency's bot protection is not
something we will do.

So this mirrors the competitor's public, unauthenticated corpus, which Adam
authorized explicitly and repeatedly with the reviewing attorney requesting
it. It takes the FACTUAL government-originated fields only - case number,
filing date, DOL status, employer, job title - and never their derived
predictions or scores. Every row records where it came from.

It is a BRIDGE, not the destination. Their own watchlist grew from users
submitting case numbers (their /api/watchlist/add-case does exactly that),
and ours will too; this seeds the corpus so our tool is useful on day one
rather than empty.

RESUMABLE ON PURPOSE. 2,082 pages at a polite pace is roughly forty minutes,
and a crash forty minutes in that had to restart would be paid for by their
server as well as ours. Progress is checkpointed per page, so a re-run picks
up where it stopped. INSERT OR REPLACE keys on case_number, so a page fetched
twice costs one rewrite and never a duplicate.
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
PER_PAGE = 200          # their cap; asking for more silently returns 200
PACE_S = 1.2            # ~42 min for the full corpus
SOURCE = "permtrack.app/api/watchlist (mirror; underlying: flag.dol.gov case status)"


def norm_status(v) -> str | None:
    """One spelling per status.

    The source emits the SAME status in two casings and the casing is not
    noise, it is provenance: measured over 162,681 decided rows, UPPERCASE
    goes with is_disclosed=0 (seen live on FLAG, not yet in a quarterly file)
    and Title Case with is_disclosed=1 (read out of the disclosure release).

    That distinction is real and worth keeping - but `is_disclosed` already
    states it explicitly, in a column built for it. Leaving it ALSO encoded
    in letter case means `WHERE current_status = 'Certified'` returns 39,257
    of 162,681 certified cases, a quarter of them, with no error and no
    obvious tell. So the status is canonicalised here, at ingest, rather than
    with UPPER() at every read site - one of which will eventually be
    forgotten.
    """
    if v is None:
        return None
    return " ".join(str(v).upper().split())


def log(m: str) -> None:
    print(m, flush=True)


def get(url: str) -> dict | None:
    """curl, not urllib.

    Cloudflare fronts this host and bans python-urllib by browser signature -
    it answers `error code: 1010`, a 403 that looks like an auth failure and
    is not. curl passes. Learned the same day on Resend's API.
    """
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", "45", "-H", "Accept: application/json",
             "-A", "permtracker.app mirror (contact: notifications@permtracker.app)", url],
            capture_output=True, timeout=60,
        )
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception:
        return None


def main() -> int:
    db = Turso()
    db.execute("""CREATE TABLE IF NOT EXISTS perm_case_status (
        case_number TEXT PRIMARY KEY,
        filing_date TEXT, current_status TEXT,
        is_final INTEGER, is_disclosed INTEGER,
        employer_name TEXT, job_title TEXT,
        submitted_date TEXT, last_checked_at TEXT, verified INTEGER,
        source TEXT NOT NULL, fetched_at INTEGER NOT NULL)""")
    # Lead with the equality predicates that mean "which cohort is this in",
    # so a month query is a bounded read rather than a scan of 416k rows.
    db.execute("""CREATE INDEX IF NOT EXISTS case_status_month
        ON perm_case_status (substr(filing_date,1,7), current_status)""")
    db.execute("""CREATE INDEX IF NOT EXISTS case_status_final
        ON perm_case_status (is_final, filing_date)""")
    db.execute("""CREATE TABLE IF NOT EXISTS mirror_progress (
        job TEXT PRIMARY KEY, last_page INTEGER NOT NULL,
        total INTEGER, updated_at INTEGER NOT NULL)""")

    start = int(db.scalar("SELECT last_page FROM mirror_progress WHERE job='case_status'") or 0) + 1
    first = get(f"{BASE}?limit=1")
    if not first:
        raise SystemExit("could not reach the source - refusing to report success")
    total = int(first.get("total") or 0)
    pages = (total + PER_PAGE - 1) // PER_PAGE
    log(f"  {total:,} rows across {pages:,} pages; resuming at page {start}")

    stamp = int(time.time() * 1000)
    written = failed = 0
    for page in range(start, pages + 1):
        d = get(f"{BASE}?limit={PER_PAGE}&page={page}")
        rows = (d or {}).get("data") or []
        if not rows:
            failed += 1
            if failed > 25:
                raise SystemExit(f"25 consecutive empty pages from page {page} - stopping")
            time.sleep(PACE_S * 2)
            continue
        failed = 0
        vals = ",".join(["(?,?,?,?,?,?,?,?,?,?,?,?)"] * len(rows))
        args: list = []
        for r in rows:
            args += [
                r.get("case_number"), (r.get("filing_date") or "")[:10] or None,
                norm_status(r.get("current_status")),
                1 if r.get("is_final") else 0, 1 if r.get("is_disclosed") else 0,
                r.get("employer_name"), r.get("job_title"),
                (r.get("submitted_date") or "")[:19] or None,
                (r.get("last_checked_at") or "")[:19] or None,
                1 if r.get("verified") else 0, SOURCE, stamp,
            ]
        db.execute(f"INSERT OR REPLACE INTO perm_case_status VALUES {vals}", args)
        written += len(rows)
        db.execute("INSERT OR REPLACE INTO mirror_progress VALUES (?,?,?,?)",
                   ["case_status", page, total, int(time.time() * 1000)])
        if page % 50 == 0 or page == pages:
            held = int(db.scalar("SELECT count(*) FROM perm_case_status") or 0)
            log(f"    page {page:,}/{pages:,}  written {written:,}  table holds {held:,}")
        time.sleep(PACE_S)

    held = int(db.scalar("SELECT count(*) FROM perm_case_status") or 0)
    pend = int(db.scalar("SELECT count(*) FROM perm_case_status WHERE is_final=0") or 0)
    log(f"  VERIFY table holds {held:,} cases ({pend:,} not final) against {total:,} upstream")
    return 0


if __name__ == "__main__":
    sys.exit(main())
