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

AND THE SITE WAS QUOTING `last_checked_at` BACK AS IF IT WERE OURS. This
script has never written that column, so it still holds the mirror seed:
measured 2026-09-03, 66,771 pending cases carried a 2026-07 date and 12,187
carried none, while the sweep had asked DOL about every one of them that
morning. `/perm-rfi-audit` turned MIN/MAX of it into a sentence about when
the review stages "were read". A sweep asks about a POPULATION, so the honest
record is one row per RUN, not a stamp on 414,358 rows (which would be ~12.4M
writes/month against a 10M plan to say something worse). That record is
`sweep_runs`, written at the end of main() by `record_sweep`, read back by
`write_review_stages` and projected into perm_docs['sweep_coverage'].

STILL OPEN, in src/ and therefore not fixed here: `/perm-case-status` prints
"checked N days ago" per case from the same column (src/lib/casePosition.ts,
`statusCheckAge`). For a PENDING case the truthful answer is the sweep's
finish date, which perm_docs['sweep_coverage'] now supplies.

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
import datetime
import json
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import (  # noqa: E402
    Turso, last_complete_sweep, record_run, record_sweep, run_independently,
    stamp_freshness,
)

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


# ---------------------------------------------------------------------------
# The observed-decision series: our own half of `daily_decisions`
#
# WHAT IT IS, AND WHAT IT IS NOT. `daily_decisions` already holds
# `dol-disclosure`, derived from `perm_cases` by DOL's OWN decision date - the
# date printed in the quarterly file. It is authoritative and it stops dead at
# the last published quarter (2026-06-30), because that is where DOL's dating
# ends. DOL publishes no decision timestamp on the live endpoint, so
# `perm_case_status` has no decision_date column and no amount of sweeping
# will produce one.
#
# What a sweep CAN say is when it SAW a case move, and `perm_case_events`
# records exactly that. So this series is dated by OBSERVATION, and it is
# stored under a source name that says so rather than one that could be read
# as DOL's dating:
#
#   dol-disclosure   DOL decided it on this date        (quarterly, to 06-30)
#   sweep-observed   our sweep first saw it on this date (daily, from 08-30)
#
# THE TWO MUST NEVER BE UNIONED. They answer different questions and a
# `sum(total) GROUP BY date` across the table silently adds them. Measured
# before this change, that union was already wrong for another reason: the
# retired `permtrack` series overlapped `dol-disclosure` on 88 dates and
# injected 42,056 phantom decisions into every unfiltered read. Those rows are
# gone and every reader is pinned to a source; `test_observed_decisions.py`
# scans for a query that forgets.
#
# WHY THE FILTERS ARE COPIED FROM `src/lib/turso/changes.ts`. That module
# renders the same events as a per-case feed. If the chart and the feed
# disagreed about which rows count, a reader could click a day on one and find
# a different day on the other. The constants below are asserted equal to that
# file's, so a change on either side fails CI instead of drifting.
# ---------------------------------------------------------------------------

OBSERVED_SOURCE = "sweep-observed"

# Byte-identical to EXPIRY_FROM / EXPIRY_TO / BULK_WRITE_ROWS in
# src/lib/turso/changes.ts. Asserted by test_observed_decisions.py.
EXPIRY_FROM = "CERTIFIED"
EXPIRY_TO = "CERTIFIED - EXPIRED"
BULK_WRITE_ROWS = 5000

# WHICH FINAL STATUS LANDS IN WHICH COLUMN.
#
# `daily_decisions` carries total/certified/denied/withdrawn, and both existing
# sources satisfy total == certified + denied + withdrawn exactly (373,939 and
# 9,457, checked). Keeping that invariant is what makes the two series
# comparable at all, so `total` here is the sum of the three buckets and not a
# count of anything else.
#
# An expired certification is filed as CERTIFIED, which is also what permtrack
# did with their `certified_expired`. The ORDINARY expiry - a case moving
# CERTIFIED -> CERTIFIED - EXPIRED - never reaches this map, because the pair
# filter drops it as a clock running out rather than a decision. What does
# reach it is an arrival at an expired-certification status from anything
# else, i.e. a certification we saw late because the sweep missed the window
# in between. Measured 2026-09-03: 0 such rows in 147,328 events, so this is a
# rule for a case that has not happened yet rather than a live reclassification.
#
# The membership assertion is the point of writing it out. FINAL_STATUSES is
# the canonical set and this map must cover it exactly; adding a status there
# without deciding where it belongs here raises rather than silently dropping
# the decisions into no column at all.
DECISION_BUCKETS = {
    "CERTIFIED": "certified",
    "CERTIFIED - EXPIRED": "certified",
    "CERTIFIED-EXPIRED": "certified",
    "DENIED": "denied",
    "WITHDRAWN": "withdrawn",
}


# ---------------------------------------------------------------------------
# Discovery: the corpus was a closed set, and this is the systematic half of
# opening it (the demand half is the web lookup's discoverCase). DOL case
# numbers are sequential - G-100-<YYDDD><serial> where YYDDD is the filing
# day and the serial increments globally - so new filings live in a narrow,
# predictable window past our highest known serial. Each full sweep walks
# that window across the last few filing days and records what DOL confirms.
#
# Measured before building (2026-08-28): one 50-number probe past the known
# max found five real cases filed the previous day. ~460 filings arrive per
# business day, so the whole day's discovery fits in a few dozen requests
# against the ~10,000 the sweep already makes.
# ---------------------------------------------------------------------------

DISCOVERY_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, discovered)"
DISCOVERY_DAY_WINDOW = 5        # probe filings from the last N calendar days
DISCOVERY_SERIAL_SPAN = 1500    # how far past the known max serial to look
DISCOVERY_REQUEST_CAP = 120     # discovery's own polite budget per run
DISCOVERY_DRY_STREAK = 2        # stop a day code after this many empty batches

CASE_RE = re.compile(r"^[A-Za-z]-\d{3}-(\d{2})(\d{3})-(\d+)$")


def decode_filing_date(case_number: str) -> str | None:
    """ISO date from the number's own YYDDD segment, or None off-shape.

    Exact for 94.6% of the corpus and equal to DOL's submittedDate for
    409,127 of 414,050 rows; a None (bad day-of-year) must stay None - a
    plausible wrong date is invisible downstream in a way a null is not.
    """
    m = CASE_RE.match(case_number)
    if not m:
        return None
    year, doy = 2000 + int(m.group(1)), int(m.group(2))
    if not 1 <= doy <= 366:
        return None
    try:
        d = datetime.date(year, 1, 1) + datetime.timedelta(days=doy - 1)
    except OverflowError:
        return None
    if d.year != year:
        return None
    return d.isoformat()


def recent_day_codes(today: datetime.date, window: int) -> list[str]:
    """YYDDD codes for `today` back through `window` days, newest first.

    Built from real dates so the year boundary is free: Jan 1 looks back
    into the previous year's codes rather than at "00-2".
    """
    return [
        f"{d.year % 100:02d}{d.timetuple().tm_yday:03d}"
        for d in (today - datetime.timedelta(days=i) for i in range(window))
    ]


def discovery_batches(max_serial: int, day_codes: list[str],
                      span: int, batch: int = BATCH):
    """Candidate batches, day-major: every unknown serial under each code.

    A serial exists under exactly one day code, so most candidates miss by
    construction; the waste is bounded by the caps and buys not having to
    guess which day each serial belongs to.
    """
    for code in day_codes:
        chunk: list[str] = []
        for serial in range(max_serial + 1, max_serial + 1 + span):
            chunk.append(f"G-100-{code}-{serial}")
            if len(chunk) == batch:
                yield code, chunk
                chunk = []
        if chunk:
            yield code, chunk


def run_discovery(db) -> int:
    """Probe past the known serial frontier and record what DOL confirms."""
    codes = recent_day_codes(datetime.date.today(), DISCOVERY_DAY_WINDOW)
    prefixes = sorted({c[:2] for c in codes})
    tails: list[str] = []
    for yy in prefixes:
        tails += [r[0] for r in _rows(
            db,
            "SELECT case_number FROM perm_case_status "
            "WHERE case_number >= ? AND case_number < ? "
            "ORDER BY case_number DESC LIMIT 300",
            [f"G-100-{yy}", f"G-100-{int(yy) + 1:02d}"])]
    serials = [int(m.group(3)) for t in tails if (m := CASE_RE.match(t))]
    if not serials:
        log("discovery: no serial frontier found; skipping")
        return 0
    frontier = max(serials)
    log(f"discovery: frontier serial {frontier:,}, probing "
        f"{DISCOVERY_SERIAL_SPAN} serials x {len(codes)} day codes")

    inserted = 0
    requests = 0
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(time.time() * 1000)
    dry = 0
    current_code = None
    for code, chunk in discovery_batches(frontier, codes, DISCOVERY_SERIAL_SPAN):
        if code != current_code:
            current_code, dry = code, 0
        if dry >= DISCOVERY_DRY_STREAK:
            continue        # this day code has gone quiet; skip its remainder
        if requests >= DISCOVERY_REQUEST_CAP:
            log(f"discovery: request cap {DISCOVERY_REQUEST_CAP} reached")
            break
        try:
            got = lookup_with_retry(chunk)
        except Exception as exc:  # noqa: BLE001
            log(f"discovery: batch failed ({exc}); stopping cleanly")
            break
        requests += 1
        wanted = set(chunk)
        hits = [v for v in got if v.get("caseNumber") in wanted]
        if not hits:
            dry += 1
        else:
            dry = 0
        for v in hits:
            cn = v["caseNumber"]
            status_str = (v.get("caseStatus") or "").strip()
            if not status_str:
                continue
            is_final = 1 if status_str.upper() in FINAL_STATUSES else 0
            res = db.execute(
                "INSERT OR IGNORE INTO perm_case_status "
                "(case_number, filing_date, current_status, is_final, "
                " is_disclosed, employer_name, job_title, submitted_date, "
                " last_checked_at, verified, source, fetched_at) "
                "VALUES (?,?,?,?,0,?,?,?,?,1,?,?)",
                [cn, decode_filing_date(cn), status_str, is_final,
                 v.get("employerName"), v.get("jobTitle"),
                 v.get("submittedDate"), now_iso, DISCOVERY_SOURCE, stamp])
            # OR IGNORE reports 0 affected rows for an already-known case
            # (the web lookup may have discovered it first); count only
            # genuine additions or the log overstates the find.
            affected = (res.get("response", {}).get("result", {})
                        .get("affected_row_count", 0))
            inserted += 1 if affected else 0
        time.sleep(PACE_S)

    log(f"discovery: {requests} requests, {inserted} new cases recorded")
    return inserted


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


def _rows(db, sql: str, args: list | None = None) -> list[list]:
    """Rows as plain Python values (Hrana cells decoded)."""
    res = db.execute(sql, args or [])["response"]["result"]
    return [[None if c["type"] == "null" else c["value"] for c in row]
            for row in res["rows"]]


# The fixture row DOL leaves in its own data. Must stay byte-identical to
# TEST_FIXTURE_EMPLOYER in src/lib/turso/rfi.ts, which is asserted by
# review-stages-doc.test.ts - a drift here would silently change what the
# published doc counts while the fallback query kept counting the old way.
TEST_FIXTURE_EMPLOYER = "bah-test-company-name"

# Same expression as AGE_DAYS in src/lib/turso/rfi.ts.
_AGE_DAYS = """CASE
  WHEN filing_date IS NOT NULL AND filing_date <> '' AND last_checked_at IS NOT NULL
  THEN CAST(julianday(substr(last_checked_at, 1, 10)) - julianday(filing_date) AS INTEGER)
END"""


def write_review_stages(db) -> None:
    """Precompute the pending review-stage census into perm_docs['review_stages'].

    WHY. `/perm-rfi-audit` and its nine stage pages called getReviewStages()
    on every cold render, and that query is a CTE over ~98,000 pending rows
    with three window functions, a COUNT(DISTINCT employer_name) and three
    joins. Measured against production 2026-08-31: **19.56s cold, 2.49s
    warm**, against the read layer's 20s deadline. It blew the deadline,
    retried, blew it again and threw - so the page returned 500.

    That was not theoretical. Google's Inspection Tool hit it three times and
    REFUSED to index two stage URLs ("Page cannot be indexed: Server error
    (5xx)"), and Sentry caught the cause verbatim:
    `turso query deadline (20000ms, attempt 2): WITH pend AS (`.

    Computing it once per sweep instead of once per cold render replaces all
    of it with a single doc read.

    RAW NUMBERS ONLY. The editorial guards that decide whether an age band is
    honest enough to draw - MIN_BAND_N, and n >= cases/2 - stay in TypeScript
    where they are already probed by tests. Reimplementing them here would
    put the same rule in two languages with no way to notice them diverging.

    THE DOC MUST RECONCILE OR IT MUST NOT BE WRITTEN, the same rule
    write_live_census follows: sum(stage.cases) must equal the pending total
    counted separately. A partial census folds into smaller plausible
    numbers and nothing downstream can tell.

    `seenFrom`/`seenTo` ARE OUR SWEEP'S DATES, NOT `last_checked_at`.

    They used to be MIN/MAX of `substr(last_checked_at, 1, 10)`, and this
    script has never written that column - it is permtrack's field, inherited
    from the mirror seed, and the header of this file says as much. Measured
    2026-09-03: 66,771 pending cases carried a 2026-07 timestamp and 12,187
    carried none, so the doc published `seenTo` 2026-08-31 for the largest
    stage on a morning when the sweep had asked DOL about every case in it.
    The page turns that into a sentence about when the stages "were read",
    which made a freshness claim out of a retired competitor's bookkeeping.

    A sweep asks about a POPULATION, and the review stages are a subset of
    the pending population that both the full and pending passes cover
    entirely. So there is nothing per-stage to recover: every stage was
    checked in the same run, on the same date, and a per-stage range would be
    that one date repeated. Sweep-wide is the accurate answer here, not a
    compromise. The range only opens when a run crosses midnight.

    NONE IS A REAL ANSWER. Before the first complete sweep is recorded there
    is no date we can prove, and both fields go null - which the reader
    already accepts (`string | null`) and which renders as no "checked"
    clause at all. An absent claim beats an unprovable one.

    THE DOC'S SHAPE DOES NOT MOVE. `parseReviewStagesDoc` in
    src/lib/turso/rfi.ts still sees `seenFrom`/`seenTo` as string-or-null on
    every stage row; only where the values come from has changed.
    """
    stage_rows = _rows(db, f"""
        WITH pend AS (
          SELECT current_status AS status, employer_name,
                 {_AGE_DAYS} AS days
            FROM perm_case_status
           WHERE is_final = 0 AND employer_name IS NOT ?
        ),
        ranked AS (
          SELECT status, days,
                 ROW_NUMBER() OVER (PARTITION BY status ORDER BY days) AS rn,
                 COUNT(*)     OVER (PARTITION BY status)               AS aged
            FROM pend WHERE days IS NOT NULL
        ),
        pct AS (
          SELECT status, MAX(aged) AS aged,
                 MAX(CASE WHEN rn = MAX(1, aged / 2)      THEN days END) AS d50,
                 MAX(CASE WHEN rn = MAX(1, aged / 10)     THEN days END) AS d10,
                 MAX(CASE WHEN rn = MAX(1, aged * 9 / 10) THEN days END) AS d90
            FROM ranked GROUP BY status
        ),
        cen AS (
          SELECT status, COUNT(*) AS cases,
                 COUNT(DISTINCT employer_name) AS employer_names
            FROM pend GROUP BY status
        ),
        top AS (
          SELECT status, employer_name, n FROM (
            SELECT status, employer_name, COUNT(*) AS n,
                   ROW_NUMBER() OVER (PARTITION BY status ORDER BY COUNT(*) DESC) AS rk
              FROM pend WHERE employer_name IS NOT NULL AND employer_name <> ''
             GROUP BY status, employer_name)
           WHERE rk = 1
        )
        SELECT cen.status, cen.cases, cen.employer_names,
               pct.aged, pct.d10, pct.d50, pct.d90,
               top.employer_name AS top_employer, top.n AS top_cases
          FROM cen
          LEFT JOIN pct ON pct.status = cen.status
          LEFT JOIN top ON top.status = cen.status
         ORDER BY cen.cases DESC""", [TEST_FIXTURE_EMPLOYER])

    pending_total = int(db.scalar(
        "SELECT COUNT(*) FROM perm_case_status "
        "WHERE is_final = 0 AND employer_name IS NOT ?",
        [TEST_FIXTURE_EMPLOYER]) or 0)

    # OUR OWN MEASUREMENT, OR NONE. See the docstring: these two fields used
    # to be MIN/MAX of `last_checked_at`, which our sweep never writes.
    sweep = last_complete_sweep(db, "perm", modes=("full", "pending"))
    seen_from = sweep["started_on"] if sweep else None
    seen_to = sweep["finished_on"] if sweep else None

    stages = []
    for (status, cases, employer_names,
         aged, d10, d50, d90, top_employer, top_cases) in stage_rows:
        stages.append({
            "status": str(status),
            "cases": int(cases or 0),
            "employerNames": int(employer_names or 0),
            "topEmployer": None if top_employer is None else str(top_employer),
            "topEmployerCases": int(top_cases or 0),
            "seenFrom": None if seen_from is None else str(seen_from),
            "seenTo": None if seen_to is None else str(seen_to),
            "aged": None if aged is None else int(aged),
            "d10": None if d10 is None else int(d10),
            "d50": None if d50 is None else int(d50),
            "d90": None if d90 is None else int(d90),
        })

    summed = sum(s["cases"] for s in stages)
    if summed != pending_total:
        log(f"NOT writing review_stages: stages {summed:,} != pending "
            f"{pending_total:,} (a concurrent write landed mid-run)")
        return

    doc = {"asOf": time.strftime("%Y-%m-%d"), "source": SOURCE,
           "pendingTotal": pending_total, "stages": stages}
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) "
        "VALUES (?, ?, ?)",
        ["review_stages", payload, int(time.time() * 1000)])
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["review_stages"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: review_stages read-back does not match write")
    # ITS OWN FRESHNESS ROW, deliberately separate from the sweep's.
    #
    # The reconciliation guard above can SKIP the write while the sweep
    # itself succeeds and stamps `perm-case-status-full` green. Without a row
    # of its own, a doc that quietly stopped being written would age past the
    # reader's 8-day cutoff, every stage page would fall back to the 19.5s
    # query, and they would start 500ing again with nothing alerting.
    #
    # 3 days, not 8: check_ingest_health.py must fire well before the reader
    # gives up on the doc, not at the same moment.
    stamp_freshness(db, "review-stages", source=SOURCE, cadence="Daily",
                    note=f"{len(stages)} stages, {pending_total:,} pending",
                    max_age_days=3)
    log(f"wrote     review_stages ({len(stages)} stages, "
        f"{pending_total:,} pending, {len(payload):,} bytes, "
        f"seen {seen_from or 'never'}..{seen_to or 'never'})")


def write_sweep_coverage(db) -> None:
    """Project the newest COMPLETE sweep into perm_docs['sweep_coverage'].

    THE TABLE IS THE RECORD; THIS IS THE CURRENT VALUE. `sweep_runs` is
    append-only and answers the historical question ("has it run every day,
    and did it finish"). The website needs only the latest answer, and it
    already reads `perm_docs` with a React-cached point read - so projecting
    it here costs one small write per sweep and saves the read layer from
    querying a table it otherwise never touches, on a database billed by rows
    read.

    Derived FROM `last_complete_sweep`, never from the run's own variables, so
    the doc cannot claim coverage the table does not record. A partial run
    leaves the previous complete run's dates standing, which is exactly right:
    the last date on which we can PROVE we saw every pending case.

    NOTHING READS THIS YET. It is written so the remaining half of the same
    defect can be fixed without adding a query shape: `/perm-case-status`
    prints "checked N days ago" for a pending case from
    `perm_case_status.last_checked_at` - permtrack's field again - and for a
    pending PERM case the honest answer is this doc's `finishedOn`, because
    the sweep asks DOL about every pending case every day. See
    src/lib/casePosition.ts `statusCheckAge` and src/lib/turso/caseLookup.ts.
    """
    sweep = last_complete_sweep(db, "perm", modes=("full", "pending"))
    if not sweep:
        log("NOT writing sweep_coverage: no complete sweep recorded yet")
        return
    doc = {
        "asOf": time.strftime("%Y-%m-%d"),
        "program": "perm",
        "source": SOURCE,
        "mode": sweep["mode"],
        "startedOn": sweep["started_on"],
        "finishedOn": sweep["finished_on"],
        "asked": sweep["asked"],
        "answered": sweep["answered"],
        "missing": sweep["missing"],
        "changed": sweep["changed"],
        "durationS": max(0, (sweep["finished_at"] - sweep["started_at"]) // 1000),
    }
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) "
        "VALUES (?, ?, ?)",
        ["sweep_coverage", payload, int(time.time() * 1000)])
    log(f"wrote     sweep_coverage ({doc['mode']} sweep of "
        f"{doc['asked']:,} cases, finished {doc['finishedOn']})")


def write_stage_cohorts(db) -> None:
    """Precompute the filing-month x status matrix into perm_docs['stage_cohorts'].

    WHY. `getStageCohorts` ran a GROUP BY over EVERY row of perm_case_status
    on each cold render of /perm-rfi-audit and its ten stage pages. Measured
    2026-09-03: 414,357 rows, and the group key is substr(filing_date, 1, 7),
    an expression no index can serve, so it is a full scan every time. It blew
    the read layer's 20s deadline locally and returned 500; production only
    survived on the ISR cache, which is exactly the shape of the getReviewStages
    incident above - a page that is fine until the first cold render after a
    deploy, and then 5xxs at Google.

    It is also a bill. Turso charges rows READ, and this one query read 414,357
    of them per render on eleven pages.

    WHY NOT FOLD live_census, WHICH ALREADY HOLDS THIS MATRIX. Because it does
    not hold the same one: live_census counts every row, and every reader in
    rfi.ts excludes DOL's own test-fixture employer. That is 10 rows in 414,357,
    small enough to look right and wrong enough to make two surfaces disagree
    about one cohort, which is the defect this codebase keeps writing rules
    about. A doc of its own costs a few hundred bytes and cannot drift.

    THE WHOLE MATRIX, NOT THE WANTED STATUSES. `filed` has to count the whole
    month including decided cases, so it is its own denominator; the reader
    filters to the statuses it wants. Storing a filtered matrix would make the
    doc unusable for the stage pages, which each ask for a different one.

    THE DOC MUST RECONCILE OR IT MUST NOT BE WRITTEN, the same rule the two
    writers above follow: sum(n) must equal a separately counted total over the
    same predicate. A partial matrix folds into smaller plausible numbers and
    nothing downstream can tell.
    """
    rows = _rows(db, """
        SELECT substr(filing_date, 1, 7) AS month,
               current_status            AS status,
               COUNT(*)                  AS n
          FROM perm_case_status
         WHERE filing_date IS NOT NULL AND filing_date <> ''
           AND employer_name IS NOT ?
         GROUP BY month, status
         ORDER BY month""", [TEST_FIXTURE_EMPLOYER])

    total = int(db.scalar(
        "SELECT COUNT(*) FROM perm_case_status "
        "WHERE filing_date IS NOT NULL AND filing_date <> '' "
        "AND employer_name IS NOT ?", [TEST_FIXTURE_EMPLOYER]) or 0)

    matrix = [{"month": str(m), "status": str(st), "n": int(n)}
              for m, st, n in rows]
    summed = sum(r["n"] for r in matrix)
    if summed != total:
        # The two queries saw different tables (a concurrent write landed
        # between them). Skip; the previous doc stays live and the next run
        # reconciles.
        log(f"NOT writing stage_cohorts: matrix {summed:,} != total {total:,}")
        return

    doc = {"asOf": time.strftime("%Y-%m-%d"), "source": SOURCE,
           "total": total, "rows": matrix}
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) "
        "VALUES (?, ?, ?)",
        ["stage_cohorts", payload, int(time.time() * 1000)])
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["stage_cohorts"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: stage_cohorts read-back does not match write")
    # Its own freshness row, for the same reason review_stages has one: the
    # guard above can skip the write while the sweep stamps itself green, and
    # without this a doc that quietly stopped being written would age past the
    # reader's cutoff and put all eleven pages back on the full scan.
    stamp_freshness(db, "stage-cohorts", source=SOURCE, cadence="Daily",
                    note=f"{len(matrix)} month/status pairs, {total:,} cases",
                    max_age_days=3)
    log(f"wrote     stage_cohorts ({len(matrix)} pairs, {total:,} cases, "
        f"{len(payload):,} bytes)")


def write_live_census(db) -> None:
    """Precompute the mirror census into perm_docs['live_census'].

    WHY. `/perm-case-status?case=` renders dynamically, and its read layer
    used to aggregate the 414k-row mirror on every request: a full status
    count, an unbounded ahead-of-month range, a whole-table month group-by
    and a bare COUNT(*) - measured at ~1.8M row reads per lookup, which is
    how a month of crawler traffic burned a 500M row-read budget. Two
    group-bys here, twice a day, replace all of it with one doc read.

    THE DOC MUST RECONCILE OR IT MUST NOT BE WRITTEN. sum(matrix) +
    noFilingDate == totalCases is asserted before the write; the reader
    re-checks it and treats a mismatch as no census at all. Half a census
    folds into small plausible numbers, and nothing downstream can tell.
    """
    matrix_rows = _rows(db, """
        SELECT substr(filing_date, 1, 7) AS month,
               current_status            AS status,
               is_final                  AS is_final,
               COUNT(*)                  AS n
          FROM perm_case_status
         WHERE filing_date IS NOT NULL AND filing_date <> ''
         GROUP BY month, status, is_final""")
    no_filing = int(db.scalar(
        "SELECT COUNT(*) FROM perm_case_status "
        "WHERE filing_date IS NULL OR filing_date = ''") or 0)
    total = int(db.scalar("SELECT COUNT(*) FROM perm_case_status") or 0)

    matrix = [{"month": str(m), "status": str(s),
               "is_final": int(f), "n": int(n)}
              for m, s, f, n in matrix_rows]
    sum_n = sum(r["n"] for r in matrix)
    if sum_n + no_filing != total:
        # The two queries saw different tables (a concurrent write landed
        # between them). Skip this run; the previous census stays live and
        # the next run in <=12h reconciles.
        log(f"NOT writing live_census: matrix {sum_n:,} + noFilingDate "
            f"{no_filing:,} != total {total:,}")
        return

    doc = {"asOf": time.strftime("%Y-%m-%d"), "totalCases": total,
           "noFilingDate": no_filing, "source": SOURCE, "matrix": matrix}
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) "
        "VALUES (?, ?, ?)",
        ["live_census", payload, int(time.time() * 1000)])
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["live_census"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: live_census read-back does not match write")
    log(f"wrote     live_census ({len(matrix):,} matrix rows, "
        f"{len(payload):,} bytes)")


def write_decided_percentiles(db) -> None:
    """Per received-month decision-day percentiles from the decided corpus.

    Replaces caseContext's per-request window-function pass over perm_cases
    (259k rows, no received_date index - a full scan per lookup). The corpus
    only changes at disclosure ingests, but recomputing here twice a day
    costs two bounded scans and guarantees the doc can never lag a re-ingest.
    """
    raw = _rows(db, """
        WITH f AS (SELECT substr(received_date, 1, 7) AS m, days
                     FROM perm_cases
                    WHERE days IS NOT NULL AND received_date IS NOT NULL
                      AND received_date <> ''),
             o AS (SELECT m, days,
                          ROW_NUMBER() OVER (PARTITION BY m ORDER BY days) AS rn,
                          COUNT(*)    OVER (PARTITION BY m)                AS n
                     FROM f)
        SELECT m, MAX(n) AS n,
               MAX(CASE WHEN rn = MAX(1, n / 4)     THEN days END) AS p25,
               MAX(CASE WHEN rn = (n + 1) / 2       THEN days END) AS p50,
               MAX(CASE WHEN rn = MAX(1, n * 3 / 4) THEN days END) AS p75
          FROM o GROUP BY m ORDER BY m""")
    months = [{"m": str(m), "n": int(n), "p25": _int_or_none(p25),
               "p50": _int_or_none(p50), "p75": _int_or_none(p75)}
              for m, n, p25, p50, p75 in raw]
    if not months:
        log("NOT writing decided_month_percentiles: perm_cases is empty here")
        return
    doc = {"asOf": time.strftime("%Y-%m-%d"), "months": months}
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) "
        "VALUES (?, ?, ?)",
        ["decided_month_percentiles", payload, int(time.time() * 1000)])
    log(f"wrote     decided_month_percentiles ({len(months)} months)")


def observed_day(changed_at: int) -> str:
    """The UTC calendar day a `perm_case_events.changed_at` falls in.

    MUST AGREE WITH THE READER, which is the only reason this is a named
    function. `src/lib/turso/changes.ts` buckets the same rows by UTC midnight
    (its `dayBounds` parses `${date}T00:00:00Z`), and the SQL form it replaced,
    `DATE(changed_at / 1000, 'unixepoch')`, is UTC too. A local-time fold here
    would move rows written between 19:00 and 24:00 ET onto the previous day
    and the two surfaces would disagree about which day a decision landed on.

    Integer division matches SQLite's `changed_at / 1000` on an INTEGER column.
    """
    return datetime.datetime.fromtimestamp(
        changed_at // 1000, datetime.timezone.utc).date().isoformat()


def fold_observed_decisions(
    stamp_totals: list[tuple[int, str, int]],
    decisions: list[tuple[int, str, int]],
    today: str,
    sweep_source: str = SOURCE,
) -> tuple[dict[str, dict[str, int]], dict[str, str]]:
    """Group observed decisions into publishable days. Pure, so it is testable.

    Returns `(days, withheld)` - the days that may be published, and the days
    deliberately not published with the reason for each.

    FOUR RULES, AND TWO OF THEM ARE ABOUT WITHHOLDING RATHER THAN FILTERING.

    1. EXPIRY IS NOT A DECISION. `CERTIFIED -> CERTIFIED - EXPIRED` is a
       180-day I-140 window lapsing, not DOL adjudicating. Excluded upstream by
       the SQL, as a status PAIR, exactly as changes.ts does it.
    2. A BULK WRITE IS NOT A DAY'S WORK. Any timestamp carrying more than
       `BULK_WRITE_ROWS` rows is a sweep catching up on months of history.
       Dropped whole.
    3. A DAY CONTAMINATED BY RULE 2 IS WITHHELD ENTIRELY, not published with
       what survives. This is where a count parts company with a feed. On
       2026-08-28 two timestamps exist: one of 58 rows and one of 94,523. Drop
       the second and 57 decisions remain - a plausible number, and a lie,
       because the dropped stamp certainly carried that day's real
       adjudications mixed in with two years of backfilled expiries and
       nothing can separate them. Plotting 57 beside 1,000 the following week
       draws a collapse in DOL output that did not happen. A hole in the chart
       is visible; a wrong point is not.
    4. THE CURRENT DAY IS WITHHELD. The sweep runs inside it, so its own day is
       complete only by accident. Publishing it makes every rebuild show
       "today" collapsing, which is the same lie as rule 3 arriving on a timer.

    AND A DAY WITH NO OBSERVATION IS ABSENT, NOT ZERO. Only days carrying a
    surviving timestamp are eligible, so a day the sweep did not run has no
    row. A day it DID run and saw nothing decided is a real zero and is
    published as one. `ingest_rfi_funnel.py` already had to learn this
    distinction: storing "we did not look" as 0 draws a trough that is
    indistinguishable from a holiday.
    """
    # The bulk rule counts a timestamp ACROSS sources, exactly as the feed's
    # roll-up does (`GROUP BY changed_at`, no source term). Splitting it per
    # source here would let two writers land under one stamp and each stay
    # under the threshold.
    per_stamp: dict[int, int] = {}
    for ts, _src, n in stamp_totals:
        per_stamp[ts] = per_stamp.get(ts, 0) + n
    bulk = {ts for ts, n in per_stamp.items() if n > BULK_WRITE_ROWS}

    contaminated: dict[str, int] = {}
    for ts in bulk:
        day = observed_day(ts)
        contaminated[day] = max(contaminated.get(day, 0), per_stamp[ts])

    days: dict[str, dict[str, int]] = {}
    for ts, src, _n in stamp_totals:
        # ELIGIBILITY IS OUR SWEEP HAVING RUN, NOT MERELY A ROW EXISTING.
        # 2026-08-27 carries exactly one timestamp: 48 rows written by the
        # retired permtrack mirror, comparing their copy against ours. Our own
        # DOL sweep did not write an event until 2026-08-27T21:16Z, the next
        # day in UTC. Treating that stamp as an observation published
        # `2026-08-27 = 0`, a zero-decision day at the head of the series and
        # a false trough - the exact failure `ingest_rfi_funnel.py` guarded
        # against with permtrack's own `has_data` flag, arriving by a
        # different door.
        #
        # This decides which days are MEASURABLE, not which rows COUNT: a
        # mirror row on a day our sweep also ran is still counted, so the
        # chart and the feed cannot disagree about a day both publish. There
        # are zero such rows (measured 2026-09-03).
        if ts not in bulk and src == sweep_source:
            days.setdefault(observed_day(ts),
                            {"certified": 0, "denied": 0, "withdrawn": 0})

    for ts, status, n in decisions:
        if ts in bulk:
            continue
        key = status.upper()
        if key not in DECISION_BUCKETS:
            # A final status nobody decided where to file. Raising is right:
            # run_independently prints it as a ::error:: annotation and the
            # other doc writers still run, whereas silently dropping it would
            # under-count the series forever with nothing to see.
            #
            # RuntimeError AND NOT SystemExit, deliberately. `run_independently`
            # catches `Exception`, and SystemExit inherits from BaseException,
            # so it would sail past the handler and kill the process BEFORE
            # `record_run` writes the audit row - leaving check_ingest_health.py
            # with nothing to turn red at 10:00 the next morning. That is the
            # exact shape of the 2026-09-03 outage this file already documents.
            raise RuntimeError(
                f"{status!r} is final but has no column in DECISION_BUCKETS; "
                f"add it rather than losing its decisions")
        day = observed_day(ts)
        if day not in days:
            # A decision on a day our sweep never ran - only reachable for the
            # mirror's own rows. Counting it would publish a day nobody swept.
            continue
        days[day][DECISION_BUCKETS[key]] += int(n)

    withheld: dict[str, str] = {}
    for date in sorted(days):
        if date in contaminated:
            withheld[date] = (
                f"a catch-up sweep wrote {contaminated[date]:,} rows under one "
                f"timestamp that day, so the day's real total is unrecoverable")
        elif date >= today:
            withheld[date] = "incomplete: the sweep is still inside this day"
    for date in withheld:
        days.pop(date, None)
    # Also name a day whose ONLY timestamp was a bulk write, which never
    # reached `days` at all and would otherwise vanish without explanation.
    for date, n in contaminated.items():
        withheld.setdefault(
            date,
            f"a catch-up sweep wrote {n:,} rows under one timestamp that day, "
            f"so the day's real total is unrecoverable")

    for row in days.values():
        row["total"] = row["certified"] + row["denied"] + row["withdrawn"]
    return days, withheld


def write_observed_decisions(db) -> None:
    """Rebuild `daily_decisions` under `sweep-observed` from perm_case_events.

    WHY IT EXISTS. `dol-disclosure` is dated by DOL's own decision date and
    stops at the last published quarter, so the chart on `/perm-cases` ends
    two months behind. DOL publishes no decision timestamp on the live
    endpoint - `perm_case_status` has no decision_date column and cannot be
    made to have one - but the sweep records every transition it sees, and
    when we SAW a case decided is a real, publishable measurement as long as
    it is labelled as that and not as DOL's dating. Hence a separate source
    name; see the block comment beside `OBSERVED_SOURCE`.

    A DECISION IS A TRANSITION INTO `FINAL_STATUSES`, which is reused from the
    same constant the sweep classifies `is_final` with, so the chart and the
    per-case pages cannot disagree about what "decided" means. Movements
    between review stages (`ANALYST REVIEW -> RFI ISSUED`, an appeal opening)
    are adjudication EVENTS and appear in the feed on `/perm-decision-activity`,
    but they are not decisions and they do not belong in a table whose other
    source counts certifications, denials and withdrawals.

    THE COST. Two grouped scans of `perm_case_events` per run, twice a day.
    Measured 2026-09-03: 147,328 rows, so ~589k rows read a day against a
    2.5B-per-cycle allowance, and the second query is served by
    `case_events_status_time (to_status, changed_at)`. Growth is ~1,500
    events/day. The site never reads this table row by row; this is the ingest
    paying once so every page reads a handful of rows.
    """
    stamp_totals = [
        (int(ts), str(src), int(n)) for ts, src, n in _rows(
            db, "SELECT changed_at, source, COUNT(*) FROM perm_case_events "
                "GROUP BY changed_at, source")]
    finals = sorted(FINAL_STATUSES)
    decisions = [
        (int(ts), str(s), int(n)) for ts, s, n in _rows(
            db,
            "SELECT changed_at, to_status, COUNT(*) FROM perm_case_events "
            f"WHERE to_status IN ({','.join('?' * len(finals))}) "
            "  AND NOT (from_status = ? AND to_status = ?) "
            "GROUP BY changed_at, to_status",
            [*finals, EXPIRY_FROM, EXPIRY_TO])]

    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    days, withheld = fold_observed_decisions(stamp_totals, decisions, today)

    if not days:
        # AN EMPTY COMPUTATION MUST NEVER WIPE A GOOD SERIES. Every path below
        # deletes what it did not just write, so a run that legitimately found
        # nothing - or a `perm_case_events` that failed to read - would empty
        # the table and log success. Same guard shape as live_census's
        # reconciliation: refuse the write, keep the previous good data.
        log(f"NOT writing {OBSERVED_SOURCE}: no publishable day "
            f"({len(withheld)} withheld, {len(stamp_totals)} sweep timestamps)")
        return

    db.execute("""CREATE TABLE IF NOT EXISTS daily_decisions (
        date TEXT NOT NULL, source TEXT NOT NULL,
        total INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
        fetched_at INTEGER NOT NULL, PRIMARY KEY (date, source))""")
    stamp = int(time.time() * 1000)
    dates = sorted(days)
    # UPSERT FIRST, DELETE SECOND, so the series is never briefly empty for a
    # reader mid-run. `INSERT OR REPLACE` is keyed on (date, source), so the
    # write is idempotent and a re-sent pipeline is a no-op.
    #
    # NOT DIFFED, unlike `perm_live_recent`, and the difference is two orders
    # of magnitude: this series is one row per day since 2026-08-30, so it is
    # ~4 rows today, ~370 in a year and ~1,800 in five - against 137,000 there.
    # At two sweeps a day that is 3,600 writes a day at the five-year mark,
    # roughly 1% of a 10M/month plan, to keep the writer a dozen lines shorter
    # and unconditionally self-healing. Revisit if this ever holds more than a
    # few thousand rows.
    db.pipeline([{"type": "execute", "stmt": {
        "sql": "INSERT OR REPLACE INTO daily_decisions "
               "(date, source, total, certified, denied, withdrawn, fetched_at) "
               "VALUES (?,?,?,?,?,?,?)",
        "args": [{"type": "text", "value": d},
                 {"type": "text", "value": OBSERVED_SOURCE},
                 {"type": "integer", "value": str(days[d]["total"])},
                 {"type": "integer", "value": str(days[d]["certified"])},
                 {"type": "integer", "value": str(days[d]["denied"])},
                 {"type": "integer", "value": str(days[d]["withdrawn"])},
                 {"type": "integer", "value": str(stamp)}]}}
        for d in dates] + [{"type": "close"}])
    # A day that becomes unpublishable (a later backfill lands on it) has to
    # LOSE its row, or the series keeps a number this run has just decided it
    # cannot stand behind.
    db.execute(
        f"DELETE FROM daily_decisions WHERE source = ? AND date NOT IN "
        f"({','.join('?' * len(dates))})", [OBSERVED_SOURCE, *dates])

    got = int(db.scalar("SELECT COUNT(*) FROM daily_decisions WHERE source = ?",
                        [OBSERVED_SOURCE]) or 0)
    if got != len(dates):
        # RuntimeError for the same reason as above: this has to reach
        # `run_independently`, not exit the interpreter over the audit write.
        raise RuntimeError(
            f"{OBSERVED_SOURCE} read-back is {got} rows, wrote {len(dates)}")

    doc = {
        "asOf": today,
        "source": OBSERVED_SOURCE,
        "dating": "when our sweep first observed the change, not DOL's own "
                  "decision date",
        "from": dates[0], "to": dates[-1],
        "decisions": sum(days[d]["total"] for d in dates),
        "withheld": [{"date": d, "reason": r} for d, r in sorted(withheld.items())],
    }
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) "
        "VALUES (?, ?, ?)",
        ["observed_decisions", json.dumps(doc, separators=(",", ":")), stamp])
    # WHY THE HOLES ARE RECORDED. A missing day in a chart is indistinguishable
    # from a day with no data, and rule 3 above deliberately makes holes. The
    # doc is what lets the page say WHY 28 and 29 August are absent instead of
    # leaving a reader to assume DOL stopped working.

    stamp_freshness(
        db, "decisions-observed", as_of=dates[-1],
        source=SOURCE,
        cadence="Daily, one row per day our sweep observed",
        note=f"Decisions observed by our own DOL sweep, {dates[0]} to "
             f"{dates[-1]}. Dated by OBSERVATION, not by DOL's decision date - "
             f"the live endpoint publishes no decision timestamp. "
             f"{len(withheld)} day(s) withheld as unmeasurable.",
        max_age_days=3)
    log(f"wrote     {OBSERVED_SOURCE} ({len(dates)} days, {dates[0]}..{dates[-1]}, "
        f"{doc['decisions']:,} decisions, {len(withheld)} withheld)")


def _int_or_none(v) -> int | None:
    return None if v is None else int(v)


def sweep_is_complete(limit, offset, truncated: bool, failed_batches: int) -> bool:
    """Did this run cover its whole population? A named function so it can be
    tested, because it is the claim `write_review_stages` dates a published
    census on.

    Every term is a coverage failure that produces a PLAUSIBLE partial result
    rather than an error:

      limit / offset   the todo list was a slice by construction
      truncated        three consecutive far-end failures stopped the loop
      failed_batches   a batch exhausted its retries and was skipped with
                       `continue` - a hole of up to 50 cases the run never
                       saw, with no exception and no missing output

    The last one is the reason this is not just `not truncated`: a sweep can
    finish its loop, report a healthy total, and still have missed 50 cases in
    the middle.
    """
    return not limit and not offset and not truncated and failed_batches == 0


def tail_steps(db, *, discover: bool) -> list[tuple[str, object]]:
    """The precomputed docs written after a sweep, as INDEPENDENT steps.

    ORDER IS LOAD-BEARING and `run_independently` preserves it: discovery
    before the census, or the census is written without the day's new filings;
    `write_sweep_coverage` before `write_review_stages`, which reads that row
    back to date the published stage census.

    These were bare calls in a row, and on 2026-09-03 the last of them raised
    SQLITE_NOMEM on a single-row INSERT (Actions run 33757242079). The
    70-minute sweep had already written its 566 status changes and stamped
    itself fresh; the run still went red, and had the failure landed on the
    FIRST doc instead of the last, all four after it would have been skipped
    for a reason that had nothing to do with them. Each doc is independently
    useful and each has its own reader fallback, so one failing is a reason to
    log loudly, not a reason to abandon the rest.
    """
    steps: list[tuple[str, object]] = []
    if discover:
        steps.append(("discovery", lambda: run_discovery(db)))
    steps += [
        ("live_census", lambda: write_live_census(db)),
        ("sweep_coverage", lambda: write_sweep_coverage(db)),
        ("review_stages", lambda: write_review_stages(db)),
        ("stage_cohorts", lambda: write_stage_cohorts(db)),
        ("decided_month_percentiles", lambda: write_decided_percentiles(db)),
        # LAST, because it reads `perm_case_events`, which `flush()` has
        # already written by the time any of these run. It is also the only
        # step whose output is a public SERIES rather than a snapshot, so a
        # failure here leaves yesterday's series live rather than a half one.
        ("observed_decisions", lambda: write_observed_decisions(db)),
    ]
    return steps


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
        "--discover", action="store_true",
        help="Only probe past the serial frontier for new filings, record "
             "them, refresh the census, and exit. The full sweep also runs "
             "discovery on its own.")
    ap.add_argument(
        "--reconcile", action="store_true",
        help="Correct statuses but write NO events. Use this for the first "
             "pass against a stale mirror.",
    )
    args = ap.parse_args()

    db = Turso()

    if args.discover and not (args.full or args.pending):
        found = run_discovery(db)
        if found:
            failed = run_independently(tail_steps(db, discover=False))
            log("census refreshed" if not failed
                else f"census refreshed; {len(failed)} doc write(s) failed")
            record_run(db, "ingest_case_status_direct.py --discover",
                       status="ok" if not failed else "partial",
                       rows_written=found,
                       note=f"discovery only: {found} filings"
                            + (f"; failed: {', '.join(k for k, _ in failed)}"
                               if failed else ""))
        return 0

    # The RFI blend reads "cases that ENTERED an RFI since <a fixed date>".
    # `changed_at > <freeze>` matches more of the table every day, so with only
    # a changed_at index that CTE degrades into a growing scan. Leading on
    # to_status keeps it bounded to the RFI rows, which are a small slice.
    db.execute("""CREATE INDEX IF NOT EXISTS case_events_status_time
        ON perm_case_events (to_status, changed_at)""")

    # The stage pages list the cases sitting at one FLAG status, oldest filing
    # first. The two indexes this table already had both lead somewhere else -
    # case_status_month on the filing month, case_status_final on is_final - so
    # SQLite served that query from case_status_final and read every one of the
    # ~98,000 pending rows to return the 974 at RFI ISSUED. Measured with
    # EXPLAIN QUERY PLAN before this existed:
    #
    #   SEARCH perm_case_status USING INDEX case_status_final (is_final=?)
    #
    # Leading on current_status bounds the read to the stage; filing_date last
    # makes the ordering free rather than a sort over the partition.
    db.execute("""CREATE INDEX IF NOT EXISTS case_status_stage
        ON perm_case_status (current_status, is_final, filing_date)""")

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
    # COVERAGE BOOKKEEPING, for the sweep record written at the end.
    #   asked          case numbers actually put to DOL (failed batches never got there)
    #   requests       HTTP batches attempted
    #   failed_batches batches that exhausted their retries - each one is a
    #                  hole of up to 50 cases, and a run with a hole in it has
    #                  NOT covered its population
    #   truncated      the loop stopped early (three consecutive far-end failures)
    asked = requests = failed_batches = 0
    truncated = False
    status_counts: dict[str, int] = {}
    fails = 0
    started = time.time()
    stamp = int(time.time() * 1000)
    events: list[list] = []
    updates: list[list] = []

    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        requests += 1
        try:
            got = lookup_with_retry(chunk)
            fails = 0
            asked += len(chunk)
        except Exception as exc:  # noqa: BLE001
            fails += 1
            failed_batches += 1
            log(f"  batch {i//BATCH+1}: {exc}")
            # DOL publishes maintenance windows. Three failures in a row is the
            # far end being down, and continuing is just noise in their logs.
            if fails >= 3:
                flush(db, updates, events)
                truncated = True
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
            # The breakdown DOL ANSWERED WITH, over every case we asked about -
            # not only the ones that moved. A record of coverage that only
            # counted changes could not tell an all-quiet sweep from one that
            # never ran.
            status_counts[new_status or "(blank)"] = (
                status_counts.get(new_status or "(blank)", 0) + 1)
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
        # PER-PASS freshness. Both passes used to stamp one `perm-case-status`
        # row, so the full pass - the only one that catches expirations, runs
        # discovery and rebuilds the live remainder - could fail every night
        # and the pending pass would keep the clock green. The full pass now
        # owns its own dataset key, which check_ingest_health.py picks up for
        # free because it reads every row in data_freshness.
        dataset = "perm-case-status-full" if args.full else "perm-case-status"
        stamp_freshness(db, dataset, source=SOURCE, cadence="Daily",
                        note=f"{n:,} cases", max_age_days=3)
        log(f"stamped   {dataset}")
        # WHAT THIS RUN ACTUALLY LOOKED AT, and whether it got all the way
        # round. `complete` is what write_review_stages reads back to date the
        # published stage census, so every term below is a coverage claim:
        #
        #   --limit / --offset  the todo list was a slice, not the population
        #   truncated           three consecutive far-end failures stopped it
        #   failed_batches      a batch exhausted its retries; each one is a
        #                       hole of up to 50 cases the run never saw
        #
        # A run failing any of these still gets a row - the audit trail wants
        # partial runs most of all - it just cannot be used to date a census.
        # The predicate itself is `sweep_is_complete`, above, where it is tested.
        complete = sweep_is_complete(args.limit, args.offset,
                                     truncated, failed_batches)
        record_sweep(
            db, script="ingest_case_status_direct.py", program="perm",
            mode="full" if args.full else "pending",
            started_at=started, asked=asked, answered=checked, missing=missing,
            changed=moved, requests=requests, failed_batches=failed_batches,
            complete=complete, status_counts=status_counts,
        )
        log(f"recorded  sweep: asked {asked:,}, answered {checked:,}, "
            f"changed {moved:,}, {requests:,} requests, "
            f"{'COMPLETE' if complete else 'PARTIAL'}")
        # Discovery rides the full sweep so the census below already carries
        # the day's new filings. The pending sweep skips it: twice-daily
        # probing buys little and doubles the polite load. write_sweep_coverage
        # runs before write_review_stages, which reads that row back, so the
        # doc's dates are this run's rather than yesterday's.
        steps = tail_steps(db, discover=bool(args.full))
        failed = run_independently(steps)

        # RECORDED AFTER THE TAIL, NOT BEFORE IT. This call used to sit above
        # the doc writes and always said "ok", so the run that died on
        # 2026-09-03 wrote itself an `ok` audit row and a fresh
        # `perm-case-status-full` stamp 80 seconds before it crashed. Every
        # row in ingest_runs said `ok` (36 of 36, measured) while two sweeps
        # had failed that morning, so both monitors reported green over a red
        # run. A status column with one value in it is not a status column.
        status = "ok" if not failed else "partial"
        note = f"{'full' if args.full else 'pending'}: {n:,} cases"
        if failed:
            note += (f"; {len(failed)}/{len(steps)} tail steps failed: "
                     + ", ".join(k for k, _ in failed))
        record_run(db, "ingest_case_status_direct.py", status=status,
                   rows_written=written["u"], note=note, started_at=started)

        if failed:
            log(f"TAIL: {len(failed)} of {len(steps)} doc writes failed: "
                + ", ".join(k for k, _ in failed))
            # EVERY tail step failing is not "a doc write failed", it is the
            # database being gone - at which point the sweep's own writes are
            # suspect too and the run should be red. One or two failing is a
            # blip: the previous docs are still live and correct, every reader
            # has its own fallback, and re-running a 70-minute federal scrape
            # to rewrite one small JSON blob is not a trade worth making. It
            # surfaces instead through the `partial` row above, which
            # check_ingest_health.py turns red at 10:00 UTC the same morning.
            if len(failed) == len(steps):
                log("every tail step failed; failing the run")
                return 1
    else:
        log("NOT stamping freshness: this run checked nothing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
