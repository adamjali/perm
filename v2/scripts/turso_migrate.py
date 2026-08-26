#!/usr/bin/env python3
"""Load the PUBLIC DOL case corpus into Turso.

WHAT IS IN HERE, AND WHAT IS DELIBERATELY NOT
---------------------------------------------
Only rows the Department of Labor publishes itself: case number, status,
dates, employer, state, job title, SOC, attorney, wage. DOL's disclosure
files carry NO beneficiary name, so this identifies employers and law firms
(public business information) and never an individual.

Nothing belonging to a user of this product is written here. Accounts, their
own tracked cases, chat history and audit logs stay on Convex. The database
is named `permtracker-public-data` so that invariant is visible from the
dashboard, and the token the web app uses is READ-ONLY.

WHY THIS MOVED OFF CONVEX
-------------------------
373,939 rows with 11 indexes and 2 search indexes exceeded Convex's 0.5 GB
free tier and disabled the whole deployment, reads included. The data is
public, read-mostly, and rewritten once a quarter, which is a workload
SQLite is very good at and a reactive document store is expensive at.

WHY THE SLUGS ARE IMPORTED RATHER THAN RECOMPUTED
-------------------------------------------------
`entity_key` merges the spellings DOL prints for one firm (Fragomen appears
six ways); `with_unique_slugs` then disambiguates what is left, in volume
order, so the busiest spelling keeps the clean slug. Both already exist. A
slug computed differently in the writer than in the reader is a detail page
that 404s from its own index, so this imports them instead of porting them.
"""
from __future__ import annotations

import gzip
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from ingest_perm_disclosure import entity_key  # noqa: E402
from lib_turso import Turso, lit  # noqa: E402
from store_entities import with_unique_slugs  # noqa: E402

COLUMNS = [
    "case_number", "status", "received_date", "decision_date", "days",
    "fiscal_year", "employer_name", "employer_slug", "state", "job_title",
    "soc_code", "soc_title", "attorney_name", "attorney_slug", "wage",
]
# 15 columns. SQLite 3.47 caps bound parameters at 32,766, so 500 rows is
# 7,500 - comfortably under, and large enough that the round trip dominates.
ROWS_PER_STMT = 500
STMTS_PER_REQUEST = 4

SCHEMA = [
    "DROP TABLE IF EXISTS perm_cases_fts",
    "DROP TABLE IF EXISTS perm_cases",
    """CREATE TABLE perm_cases (
         case_number   TEXT PRIMARY KEY,
         status        TEXT NOT NULL,
         received_date TEXT,
         decision_date TEXT,
         days          INTEGER,
         fiscal_year   TEXT,
         employer_name TEXT,
         employer_slug TEXT,
         state         TEXT,
         job_title     TEXT,
         soc_code      TEXT,
         soc_title     TEXT,
         attorney_name TEXT,
         attorney_slug TEXT,
         wage          REAL
       )""",
]

# Built AFTER the load: indexing 374k rows once is far cheaper than
# maintaining ten B-trees across 748 insert statements.
#
# Fewer indexes than Convex needed, and not because we are cutting corners:
# SQLite can serve a query from any PREFIX of a composite index, so
# (state, status, decision_date) also answers "by state" and
# "by state and status". Convex requires an exact index per access path,
# which is a large part of why the storage bill got away from us.
INDEXES = [
    "CREATE INDEX idx_pc_decision      ON perm_cases(decision_date)",
    "CREATE INDEX idx_pc_status_dec    ON perm_cases(status, decision_date)",
    "CREATE INDEX idx_pc_state_dec     ON perm_cases(state, decision_date)",
    "CREATE INDEX idx_pc_state_st_dec  ON perm_cases(state, status, decision_date)",
    "CREATE INDEX idx_pc_soc_dec       ON perm_cases(soc_code, decision_date)",
    "CREATE INDEX idx_pc_soc_st_dec    ON perm_cases(soc_code, status, decision_date)",
    "CREATE INDEX idx_pc_emp_dec       ON perm_cases(employer_slug, decision_date)",
    "CREATE INDEX idx_pc_emp_st_dec    ON perm_cases(employer_slug, status, decision_date)",
    "CREATE INDEX idx_pc_att_dec       ON perm_cases(attorney_slug, decision_date)",
    "CREATE INDEX idx_pc_att_st_dec    ON perm_cases(attorney_slug, status, decision_date)",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def slug_maps(payload: dict) -> tuple[dict[str, str], dict[str, str]]:
    """entity_key(name) -> slug, for employers and law firms.

    Mirrors store_entities.py exactly: sort by volume descending, THEN assign
    slugs, so the busier entity keeps the clean one and a later collision
    takes the -2 suffix. Reversing those two steps silently reassigns pages.
    """
    maps: list[dict[str, str]] = []
    for key, name_of in (("topEmployers", lambda r: r["name"]),
                         ("topAttorneys", lambda r: r["name"])):
        rows = payload.get(key) or []
        ordered = sorted(rows, key=lambda r: -r["total"])
        out: dict[str, str] = {}
        collisions = 0
        for slug, item in with_unique_slugs(ordered, name_of):
            k = entity_key(name_of(item))
            if k in out:
                collisions += 1
                continue
            out[k] = slug
        log(f"  {key:14s} {len(out):>6,} slugs"
            + (f"  ({collisions} merge-key collisions)" if collisions else ""))
        maps.append(out)
    return maps[0], maps[1]


def rows_from(cases_path: pathlib.Path, employers, firms):
    """Stream the NDJSON into column tuples. Streamed because 374k rows held
    as dicts is a quarter of a gigabyte before anything is serialised."""
    with gzip.open(cases_path, "rt", encoding="utf-8") as src:
        for line in src:
            r = json.loads(line)
            emp = r.get("employerName") or ""
            att = r.get("attorneyName") or ""
            yield (
                r["caseNumber"], r["status"], r.get("receivedDate"),
                r.get("decisionDate"), r.get("days"), r.get("fiscalYear"),
                emp or None,
                # "" means no entity page, which is the honest state for an
                # employer below the page floor. The UI renders those as text
                # rather than a link that would 404.
                employers.get(entity_key(emp), "") if emp else "",
                r.get("state"), r.get("jobTitle"), r.get("socCode"),
                r.get("socTitle"), att or None,
                firms.get(entity_key(att), "") if att else "",
                r.get("wage"),
            )


def row_fingerprint(row: tuple) -> str:
    """A short hash of everything except the key.

    Cheap change detection. A quarterly disclosure file is a SUPERSET of the
    last one: the vast majority of rows are byte-identical, a few thousand
    have a new decision, and the rest are new cases. Rewriting all 373,939
    every quarter costs ~4.76M row-writes (the table plus ten indexes);
    writing only what moved costs a fraction of that and finishes in seconds
    instead of four minutes.
    """
    import hashlib
    return hashlib.blake2b("\x1f".join(_canon(v) for v in row[1:]).encode(),
                           digest_size=8).hexdigest()


def _canon(v) -> str:
    """One spelling per value, whichever side it came from.

    SQLite stores `wage` as REAL, so a value written as the integer 93205
    comes back as 93205.0. Comparing str() of the two marks every waged row
    as changed - which is exactly what the first run of this did: it read all
    373,939 fingerprints correctly and then rewrote the table anyway. Both
    sides go through here so the comparison is about the VALUE, not about
    which type the storage layer happened to choose.
    """
    if v is None or v == "":
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    # 93205.0 and 93205 must produce the same string; 1.5 must survive.
    return str(int(f)) if f == int(f) else repr(f)


def existing_fingerprints(db: Turso) -> dict[str, str]:
    """case_number -> fingerprint for everything already stored.

    Read in pages: 373,939 rows in one response is tens of megabytes of JSON
    and the pipeline has a response cap.
    """
    out: dict[str, str] = {}
    page = 20000
    after = ""
    while True:
        res = db.execute(
            f"SELECT {','.join(COLUMNS)} FROM perm_cases "
            "WHERE case_number > ? ORDER BY case_number LIMIT ?", [after, page])
        rows = res["response"]["result"]["rows"]
        if not rows:
            break
        for r in rows:
            vals = tuple(None if c["type"] == "null" else c["value"] for c in r)
            out[str(vals[0])] = row_fingerprint(vals)
        after = str(out and rows[-1][0]["value"])
        if len(rows) < page:
            break
    return out


def main() -> int:
    artifact = pathlib.Path(sys.argv[1] if len(sys.argv) > 1
                            else sorted(pathlib.Path("/tmp/ingest-artifact").iterdir())[0])
    cases = artifact / "perm-cases.ndjson.gz"
    payload_path = artifact / "perm-payload.json"
    for p in (cases, payload_path):
        if not p.exists():
            log(f"FATAL: {p} not found"); return 1
    log(f"  artifact: {artifact}")

    db = Turso()
    log(f"  target:   {db.url}")

    employers, firms = slug_maps(json.load(open(payload_path)))

    incremental = "--incremental" in sys.argv
    if incremental:
        log("  incremental: reading existing fingerprints")
        have = existing_fingerprints(db)
        log(f"    {len(have):,} rows already stored")
        if not have:
            log("    table is empty - falling back to a full load")
            incremental = False
    if not incremental:
        have = {}
        log("  creating schema (dropping any previous load)")
        db.script(SCHEMA)

    placeholders = "(" + ",".join("?" * len(COLUMNS)) + ")"
    insert_head = f"INSERT OR REPLACE INTO perm_cases ({','.join(COLUMNS)}) VALUES "

    sent = 0
    t0 = time.time()
    pending: list[dict] = []
    batch: list[tuple] = []

    def flush_stmt():
        nonlocal batch
        if not batch:
            return
        sql = insert_head + ",".join([placeholders] * len(batch))
        args = [lit(v) for row in batch for v in row]
        pending.append({"type": "execute", "stmt": {"sql": sql, "args": args}})
        batch = []

    def flush_request():
        nonlocal sent, pending
        if not pending:
            return
        db.pipeline(pending + [{"type": "close"}])
        pending = []

    skipped = 0
    for row in rows_from(cases, employers, firms):
        if incremental and have.get(str(row[0])) == row_fingerprint(row):
            skipped += 1
            continue
        batch.append(row)
        sent += 1
        if len(batch) >= ROWS_PER_STMT:
            flush_stmt()
            if len(pending) >= STMTS_PER_REQUEST:
                flush_request()
                if sent % 50_000 < ROWS_PER_STMT * STMTS_PER_REQUEST:
                    rate = sent / max(time.time() - t0, 0.001)
                    log(f"    {sent:>7,} rows  ({rate:,.0f}/s)")
    flush_stmt()
    flush_request()
    log(f"  wrote {sent:,} rows in {time.time() - t0:,.0f}s"
        + (f"  ({skipped:,} unchanged, skipped)" if incremental else ""))

    if incremental:
        # The indexes already exist and were maintained by the writes above.
        # Rebuilding them would undo the entire point of the incremental path.
        got = int(db.scalar("SELECT count(*) FROM perm_cases") or 0)
        log(f"  VERIFY count(*) = {got:,}")
        return 0

    log("  building indexes")
    ti = time.time()
    for stmt in INDEXES:
        db.execute(stmt)
    log(f"  {len(INDEXES)} indexes in {time.time() - ti:,.0f}s")

    # Verify against the table, never against the counter that wrote it: a
    # loader that reports its own intent is not a verification.
    got = int(db.scalar("SELECT count(*) FROM perm_cases") or 0)
    log(f"  VERIFY count(*) = {got:,}  (streamed {sent:,})")
    if got != sent:
        log("  FATAL: row count disagrees with what was streamed"); return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
