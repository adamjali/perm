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

TWO MODES, AND THE SECOND ONE IS WHY ALERTS CAN HAVE A LATENCY YOU CAN NAME.

`--pending` pages `is_final=false`, which is 98,584 rows against 416,858, so
the cycle is 493 pages and about ten minutes rather than 2,082 and forty.
That matters far beyond the runtime: this is a SEQUENTIAL page-through, so a
case is re-checked only when the scan reaches its page, and a full-corpus
cycle therefore gives a case a re-check latency set by its POSITION in the
table rather than by anything about the case. Measured before this existed,
77,968 of 97,657 pending cases (79.8%) had not been re-verified since
2026-08-01, while the April-to-June rows were all final and were being
re-scanned anyway for no reason: a final case cannot change again.

A pending-only pass covers every case that can still move, so run it often
and run the full pass rarely. A status-change alert is only as timely as its
case's own re-scan, and silence that a subscriber reads as "nothing happened"
is worse than no product at all.

THE FILTER VALUE IS LOAD-BEARING AND THE WRONG ONE FAILS SILENTLY. Measured:
`is_final=false` returns 98,584 and `is_final=0` returns the full 416,858,
ignored without an error. So a typo does not break the pending pass, it turns
it back into a full pass that reports success. `assert_filter_applied` is what
makes that loud, and it is not optional.
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
# `false`, not `0`. See the module docstring: `0` is ignored and silently
# returns the whole corpus.
PENDING_FILTER = "is_final=false"
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


def assert_filter_applied(pending: bool, total: int, full_total: int) -> None:
    """A pending pass that quietly became a full pass must fail, not succeed.

    Measured: `is_final=false` returns 98,584 rows and `is_final=0` returns all
    416,858, ignored with no error and a 200. So the failure mode of a typo in
    the filter is not a crash, it is a forty-minute full scan wearing a
    ten-minute pass's name and reporting success.

    The threshold is deliberately loose. The pending share is about 24% today
    and will drift as DOL decides cases; anything at or above half the corpus
    means the filter did not apply, and no plausible pending share reaches
    that.
    """
    if not pending:
        return
    if full_total <= 0:
        raise SystemExit("could not read the unfiltered total - refusing to guess")
    share = total / full_total
    if share >= 0.5:
        raise SystemExit(
            f"pending filter did not apply: {total:,} of {full_total:,} rows "
            f"({share:.0%}). Check PENDING_FILTER; `is_final=0` is ignored."
        )
    log(f"  pending filter applied: {total:,} of {full_total:,} ({share:.0%})")


def diff_page(db: Turso, incoming: list[tuple[str, str | None, int]],
              stamp: int) -> list:
    """Event rows for the cases in this page whose status actually moved.

    WHY THIS EXISTS. `INSERT OR REPLACE` keys on case_number, so every refresh
    DESTROYS the status it is overwriting. That made "did this case change?"
    unanswerable from our own data at any level of effort, which is the same
    hole the disclosure files have and the reason `rfi_funnel` has to be
    mirrored from a third party rather than measured here. One SELECT per page,
    before the write, closes it permanently.

    THREE THINGS THIS IS CAREFUL ABOUT, each of which would produce a table of
    fictional transitions:

    1. **Both sides go through `norm_status` first.** The source emits the same
       status in two casings (see that function), and the stored side is
       already canonical. Comparing raw incoming against canonical stored would
       mark every Title Case row as a transition, so the very first run would
       have invented ~150,000 events.
    2. **A case we have never seen is an ARRIVAL, not a change.** No previous
       status exists to move from, so it gets no row.
    3. **The comparison is explicit inequality between two known values**, not a
       truthiness check. `if old != new` with `old` absent is true for every new
       case; this codebase has already shipped that bug once elsewhere.

    `changed_at` is when WE OBSERVED the move, not when DOL made it. Those are
    different facts and only one of them is ours to state.
    """
    if not incoming:
        return []
    nums = [c for c, _, _ in incoming]
    res = db.execute(
        "SELECT case_number, current_status FROM perm_case_status "
        f"WHERE case_number IN ({','.join('?' * len(nums))})", nums)
    held = {
        r[0]["value"]: (None if r[1]["type"] == "null" else r[1]["value"])
        for r in res["response"]["result"]["rows"]
    }

    out: list = []
    for case_number, raw_status, new_final in incoming:
        # Rule 1, enforced HERE rather than trusted from the caller. The caller
        # does normalise, and a future one might not; the cost of the check is
        # one idempotent upper() per row and the cost of skipping it is a table
        # of fictional transitions that looks exactly like a real one.
        new_status = norm_status(raw_status)
        old_status = norm_status(held.get(case_number))
        # Rule 2: absent from `held` means we have never held this case.
        # Rule 3: and a NULL status on either side is not a transition either,
        # because "we do not know" is not a state a case moved out of.
        if old_status is None or new_status is None:
            continue
        if old_status == new_status:
            continue
        out += [case_number, stamp, old_status, new_status, new_final, SOURCE]
    return out


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
    # Append-only. A column on perm_case_status would hold exactly ONE step of
    # history and lose it on the next refresh, so two moves between two reads
    # would show as one. It is also the only table from which "what does this
    # status resolve to" can ever be measured with our own data instead of a
    # third party's aggregate.
    #
    # The PK is (case_number, changed_at) so a page fetched twice in one run
    # writes one row rather than two, matching the upsert's own idempotence.
    #
    # TYPE NOTE, DELIBERATE AND NOT MATCHING ITS NEIGHBOUR. `changed_at` is an
    # INTEGER of epoch milliseconds, while `perm_case_status.last_checked_at`
    # next to it is an ISO-8601 TEXT string. They are not the same kind of fact
    # and unifying the type would invite treating them as one:
    #
    #   `changed_at`      is OURS. The moment WE observed a transition, from a
    #                     clock we control, so arithmetic on it is meaningful.
    #   `last_checked_at` is THEIRS. Written straight from the upstream's own
    #                     field, so it is the moment the UPSTREAM checked, and
    #                     it is an opaque string we should compare as a string.
    #
    # SQLite sorts any string above any number, so a numeric comparison against
    # `last_checked_at` (`>= 1787000000`) is TRUE for every non-null row and
    # returns a clean-looking result that is entirely artefact. Compare it as
    # text or not at all.
    db.execute("""CREATE TABLE IF NOT EXISTS perm_case_events (
        case_number TEXT NOT NULL,
        changed_at INTEGER NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        to_final INTEGER NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY (case_number, changed_at))""")
    # The email sweep asks "what moved since I last looked", so time leads.
    db.execute("""CREATE INDEX IF NOT EXISTS case_events_recent
        ON perm_case_events (changed_at)""")

    # Two jobs with two checkpoints. Sharing one row would make each pass
    # resume from the other's page number, which is a different slice of a
    # differently-sized result set: the pending pass would skip most of its
    # rows and report success.
    pending = "--pending" in sys.argv
    job = "case_status_pending" if pending else "case_status"
    query = f"&{PENDING_FILTER}" if pending else ""
    log(f"  mode: {'PENDING ONLY' if pending else 'FULL CORPUS'} (job={job})")

    start = int(db.scalar(
        "SELECT last_page FROM mirror_progress WHERE job=?", [job]) or 0) + 1

    # The unfiltered total is read on every run, pending or not, because the
    # guard needs a denominator it did not compute from the same filtered call.
    full = get(f"{BASE}?limit=1")
    if not full:
        raise SystemExit("could not reach the source - refusing to report success")
    full_total = int(full.get("total") or 0)

    if pending:
        first = get(f"{BASE}?limit=1{query}")
        if not first:
            raise SystemExit("could not reach the source - refusing to report success")
        total = int(first.get("total") or 0)
    else:
        total = full_total

    assert_filter_applied(pending, total, full_total)

    pages = (total + PER_PAGE - 1) // PER_PAGE
    log(f"  {total:,} rows across {pages:,} pages; resuming at page {start}")

    # A finished cycle restarts rather than sitting at the end forever. Without
    # this the pending pass runs once and every later run is a no-op that looks
    # like a clean run.
    if start > pages:
        log(f"  previous cycle complete ({pages:,} pages); restarting from page 1")
        start = 1

    stamp = int(time.time() * 1000)
    written = failed = moved = 0
    for page in range(start, pages + 1):
        d = get(f"{BASE}?limit={PER_PAGE}&page={page}{query}")
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
        incoming: list[tuple[str, str | None, int]] = []
        for r in rows:
            case_number = r.get("case_number")
            status = norm_status(r.get("current_status"))
            is_final = 1 if r.get("is_final") else 0
            if case_number:
                incoming.append((str(case_number), status, is_final))
            args += [
                case_number, (r.get("filing_date") or "")[:10] or None,
                status,
                is_final, 1 if r.get("is_disclosed") else 0,
                r.get("employer_name"), r.get("job_title"),
                (r.get("submitted_date") or "")[:19] or None,
                (r.get("last_checked_at") or "")[:19] or None,
                1 if r.get("verified") else 0, SOURCE, stamp,
            ]
        # BEFORE the upsert, which is the only moment the old status still
        # exists. After it, the previous value is gone from every table.
        events = diff_page(db, incoming, stamp)
        if events:
            ev = ",".join(["(?,?,?,?,?,?)"] * (len(events) // 6))
            db.execute(f"INSERT OR REPLACE INTO perm_case_events VALUES {ev}", events)
            moved += len(events) // 6
        db.execute(f"INSERT OR REPLACE INTO perm_case_status VALUES {vals}", args)
        written += len(rows)
        db.execute("INSERT OR REPLACE INTO mirror_progress VALUES (?,?,?,?)",
                   [job, page, total, int(time.time() * 1000)])
        if page % 50 == 0 or page == pages:
            held = int(db.scalar("SELECT count(*) FROM perm_case_status") or 0)
            log(f"    page {page:,}/{pages:,}  written {written:,}  "
                f"moved {moved:,}  table holds {held:,}")
        time.sleep(PACE_S)

    # A FINAL sweep, not just canonical writes.
    #
    # norm_status() fixes every row this process writes, and that is not
    # enough on its own: this script was edited while an earlier run was in
    # flight, and Python had already loaded the old module, so 240 rows
    # landed mixed-case behind a fix that was correct in the file. A
    # write-time guarantee is only a guarantee for writes that happen after
    # it exists. Ending every run by canonicalising the whole table closes
    # that gap permanently and is idempotent - it touches nothing when there
    # is nothing to touch.
    spellings = int(db.scalar("SELECT count(DISTINCT current_status) FROM perm_case_status") or 0)
    if pending:
        # Skipped on the pending pass on purpose. It is a corpus-wide UPDATE and
        # this pass touched a quarter of the corpus; running it here would make
        # a ten-minute job carry a whole-table write for rows it never read.
        # The full pass still closes the gap.
        log(f"  skipping the corpus-wide canonicalisation on a pending pass; "
            f"{spellings} distinct statuses held")
    else:
        db.execute(
            "UPDATE perm_case_status SET current_status = upper(current_status) "
            "WHERE current_status <> upper(current_status)")
        spellings = int(db.scalar(
            "SELECT count(DISTINCT current_status) FROM perm_case_status") or 0)
        log(f"  normalised trailing rows; {spellings} distinct statuses remain")

    held = int(db.scalar("SELECT count(*) FROM perm_case_status") or 0)
    pend = int(db.scalar("SELECT count(*) FROM perm_case_status WHERE is_final=0") or 0)
    log(f"  VERIFY table holds {held:,} cases ({pend:,} not final) against {total:,} upstream")

    # Print the counts BEFORE any verdict, and say plainly when a run observed
    # nothing. A first run legitimately produces zero events (nothing was held
    # to compare against) and so does a broken diff; the two must not read the
    # same. `evs` is the lifetime total, `moved` is this run's.
    evs = int(db.scalar("SELECT count(*) FROM perm_case_events") or 0)
    log(f"  VERIFY {moved:,} transitions observed this run; {evs:,} held in total"
        + ("  (none this run: either nothing moved upstream, or this was a"
           " first pass with nothing to compare against)" if moved == 0 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
