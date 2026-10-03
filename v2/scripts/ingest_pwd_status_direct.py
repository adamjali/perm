#!/usr/bin/env python3
"""Per-case status for the FLAG programs other than PERM, straight from
flag.dol.gov: prevailing wage requests (ETA-9141), LCAs (ETA-9035), and the
H-2A and H-2B seasonal filings.

Every DOL foreign-labor filing gets a FLAG case number: `G-100-` for a PERM,
`P-100-` for the prevailing wage request before it, `I-200-` and `I-203-` for
labor condition applications, `H-300-`, `H-400-` and `P-400-` for H-2A, H-2B
and H-2B prevailing wage. DOL's batch case-status endpoint serves all of them
with the same fields, and every program draws from one serial counter: a
serial that answers under one prefix is no case under another. So one prober
covers them all and drops a serial the moment a prefix claims it.

Separate tables per program (`pwd_case_status`, `lca_case_status`,
`seasonal_case_status`), because the PERM tables feed the queue census, the
review-stage pages, the RFI funnel and the alert sweep, all of which assume a
PERM status vocabulary. Each program's final-status set is pinned against its
TypeScript reader by a test.

New filings are found by the unified serial walk in
ingest_case_status_direct.py, which hands P-, I- and H- hits to
`insert_hits` here. This script re-checks what is held:

    python3 scripts/ingest_pwd_status_direct.py --pending [--program pwd|lca|seasonal|all]   # daily
    python3 scripts/ingest_pwd_status_direct.py --full [--program ...]     # weekly, a rolling window
    python3 scripts/ingest_pwd_status_direct.py --discover                 # recent days, by day window
    python3 scripts/ingest_pwd_status_direct.py --backfill --from 2026-01-01 --to 2026-08-31

A status outside a program's known set is treated as pending and re-swept,
the safe failure, and logged so the set grows from evidence. Coverage is
recorded per run in `sweep_runs`, which is what "last checked" on the site
reads; unchanged rows aren't rewritten.
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import (  # noqa: E402
    Turso, add_missing_columns, query_rows, read_doc, record_run, record_sweep,
    run_independently, run_stmts, stamp_freshness, stmt, write_doc,
)
from ingest_case_status_direct import (  # noqa: E402
    BATCH, PACE_S, decode_filing_date, log, lookup_with_retry,
)
from lib_flag_serials import SERIAL_MOD, case_number, day_code, serial_of  # noqa: E402
from lib_slugs import slugify  # noqa: E402

PERM_PREFIX = "G-100-"

PROGRAMS: dict[str, dict] = {
    "pwd": {
        "label": "prevailing wage",
        "table": "pwd_case_status",
        "events": "pwd_case_events",
        # P-100 is a wage request for a PERM job; P-200 to P-203 one for an
        # H-1B, H-1B1 Chile, H-1B1 Singapore or E-3 job (DOL's answer names the
        # visa). DOL publishes their processing time as one queue ("PERM, H-1B,
        # H-1B1 and E-3"), so they are one program here. Mirror pwdCases.ts.
        "prefixes": ["P-100-", "P-200-", "P-201-", "P-202-", "P-203-"],
        # RETURNED UNPROCESSED (274 rows) and CENTER DIRECTOR REVIEW AFFIRMED
        # DETERMINATION (1) were unknown to this set and so counted as pending
        # forever; both are terminal. Mirror pwdCases.ts, pinned by its test.
        "final": {"DETERMINATION ISSUED", "REDETERMINATION AFFIRMED",
                  "REDETERMINATION MODIFIED", "WITHDRAWN", "DENIED",
                  "RETURNED UNPROCESSED",
                  "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION"},
        "pending": {"IN PROCESS"},
        "doc": "pwd_live_summary",
        "freshness": "pwd-status",
        # The weekly full pass re-checks filings this recent. Determinations
        # that later move (redetermination, withdrawal) do so within months
        # of filing; a 2024 determination is frozen. The old full pass walked
        # ALL 96k rows and could never finish beside LCA's 310k.
        "full_window_days": 180,
        "freshness_max_age": 3,     # the daily pending pass checks thousands
    },
    "lca": {
        "label": "LCA",
        "table": "lca_case_status",
        "events": "lca_case_events",
        # By measured hit rate. I-201/I-202 returned nothing in the sampled
        # windows; they stay in the list because a serial the others did not
        # claim costs one more probe and a missed case costs a visitor.
        "prefixes": ["I-200-", "I-203-", "I-201-", "I-202-"],
        "final": {"CERTIFIED", "CERTIFIED - WITHDRAWN", "CERTIFIED-WITHDRAWN",
                  "DENIED", "WITHDRAWN"},
        "pending": {"IN PROCESS"},
        "doc": "lca_live_summary",
        "freshness": "lca-status",
        # LCAs certify within a week and then only ever withdraw; 90 days of
        # filings is ~90k rows, about 50 minutes, against 310k for all of them.
        "full_window_days": 90,
        # The daily pending pass finds 0 LCAs (they are final in days), so
        # only the weekly pass can honestly stamp this row. A 3-day budget
        # would read as stale six days a week for a table that is fine.
        "freshness_max_age": 8,
    },
    "seasonal": {
        "label": "H-2A, H-2B and CW-1",
        "table": "seasonal_case_status",
        "events": "seasonal_case_events",
        # The temporary-labor programs, from the same counter and the same
        # endpoint: H-300 is an H-2A application (ETA-9142A),
        # H-400 an H-2B application (ETA-9142B), P-400 an H-2B prevailing
        # wage request, P-500 a wage request for a CW-1 job (the Northern
        # Mariana Islands' temporary-worker program, 48 U.S.C. 1806), whose
        # requests run through the same temporary-labor process as H-2B's.
        # P-400 is kept OUT of the PWD program on purpose: the
        # PWD pages describe the ETA-9141 queue that PERM and H-1B wait in,
        # and H-2B requests run through a different one.
        "prefixes": ["H-300-", "H-400-", "P-400-", "P-500-"],
        # Statuses read off DOL's own answers over the FY2026 backfill's first
        # 27,000 cases. One not in either set is logged and
        # treated as pending, which costs a daily re-check and never a wrong
        # "decided". Mirror seasonalCases.ts, pinned by its test.
        "final": {"FULL CERTIFICATION", "FULL CERTIFICATION - EXPIRED",
                  "FULL CERTIFICATION - WITHDRAWN",
                  "PARTIAL CERTIFICATION", "PARTIAL CERTIFICATION - EXPIRED",
                  "PARTIAL CERTIFICATION - WITHDRAWN",
                  "DENIED", "WITHDRAWN", "DETERMINATION ISSUED",
                  "REDETERMINATION AFFIRMED", "REDETERMINATION MODIFIED",
                  "RETURNED UNPROCESSED",
                  "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
                  "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
                  # The Board's decision on an appealed wage determination is
                  # the last administrative word (20 CFR 655.13(c)).
                  "BALCA OVERTURNED"},
        "pending": {"IN PROCESS", "ACCEPTED - PENDING RECRUITMENT", "NOD ISSUED",
                    "NOR ISSUED", "NRM ISSUED", "RFI ISSUED", "PENDING APPEAL",
                    "PENDING CENTER DIRECTOR REVIEW", "POST-CERT REQUEST PENDING"},
        "doc": "seasonal_live_summary",
        "freshness": "seasonal-status",
        # An H-2A or H-2B season is decided within months of filing.
        "full_window_days": 120,
        "freshness_max_age": 3,
    },
}
PREFIX_TO_PROGRAM = {p: name for name, cfg in PROGRAMS.items() for p in cfg["prefixes"]}
# Probe order across programs, by measured hit rate: the more a prefix
# claims early, the fewer serials the rarer prefixes are asked about.
DISCOVERY_ORDER = ["I-200-", "P-100-", "H-300-", "P-400-", "H-400-", "I-203-", "P-200-",
                   "P-500-", "I-201-", "I-202-", "P-203-", "P-201-", "P-202-"]

# Kept under their original names: scripts/test_pwd_status.py imports them.
PREFIX = "P-100-"
PWD_FINAL = PROGRAMS["pwd"]["final"]

SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)"
DISCOVERY_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, discovered)"

DISCOVERY_DAY_WINDOW = 7
DISCOVERY_REQUEST_CAP = 2000
BACKFILL_REQUEST_CAP = 9000
EDGE_PAD = 300
# The counter wraps at 1,000,000, so on a wrap day MIN/MAX read as (1, 999,997):
# a million-serial window that would spend a whole run's cap. A jump this big
# between two consecutive known serials is the wrap; each side is probed as its
# own cluster, and no window may exceed MAX_WINDOW.
CLUSTER_GAP = 50_000
MAX_WINDOW = 20_000
_KNOWN_CACHE: dict[str, set[int]] = {}
PROGRESS_KEY = "flag_backfill_progress"


def table_ddl(cfg: dict) -> list[str]:
    t, e = cfg["table"], cfg["events"]
    return [
        f"""CREATE TABLE IF NOT EXISTS {t} (
             case_number     TEXT PRIMARY KEY,
             filing_date     TEXT,
             current_status  TEXT,
             is_final        INTEGER,
             employer_name   TEXT,
             employer_slug   TEXT,
             job_title       TEXT,
             visa_type       TEXT,
             submitted_date  TEXT,
             first_seen_at   TEXT,
             last_checked_at TEXT,
             source          TEXT NOT NULL,
             fetched_at      INTEGER NOT NULL)""",
        f"CREATE INDEX IF NOT EXISTS {t}_emp ON {t} (employer_slug, filing_date)",
        f"CREATE INDEX IF NOT EXISTS {t}_final_filed ON {t} (is_final, filing_date, case_number)",
        f"CREATE INDEX IF NOT EXISTS {t}_filed ON {t} (filing_date, case_number)",
        f"CREATE INDEX IF NOT EXISTS {t}_stage ON {t} (current_status, is_final, filing_date)",
        f"""CREATE TABLE IF NOT EXISTS {e} (
             case_number TEXT NOT NULL,
             changed_at  INTEGER NOT NULL,
             from_status TEXT,
             to_status   TEXT,
             to_final    INTEGER,
             source      TEXT,
             PRIMARY KEY (case_number, changed_at))""",
        f"CREATE INDEX IF NOT EXISTS {e}_status_time ON {e} (to_status, changed_at)",
    ]


def ensure_schema(db: Turso) -> None:
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER NOT NULL)""")
    for cfg in PROGRAMS.values():
        for ddl in table_ddl(cfg):
            db.execute(ddl)
        if add_missing_columns(db, cfg["table"], {"visa_type": "TEXT"}):
            log(f"  added column {cfg['table']}.visa_type")


# ---------------------------------------------------------------------------
# Serial windows
# ---------------------------------------------------------------------------

# day_code and serial_of come from lib_flag_serials (shared with the PERM prober).


def _serial_stats(db: Turso, table: str, prefixes: list[str], codes: list[str]):
    """Per day code, min and max serial, read by PRIMARY KEY RANGE.

    `LIKE 'G-100-26238-%'` can't use the primary key index (LIKE is
    case-insensitive by default while the column collates BINARY), so it scans
    the whole table; a half-open range on the same prefix walks only that day's
    rows.
    """
    out = []
    for prefix in prefixes:
        for code in codes:
            lo, hi = f"{prefix}{code}-", f"{prefix}{code}-~"
            for _day, mn, mx in query_rows(
                    db,
                    f"SELECT ? AS day, "
                    f"       MIN(CAST(substr(case_number, 13) AS INTEGER)), "
                    f"       MAX(CAST(substr(case_number, 13) AS INTEGER)) "
                    f"  FROM {table} WHERE case_number >= ? AND case_number < ?",
                    [code, lo, hi]):
                if mn is not None:
                    out.append((code, mn, mx))
    return out


def cluster_serials(serials: list[int], gap: int = CLUSTER_GAP) -> list[tuple[int, int]]:
    """Sorted serials -> (lo, hi) runs, split wherever two neighbours are more
    than `gap` apart. One run for an ordinary day; two on the day the counter
    wraps (one near 999,999, one near 0)."""
    if not serials:
        return []
    out: list[tuple[int, int]] = []
    lo = prev = serials[0]
    for s in serials[1:]:
        if s - prev > gap:
            out.append((lo, prev))
            lo = s
        prev = s
    out.append((lo, prev))
    return out


def cached_known(db: Turso, code: str) -> set[int]:
    if code not in _KNOWN_CACHE:
        _KNOWN_CACHE[code] = known_serials(db, code)
    return _KNOWN_CACHE[code]


def day_windows(db: Turso, codes: list[str]) -> dict[str, list[tuple[int, int]]]:
    """Per day code, the serial ranges to probe: what the PERM corpus and our
    own tables already know for that day, padded at both edges.

    The PERM sample under-reads the day's true edges (a day's first filing is
    rarely a PERM), so each edge is padded by EDGE_PAD and, where the next
    day is known, the top edge stops just under the next day's floor.

    A day whose MIN/MAX are more than MAX_WINDOW apart is read in full and
    split into clusters (see CLUSTER_GAP); every window is clamped to
    MAX_WINDOW and the clamp is logged as a workflow warning, because a
    silently narrowed window is a hole the next run cannot see.
    """
    if not codes:
        return {}
    out: dict[str, list[int]] = {}
    sources: list[tuple[str, list[str]]] = [("perm_case_status", [PERM_PREFIX])]
    for cfg in PROGRAMS.values():
        sources.append((cfg["table"], list(cfg["prefixes"])))
    for table, prefixes in sources:
        for day, lo, hi in _serial_stats(db, table, prefixes, codes):
            if lo is None or hi is None:
                continue
            cur = out.setdefault(str(day), [int(lo), int(hi)])
            cur[0] = min(cur[0], int(lo))
            cur[1] = max(cur[1], int(hi))
    ordered = sorted(out.items())
    windows: dict[str, list[tuple[int, int]]] = {}
    for i, (day, (lo, hi)) in enumerate(ordered):
        next_floor = ordered[i + 1][1][0] - 1 if i + 1 < len(ordered) else None
        if hi - lo > MAX_WINDOW:
            clusters = cluster_serials(sorted(cached_known(db, day)))
            log(f"::warning::{day}: known serials span {lo:,}-{hi:,}; "
                f"probing {len(clusters)} cluster(s) instead")
        else:
            clusters = [(lo, hi)]
        spans: list[tuple[int, int]] = []
        for clo, chi in clusters:
            bottom = max(0, clo - EDGE_PAD)
            top = min(chi + EDGE_PAD, SERIAL_MOD - 1)
            if next_floor is not None and chi < next_floor:
                top = min(top, max(chi, next_floor))
            if top - bottom > MAX_WINDOW:
                log(f"::warning::{day}: window {bottom:,}-{top:,} clamped to {MAX_WINDOW:,} serials")
                top = bottom + MAX_WINDOW
            spans.append((bottom, top))
        windows[day] = spans
    return windows


def known_serials(db: Turso, code: str) -> set[int]:
    """Every serial already claimed for a day, across ALL programs."""
    known: set[int] = set()
    pairs: list[tuple[str, str]] = [("perm_case_status", PERM_PREFIX)]
    for cfg in PROGRAMS.values():
        pairs += [(cfg["table"], pfx) for pfx in cfg["prefixes"]]
    for table, prefix in pairs:
        # Primary-key range, not LIKE: see _serial_stats.
        for (s,) in query_rows(db, f"SELECT CAST(substr(case_number, 13) AS INTEGER) FROM {table} "
                              f"WHERE case_number >= ? AND case_number < ?",
                          [f"{prefix}{code}-", f"{prefix}{code}-~"]):
            known.add(int(s))
    return known


def candidate_batches(code: str, lo: int, hi: int, known: set[int], prefix: str = PREFIX):
    """Unknown serials in [lo, hi] as padded case numbers, BATCH at a time.

    PADDED. DOL issues "P-100-26161-003499"; this used to format the serial
    bare, so every candidate below 100,000 was a number DOL has never seen,
    and the post-wrap half of June 2026 could not be found by construction.
    """
    chunk: list[str] = []
    for s in range(lo, hi + 1):
        if s in known:
            continue
        chunk.append(case_number(prefix, code, s))
        if len(chunk) == BATCH:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

def is_final(status: str, program: str = "pwd") -> int:
    return 1 if status.strip().upper() in PROGRAMS[program]["final"] else 0


def _flag(v) -> int:
    """A stored is_final as an int: libSQL hands integers back as strings."""
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


unknown_seen: set[tuple[str, str]] = set()


def note_status(program: str, status: str) -> None:
    s = status.strip().upper()
    cfg = PROGRAMS[program]
    if s and s not in cfg["final"] and s not in cfg["pending"] and (program, s) not in unknown_seen:
        unknown_seen.add((program, s))
        log(f"  NOTE: {program} status not in the known set, treated as pending: {s!r}")


def _insert_sql(table: str) -> str:
    return (f"INSERT OR IGNORE INTO {table} "
            "(case_number, filing_date, current_status, is_final, employer_name, "
            " employer_slug, job_title, visa_type, submitted_date, first_seen_at, "
            " last_checked_at, source, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")


def insert_hits(db: Turso, hits: list[dict], source: str) -> int:
    """INSERT OR IGNORE each confirmed case into its program's table, in one
    pipeline. Returns rows actually added."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    stamp = int(time.time() * 1000)
    stmts = []
    for v in hits:
        cn = v.get("caseNumber") or ""
        program = PREFIX_TO_PROGRAM.get(cn[:6])
        status = (v.get("caseStatus") or "").strip()
        if not program or not status:
            continue
        note_status(program, status)
        name = (v.get("employerName") or "").strip() or None
        stmts.append(stmt(_insert_sql(PROGRAMS[program]["table"]), [
            cn, decode_filing_date(cn), status, is_final(status, program), name,
            slugify(name) if name else None, v.get("jobTitle"),
            (v.get("visaType") or "").strip() or None, v.get("submittedDate"),
            now_iso, now_iso, source, stamp]))
    return sum(1 for n in run_stmts(db, stmts) if n) if stmts else 0


def probe_days(db: Turso, windows: dict[str, list[tuple[int, int]]], cap: int,
               source: str) -> tuple[int, dict[str, int], list[str]]:
    """Every unknown serial in each window, each prefix in turn, claimed
    serials dropped as they hit. Returns (requests, added per program, days done)."""
    requests = 0
    added = {name: 0 for name in PROGRAMS}
    done: list[str] = []
    for code in sorted(windows):
        known = cached_known(db, code)
        spans = windows[code]
        log(f"  {code}: {', '.join(f'{lo:,}-{hi:,}' for lo, hi in spans)}, "
            f"{len(known):,} already known")
        stopped = False
        claimed: set[int] = set(known)
        for prefix in DISCOVERY_ORDER:
            program = PREFIX_TO_PROGRAM[prefix]
            for chunk in (c for lo, hi in spans for c in candidate_batches(code, lo, hi, claimed, prefix)):
                if requests >= cap:
                    log(f"  request cap {cap} reached inside {code} ({prefix}); resume later")
                    stopped = True
                    break
                try:
                    got = lookup_with_retry(chunk)
                except Exception as exc:  # noqa: BLE001
                    log(f"  batch failed ({exc}); stopping cleanly")
                    stopped = True
                    break
                requests += 1
                wanted = set(chunk)
                hits = [v for v in got if v.get("caseNumber") in wanted]
                added[program] += insert_hits(db, hits, source)
                for v in hits:
                    s = serial_of(v["caseNumber"])
                    if s is not None:
                        claimed.add(s)
                time.sleep(PACE_S)
            if stopped:
                break
        if stopped:
            break
        done.append(code)
    return requests, added, done


# ---------------------------------------------------------------------------
# Sweeps
# ---------------------------------------------------------------------------

def sweep(db: Turso, program: str, pending_only: bool, limit: int | None,
          window_days: int | None = None) -> dict:
    """Re-ask DOL about a set of cases and record what moved.

    pending_only  every non-final row (the daily pass; index case_status_final)
    window_days   every row filed within the last N days (the weekly pass;
                  index <table>_filed). Every row would outlast the job's
                  timeout, and in case-number order the newest rows would be
                  the ones never reached.
    neither       every row (only --limit sampling uses this now)
    """
    cfg = PROGRAMS[program]
    table, events = cfg["table"], cfg["events"]
    args: list = []
    if pending_only:
        where = "WHERE is_final = 0 OR is_final = '0'"
        order = "case_number"
    elif window_days:
        cutoff = (datetime.date.today() - datetime.timedelta(days=window_days)).isoformat()
        where, args = "WHERE filing_date >= ?", [cutoff]
        order = "filing_date, case_number"      # the index's own order: no sort
        log(f"{program}: rolling window, filed on or after {cutoff}")
    else:
        where, order = "", "case_number"
    rows = {
        r[0]: r[1:] for r in query_rows(
            db,
            f"SELECT case_number, current_status, employer_name, job_title, is_final "
            f"FROM {table} {where} ORDER BY {order} LIMIT {limit or 10**9}", args)
    }
    todo = sorted(rows)
    log(f"{program}: {len(todo):,} cases to check, {BATCH} per request "
        f"= {(len(todo)+BATCH-1)//BATCH:,} requests")
    checked = moved = missing = fails = healed = 0
    # Coverage bookkeeping for the sweep record. Same meanings as the PERM
    # sweep: `asked` counts numbers that reached DOL, `failed_batches` counts
    # holes of up to 50 cases, and either a hole or an early stop disqualifies
    # the run from dating anything.
    asked = requests = failed_batches = 0
    truncated = False
    status_counts: dict[str, int] = {}
    started = time.time()
    stamp = int(time.time() * 1000)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pending_writes: list[dict] = []

    def flush() -> None:
        if pending_writes:
            run_stmts(db, pending_writes)
            pending_writes.clear()

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
            if fails >= 3:
                flush()
                truncated = True
                log("  three consecutive failures; stopping cleanly")
                break
            time.sleep(5)
            continue
        if len(got) > len(chunk):
            raise SystemExit(f"FATAL: asked {len(chunk)}, got {len(got)}")
        seen = set()
        for v in got:
            cn = v.get("caseNumber")
            old = rows.get(cn)
            if not old:
                continue
            seen.add(cn)
            checked += 1
            new_status = (v.get("caseStatus") or "").strip()
            old_status = (old[0] or "").strip()
            note_status(program, new_status)
            status_counts[new_status or "(blank)"] = (
                status_counts.get(new_status or "(blank)", 0) + 1)
            visa = (v.get("visaType") or "").strip() or None
            if new_status and new_status != old_status:
                moved += 1
                fin = is_final(new_status, program)
                pending_writes.append(stmt(
                    f"UPDATE {table} SET current_status=?, is_final=?, employer_name=?, "
                    f"job_title=?, visa_type=COALESCE(?, visa_type), last_checked_at=?, "
                    f"source=?, fetched_at=? WHERE case_number=?",
                    [new_status, fin, v.get("employerName") or old[1],
                     v.get("jobTitle") or old[2], visa, now_iso, SOURCE, stamp, cn]))
                pending_writes.append(stmt(
                    f"INSERT OR IGNORE INTO {events} (case_number, changed_at, from_status, "
                    f"to_status, to_final, source) VALUES (?,?,?,?,?,?)",
                    [cn, stamp, old_status, new_status, fin, SOURCE]))
            elif new_status and _flag(old[3]) != is_final(new_status, program):
                # Same status, wrong flag: the status set learned a word after
                # the row was stored. Fix the flag; no event, because nothing
                # moved.
                healed += 1
                pending_writes.append(stmt(
                    f"UPDATE {table} SET is_final=? WHERE case_number=?",
                    [is_final(new_status, program), cn]))
            # An unchanged row is not written. This branch used to stamp
            # last_checked_at on every row it looked at: ~300,000 UPDATEs a
            # Sunday to record 54 transitions, each one maintaining every
            # index on the table. The sweep's own timestamp lives in
            # sweep_runs, and that is what "last checked" on the site reads.
        missing += len(chunk) - len(seen)
        # Written as it goes, so a shutdown mid-run keeps the work.
        if len(pending_writes) >= 400:
            flush()
        if (i // BATCH) % 40 == 0 and i:
            log(f"  {i:,}/{len(todo):,}  moved={moved:,}  missing={missing:,}")
        time.sleep(PACE_S)
    flush()
    log(f"{program}: checked {checked:,}  moved {moved:,}  not found {missing:,}"
        + (f"  final flag corrected on {healed:,}" if healed else ""))
    # `complete` is decided here rather than by the caller because only this
    # function knows whether a batch was lost. `limit` is the caller's, and a
    # limited run is a slice of the population by construction.
    complete = not limit and not truncated and failed_batches == 0
    record_sweep(
        db, script="ingest_pwd_status_direct.py", program=program,
        mode="pending" if pending_only else "full",
        started_at=started, asked=asked, answered=checked, missing=missing,
        changed=moved, requests=requests, failed_batches=failed_batches,
        complete=complete, status_counts=status_counts,
    )
    log(f"{program}: recorded sweep, asked {asked:,}, {requests:,} requests, "
        f"{'COMPLETE' if complete else 'PARTIAL'}")
    return {"checked": checked, "moved": moved, "missing": missing,
            "asked": asked, "requests": requests, "complete": complete}


# ---------------------------------------------------------------------------
# Summary docs
# ---------------------------------------------------------------------------

def write_summary_doc(db: Turso, program: str = "pwd") -> bool:
    """perm_docs[<program>_live_summary]: counts by status, program tag and
    filing month, so the pages never count the table per request. Reconciled
    against COUNT(*) before writing; a mismatch leaves the previous doc."""
    cfg = PROGRAMS[program]
    table, key = cfg["table"], cfg["doc"]
    by_status = {s: int(n) for s, n in query_rows(
        db, f"SELECT current_status, COUNT(*) FROM {table} GROUP BY current_status")}
    by_visa = {(v or "unknown"): int(n) for v, n in query_rows(
        db, f"SELECT visa_type, COUNT(*) FROM {table} GROUP BY visa_type")}
    by_month_rows = query_rows(
        db,
        f"SELECT substr(filing_date, 1, 7) AS m, COUNT(*), SUM(is_final) "
        f"FROM {table} WHERE filing_date IS NOT NULL GROUP BY m ORDER BY m DESC")
    # Per form prefix (H-300, H-400, P-400 under one table; I-200 and I-203
    # under another): the H-2A and H-2B page names the three forms apart.
    by_prefix_rows = query_rows(
        db, f"SELECT substr(case_number, 1, 5) AS p, COUNT(*), SUM(is_final) FROM {table} GROUP BY p")
    total = int(query_rows(db, f"SELECT COUNT(*) FROM {table}")[0][0] or 0)
    if sum(by_status.values()) != total:
        log(f"  MISMATCH {key} {sum(by_status.values()):,} vs count {total:,}; doc not written")
        return False
    final = sum(n for s, n in by_status.items() if (s or "").upper() in cfg["final"])
    earliest = query_rows(db, f"SELECT MIN(first_seen_at) FROM {table}")[0][0]
    doc = {
        "total": total,
        "pending": total - final,
        "decided": final,
        "byStatus": dict(sorted(by_status.items(), key=lambda kv: -kv[1])),
        "byVisaType": dict(sorted(by_visa.items(), key=lambda kv: -kv[1])),
        "byPrefix": {pfx: int(n) for pfx, n, _f in sorted(by_prefix_rows, key=lambda r: -int(r[1])) if pfx},
        "pendingByPrefix": {pfx: int(n) - int(f or 0) for pfx, n, f in by_prefix_rows if pfx},
        "byMonth": [{"month": m, "total": int(n), "decided": int(f or 0),
                     "pending": int(n) - int(f or 0)} for m, n, f in by_month_rows if m],
        "sinceFirstSeen": earliest,
        "asOf": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    payload = json.dumps(doc, separators=(",", ":"))
    write_doc(db, key, payload)
    got = query_rows(db, "SELECT length(json) FROM perm_docs WHERE key = ?", [key])
    ok = bool(got) and int(got[0][0] or 0) == len(payload)
    log(f"  {'ok ' if ok else 'MISMATCH'} perm_docs[{key}]  {total:,} cases, "
        f"{total - final:,} pending, {len(doc['byMonth'])} months")
    return ok


def read_progress_doc(db: Turso) -> dict:
    """The whole backfill record: lastDayDone, when it last moved, the range
    it was dispatched for, and whether it finished. Empty when none exists."""
    return read_doc(db, PROGRESS_KEY) or {}


def read_progress(db: Turso) -> str | None:
    return read_progress_doc(db).get("lastDayDone")


def write_progress(db: Turso, last_day: str | None = None, **fields) -> None:
    """Merge into the record. `lastDayDoneAt` moves ONLY when lastDayDone
    does: it is what the health check judges a stalled backfill by, and a
    leg that restarts every day without advancing must not refresh it."""
    doc = read_progress_doc(db)
    now_ms = int(time.time() * 1000)
    if last_day is not None and last_day != doc.get("lastDayDone"):
        doc["lastDayDone"] = last_day
        doc["lastDayDoneAt"] = now_ms
    doc.update(fields)
    write_doc(db, PROGRESS_KEY, json.dumps(doc), now_ms)


# A leg that ran inside this window means the chain is alive (legs take up
# to 170 minutes and dispatch their successor themselves). Outside it, an
# incomplete backfill has stopped chaining - a leg died before moving the
# frontier, DOL refused for a night - and the daily job re-dispatches ONE
# leg. One a day, so a DOL outage cannot loop it.
RESUME_QUIET_HOURS = 20
BACKFILL_SCRIPT = "ingest_pwd_status_direct.py --backfill"


def resume_decision(doc: dict, last_run_ms: int | None, now_ms: int) -> tuple[str, str]:
    """('dispatch' | 'noop', reason). Pure, so the daily job's choice is testable."""
    if not doc:
        return "noop", "no backfill on record"
    if doc.get("complete"):
        return "noop", f"backfill complete through {doc.get('to')}"
    if not (doc.get("from") and doc.get("to")):
        return "noop", "backfill has no range recorded (it pre-dates the resumer)"
    if last_run_ms is not None and now_ms - last_run_ms < RESUME_QUIET_HOURS * 3_600_000:
        hours = (now_ms - last_run_ms) / 3_600_000
        return "noop", f"a leg ran {hours:.1f}h ago; the chain is alive"
    return "dispatch", (f"incomplete: last day done {doc.get('lastDayDone') or 'none'}, "
                        f"target {doc['to']}")


def last_backfill_run_ms(db: Turso) -> int | None:
    try:
        got = query_rows(db, "SELECT started_at FROM ingest_runs WHERE script = ? "
                        "ORDER BY started_at DESC LIMIT 1", [BACKFILL_SCRIPT])
    except Exception:  # noqa: BLE001 - a database with no runs yet
        return None
    return int(got[0][0]) if got and got[0][0] is not None else None


# ---------------------------------------------------------------------------

def programs_from(arg: str) -> list[str]:
    return list(PROGRAMS) if arg == "all" else [arg]


def _tail_exit(failed: list[tuple[str, str]]) -> int:
    """0 when the sweep worked and only some docs did not; 1 when none did.

    A doc write failing is not a reason to re-run a sweep that already spent
    an hour being polite to a government host: the previous doc is still live
    and correct, and every page that reads one has its own fallback. It
    surfaces through the `partial` row `record_run` just wrote, which
    check_ingest_health.py turns red the same morning.

    EVERY doc failing is a different claim - that is the database being gone,
    at which point the sweep's own writes are suspect too and the run should
    be red now rather than tomorrow.
    """
    if failed and len(failed) >= len(PROGRAMS):
        log(f"every summary doc failed ({len(failed)}); failing the run")
        return 1
    if failed:
        log(f"TAIL: {len(failed)} doc write(s) failed: "
            + ", ".join(k for k, _ in failed))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--discover", action="store_true",
                    help="Probe the last week's filing days for new cases, every program.")
    ap.add_argument("--days", type=int, default=DISCOVERY_DAY_WINDOW)
    ap.add_argument("--backfill", action="store_true",
                    help="Probe every filing day in --from..--to (resumable), every program.")
    ap.add_argument("--from", dest="from_", help="YYYY-MM-DD, backfill start")
    ap.add_argument("--to", dest="to", help="YYYY-MM-DD, backfill end (inclusive)")
    ap.add_argument("--cap", type=int, help="Override the run's request cap.")
    ap.add_argument("--pending", action="store_true", help="Re-check every non-final case.")
    ap.add_argument("--full", action="store_true", help="Re-check every case filed inside its program's window.")
    ap.add_argument("--program", choices=[*PROGRAMS, "all"], default="all")
    ap.add_argument("--limit", type=int)
    # Two read-only probes for the workflow that chains backfill legs: where
    # the frontier is, and the day code a --to date resolves to. Neither
    # touches DOL; --day-code does not even open Turso.
    ap.add_argument("--progress", action="store_true",
                    help="Print the backfill frontier (last day code done) and exit.")
    ap.add_argument("--day-code", metavar="YYYY-MM-DD",
                    help="Print the day code for a date and exit.")
    ap.add_argument("--progress-json", action="store_true",
                    help="Print the whole backfill record as JSON and exit.")
    ap.add_argument("--resume-check", action="store_true",
                    help="Print 'dispatch from=.. to=..' when an incomplete backfill has "
                         "stopped chaining, else 'noop: <reason>'. Read-only.")
    args = ap.parse_args()

    if args.day_code:
        print(day_code(datetime.date.fromisoformat(args.day_code)))
        return 0
    if args.progress:
        print(read_progress(Turso()) or "")
        return 0
    if args.progress_json:
        print(json.dumps(read_progress_doc(Turso()), sort_keys=True))
        return 0
    if args.resume_check:
        db = Turso()
        doc = read_progress_doc(db)
        verdict, reason = resume_decision(doc, last_backfill_run_ms(db), int(time.time() * 1000))
        if verdict == "dispatch":
            print(f"dispatch from={doc['from']} to={doc['to']} ({reason})")
        else:
            print(f"noop: {reason}")
        return 0

    db = Turso()
    ensure_schema(db)
    today = datetime.date.today()
    started = time.time()

    def finish_docs(note_for=None) -> list[tuple[str, str]]:
        """Write each program's summary doc independently. Returns failures.

        THREE OUTCOMES, NOT TWO, and only one of them is a failure:

          wrote     the doc reconciled against COUNT(*) and was written
          declined  the reconciliation guard refused, because a concurrent
                    write landed between its two queries. HEALTHY. It leaves
                    the previous doc live, must not be retried, and must not
                    stamp freshness - the doc it describes was not written.
          failed    it raised; the far end is unhappy and the next one might
                    still succeed, so it must not take its siblings with it.

        `write_summary_doc` has returned that bool since it was written and
        EVERY CALLER THREW IT AWAY, then stamped freshness anyway - so a doc
        that stopped reconciling would sit unwritten indefinitely behind a
        green clock, which is the exact failure `data_freshness` exists to
        make impossible.
        """
        wrote: dict[str, bool] = {}

        def write_one(name: str) -> None:
            wrote[name] = bool(write_summary_doc(db, name))

        failed = run_independently(
            [(f"{name}_summary_doc", (lambda n=name: write_one(n)))
             for name in PROGRAMS])
        if note_for is None:
            return failed
        for name in PROGRAMS:
            note = note_for(name)
            if note is None:
                continue
            if not wrote.get(name):
                log(f"  NOT stamping {PROGRAMS[name]['freshness']}: its doc "
                    f"was not written this run")
                continue
            stamp_freshness(db, PROGRAMS[name]["freshness"],
                            source="flag.dol.gov case status (DOL, direct)",
                            cadence="Daily", note=note,
                            max_age_days=PROGRAMS[name].get("freshness_max_age", 3))
        return failed

    if args.discover:
        codes = [day_code(today - datetime.timedelta(days=i)) for i in range(args.days)]
        windows = day_windows(db, codes)
        log(f"DISCOVER: {len(windows)} of {len(codes)} day codes have a serial window")
        requests, added, done = probe_days(db, windows, args.cap or DISCOVERY_REQUEST_CAP,
                                           DISCOVERY_SOURCE)
        log(f"discover: {requests} requests, new cases {added}, days done {done}")
        failed = finish_docs(lambda n: f"{added.get(n, 0)} discovered")
        record_run(db, "ingest_pwd_status_direct.py --discover",
                   status="ok" if not failed else "partial",
                   rows_written=sum(added.values()),
                   note=f"{requests} requests in {time.time()-started:.0f}s"
                        + (f"; failed: {', '.join(k for k, _ in failed)}"
                           if failed else ""))
        return _tail_exit(failed)

    if args.backfill:
        if not (args.from_ and args.to):
            raise SystemExit("--backfill needs --from and --to")
        start = datetime.date.fromisoformat(args.from_)
        end = datetime.date.fromisoformat(args.to)
        resume = read_progress(db)
        codes = []
        d = start
        while d <= end:
            c = day_code(d)
            if not resume or c > resume:
                codes.append(c)
            d += datetime.timedelta(days=1)
        log(f"BACKFILL {start}..{end}: {len(codes)} day codes"
            + (f" (resuming after {resume})" if resume else ""))
        # The range is recorded so a leg that dies can be re-dispatched by
        # the daily job (--resume-check) without a human remembering it.
        write_progress(db, **{"from": args.from_, "to": args.to, "complete": False})
        stopped = False
        total_req = 0
        total_added = {name: 0 for name in PROGRAMS}
        cap = args.cap or BACKFILL_REQUEST_CAP
        for i in range(0, len(codes), 10):
            group = codes[i:i + 10]
            windows = day_windows(db, group)
            requests, added, done = probe_days(db, windows, cap - total_req, DISCOVERY_SOURCE)
            total_req += requests
            for k, v in added.items():
                total_added[k] += v
            if done:
                write_progress(db, max(done))
            if total_req >= cap or len(done) < len(windows):
                log(f"backfill: stopped at cap ({total_req} requests); re-run to resume")
                stopped = True
                break
        if not stopped:
            write_progress(db, complete=True)
            log(f"backfill: complete through {end}")
        log(f"backfill: {total_req} requests, new cases {total_added}")
        failed = finish_docs()
        record_run(db, "ingest_pwd_status_direct.py --backfill",
                   status="ok" if not failed else "partial",
                   rows_written=sum(total_added.values()),
                   note=f"{start}..{end}, {total_req} requests"
                        + (f"; failed: {', '.join(k for k, _ in failed)}"
                           if failed else ""))
        return _tail_exit(failed)

    if args.pending or args.full:
        results = {}
        for name in programs_from(args.program):
            results[name] = sweep(db, name, pending_only=not args.full, limit=args.limit,
                                  window_days=PROGRAMS[name]["full_window_days"] if args.full else None)
        # Discovery is the unified serial walk in ingest_case_status_direct.py
        # (its nightly full sweep, or --discover). It asks every busy prefix
        # for each span and hands P-/I- hits to insert_hits above, so these
        # tables' frontiers move with PERM's instead of being seeded FROM it.
        # The day-window probe (day_windows/probe_days) now serves --discover
        # and --backfill only. The old in-pass probe printed "discover: 0
        # requests" for three days, recorded ok, and stamped freshness.
        log("discover: delegated to ingest_case_status_direct.py --discover (the serial walk)")
        # Was a second copy of finish_docs's loop, drifted: this one stamped
        # freshness for a program whose doc had just been declined, the other
        # did not. Two callers is enough to share.
        def _note(name: str) -> str | None:
            res = results.get(name)
            if res is None:
                return None
            if res["checked"] == 0:
                # Nothing was asked, so nothing is fresher. The LCA pending
                # pass is 0 every day (LCAs are final within a week); it is
                # the weekly window pass that earns that table its stamp.
                log(f"  {name}: 0 checked; not stamping {PROGRAMS[name]['freshness']}")
                return None
            return f"{res['checked']:,} checked, {res['moved']:,} moved"

        failed = finish_docs(_note)
        record_run(db, f"ingest_pwd_status_direct.py --{'full' if args.full else 'pending'} "
                       f"--program {args.program}",
                   status="ok" if not failed else "partial",
                   rows_written=sum(r["moved"] for r in results.values()),
                   note=f"{sum(r['checked'] for r in results.values()):,} checked in "
                        f"{time.time()-started:.0f}s"
                        + (f"; failed: {', '.join(k for k, _ in failed)}"
                           if failed else ""))
        return _tail_exit(failed)

    ap.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
