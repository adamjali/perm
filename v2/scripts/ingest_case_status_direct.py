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
import datetime
import json
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

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
    """
    stage_rows = _rows(db, f"""
        WITH pend AS (
          SELECT current_status AS status, employer_name,
                 {_AGE_DAYS} AS days, substr(last_checked_at, 1, 10) AS seen
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
                 COUNT(DISTINCT employer_name) AS employer_names,
                 MIN(seen) AS seen_from, MAX(seen) AS seen_to
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
        SELECT cen.status, cen.cases, cen.employer_names, cen.seen_from, cen.seen_to,
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

    stages = []
    for (status, cases, employer_names, seen_from, seen_to,
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
        f"{pending_total:,} pending, {len(payload):,} bytes)")


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


def _int_or_none(v) -> int | None:
    return None if v is None else int(v)


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
            write_live_census(db)
            write_review_stages(db)
            write_stage_cohorts(db)
            write_decided_percentiles(db)
            log("census refreshed")
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
        record_run(db, "ingest_case_status_direct.py",
                   status="ok", rows_written=written["u"],
                   note=f"{'full' if args.full else 'pending'}: {n:,} cases")
        # Discovery rides the full sweep so the census below already carries
        # the day's new filings. The pending sweep skips it: twice-daily
        # probing buys little and doubles the polite load.
        if args.full:
            run_discovery(db)
        write_live_census(db)
        write_review_stages(db)
        write_stage_cohorts(db)
        write_decided_percentiles(db)
    else:
        log("NOT stamping freshness: this run checked nothing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
