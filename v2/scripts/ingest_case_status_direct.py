#!/usr/bin/env python3
"""Per-case PERM status, straight from DOL's own case-status lookup.

    POST https://flag.dol.gov/recaptcha/caseStatus
    ["G-100-24339-516453", ...]        <- a JSON array; it batches

    {"value":[{"caseNumber":"...","caseStatus":"CERTIFIED","visaType":"PERM",
               "employerName":"...","jobTitle":"...","submittedDate":"..."}]}

The path is named `recaptcha`, but nothing in the flow is a CAPTCHA: no
challenge script, no site key, no token, and a bare request with no cookie is
answered. `robots.txt` doesn't disallow it.

THE BATCH CEILING IS 50, AND IT FAILS QUIETLY. Asking for 100 or 200 returns
200 OK with exactly 50 records and no warning (only 400 is rejected), so the
batch size is asserted against the request rather than trusted.

Coverage is recorded per run, not per case: a sweep asks about a population,
so `record_sweep` writes one `sweep_runs` row at the end of main(), and the
review-stage doc and perm_docs['sweep_coverage'] read it back. The inherited
`perm_case_status.last_checked_at` column is never written here and must not
be quoted as the date a case was checked.

This is a government system with published maintenance windows, so the sweep
is paced, checkpoints as it goes, and stops rather than hammering a far end
that keeps failing.

    python3 scripts/ingest_case_status_direct.py --limit 500     # a taste
    python3 scripts/ingest_case_status_direct.py --pending       # the sweep
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import (  # noqa: E402
    ET, Turso, et_date, last_complete_sweep, query_rows, read_doc, record_run, record_sweep,
    run_independently, run_stmts, stamp_freshness, stmt, write_doc,
)
from lib_housekeeping import prune as prune_old_rows  # noqa: E402
from lib_flag_serials import (  # noqa: E402
    CASE_RE, PERM_OFFICE_PREFIXES, RARE_PREFIXES, WALK_PREFIXES,
    case_number, code_of,
    day_code, day_codes_between, decode_filing_date, fmt_serial, newer,
    prefix_of, recent_day_codes, serial_add, serial_gap, serial_of, serial_span,
)
# CASE_RE, decode_filing_date and recent_day_codes are re-exported: the PWD
# prober and the tests import them from here.
__all__ = ["CASE_RE", "decode_filing_date", "recent_day_codes"]

URL = "https://flag.dol.gov/recaptcha/caseStatus"
BATCH = 50                      # measured ceiling; larger is silently truncated
PACE_S = 0.35                   # ~3 req/s against a .gov
SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

FINAL_STATUSES = {
    "CERTIFIED", "CERTIFIED - EXPIRED", "DENIED", "WITHDRAWN",
    "CERTIFIED-EXPIRED",
    # An appeal dismissed by BALCA ends the case (9 rows sat pending forever).
    "DENIED - BALCA DISMISSED",
    # The Board affirmed the denial, 20 CFR 656.27(c)(1); no DOL step follows.
    # 18 cases filed in 2023 had sat as pending and in the stage census.
    "DENIED - BALCA AFFIRMED",
}


# ---------------------------------------------------------------------------
# The observed-decision series: our own half of `daily_decisions`
#
# `daily_decisions` holds two sources that answer different questions:
#
#   dol-disclosure   DOL decided it on this date          (quarterly files)
#   sweep-observed   our sweep first saw it on this date  (daily)
#
# DOL's live endpoint publishes no decision date, so the most a sweep can say
# is when it SAW a case move, and the source name says exactly that. The two
# must never be unioned: a `sum(total) GROUP BY date` across both adds them.
# Every reader is pinned to one source, and test_observed_decisions.py scans
# for a query that forgets.
#
# The filters below are copied from src/lib/turso/changes.ts, which renders the
# same events as a per-case feed, and asserted equal to it, so the chart and
# the feed always count the same rows.
# ---------------------------------------------------------------------------

OBSERVED_SOURCE = "sweep-observed"

# Byte-identical to EXPIRY_FROM / EXPIRY_TO / BULK_WRITE_ROWS in
# src/lib/turso/changes.ts. Asserted by test_observed_decisions.py.
EXPIRY_FROM = "CERTIFIED"
EXPIRY_TO = "CERTIFIED - EXPIRED"
BULK_WRITE_ROWS = 5000

# WHICH FINAL STATUS LANDS IN WHICH COLUMN.
#
# `total` is the sum of the three buckets and nothing else, so both sources
# keep total == certified + denied + withdrawn and stay comparable.
#
# An expired certification counts as certified. The ordinary expiry (CERTIFIED
# -> CERTIFIED - EXPIRED) never reaches this map, because the pair filter drops
# it as a clock running out; what can reach it is a certification the sweep saw
# only after it had already expired.
#
# FINAL_STATUSES must be covered exactly: adding a status there without
# deciding its bucket here raises, rather than dropping its decisions into no
# column at all.
DECISION_BUCKETS = {
    "CERTIFIED": "certified",
    "CERTIFIED - EXPIRED": "certified",
    "CERTIFIED-EXPIRED": "certified",
    "DENIED": "denied",
    "DENIED - BALCA DISMISSED": "denied",
    "DENIED - BALCA AFFIRMED": "denied",
    "WITHDRAWN": "withdrawn",
}


# ---------------------------------------------------------------------------
# Discovery: walk DOL's shared serial counter forward from the last confirmed
# filing, carrying the day code. (The other way new cases arrive is a visitor's
# lookup of a number we don't hold, in the web app.)
#
#   - The cursor is a (day_code, serial) pair kept in perm_docs and moved only
#     by a confirmed hit, never by the calendar.
#   - Each span is asked under the cursor's day code and then each later code
#     up to today, so a day boundary is crossed by a hit, not guessed.
#   - Each span is asked under every prefix at once: a serial belongs to
#     exactly one program, and DOL returns nothing for it under any other
#     prefix, so "issued elsewhere" and "not issued yet" stay different answers.
#   - PWD, LCA and seasonal hits go to the PWD prober's inserter, so those
#     tables move with this walk.
#   - Serials are six digits and wrap at 1,000,000 (lib_flag_serials).
#   - A run that stops on its own cap or budget records "ok" and names the stop
#     in its note, and a run that finds nothing still records itself, so the
#     health check can see a frontier that stops moving.
#
# A weekday issues 3,000 to 5,300 serials; with every prefix asked, a request
# covers DISCOVERY_STEP of them at ~1.4 s (PACE_S plus DOL's latency), so
# keeping pace takes several hundred to about a thousand requests a day.
# ---------------------------------------------------------------------------

DISCOVERY_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, discovered)"

# A stop on the walk's own request cap is not a failure: the run records "ok"
# and names the stop in its note. The health check reads this exact string
# (check_ingest_health.SWEEP_CAP_NOTE, shared with sweep_serial_gaps.CAP_NOTE).
CAP_NOTE = "stopped on the request cap"
# Every span is asked under every busy prefix (WALK_PREFIXES), and a span none
# of them claims is asked again under the rare ones (RARE_PREFIXES) before it
# counts toward the "unissued" streak that ends a day: a prefix asked under
# none would answer empty, end the walk there, and hide the serials behind it,
# every night. Asking all 17 in one request would halve the serials a request
# covers; the rare ones are under 1% of the counter, and the gap sweep asks
# every prefix for the holes the walk stepped over. A confirmed hit is stored as
# PERM when its prefix is a PERM office code (PERM_OFFICE_PREFIXES) and handed
# to the PWD prober otherwise; a prefix asked but stored nowhere would be found
# and dropped every night.
DISCOVERY_STEP = BATCH // len(WALK_PREFIXES)   # serials per request, at the 50 ceiling
# The walk has to out-run the counter, so it runs on both daily passes and is
# bounded by a time budget; this cap is only a sanity bound. At ~1.4 s a
# request, 2,000 is ~47 minutes and ~10,000 serials: a backlog of days clears in
# one run, and a normal run reaches the edge long before it.
DISCOVERY_REQUEST_CAP = 2000
# Minutes after the PROCESS started (not after the walk did), so the walk
# spends only what the pass has left, and every budget leaves room under its
# workflow step's `timeout` (105m for the passes, 100m for a dispatched
# --discover) for the work that follows. A run that stops on its own clock
# records itself; one killed by `timeout` leaves only a red run.
# test_case_status_direct.py reads the step timeouts out of the workflow.
DISCOVERY_BUDGET_MIN = {"full": 90, "pending": 75, "discover": 95}
# The note a walk writes when the budget, not the cap, stopped it. Pinned
# byte-identical by test_ingest_health.py, whose streak check reads it.
BUDGET_NOTE = "stopped on its time budget"
# How far a gap of unissued serials the walk steps over before calling it the
# edge. Counted in serials, not spans: a span's width depends on the prefix
# count, so a limit in spans would shrink every time a prefix was added.
DISCOVERY_UNISSUED_SERIALS = 50
DISCOVERY_UNISSUED_STREAK = max(2, -(-DISCOVERY_UNISSUED_SERIALS // DISCOVERY_STEP))
DISCOVERY_MAX_DAYS_AHEAD = 21    # later day codes a span is re-asked under
FRONTIER_DOC = "discovery_frontier"


def _frontier_doc(db) -> tuple[str, int] | None:
    d = read_doc(db, FRONTIER_DOC)
    try:
        return (str(d["day_code"]), int(d["serial"])) if d else None
    except (ValueError, KeyError, TypeError):
        return None


def _frontier_from_rows(db, today: datetime.date) -> tuple[str, int] | None:
    """Newest (day_code, serial) among rows the SWEEP or the PROBER wrote,
    across every PERM office code, this year and last so January is not
    blind. Visitor-lookup rows are excluded on purpose: a visitor finding a
    case a week ahead of the walk must not make the walk skip the week."""
    best = None
    years = sorted({f"{today.year % 100:02d}", f"{(today.year - 1) % 100:02d}"})
    for prefix in PERM_OFFICE_PREFIXES:
        for yy in years:
            for (cn,) in query_rows(
                    db,
                    "SELECT case_number FROM perm_case_status "
                    "WHERE case_number >= ? AND case_number < ? AND source IN (?, ?) "
                    "ORDER BY case_number DESC LIMIT 50",
                    [f"{prefix}{yy}", f"{prefix}{int(yy) + 1:02d}", SOURCE, DISCOVERY_SOURCE]):
                code, serial = code_of(cn), serial_of(cn)
                if code is None or serial is None:
                    continue
                best = (code, serial) if best is None else newer(best, (code, serial))
    return best


def _write_frontier(db, code: str, serial: int, note: str) -> None:
    doc = {"day_code": code, "serial": serial,
           "shape": case_number("G-100-", code, serial),
           "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "note": note}
    write_doc(db, FRONTIER_DOC, json.dumps(doc))


def parse_frontier(text: str) -> tuple[str, int]:
    """'26240:200246' -> ('26240', 200246), for the --frontier override."""
    code, _, serial = text.partition(":")
    if len(code) != 5 or not code.isdigit() or not serial.isdigit():
        raise ValueError(f"frontier must be YYDDD:SERIAL, got {text!r}")
    return code, int(serial)


def _furthest(span_start: int, serials: list[int]) -> int:
    """The serial furthest along the ring from the span's first serial, so a
    span that wraps (999,995 .. 000004) picks 4, not 999,999."""
    return max(serials, key=lambda s: serial_gap(span_start, s))


def _insert_perm_hits(db, hits: list[dict], now_iso: str, stamp: int) -> int:
    inserted = 0
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
        # OR IGNORE reports 0 affected rows for an already-known case (the
        # web lookup may have found it first); count only genuine additions.
        affected = (res.get("response", {}).get("result", {})
                    .get("affected_row_count", 0))
        inserted += 1 if affected else 0
    return inserted


_OTHER_SCHEMA_READY = False


def _insert_other_hits(db, hits: list[dict]) -> int:
    """PWD and LCA hits go to their own tables through the PWD prober's
    inserter (program routing, slugs, status vocabularies live there).
    Imported lazily: that module imports THIS one at its top."""
    if not hits:
        return 0
    from ingest_pwd_status_direct import ensure_schema, insert_hits  # noqa: PLC0415
    # A program added later (H-2A and H-2B, say) has no table until
    # something creates it, and the walk can meet its first case before any
    # job that would. Once per process.
    global _OTHER_SCHEMA_READY
    if not _OTHER_SCHEMA_READY:
        ensure_schema(db)
        _OTHER_SCHEMA_READY = True
    return insert_hits(db, hits, DISCOVERY_SOURCE)


def run_discovery(db, *, lookup=None, today: datetime.date | None = None,
                  cap: int = DISCOVERY_REQUEST_CAP,
                  frontier_override: tuple[str, int] | None = None,
                  deadline: float | None = None, clock=time.monotonic) -> dict:
    """Walk the counter forward from the frontier; record what DOL confirms.

    Returns {requests, inserted, inserted_other, frontier_before,
    frontier_after, status, capped, note}. status is "ok" when the walk
    reached the edge of what DOL has issued AND when it stopped on its own
    request cap or time budget (`capped` tells those apart from reaching the
    edge, and the note names which one); "failed" only when DOL stopped
    answering. `deadline` is a `clock()` value; past it, no new request is
    made, and the frontier stays at the last confirmed hit.
    """
    lookup = lookup or lookup_with_retry
    today = today or datetime.date.today()
    today_code = day_code(today)
    start = frontier_override or _frontier_doc(db)
    if start is None:
        start = _frontier_from_rows(db, today)
        if start is None:
            log("discovery: no serial frontier found; skipping")
            return {"requests": 0, "inserted": 0, "inserted_other": 0,
                    "frontier_before": None, "frontier_after": None,
                    "status": "failed", "note": "no frontier"}
        _write_frontier(db, *start, note="initialised from the newest sweep/prober row")
    if frontier_override:
        _write_frontier(db, *start, note="set by --frontier")
    if start[0] > today_code:
        log(f"discovery: frontier day {start[0]} is after today {today_code}; refusing")
        return {"requests": 0, "inserted": 0, "inserted_other": 0,
                "frontier_before": start, "frontier_after": start,
                "status": "failed", "note": "frontier in the future"}

    code, serial = start
    # Two cursors: `code`/`serial` is the confirmed frontier and moves only on a
    # hit; `probe_code`/`probe_serial` is where the walk is looking and steps
    # over gaps. One shared variable would report wherever probing stopped as
    # the frontier, which is not a place DOL confirmed anything.
    probe_code, probe_serial = start
    log(f"discovery: frontier {code}:{fmt_serial(serial)}, walking toward {today_code} "
        f"({DISCOVERY_STEP} serials x {len(WALK_PREFIXES)} prefixes per request, cap {cap})")
    requests = inserted = inserted_other = 0
    unissued = 0
    stopped: str | None = None
    timed_out = False
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(time.time() * 1000)

    while requests < cap and unissued < DISCOVERY_UNISSUED_STREAK:
        span = serial_span(serial_add(probe_serial, 1), DISCOVERY_STEP)
        codes = day_codes_between(probe_code, today_code)[:DISCOVERY_MAX_DAYS_AHEAD + 1]
        claimed: list[dict] = []
        claimed_code: str | None = None
        # Busy prefixes under every later day code first, then the rare ones:
        # a span counts as unissued only when no prefix FLAG issues claims it.
        for prefixes in (WALK_PREFIXES, RARE_PREFIXES):
            for c in codes:
                if requests >= cap:
                    break
                if deadline is not None and clock() >= deadline:
                    timed_out = True
                    break
                asked = [case_number(pfx, c, s) for s in span for pfx in prefixes]
                try:
                    got = lookup(asked)
                except Exception as exc:  # noqa: BLE001
                    stopped = f"batch failed ({exc})"
                    break
                requests += 1
                time.sleep(PACE_S)
                wanted = set(asked)
                found = [v for v in got if v.get("caseNumber") in wanted]
                if found:
                    claimed, claimed_code = found, c
                    break
            if claimed or stopped or timed_out or requests >= cap:
                break
        if stopped or timed_out:
            break
        if not claimed:
            if requests >= cap:
                break
            # Step over the gap, or the next iteration would ask the same span
            # again. `serial` is the probe cursor only; the frontier doc is
            # written solely on a confirmed hit, below.
            probe_serial = serial_add(probe_serial, DISCOVERY_STEP)
            unissued += 1
            continue
        unissued = 0
        perm = [v for v in claimed if prefix_of(v["caseNumber"]) in PERM_OFFICE_PREFIXES]
        other = [v for v in claimed if prefix_of(v["caseNumber"]) not in PERM_OFFICE_PREFIXES]
        inserted += _insert_perm_hits(db, perm, now_iso, stamp)
        inserted_other += _insert_other_hits(db, other)
        top = _furthest(span[0], [serial_of(v["caseNumber"]) for v in claimed])
        code, serial = claimed_code, top
        probe_code, probe_serial = claimed_code, top
        _write_frontier(db, code, serial, note=f"{requests} requests this run")

    # `capped` is the walk stopping on its own budget with more serials to
    # ask about - the ordinary state while it catches up. Only DOL going away
    # is a failure.
    capped = not stopped and unissued < DISCOVERY_UNISSUED_STREAK
    status = "failed" if stopped else "ok"
    if stopped:
        note = stopped
    elif capped and timed_out:
        note = f"{BUDGET_NOTE} after {requests} requests and resumes from the frontier above"
    elif capped:
        note = f"{CAP_NOTE} ({cap}) and resumes from the frontier above"
    else:
        note = ""
    log(f"discovery: {requests} requests, {inserted} new PERM cases, "
        f"{inserted_other} new PWD/LCA cases; frontier {start[0]}:{fmt_serial(start[1])} -> "
        f"{code}:{fmt_serial(serial)}; {status}"
        + (f" ({note})" if note else ""))
    return {"requests": requests, "inserted": inserted, "inserted_other": inserted_other,
            "frontier_before": start, "frontier_after": (code, serial),
            "status": status, "capped": capped, "note": note}


def discover_and_record(db, **kw) -> dict:
    """run_discovery, plus its own ingest_runs row (requests, insertions and
    the frontier it moved to), so the health check can see a walk that finds
    nothing."""
    res = run_discovery(db, **kw)
    fb, fa = res["frontier_before"], res["frontier_after"]
    record_run(db, "ingest_case_status_direct.py --discover", status=res["status"],
               rows_written=res["inserted"] + res["inserted_other"],
               note=f"{res['inserted']} PERM + {res['inserted_other']} PWD/LCA in "
                    f"{res['requests']} requests; frontier "
                    f"{fb[0] + ':' + fmt_serial(fb[1]) if fb else 'none'} -> "
                    f"{fa[0] + ':' + fmt_serial(fa[1]) if fa else 'none'}"
                    + (f"; {res['note']}" if res['note'] else ""))
    return res


def log(m: str) -> None:
    print(m, flush=True)


def lookup_with_retry(nums: list[str], attempts: int = 4) -> list[dict]:
    """One batch, with backoff.

    A batch that fails is fifty cases skipped, and the caller only counts
    consecutive failures, so one blip mid-sweep would leave a hole nothing
    reports. The backoff is generous because the usual failure is DOL's
    published maintenance window, which hammering cannot get through.
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
    """One batch. curl, not urllib: this host answers python-urllib with 1010.

    The body goes in on stdin. It went through one fixed file, /tmp/_csd_batch.json,
    which two jobs running at once would overwrite under each other, and which
    another user's leftover copy made unwritable (Oct 3 2026).
    """
    r = subprocess.run(
        ["/usr/bin/curl", "-s", "-X", "POST", URL,
         "-H", "Content-Type: application/json",
         "-H", "Origin: https://flag.dol.gov",
         "-H", "Referer: https://flag.dol.gov/case-status-search",
         "-A", UA, "--data", "@-", "--max-time", "60", "-w", "\n%{http_code}"],
        input=json.dumps(nums), capture_output=True, text=True,
    )
    body, _, code = r.stdout.rpartition("\n")
    if code.strip() != "200":
        raise RuntimeError(f"HTTP {code.strip()}")
    return json.loads(body).get("value", [])


written = {"u": 0, "e": 0}


def flush(db, updates: list, events: list) -> None:
    """Write what we have, then clear it.

    Called mid-run, not only at the end, so a sweep that stops partway (DOL
    has published maintenance windows) keeps the work it already did.
    """
    run_stmts(db, [stmt(
        "UPDATE perm_case_status SET current_status=?, is_final=?, employer_name=?, "
        "job_title=?, source=?, fetched_at=? WHERE case_number=?", u) for u in updates])
    run_stmts(db, [stmt(
        "INSERT OR IGNORE INTO perm_case_events (case_number, changed_at, from_status, "
        "to_status, to_final, source) VALUES (?,?,?,?,?,?)", e) for e in events])
    written["u"] += len(updates)
    written["e"] += len(events)
    updates.clear()
    events.clear()


# The fixture row DOL leaves in its own data. Byte-identical to
# TEST_FIXTURE_EMPLOYER in src/lib/turso/rfi.ts (review-stages-doc.test.ts
# asserts it), so the doc and the page's fallback query count the same rows.
TEST_FIXTURE_EMPLOYER = "bah-test-company-name"

# Age today, from the filing date. Byte-identical to AGE_DAYS in
# src/lib/turso/rfi.ts.
_AGE_DAYS = """CASE
  WHEN filing_date IS NOT NULL AND filing_date <> ''
  THEN CAST(julianday('now') - julianday(filing_date) AS INTEGER)
END"""


def write_review_stages(db) -> None:
    """Precompute the pending review-stage census into perm_docs['review_stages'].

    The live query behind /perm-rfi-audit and its stage pages (a CTE over the
    whole pending population with three window functions) is far too slow to
    run on a page render, so it runs once per sweep and the pages read the doc.

    Raw numbers only. The editorial guards that decide whether an age band is
    honest enough to draw (MIN_BAND_N, n >= cases/2) stay in TypeScript beside
    their tests, so one rule doesn't live in two languages.

    The doc must reconcile or it isn't written: sum(stage.cases) must equal the
    pending total counted separately, because a partial census looks like a
    plausible smaller one.

    `seenFrom`/`seenTo` are the newest complete sweep's dates. Every pass
    covers the whole pending population, so each stage was checked in the
    same run and a per-stage range would repeat one date. Before the first
    complete sweep is recorded they are null, and the page states no
    "checked" date at all rather than one it can't prove.
    """
    stage_rows = query_rows(db, f"""
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
    write_doc(db, "review_stages", payload)
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["review_stages"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: review_stages read-back does not match write")
    # Its own freshness row, separate from the sweep's: the reconciliation
    # guard can skip this write while the sweep itself succeeds, and a doc that
    # quietly stopped being written must alarm before the reader's 8-day
    # cutoff sends the stage pages back to the slow query. Hence 3 days.
    stamp_freshness(db, "review-stages", source=SOURCE, cadence="Daily",
                    note=f"{len(stages)} stages, {pending_total:,} pending",
                    max_age_days=3)
    log(f"wrote     review_stages ({len(stages)} stages, "
        f"{pending_total:,} pending, {len(payload):,} bytes, "
        f"seen {seen_from or 'never'}..{seen_to or 'never'})")


QUEUE_STATUS = "ANALYST REVIEW"
HOLD_STATUS = "APPLICATION ON HOLD"
EMPLOYER_STAGES_MIN_PENDING = 5
EMPLOYER_STAGES_CAP = 1000
# Five or more of one employer's cases moved on one day is an action on the
# employer. DOL's case-level holds arrive one or two at a time, spread across
# filers and filing dates, so five separates the two with room on both sides.
EMPLOYER_MOVE_MIN = 5
EMPLOYER_MOVES_DAYS = 120
# A day of decisions is an employer-wide event when it is big in absolute
# terms AND against the employer's own queue. Ten is under what one analyst
# decides in a day, so a busy filer's ordinary flow (dozens a day out of
# thousands pending) never reaches 5% of its queue; a batch does.
DECISION_STATUSES = ("CERTIFIED", "DENIED", "WITHDRAWN")
DECISION_MOVE_MIN = 10
DECISION_MOVE_SHARE = 0.05
DECISION_MOVES_DAYS = 60
# ...and it must stand out against the employer's own pace: a large filer's
# ordinary flow can pass both rules above every day. Three times its average
# day over the window (zero days included) keeps only the batches.
DECISION_MOVE_PACE = 3.0


def _norm_name(name) -> str:
    return " ".join(str(name or "").lower().split())


def employer_stage_rows(rows, floor: int = EMPLOYER_STAGES_MIN_PENDING,
                        cap: int | None = EMPLOYER_STAGES_CAP) -> list[dict]:
    """Fold (employer_name, employer_slug, status, n) rows into one row per employer.

    Pure, so the test can drive it with a handful of tuples. An employer is
    keyed by slug when the nightly rebuild resolved one and by name otherwise,
    which is the same identity the stage pages link with. `review` is every
    pending case at a status other than analyst review: on hold, RFI, NORD,
    supervised recruitment, or an appeal - the cases DOL pulled aside rather
    than the ordinary queue. `share` is review / pending, and the page only
    ranks by share above a floor, because 2 of 2 is not a signal.

    A name-keyed row folds into the slug row that carries the same spelling.
    The query takes the slug from either case table (an appeal is a decided
    case, so it lives in `perm_cases`); this fold catches what is left, a case
    discovered since the nightly rebuild, so one employer never splits across
    two rows. Each row keeps its spellings in `_names` for `annotate_holds`;
    `strip_private` removes them before the doc is written.
    """
    by_key: dict[str, dict] = {}
    for employer_name, employer_slug, status, n in rows:
        name = (employer_name or "").strip()
        if not name:
            continue
        key = employer_slug or f"name:{_norm_name(name)}"
        row = by_key.get(key)
        if row is None:
            row = {"name": name, "slug": employer_slug, "pending": 0,
                   "review": 0, "byStatus": {}, "_names": set()}
            by_key[key] = row
        row["_names"].add(_norm_name(name))
        n = int(n or 0)
        row["pending"] += n
        if status != QUEUE_STATUS:
            row["review"] += n
        row["byStatus"][status] = row["byStatus"].get(status, 0) + n
    by_name: dict[str, dict] = {}
    for row in by_key.values():
        if row["slug"]:
            for nm in row["_names"]:
                by_name.setdefault(nm, row)
    for key in [k for k in by_key if k.startswith("name:")]:
        target = by_name.get(key[len("name:"):])
        if target is None:
            continue
        src = by_key.pop(key)
        target["pending"] += src["pending"]
        target["review"] += src["review"]
        for st, n in src["byStatus"].items():
            target["byStatus"][st] = target["byStatus"].get(st, 0) + n
        target["_names"] |= src["_names"]
    out = [r for r in by_key.values() if r["pending"] >= floor]
    for r in out:
        r["share"] = round(r["review"] / r["pending"], 4) if r["pending"] else 0.0
    out.sort(key=lambda r: (-r["review"], -r["pending"], r["name"].lower()))
    return out if cap is None else out[:cap]


def _row_index(employers: list[dict]) -> tuple[dict, dict]:
    by_slug = {r["slug"]: r for r in employers if r.get("slug")}
    by_name: dict[str, dict] = {}
    for r in employers:
        for nm in r.get("_names") or {_norm_name(r["name"])}:
            by_name.setdefault(nm, r)
    return by_slug, by_name


def _resolve(index: tuple[dict, dict], name, slug) -> dict | None:
    by_slug, by_name = index
    if slug and slug in by_slug:
        return by_slug[slug]
    return by_name.get(_norm_name(name))


def annotate_holds(employers: list[dict], held, log_from: str | None = None) -> None:
    """Date each employer's current hold from the event log, in place.

    `held` is (employer_name, slug, entered, first_seen) for every case at the
    hold today: `entered` is the Eastern date of its LAST move into the hold,
    or None when the log never saw it enter; `first_seen` is the Eastern date
    this site first recorded the case (`fetched_at`, which moves only when the
    status does, so for an undated hold it IS the first record).

    An undated hold is two different facts. A case held when the log began is
    held "since before the record began"; a case first recorded already held,
    after the log began, is not. `holdBeforeLog` counts only the cases first
    recorded on or before `log_from`; the rest of `holdUndated` were already
    held when first recorded. A case held, released and held again is dated by
    its latest entry, because that is the hold it is in.

    An employer's hold is dated by the entry day most of its held cases share
    (ties go to the later day), with the count on that day beside it, and the
    undated cases are counted apart: "held since Sep 24" and "held since before
    the record began" are different statements and one must never stand in
    for the other. Only employers with a held case get the keys.
    """
    index = _row_index(employers)
    groups: dict[int, tuple[dict, list]] = {}
    for name, slug, entered, first_seen in held:
        row = _resolve(index, name, slug)
        if row is None:
            continue
        groups.setdefault(id(row), (row, []))[1].append((entered, first_seen))
    for row, cases in groups.values():
        dated = [e for e, _ in cases if e]
        row["holdUndated"] = len(cases) - len(dated)
        row["holdBeforeLog"] = sum(1 for e, f in cases
                                   if not e and log_from and f and f <= log_from)
        if dated:
            counts: dict[str, int] = {}
            for d in dated:
                counts[d] = counts.get(d, 0) + 1
            day, n = max(counts.items(), key=lambda kv: (kv[1], kv[0]))
            row["holdSince"], row["holdSinceCases"] = day, n
        else:
            row["holdSince"], row["holdSinceCases"] = None, 0


def hold_moves(events, today: datetime.date, employers: list[dict] | None = None,
               days: int = EMPLOYER_MOVES_DAYS,
               minimum: int = EMPLOYER_MOVE_MIN) -> list[dict]:
    """The days DOL moved one employer's cases into or out of hold, in bulk.

    `events` is (employer_name, slug, et_date, direction, to_status) per case
    move, direction "on" or "off". A group is one employer, one day, one
    direction (and for a release, one destination, so "back to analyst
    review" and "certified" never merge). Groups under `minimum` are case-level
    and dropped; the feed is for actions taken on an employer. Newest first.
    """
    index = _row_index(employers or [])
    cutoff = (today - datetime.timedelta(days=days)).isoformat()
    groups: dict[tuple, dict] = {}
    for name, slug, date, direction, to_status in events:
        if not date or date < cutoff:
            continue
        row = _resolve(index, name, slug)
        who = (row["slug"] or f"name:{_norm_name(row['name'])}") if row else (
            slug or f"name:{_norm_name(name)}")
        to = to_status if direction == "off" else HOLD_STATUS
        g = groups.setdefault((who, date, direction, to), {
            "date": date,
            "name": row["name"] if row else str(name or "").strip(),
            "slug": row["slug"] if row else slug,
            "dir": direction, "to": to, "n": 0})
        g["n"] += 1
    out = [g for g in groups.values() if g["n"] >= minimum and g["name"]]
    out.sort(key=lambda g: (g["date"], g["n"]), reverse=True)
    return out


def decision_moves(events, today: datetime.date, employers: list[dict] | None = None,
                   log_from: str | None = None,
                   days: int = DECISION_MOVES_DAYS,
                   minimum: int = DECISION_MOVE_MIN,
                   share: float = DECISION_MOVE_SHARE,
                   pace: float = DECISION_MOVE_PACE) -> list[dict]:
    """The days one employer's cases were decided in bulk, for the follow alerts.

    `events` is (employer_name, slug, et_date, to_status) per case reaching a
    decision. A group is one employer, one day, one outcome, so a batch of
    certifications and a batch of withdrawals never merge: DOL certifies and
    denies, the EMPLOYER withdraws, and the copy downstream names who acted.

    A group counts when it holds at least `minimum` cases AND at least `share`
    of the employer's queue as it stood that morning (pending now plus the
    group). Pending comes from `employers`, which here is every employer with
    a pending case, not the floored census; an employer whose whole queue was
    decided has no row and 0 pending, so its batch always counts. And it must
    reach `pace` times the employer's average day for that outcome across the
    window, counted from the later of the cutoff and `log_from` (the first day
    the record holds), zero days included: a big filer decided every weekday
    is its queue moving, not an event. The date is the day this site recorded
    the decision, which the copy says.
    """
    index = _row_index(employers or [])
    cutoff = (today - datetime.timedelta(days=days)).isoformat()
    start = max(cutoff, log_from or cutoff)
    window_days = max(1, (today - datetime.date.fromisoformat(start)).days + 1)
    totals: dict[tuple, int] = {}
    groups: dict[tuple, dict] = {}
    for name, slug, date, to_status in events:
        if not date or date < cutoff or to_status not in DECISION_STATUSES:
            continue
        row = _resolve(index, name, slug)
        who = (row["slug"] or f"name:{_norm_name(row['name'])}") if row else (
            slug or f"name:{_norm_name(name)}")
        g = groups.setdefault((who, date, to_status), {
            "date": date,
            "name": row["name"] if row else str(name or "").strip(),
            "slug": row["slug"] if row else slug,
            "to": to_status, "n": 0,
            "_pending": row["pending"] if row else 0, "_who": (who, to_status)})
        g["n"] += 1
        totals[(who, to_status)] = totals.get((who, to_status), 0) + 1
    out = [g for g in groups.values()
           if g["name"] and g["n"] >= minimum
           and g["n"] >= share * (g["_pending"] + g["n"])
           and g["n"] >= pace * totals[g["_who"]] / window_days]
    out.sort(key=lambda g: (g["date"], g["n"]), reverse=True)
    return strip_private(out)


def strip_private(employers: list[dict]) -> list[dict]:
    return [{k: v for k, v in r.items() if not k.startswith("_")} for r in employers]


def _slug_join(case_col: str = "c.case_number") -> str:
    """Resolve a case's employer slug from whichever table holds the case.

    Pending cases are in `perm_live_recent`; appeals of decided cases are in
    `perm_cases`. Both carry the canonical slug the employer pages use.
    """
    return (f"LEFT JOIN perm_live_recent l ON l.case_number = {case_col} "
            f"LEFT JOIN perm_cases p ON p.case_number = {case_col}")


def hold_history(db, employers: list[dict], today: datetime.date) -> dict:
    """Read the hold and decision moves out of the event log; date the current holds.

    Five bounded reads: moves into the hold (`case_events_status_time`), moves
    out of it (`case_events_from_time`), the employer of every case involved
    (primary key, in chunks), the cases held today (`case_status_stage`), and
    the last `DECISION_MOVES_DAYS` of decisions with their employers (one
    join driven by `case_events_status_time`). `employers` is EVERY employer
    with a pending case, so a name resolves to its slug and a batch is judged
    against the employer's real queue; annotating those rows in place also
    annotates the floored census, which holds the same dicts.
    Only DOL-direct events count; the older rows from another source describe
    changes of unknown date.
    """
    ins = query_rows(db, "SELECT case_number, changed_at FROM perm_case_events "
                    "WHERE to_status = ? AND source = ?", [HOLD_STATUS, SOURCE])
    outs = query_rows(db, "SELECT case_number, changed_at, to_status FROM perm_case_events "
                     "WHERE from_status = ? AND source = ?", [HOLD_STATUS, SOURCE])
    held = query_rows(db, f"""
        SELECT c.case_number, c.employer_name, COALESCE(l.employer_slug, p.employer_slug),
               c.fetched_at
          FROM perm_case_status c {_slug_join()}
         WHERE c.is_final = 0 AND c.current_status = ? AND c.employer_name IS NOT ?""",
                 [HOLD_STATUS, TEST_FIXTURE_EMPLOYER])
    meta = {cn: (name, slug) for cn, name, slug, _ in held}
    need = sorted(({r[0] for r in ins} | {r[0] for r in outs}) - set(meta))
    for i in range(0, len(need), 400):
        chunk = need[i:i + 400]
        for cn, name, slug in query_rows(db, f"""
                SELECT c.case_number, c.employer_name,
                       COALESCE(l.employer_slug, p.employer_slug)
                  FROM perm_case_status c {_slug_join()}
                 WHERE c.case_number IN ({",".join("?" * len(chunk))})""", chunk):
            meta[cn] = (name, slug)

    first = query_rows(db, "SELECT changed_at FROM perm_case_events WHERE source = ? "
                      "ORDER BY changed_at LIMIT 1", [SOURCE])
    log_from = et_date(first[0][0]) if first else None
    last_in: dict[str, int] = {}
    for cn, at in ins:
        last_in[cn] = max(last_in.get(cn, 0), int(at))
    annotate_holds(employers, [
        (name, slug, et_date(last_in[cn]) if cn in last_in else None,
         et_date(seen) if seen else None)
        for cn, name, slug, seen in held], log_from)

    events = [(*meta.get(cn, (None, None)), et_date(at), "on", HOLD_STATUS)
              for cn, at in ins]
    events += [(*meta.get(cn, (None, None)), et_date(at), "off", to)
               for cn, at, to in outs]
    since_ms = int((time.time() - (DECISION_MOVES_DAYS + 1) * 86400) * 1000)
    decided = query_rows(db, f"""
        SELECT c.employer_name, COALESCE(l.employer_slug, p.employer_slug),
               e.changed_at, e.to_status
          FROM perm_case_events e
          JOIN perm_case_status c ON c.case_number = e.case_number
          {_slug_join("e.case_number")}
         WHERE e.to_status IN ({",".join("?" * len(DECISION_STATUSES))})
           AND e.changed_at >= ? AND e.source = ?
           AND c.employer_name IS NOT ?""",
        [*DECISION_STATUSES, since_ms, SOURCE, TEST_FIXTURE_EMPLOYER])
    return {"logFrom": log_from,
            "holdMoves": hold_moves(events, today, employers),
            "decisionMoves": decision_moves(
                [(name, slug, et_date(at), to) for name, slug, at, to in decided],
                today, employers, log_from)}


def write_employer_stages(db) -> None:
    """Precompute per-employer pending counts by status into perm_docs['employer_stages'].

    Answers "which employers have cases pulled aside" without a page render
    grouping the whole pending table: once a sweep, it is one doc read. Raw
    counts only; the floor and the ranking rules live in TypeScript beside
    their tests.
    """
    rows = query_rows(db, f"""
        SELECT c.employer_name, COALESCE(l.employer_slug, p.employer_slug) AS slug,
               c.current_status, COUNT(*) AS n
          FROM perm_case_status c {_slug_join()}
         WHERE c.is_final = 0 AND c.employer_name IS NOT ?
         GROUP BY c.employer_name, slug, c.current_status""",
        [TEST_FIXTURE_EMPLOYER])
    nationwide: dict[str, int] = {}
    for _name, _slug, status, n in rows:
        nationwide[str(status)] = nationwide.get(str(status), 0) + int(n or 0)
    pending_total = int(db.scalar(
        "SELECT COUNT(*) FROM perm_case_status "
        "WHERE is_final = 0 AND employer_name IS NOT ?",
        [TEST_FIXTURE_EMPLOYER]) or 0)
    if sum(nationwide.values()) != pending_total:
        log(f"NOT writing employer_stages: statuses {sum(nationwide.values()):,} "
            f"!= pending {pending_total:,} (a concurrent write landed mid-run)")
        return
    everyone = employer_stage_rows(rows, floor=1, cap=None)
    employers = [r for r in everyone
                 if r["pending"] >= EMPLOYER_STAGES_MIN_PENDING][:EMPLOYER_STAGES_CAP]
    today = datetime.datetime.now(ET).date()
    # The dates are context, never a reason to withhold the counts: a failure
    # here writes the doc without them, the page hides the dated parts, and
    # the next pass tries again.
    try:
        history = hold_history(db, everyone, today)
    except Exception as e:  # noqa: BLE001 - logged and named, never silent
        log(f"employer_stages: hold history FAILED ({type(e).__name__}: {e}); "
            "writing the counts without dates")
        history = {}
    doc = {"asOf": today.isoformat(), "source": SOURCE,
           "pendingTotal": pending_total, "nationwide": nationwide,
           "minPending": EMPLOYER_STAGES_MIN_PENDING,
           "employers": strip_private(employers), **history}
    payload = json.dumps(doc, separators=(",", ":"))
    write_doc(db, "employer_stages", payload)
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["employer_stages"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: employer_stages read-back does not match write")
    log(f"wrote     employer_stages ({len(employers)} employers with >= "
        f"{EMPLOYER_STAGES_MIN_PENDING} pending, "
        f"{len(history.get('holdMoves') or [])} employer-wide hold moves, "
        f"{len(history.get('decisionMoves') or [])} decision batches, "
        f"{len(payload):,} bytes)")


def write_sweep_coverage(db) -> None:
    """Project the newest complete sweep into perm_docs['sweep_coverage'].

    `sweep_runs` is the append-only record; this is its current value, which
    the case page reads (src/lib/turso/sweepCoverage.ts) to say when a pending
    case was last checked against DOL. Derived from `last_complete_sweep`, never
    from this run's own variables, so a partial run leaves the previous
    complete run's dates standing: the last date every pending case was seen.
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
    write_doc(db, "sweep_coverage", payload)
    log(f"wrote     sweep_coverage ({doc['mode']} sweep of "
        f"{doc['asked']:,} cases, finished {doc['finishedOn']})")


def write_stage_cohorts(db) -> None:
    """Precompute the filing-month x status matrix into perm_docs['stage_cohorts'].

    Grouping every case by filing month is a full scan (no index serves the
    month expression), far too slow for a page render, so it runs here once a
    sweep.

    Not folded from live_census: that counts every row, while every reader in
    rfi.ts excludes DOL's own test-fixture employer, and two surfaces must not
    disagree about one cohort. The whole matrix is stored, decided cases
    included, because `filed` is its own denominator and each stage page
    filters to the statuses it wants.

    The doc must reconcile or it isn't written: sum(n) must equal a separately
    counted total over the same predicate.
    """
    rows = query_rows(db, """
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
    write_doc(db, "stage_cohorts", payload)
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["stage_cohorts"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: stage_cohorts read-back does not match write")
    # Its own freshness row, for the same reason review_stages has one.
    stamp_freshness(db, "stage-cohorts", source=SOURCE, cadence="Daily",
                    note=f"{len(matrix)} month/status pairs, {total:,} cases",
                    max_age_days=3)
    log(f"wrote     stage_cohorts ({len(matrix)} pairs, {total:,} cases, "
        f"{len(payload):,} bytes)")


def write_stage_stats(db) -> None:
    """Precompute what each review stage looks like right now.

    Measured from the live table every sweep, rather than typed into the code,
    so the ages can't drift. What stays in code is the percentile each stage
    maps to (an RFI sits in the slow tail of its month; an appeal is a separate
    proceeding with no percentile at all): that is a judgement about what a
    stage means, not a measurement.

    The exit mix is here too: most RFI exits return to analyst review rather
    than to a decision, so an RFI is a detour back into the ordinary queue, not
    an endpoint.

    Ages are pending-only and measured from the filing date, so they say how
    long cases at a stage have already waited, never how much longer they
    have: that needs exit timing the event log is still too young to supply.
    """
    ages = query_rows(db, """
        SELECT current_status AS s, COUNT(*) AS n,
               CAST(AVG(julianday('now') - julianday(filing_date)) AS INT) AS mean_age
          FROM perm_case_status
         WHERE is_final IN (0, '0') AND filing_date IS NOT NULL AND filing_date <> ''
         GROUP BY s HAVING n >= 5""")

    # Where a stage's cases go when they leave it. Left-truncated - the event
    # log opens 2026-08-26 and cannot see an entry before that - so this is
    # honest about DESTINATIONS and says nothing about how long the stage runs.
    exits = query_rows(db, """
        SELECT from_status AS f, to_status AS t, COUNT(*) AS n
          FROM perm_case_events
         WHERE from_status IS NOT NULL AND to_status IS NOT NULL
           AND from_status <> to_status
         GROUP BY f, t HAVING n >= 3""")

    # How long a stage lasts, as a survival curve rather than an average.
    #
    # Only cases watched ENTERING a stage can be timed: pairing an exit we saw
    # with an entry we didn't would time a fragment. And a median of the exits
    # seen so far is wrong while the log is young, because only short stays can
    # have finished yet. So for each candidate duration d, only entrants old
    # enough to have reached d are counted, and the question is how many of
    # those had left by then. That handles the censoring and can never report a
    # median longer than the window; the reader picks the median off the curve,
    # so a stage starts reporting the day its own data crosses the line.
    pairs = query_rows(db, """
        WITH ins AS (
            SELECT case_number, to_status AS stage, MIN(changed_at) AS t0
              FROM perm_case_events
             WHERE to_status IS NOT NULL AND to_final IN (0, '0')
             GROUP BY case_number, to_status),
             outs AS (
            SELECT e.case_number, e.from_status AS stage, MIN(e.changed_at) AS t1
              FROM perm_case_events e
              JOIN ins i ON i.case_number = e.case_number AND i.stage = e.from_status
             WHERE e.changed_at > i.t0
             GROUP BY e.case_number, e.from_status)
        SELECT ins.stage AS stage,
               CAST((? - ins.t0) / 86400000 AS INT) AS observed_for,
               CASE WHEN outs.t1 IS NOT NULL
                    THEN CAST((outs.t1 - ins.t0) / 86400000 AS INT) END AS lasted
          FROM ins LEFT JOIN outs
            ON outs.case_number = ins.case_number AND outs.stage = ins.stage""",
        [int(time.time() * 1000)])

    by_stage: dict[str, list[tuple[int, int | None]]] = {}
    for stage, observed_for, lasted in pairs:
        by_stage.setdefault(str(stage), []).append(
            (int(observed_for or 0), None if lasted is None else int(lasted)))

    dur = []
    for stage, rows_ in by_stage.items():
        if len(rows_) < 30:
            continue
        horizon = max(o for o, _ in rows_)
        curve = []
        for d in range(1, horizon + 1):
            eligible = [(o, l) for o, l in rows_ if o >= d]
            if len(eligible) < 30:
                continue
            done = sum(1 for _, l in eligible if l is not None and l <= d)
            curve.append({"days": d, "eligible": len(eligible), "left": done})
        if curve:
            dur.append({"stage": stage, "entered": len(rows_),
                        "observedDays": horizon, "curve": curve})

    stages = [{"status": str(s), "pending": int(n), "meanAgeDays": int(a or 0)}

              for s, n, a in ages]
    moves = [{"from": str(f), "to": str(t), "n": int(n)} for f, t, n in exits]
    if not stages:
        log("NOT writing stage_stats: no pending stages returned")
        return

    doc = {"asOf": time.strftime("%Y-%m-%d"), "source": SOURCE,
           "stages": sorted(stages, key=lambda r: -r["pending"]),
           "exits": sorted(moves, key=lambda r: -r["n"]),
           "durations": sorted(dur, key=lambda r: -r["entered"])}
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    write_doc(db, "stage_stats", payload)
    def _median(d):
        for pt in d["curve"]:
            if pt["left"] / pt["eligible"] >= 0.5:
                return pt["days"]
        return None
    ready = [f'{d["stage"]}~{_median(d)}d' for d in dur if _median(d) is not None]
    log(f"  stage_stats: {len(stages)} stages, {len(moves)} transitions, "
        f"{len(dur)} timed; median reportable for {ready or 'none yet'}")


def write_live_census(db) -> None:
    """Precompute the live census into perm_docs['live_census'].

    The case-status page renders on request, and aggregating every case for
    each lookup is far too many rows read per visit; two group-bys here, twice
    a day, become one doc read.

    The doc must reconcile or it isn't written: sum(matrix) + noFilingDate ==
    totalCases is asserted before the write, and the reader re-checks it and
    treats a mismatch as no census at all.
    """
    matrix_rows = query_rows(db, """
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
    write_doc(db, "live_census", payload)
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?",
                    ["live_census"])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: live_census read-back does not match write")
    log(f"wrote     live_census ({len(matrix):,} matrix rows, "
        f"{len(payload):,} bytes)")


def write_decided_percentiles(db) -> None:
    """Per received-month decision-day percentiles from the decided corpus.

    Replaces a per-lookup window-function scan of perm_cases. The corpus only
    changes at disclosure loads, but recomputing it with each sweep is cheap
    and means the doc can never lag a load.
    """
    raw = query_rows(db, """
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
    write_doc(db, "decided_month_percentiles", payload)
    log(f"wrote     decided_month_percentiles ({len(months)} months)")


def observed_day(changed_at: int) -> str:
    """The UTC calendar day a `perm_case_events.changed_at` falls in.

    UTC because the reader buckets the same rows by UTC midnight
    (src/lib/turso/changes.ts `dayBounds`); a local-time fold here would move
    evening rows onto the previous day and the two surfaces would disagree.
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

    Four rules, two of them about withholding rather than filtering:

    1. Expiry is not a decision. `CERTIFIED -> CERTIFIED - EXPIRED` is an I-140
       window lapsing; the SQL excludes it as a status pair, as changes.ts does.
    2. A bulk write is not a day's work. A timestamp carrying more than
       `BULK_WRITE_ROWS` rows is a sweep catching up on history; it is dropped.
    3. A day touched by rule 2 is withheld entirely, not published with what
       survives: the dropped stamp may have carried that day's real decisions
       too, and a plausible small number would draw a collapse in DOL's output
       that never happened. A hole is visible; a wrong point is not.
    4. The current day is withheld, because the sweep runs inside it and its
       count is incomplete.

    A day with no observation is absent, not zero. Only days carrying a
    surviving timestamp are eligible; a day the sweep ran and saw nothing
    decided is a real zero and is published as one.
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
        # A day is measurable when our own sweep ran on it, not merely when some
        # row exists: rows from another source on a day the sweep didn't run
        # would publish a false zero. Rows on a day the sweep did run still
        # count, so the chart and the feed agree about every day both publish.
        if ts not in bulk and src == sweep_source:
            days.setdefault(observed_day(ts),
                            {"certified": 0, "denied": 0, "withdrawn": 0})

    for ts, status, n in decisions:
        if ts in bulk:
            continue
        key = status.upper()
        if key not in DECISION_BUCKETS:
            # A final status nobody decided where to file. Raising is right:
            # run_independently prints it as a ::error:: annotation and the other
            # doc writers still run, where dropping it would under-count forever.
            # RuntimeError, not SystemExit: run_independently catches Exception,
            # and a SystemExit would kill the process before `record_run`
            # writes the row the health check reads.
            raise RuntimeError(
                f"{status!r} is final but has no column in DECISION_BUCKETS; "
                f"add it rather than losing its decisions")
        day = observed_day(ts)
        if day not in days:
            # A decision on a day our sweep never ran (only rows from another
            # source can land there). Counting it would publish a day nobody swept.
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

    `dol-disclosure` stops at the last published quarter, and DOL's live
    endpoint publishes no decision date, but the sweep records every
    transition it sees, and when we SAW a case decided is a real measurement as
    long as it is labelled as one (see the comment beside `OBSERVED_SOURCE`).

    A decision is a transition into `FINAL_STATUSES`, the same constant the
    sweep classifies `is_final` with. Moves between review stages are events in
    the activity feed, not decisions, and don't belong beside a source that
    counts certifications, denials and withdrawals.

    Two grouped scans of `perm_case_events` per run, the second served by
    `case_events_status_time (to_status, changed_at)`.
    """
    stamp_totals = [
        (int(ts), str(src), int(n)) for ts, src, n in query_rows(
            db, "SELECT changed_at, source, COUNT(*) FROM perm_case_events "
                "GROUP BY changed_at, source")]
    finals = sorted(FINAL_STATUSES)
    decisions = [
        (int(ts), str(s), int(n)) for ts, s, n in query_rows(
            db,
            "SELECT changed_at, to_status, COUNT(*) FROM perm_case_events "
            f"WHERE to_status IN ({','.join('?' * len(finals))}) "
            "  AND NOT (from_status = ? AND to_status = ?) "
            "GROUP BY changed_at, to_status",
            [*finals, EXPIRY_FROM, EXPIRY_TO])]

    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    days, withheld = fold_observed_decisions(stamp_totals, decisions, today)

    if not days:
        # An empty computation must never wipe a good series: every path below
        # deletes what it did not just write, so a run that found nothing (or
        # failed to read the events) would empty the table and log success.
        log(f"NOT writing {OBSERVED_SOURCE}: no publishable day "
            f"({len(withheld)} withheld, {len(stamp_totals)} sweep timestamps)")
        return

    db.execute("""CREATE TABLE IF NOT EXISTS daily_decisions (
        date TEXT NOT NULL, source TEXT NOT NULL,
        total INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
        fetched_at INTEGER NOT NULL, PRIMARY KEY (date, source))""")
    stamp = int(time.time() * 1000)
    dates = sorted(days)
    # Upsert first, delete second, so a reader never sees the series briefly
    # empty. `INSERT OR REPLACE` is keyed on (date, source), so a re-sent
    # pipeline is a no-op. Not diffed like `perm_live_recent`: this is one row
    # per day, so rewriting it whole stays cheap and is always self-healing.
    db.pipeline([stmt(
        "INSERT OR REPLACE INTO daily_decisions "
        "(date, source, total, certified, denied, withdrawn, fetched_at) VALUES (?,?,?,?,?,?,?)",
        [d, OBSERVED_SOURCE, days[d]["total"], days[d]["certified"], days[d]["denied"],
         days[d]["withdrawn"], stamp]) for d in dates] + [{"type": "close"}])
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
    write_doc(db, "observed_decisions", doc, stamp)
    # The withheld days are recorded so the page can say why a day is missing,
    # rather than leave a reader to assume DOL stopped working.

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
    """Did this run cover its whole population? `write_review_stages` dates a
    published census on this claim, so it is a named, tested function.

    Every term is a coverage failure that yields a plausible partial result
    rather than an error:

      limit / offset   the todo list was a slice by construction
      truncated        three consecutive far-end failures stopped the loop
      failed_batches   a batch exhausted its retries and was skipped: a hole of
                       up to 50 cases, with no exception and no missing output
    """
    return not limit and not offset and not truncated and failed_batches == 0


def tail_steps(db, *, discover: bool, cap: int = DISCOVERY_REQUEST_CAP,
               deadline: float | None = None,
               housekeeping: bool = False) -> list[tuple[str, object]]:
    """The precomputed docs written after a sweep, as independent steps.

    Each doc is useful on its own and each has a reader fallback, so one
    failing is logged loudly and the rest still run. Order matters and
    `run_independently` keeps it: discovery before the census, or the census
    misses the day's new filings; `write_sweep_coverage` before
    `write_review_stages`, which reads that row back.
    """
    steps: list[tuple[str, object]] = []
    if discover:
        steps.append(("discovery",
                      lambda: discover_and_record(db, cap=cap, deadline=deadline)))
    steps += [
        ("live_census", lambda: write_live_census(db)),
        # After live_census, before the event-log readers below: it wants both
        # the current statuses and whatever transitions this run recorded.
        ("stage_stats", lambda: write_stage_stats(db)),
        ("sweep_coverage", lambda: write_sweep_coverage(db)),
        ("review_stages", lambda: write_review_stages(db)),
        ("employer_stages", lambda: write_employer_stages(db)),
        ("stage_cohorts", lambda: write_stage_cohorts(db)),
        ("decided_month_percentiles", lambda: write_decided_percentiles(db)),
        # Last: it reads the `perm_case_events` that `flush()` wrote, and as the
        # only public series here, a failure leaves yesterday's series live
        # rather than half of one.
        ("observed_decisions", lambda: write_observed_decisions(db)),
    ]
    if housekeeping:
        # Once a night (the full pass), after every reader above has run:
        # retention for the tables nothing reads past a known horizon
        # (lib_housekeeping.py says which, and why each horizon is safe).
        steps.append(("housekeeping", lambda: log(
            "housekeeping: deleted " + ", ".join(
                f"{k} {v:,}" for k, v in prune_old_rows(
                    db, datetime.datetime.now(datetime.timezone.utc).date()).items()))))
    return steps


def main() -> int:
    t0 = time.monotonic()          # the discovery budget counts from here
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
    ap.add_argument("--discover-cap", type=int, default=DISCOVERY_REQUEST_CAP,
                    help="Discovery request cap for this run (default %(default)s). "
                         "Raise it to catch up a gap in one run.")
    ap.add_argument("--frontier", type=parse_frontier, default=None,
                    help="Reset the walk cursor to YYDDD:SERIAL before walking, e.g. "
                         "26240:200246. Persisted; use to recover a gap the doc has skipped.")
    ap.add_argument(
        "--discover", action="store_true",
        help="Only probe past the serial frontier for new filings, record "
             "them, refresh the census, and exit. Both the --full and the "
             "--pending sweep also walk on their own, under a time budget.")
    ap.add_argument(
        "--reconcile", action="store_true",
        help="Correct statuses but write NO events, for a pass against stale data.",
    )
    args = ap.parse_args()

    db = Turso()

    if args.discover and not (args.full or args.pending):
        res = run_discovery(db, cap=args.discover_cap, frontier_override=args.frontier,
                            deadline=t0 + DISCOVERY_BUDGET_MIN["discover"] * 60)
        failed: list[tuple[str, str]] = []
        if res["inserted"]:
            failed = run_independently(tail_steps(db, discover=False))
            log("census refreshed" if not failed
                else f"census refreshed; {len(failed)} doc write(s) failed")
        # A run that found nothing still records itself: the frontier not
        # moving is exactly the signal check_ingest_health.py has to see.
        status = res["status"] if not failed else "partial"
        fb, fa = res["frontier_before"], res["frontier_after"]
        record_run(db, "ingest_case_status_direct.py --discover", status=status,
                   rows_written=res["inserted"] + res["inserted_other"],
                   note=f"discovery only: {res['inserted']} PERM + {res['inserted_other']} PWD/LCA "
                        f"in {res['requests']} requests; frontier "
                        f"{fb[0] + ':' + fmt_serial(fb[1]) if fb else 'none'} -> "
                        f"{fa[0] + ':' + fmt_serial(fa[1]) if fa else 'none'}"
                        + (f"; {res['note']}" if res['note'] else "")
                        + (f"; failed: {', '.join(k for k, _ in failed)}" if failed else ""))
        return 0 if status != "failed" else 1

    # Reads of "cases that entered a status since a date" lead on to_status, so
    # they stay bounded to that status's rows instead of a growing time scan.
    db.execute("""CREATE INDEX IF NOT EXISTS case_events_status_time
        ON perm_case_events (to_status, changed_at)""")
    # The same, for moves OUT of a status: the employer census dates releases
    # from hold with it, including cases held before the log began, which have
    # no entry event to find them by.
    db.execute("""CREATE INDEX IF NOT EXISTS case_events_from_time
        ON perm_case_events (from_status, changed_at)""")

    # The stage pages list the cases at one status, oldest filing first.
    # Leading on current_status bounds the read to that stage (the other
    # indexes would read every pending row), and filing_date last makes the
    # ordering free.
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
    rows = {r[0]: r[1:] for r in query_rows(db, sql)}
    todo = sorted(rows)
    log(f"{len(todo):,} cases to check, {BATCH} per request "
        f"= {(len(todo)+BATCH-1)//BATCH:,} requests\n")

    checked = moved = missing = 0
    # Coverage bookkeeping, for the sweep record written at the end.
    #   asked          case numbers actually put to DOL (failed batches never got there)
    #   requests       HTTP batches attempted
    #   failed_batches batches that exhausted their retries: each is a hole of
    #                  up to 50 cases, so the run hasn't covered its population
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
            # The breakdown DOL answered with, over every case asked about, not
            # only the ones that moved, so an all-quiet sweep and one that never
            # ran look different.
            status_counts[new_status or "(blank)"] = (
                status_counts.get(new_status or "(blank)", 0) + 1)
            if new_status and new_status != old_status:
                moved += 1
                is_final = 1 if new_status.upper() in FINAL_STATUSES else 0
                updates.append([new_status, is_final, v.get("employerName") or old[1],
                                v.get("jobTitle") or old[2], SOURCE, stamp, cn])
                # A reconciliation is not a transition: correcting stale rows
                # against DOL must not write events stamped today, or the alert
                # sweep and the activity history would see a one-day surge that
                # never happened. Once the data is current, a difference does
                # mean the case moved, and the events are real.
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

    # Stamp freshness so check_ingest_health.py can see this ingest stop, but
    # only on a run that got somewhere: a run that died on its first batch must
    # not refresh the clock, or a broken ingest would report itself healthy.
    if checked:
        n = int(db.scalar("SELECT count(*) FROM perm_case_status") or 0)
        # Freshness per pass, so the pending pass can never keep the clock
        # green over a full pass (the only one that catches expirations) that
        # fails every night. The health check reads every data_freshness row,
        # so the full pass's own key is monitored automatically.
        dataset = "perm-case-status-full" if args.full else "perm-case-status"
        stamp_freshness(db, dataset, source=SOURCE, cadence="Daily",
                        note=f"{n:,} cases", max_age_days=3)
        log(f"stamped   {dataset}")
        # What this run looked at, and whether it got all the way round
        # (`sweep_is_complete`). A partial run still gets a row, since the audit
        # trail wants partial runs most of all; it just can't date a census.
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
        # Discovery rides both passes, so the census below carries the day's
        # new filings and the walk keeps pace with the counter; its time budget
        # (DISCOVERY_BUDGET_MIN) keeps either pass under its step timeout. A
        # `--limit` test run does not walk.
        mode = "full" if args.full else "pending"
        walk = bool(args.full or args.pending)
        steps = tail_steps(db, discover=walk, cap=args.discover_cap,
                           deadline=t0 + DISCOVERY_BUDGET_MIN[mode] * 60,
                           housekeeping=bool(args.full))
        failed = run_independently(steps)

        # Recorded after the tail, not before it, so a run that dies in its doc
        # writes can't have already written itself an `ok` row.
        status = "ok" if not failed else "partial"
        note = f"{'full' if args.full else 'pending'}: {n:,} cases"
        if failed:
            note += (f"; {len(failed)}/{len(steps)} tail steps failed: "
                     + ", ".join(k for k, _ in failed))
        # Keyed with its mode, the shape the workflow's failure hook writes
        # ("ingest_case_status_direct.py --full"), so a clean re-run clears a
        # failed run of the same pass.
        record_run(db, f"ingest_case_status_direct.py --{mode}", status=status,
                   rows_written=written["u"], note=note, started_at=started)

        if failed:
            log(f"TAIL: {len(failed)} of {len(steps)} doc writes failed: "
                + ", ".join(k for k, _ in failed))
            # Every tail step failing means the database is gone, so the sweep's
            # own writes are suspect and the run goes red. One or two failing is
            # a blip: the previous docs stay live, every reader has a fallback,
            # and the `partial` row above turns the health check red that morning.
            if len(failed) == len(steps):
                log("every tail step failed; failing the run")
                return 1
    else:
        log("NOT stamping freshness: this run checked nothing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
