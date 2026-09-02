#!/usr/bin/env python3
"""Per-case status for PREVAILING WAGE (ETA-9141) and LCA (ETA-9035) filings,
straight from flag.dol.gov: one prober, two tables.

WHAT THIS IS. Every DOL foreign-labor filing gets a FLAG case number:
`G-100-` for a PERM, `P-100-` for the prevailing wage request that precedes
it, `I-200-` (H-1B) and `I-203-` for labor condition applications. The
applicant usually never sees the P- or I- number, and the question people
ask is the same one they ask about PERM: find my number from the employer,
the title and roughly when it was filed, then tell me where it is.

THREE FACTS, MEASURED 2026-09-02, THAT MAKE THIS ONE SCRIPT:

1. DOL's batch case-status endpoint SERVES ALL OF THEM, with the same fields
   (status, employer, job title, submitted date, visaType). FLAG's own page
   lists PERM, prevailing wage and LCA among the programs the search covers.

2. EVERY PROGRAM DRAWS FROM ONE SERIAL COUNTER. On day code 26239
   (2026-08-27) serials 199900-199949 held PERM cases already in our corpus,
   14 H-1B LCAs, 2 I-203 LCAs and a run of PWDs. So the serial range the
   PERM corpus already knows for each filing day IS the range to probe, and
   a serial that hits under one prefix cannot be a case under another: the
   prober walks each day's range once, tries prefixes in measured hit-rate
   order, and drops a serial the moment it is claimed. Roughly a third of
   the counter is LCAs, a quarter PWDs, a tenth PERMs.

3. The counter advances ~3,000 a day. With claimed serials dropped, a day is
   ~180 requests across every prefix, the last week ~1,300, and a backfill
   to January ~45,000: a few CI runs at a polite pace, then ~20 minutes a
   day.

SEPARATE TABLES PER PROGRAM, ON PURPOSE. The PERM tables feed the queue
census, the review-stage pages, the RFI funnel and the alert sweep, all of
which assume a PERM status vocabulary; ten P-/I- rows had already leaked
into them through the web lookup before this existed. `pwd_case_status` and
`lca_case_status` mirror the PERM pair, and their final-status sets are
pinned against the TypeScript readers by tests.

STATUS VOCABULARIES, as observed. PWD: IN PROCESS, DETERMINATION ISSUED,
REDETERMINATION AFFIRMED / MODIFIED, WITHDRAWN. LCA: IN PROCESS, CERTIFIED,
WITHDRAWN (DOL's target for an LCA is seven business days, so its pending
set is small). A status outside a program's known set is treated as pending
and re-swept, the safe failure, and logged so the set grows from evidence.

    python3 scripts/ingest_pwd_status_direct.py --discover                       # last 7 filing days, both programs
    python3 scripts/ingest_pwd_status_direct.py --backfill --from 2026-01-01 --to 2026-08-31
    python3 scripts/ingest_pwd_status_direct.py --pending [--program pwd|lca|all]   # daily
    python3 scripts/ingest_pwd_status_direct.py --full [--program ...]              # weekly
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, lit, record_run, stamp_freshness  # noqa: E402
from ingest_case_status_direct import (  # noqa: E402
    BATCH, CASE_RE, PACE_S, _rows, decode_filing_date, log, lookup_with_retry,
)
from build_entity_detail import _search_slug  # noqa: E402

PERM_PREFIX = "G-100-"

PROGRAMS: dict[str, dict] = {
    "pwd": {
        "label": "prevailing wage",
        "table": "pwd_case_status",
        "events": "pwd_case_events",
        "prefixes": ["P-100-"],
        "final": {"DETERMINATION ISSUED", "REDETERMINATION AFFIRMED",
                  "REDETERMINATION MODIFIED", "WITHDRAWN", "DENIED"},
        "pending": {"IN PROCESS"},
        "doc": "pwd_live_summary",
        "freshness": "pwd-status",
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
    },
}
PREFIX_TO_PROGRAM = {p: name for name, cfg in PROGRAMS.items() for p in cfg["prefixes"]}
# Probe order across programs, by measured hit rate: the more a prefix
# claims early, the fewer serials the rarer prefixes are asked about.
DISCOVERY_ORDER = ["I-200-", "P-100-", "I-203-", "I-201-", "I-202-"]

# Kept under their original names: scripts/test_pwd_status.py imports them.
PREFIX = "P-100-"
PWD_FINAL = PROGRAMS["pwd"]["final"]
KNOWN_STATUSES = PWD_FINAL | PROGRAMS["pwd"]["pending"]

SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)"
DISCOVERY_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, discovered)"

DISCOVERY_DAY_WINDOW = 7
DISCOVERY_REQUEST_CAP = 2000
BACKFILL_REQUEST_CAP = 9000
EDGE_PAD = 300
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
        for stmt in table_ddl(cfg):
            db.execute(stmt)
        # A column added after the table existed; CREATE TABLE IF NOT EXISTS
        # is a no-op on a live database. Idempotent afterwards.
        have = {r[1] for r in _rows(db, f"PRAGMA table_info({cfg['table']})")}
        if "visa_type" not in have:
            db.execute(f"ALTER TABLE {cfg['table']} ADD COLUMN visa_type TEXT")
            log(f"  added column {cfg['table']}.visa_type")


# ---------------------------------------------------------------------------
# Serial windows
# ---------------------------------------------------------------------------

def day_code(d: datetime.date) -> str:
    return f"{d.year % 100:02d}{d.timetuple().tm_yday:03d}"


def serial_of(case_number: str) -> int | None:
    m = CASE_RE.match(case_number)
    return int(m.group(3)) if m else None


def _serial_stats(db: Turso, table: str, like: str, codes: list[str]):
    marks = ",".join("?" for _ in codes)
    return _rows(
        db,
        f"SELECT substr(case_number, 7, 5) AS day, "
        f"       MIN(CAST(substr(case_number, 13) AS INTEGER)), "
        f"       MAX(CAST(substr(case_number, 13) AS INTEGER)) "
        f"  FROM {table} WHERE case_number LIKE ? "
        f"   AND substr(case_number, 7, 5) IN ({marks}) GROUP BY day",
        [like, *codes])


def day_windows(db: Turso, codes: list[str]) -> dict[str, tuple[int, int]]:
    """Per day code, the serial range to probe: what the PERM corpus and our
    own tables already know for that day, padded at both edges.

    The PERM sample under-reads the day's true edges (a day's first filing is
    rarely a PERM), so each edge is padded by EDGE_PAD and, where the next
    day is known, the top edge stops just under the next day's floor.
    """
    if not codes:
        return {}
    out: dict[str, list[int]] = {}
    sources = [("perm_case_status", PERM_PREFIX + "%")]
    for cfg in PROGRAMS.values():
        sources.append((cfg["table"], cfg["prefixes"][0][0] + "-%"))
    for table, like in sources:
        for day, lo, hi in _serial_stats(db, table, like, codes):
            if lo is None or hi is None:
                continue
            cur = out.setdefault(str(day), [int(lo), int(hi)])
            cur[0] = min(cur[0], int(lo))
            cur[1] = max(cur[1], int(hi))
    ordered = sorted(out.items())
    windows: dict[str, tuple[int, int]] = {}
    for i, (day, (lo, hi)) in enumerate(ordered):
        top = hi + EDGE_PAD
        if i + 1 < len(ordered):
            top = min(top, max(hi, ordered[i + 1][1][0] - 1))
        windows[day] = (max(1, lo - EDGE_PAD), top)
    return windows


def known_serials(db: Turso, code: str) -> set[int]:
    """Every serial already claimed for a day, across ALL programs."""
    known: set[int] = set()
    for table, like in [("perm_case_status", f"{PERM_PREFIX}{code}-%")] + [
            (cfg["table"], f"{cfg['prefixes'][0][0]}-%-{code}-%") for cfg in PROGRAMS.values()]:
        for (s,) in _rows(db, f"SELECT CAST(substr(case_number, 13) AS INTEGER) FROM {table} "
                              f"WHERE case_number LIKE ?", [like]):
            known.add(int(s))
    return known


def candidate_batches(code: str, lo: int, hi: int, known: set[int], prefix: str = PREFIX):
    chunk: list[str] = []
    for s in range(lo, hi + 1):
        if s in known:
            continue
        chunk.append(f"{prefix}{code}-{s}")
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


def _stmt(sql: str, args: list) -> dict:
    return {"type": "execute", "stmt": {"sql": sql, "args": [lit(a) for a in args]}}


def _run_pipeline(db: Turso, stmts: list[dict]) -> list[int]:
    """Statements in chunks of 200; returns affected-row counts in order."""
    out: list[int] = []
    for i in range(0, len(stmts), 200):
        chunk = stmts[i:i + 200]
        res = db.pipeline(chunk + [{"type": "close"}])
        for r in res.get("results", [])[:len(chunk)]:
            out.append(int(r.get("response", {}).get("result", {}).get("affected_row_count", 0) or 0))
    return out


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
        stmts.append(_stmt(_insert_sql(PROGRAMS[program]["table"]), [
            cn, decode_filing_date(cn), status, is_final(status, program), name,
            _search_slug(name) if name else None, v.get("jobTitle"),
            (v.get("visaType") or "").strip() or None, v.get("submittedDate"),
            now_iso, now_iso, source, stamp]))
    return sum(1 for n in _run_pipeline(db, stmts) if n) if stmts else 0


def probe_days(db: Turso, windows: dict[str, tuple[int, int]], cap: int,
               source: str) -> tuple[int, dict[str, int], list[str]]:
    """Every unknown serial in each window, each prefix in turn, claimed
    serials dropped as they hit. Returns (requests, added per program, days done)."""
    requests = 0
    added = {name: 0 for name in PROGRAMS}
    done: list[str] = []
    for code in sorted(windows):
        lo, hi = windows[code]
        known = known_serials(db, code)
        log(f"  {code}: serials {lo:,}-{hi:,}, {len(known):,} already known")
        stopped = False
        claimed: set[int] = set(known)
        for prefix in DISCOVERY_ORDER:
            program = PREFIX_TO_PROGRAM[prefix]
            for chunk in candidate_batches(code, lo, hi, claimed, prefix):
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

def sweep(db: Turso, program: str, pending_only: bool, limit: int | None) -> dict:
    cfg = PROGRAMS[program]
    table, events = cfg["table"], cfg["events"]
    where = "WHERE is_final = 0 OR is_final = '0'" if pending_only else ""
    rows = {
        r[0]: r[1:] for r in _rows(
            db,
            f"SELECT case_number, current_status, employer_name, job_title "
            f"FROM {table} {where} ORDER BY case_number LIMIT {limit or 10**9}")
    }
    todo = sorted(rows)
    log(f"{program}: {len(todo):,} cases to check, {BATCH} per request "
        f"= {(len(todo)+BATCH-1)//BATCH:,} requests")
    checked = moved = missing = fails = 0
    stamp = int(time.time() * 1000)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pending_writes: list[dict] = []

    def flush() -> None:
        if pending_writes:
            _run_pipeline(db, pending_writes)
            pending_writes.clear()

    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        try:
            got = lookup_with_retry(chunk)
            fails = 0
        except Exception as exc:  # noqa: BLE001
            fails += 1
            log(f"  batch {i//BATCH+1}: {exc}")
            if fails >= 3:
                flush()
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
            visa = (v.get("visaType") or "").strip() or None
            if new_status and new_status != old_status:
                moved += 1
                fin = is_final(new_status, program)
                pending_writes.append(_stmt(
                    f"UPDATE {table} SET current_status=?, is_final=?, employer_name=?, "
                    f"job_title=?, visa_type=COALESCE(?, visa_type), last_checked_at=?, "
                    f"source=?, fetched_at=? WHERE case_number=?",
                    [new_status, fin, v.get("employerName") or old[1],
                     v.get("jobTitle") or old[2], visa, now_iso, SOURCE, stamp, cn]))
                pending_writes.append(_stmt(
                    f"INSERT OR IGNORE INTO {events} (case_number, changed_at, from_status, "
                    f"to_status, to_final, source) VALUES (?,?,?,?,?,?)",
                    [cn, stamp, old_status, new_status, fin, SOURCE]))
            else:
                pending_writes.append(_stmt(
                    f"UPDATE {table} SET last_checked_at=?, visa_type=COALESCE(visa_type, ?) "
                    f"WHERE case_number=?",
                    [now_iso, visa, cn]))
        missing += len(chunk) - len(seen)
        # Written as it goes, so a shutdown mid-run keeps the work.
        if len(pending_writes) >= 400:
            flush()
        if (i // BATCH) % 40 == 0 and i:
            log(f"  {i:,}/{len(todo):,}  moved={moved:,}  missing={missing:,}")
        time.sleep(PACE_S)
    flush()
    log(f"{program}: checked {checked:,}  moved {moved:,}  not found {missing:,}")
    return {"checked": checked, "moved": moved, "missing": missing}


# ---------------------------------------------------------------------------
# Summary docs
# ---------------------------------------------------------------------------

def write_summary_doc(db: Turso, program: str = "pwd") -> bool:
    """perm_docs[<program>_live_summary]: counts by status, program tag and
    filing month, so the pages never count the table per request. Reconciled
    against COUNT(*) before writing; a mismatch leaves the previous doc."""
    cfg = PROGRAMS[program]
    table, key = cfg["table"], cfg["doc"]
    by_status = {s: int(n) for s, n in _rows(
        db, f"SELECT current_status, COUNT(*) FROM {table} GROUP BY current_status")}
    by_visa = {(v or "unknown"): int(n) for v, n in _rows(
        db, f"SELECT visa_type, COUNT(*) FROM {table} GROUP BY visa_type")}
    by_month_rows = _rows(
        db,
        f"SELECT substr(filing_date, 1, 7) AS m, COUNT(*), SUM(is_final) "
        f"FROM {table} WHERE filing_date IS NOT NULL GROUP BY m ORDER BY m DESC")
    total = int(_rows(db, f"SELECT COUNT(*) FROM {table}")[0][0] or 0)
    if sum(by_status.values()) != total:
        log(f"  MISMATCH {key} {sum(by_status.values()):,} vs count {total:,}; doc not written")
        return False
    final = sum(n for s, n in by_status.items() if (s or "").upper() in cfg["final"])
    earliest = _rows(db, f"SELECT MIN(first_seen_at) FROM {table}")[0][0]
    doc = {
        "total": total,
        "pending": total - final,
        "decided": final,
        "byStatus": dict(sorted(by_status.items(), key=lambda kv: -kv[1])),
        "byVisaType": dict(sorted(by_visa.items(), key=lambda kv: -kv[1])),
        "byMonth": [{"month": m, "total": int(n), "decided": int(f or 0),
                     "pending": int(n) - int(f or 0)} for m, n, f in by_month_rows if m],
        "sinceFirstSeen": earliest,
        "asOf": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
               [key, payload, int(time.time() * 1000)])
    got = _rows(db, "SELECT length(json) FROM perm_docs WHERE key = ?", [key])
    ok = bool(got) and int(got[0][0] or 0) == len(payload)
    log(f"  {'ok ' if ok else 'MISMATCH'} perm_docs[{key}]  {total:,} cases, "
        f"{total - final:,} pending, {len(doc['byMonth'])} months")
    return ok


def read_progress(db: Turso) -> str | None:
    got = _rows(db, "SELECT json FROM perm_docs WHERE key = ?", [PROGRESS_KEY])
    if not got:
        return None
    try:
        return json.loads(got[0][0]).get("lastDayDone")
    except (TypeError, ValueError):
        return None


def write_progress(db: Turso, last_day: str) -> None:
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
               [PROGRESS_KEY, json.dumps({"lastDayDone": last_day}), int(time.time() * 1000)])


# ---------------------------------------------------------------------------

def programs_from(arg: str) -> list[str]:
    return list(PROGRAMS) if arg == "all" else [arg]


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
    ap.add_argument("--full", action="store_true", help="Re-check every case.")
    ap.add_argument("--program", choices=[*PROGRAMS, "all"], default="all")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    db = Turso()
    ensure_schema(db)
    today = datetime.date.today()
    started = time.time()

    def finish_docs(added: dict[str, int] | None = None) -> None:
        for name in PROGRAMS:
            write_summary_doc(db, name)
            if added is not None:
                stamp_freshness(db, PROGRAMS[name]["freshness"],
                                source="flag.dol.gov case status (DOL, direct)",
                                cadence="Daily", note=f"{added.get(name, 0)} discovered",
                                max_age_days=3)

    if args.discover:
        codes = [day_code(today - datetime.timedelta(days=i)) for i in range(args.days)]
        windows = day_windows(db, codes)
        log(f"DISCOVER: {len(windows)} of {len(codes)} day codes have a serial window")
        requests, added, done = probe_days(db, windows, args.cap or DISCOVERY_REQUEST_CAP,
                                           DISCOVERY_SOURCE)
        log(f"discover: {requests} requests, new cases {added}, days done {done}")
        finish_docs(added)
        record_run(db, "ingest_pwd_status_direct.py --discover", status="ok",
                   rows_written=sum(added.values()),
                   note=f"{requests} requests in {time.time()-started:.0f}s")
        return 0

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
                break
        log(f"backfill: {total_req} requests, new cases {total_added}")
        finish_docs()
        record_run(db, "ingest_pwd_status_direct.py --backfill", status="ok",
                   rows_written=sum(total_added.values()),
                   note=f"{start}..{end}, {total_req} requests")
        return 0

    if args.pending or args.full:
        results = {}
        for name in programs_from(args.program):
            results[name] = sweep(db, name, pending_only=not args.full, limit=args.limit)
        added = None
        if args.full or not args.limit:
            codes = [day_code(today - datetime.timedelta(days=i)) for i in range(args.days)]
            windows = day_windows(db, codes)
            requests, added, _ = probe_days(db, windows, DISCOVERY_REQUEST_CAP, DISCOVERY_SOURCE)
            log(f"discover: {requests} requests, new cases {added}")
        for name in PROGRAMS:
            write_summary_doc(db, name)
            res = results.get(name)
            if res is not None:
                stamp_freshness(db, PROGRAMS[name]["freshness"],
                                source="flag.dol.gov case status (DOL, direct)",
                                cadence="Daily",
                                note=f"{res['checked']:,} checked, {res['moved']:,} moved",
                                max_age_days=3)
        record_run(db, f"ingest_pwd_status_direct.py --{'full' if args.full else 'pending'} "
                       f"--program {args.program}",
                   status="ok", rows_written=sum(r["moved"] for r in results.values()),
                   note=f"{sum(r['checked'] for r in results.values()):,} checked in "
                        f"{time.time()-started:.0f}s")
        return 0

    ap.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
