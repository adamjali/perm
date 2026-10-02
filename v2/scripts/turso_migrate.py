#!/usr/bin/env python3
"""Load the public DOL case corpus into the database (`perm_cases`).

Only rows the Department of Labor publishes itself: case number, status, dates,
employer, state, job title, SOC, attorney, wage. DOL's disclosure files carry
no beneficiary name, so this identifies employers and law firms (public
business information) and never an individual. Nothing belonging to a user of
this product is written here; accounts and their own cases live in Convex, and
the token the web app reads this database with is read-only.

The entity key and slug rules are imported from the scripts that own them
rather than ported: a slug computed differently in the writer than in the
reader is a detail page that 404s from its own index.
"""
from __future__ import annotations

import gzip
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from entity_identity import entity_key  # noqa: E402
from lib_load_guard import drift_findings, sanity_findings  # noqa: E402
from lib_turso import (  # noqa: E402
    Turso, add_missing_columns, canon, canon_hash, case_update, query_rows, read_doc, stmt,
    write_doc,
)
from lib_slugs import with_unique_slugs  # noqa: E402

COLUMNS = [
    "case_number", "status", "received_date", "decision_date", "days",
    "fiscal_year", "employer_name", "employer_slug", "state", "job_title",
    "soc_code", "soc_title", "attorney_name", "attorney_slug", "wage",
    "naics", "worksite_city",
    "citizenship", "birth_country", "visa_class", "education", "major",
    "institution", "job_education",
]
# The first CORE columns are the ones every load has carried since the table
# was made. The two after them (the employer's NAICS code and the worksite city)
# are unindexed, so an incremental load that finds only those different UPDATEs
# them in place: one row write, where an INSERT OR REPLACE would also rewrite
# every index.
CORE = 15
EXTRA = COLUMNS[CORE:]
# 24 columns. SQLite 3.47 caps bound parameters at 32,766, so 500 rows is
# 12,000 - comfortably under, and large enough that the round trip dominates.
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
         wage          REAL,
         naics         TEXT,
         worksite_city TEXT,
         citizenship   TEXT,
         birth_country TEXT,
         visa_class    TEXT,
         education     TEXT,
         major         TEXT,
         institution   TEXT,
         job_education TEXT
       )""",
]

# Built after the load: indexing every row once is far cheaper than maintaining
# each index across hundreds of insert statements. SQLite serves a query from
# any prefix of a composite index, so (state, status, decision_date) also
# answers "by state" and "by state and status".
INDEXES = [
    "CREATE INDEX idx_pc_decision      ON perm_cases(decision_date)",
    # Filing-month cohorts (the getCohortDuration fallback), which would
    # otherwise scan the table.
    "CREATE INDEX idx_pc_received      ON perm_cases(received_date, days)",
    "CREATE INDEX idx_pc_status_dec    ON perm_cases(status, decision_date)",
    "CREATE INDEX idx_pc_state_dec     ON perm_cases(state, decision_date)",
    "CREATE INDEX idx_pc_state_st_dec  ON perm_cases(state, status, decision_date)",
    "CREATE INDEX idx_pc_soc_dec       ON perm_cases(soc_code, decision_date)",
    "CREATE INDEX idx_pc_soc_st_dec    ON perm_cases(soc_code, status, decision_date)",
    "CREATE INDEX idx_pc_emp_dec       ON perm_cases(employer_slug, decision_date)",
    "CREATE INDEX idx_pc_emp_st_dec    ON perm_cases(employer_slug, status, decision_date)",
    "CREATE INDEX idx_pc_att_dec       ON perm_cases(attorney_slug, decision_date)",
    "CREATE INDEX idx_pc_att_st_dec    ON perm_cases(attorney_slug, status, decision_date)",
    # The occupation pair is on the 6-digit group: `perm_cases` holds both
    # spellings of one occupation (dotted `15-1252.00` and bare `15-1252`), so
    # an exact `soc_code = ?` would silently drop part of it. `idx_pc_soc_dec`
    # above stays: it is on the bare column, can't serve the expression, and
    # dropping it would change other plans.
    "CREATE INDEX idx_pc_socg_dec      ON perm_cases(substr(soc_code, 1, 7), decision_date)",
    "CREATE INDEX idx_pc_socg_st_dec   ON perm_cases(substr(soc_code, 1, 7), status, decision_date)",
    # Two equalities as a seek, so a lead combined with a second filter (a firm
    # and a state, a state and an occupation) reads only the rows it returns
    # instead of walking the lead's whole slice; that is what lets every filter
    # be combined. `decision_date` is last in each so `ORDER BY decision_date
    # DESC` stays free, as it is for the single-equality indexes above.
    "CREATE INDEX idx_pc_att_state_dec ON perm_cases(attorney_slug, state, decision_date)",
    "CREATE INDEX idx_pc_att_soc_dec   ON perm_cases(attorney_slug, substr(soc_code, 1, 7), decision_date)",
    "CREATE INDEX idx_pc_state_soc_dec ON perm_cases(state, substr(soc_code, 1, 7), decision_date)",
    # A covering index for the /perm-wages band aggregation, so that GROUP BY
    # reads the index alone rather than scanning the table. `perm_cases` is
    # rebuilt quarterly, so the write cost of another index is close to nothing.
    "CREATE INDEX idx_pc_fy_wage       ON perm_cases(fiscal_year, wage)",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def slug_maps(payload: dict) -> tuple[dict[str, str], dict[str, str]]:
    """entity_key(name) -> slug, for employers and law firms.

    Mirrors lib_slugs.py exactly: sort by volume descending, THEN assign
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
                r.get("naics"), r.get("worksiteCity"),
                r.get("citizenship"), r.get("birthCountry"), r.get("visaClass"),
                r.get("education"), r.get("major"), r.get("institution"),
                r.get("jobEducation"),
            )


def row_fingerprint(row: tuple) -> str:
    """A short hash of everything except the key.

    Cheap change detection. A quarterly disclosure file is a superset of the
    last one: most rows are byte-identical, a few thousand have a new decision,
    and the rest are new cases, so writing only what moved is a fraction of
    rewriting every row and every index.
    """
    return canon_hash(row[1:CORE])


def extras_of(row: tuple) -> tuple[str, ...]:
    """The unindexed columns, canonicalised, compared on their own."""
    return tuple(canon(v) for v in row[CORE:])


def existing_fingerprints(db: Turso) -> dict[str, tuple[str, tuple[str, ...]]]:
    """case_number -> (fingerprint of the core columns, the extras) for
    everything already stored.

    Read in pages: the whole table in one response is tens of megabytes of JSON,
    past the pipeline's response cap.
    """
    out: dict[str, str] = {}
    page = 20000
    after = ""
    while True:
        rows = query_rows(db, f"SELECT {','.join(COLUMNS)} FROM perm_cases "
                              "WHERE case_number > ? ORDER BY case_number LIMIT ?", [after, page])
        if not rows:
            break
        for r in rows:
            vals = tuple(r)
            out[str(vals[0])] = (row_fingerprint(vals), extras_of(vals))
        after = str(rows[-1][0])
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

    # The load guard, before any write. The parser recorded the file's shape in
    # the artifact's meta (which columns resolved per fiscal year, blank shares,
    # the median wage, impossible values); the previous load's shape is in
    # perm_docs, so a column DOL renamed can't land as NULL under a green run.
    # `--accept-drift` overrides the drift half for a human who has read the
    # parser's log; nothing overrides impossible values.
    meta_path = pathlib.Path(str(cases) + ".meta.json")
    fingerprint = None
    if meta_path.exists():
        fingerprint = json.load(open(meta_path)).get("fingerprint")
    if fingerprint:
        baseline = read_fingerprint(db)
        findings = sanity_findings(fingerprint)
        drift = drift_findings(baseline, fingerprint)
        log(f"  guard: {int(fingerprint.get('rows') or 0):,} rows, impossible "
            f"{float(fingerprint.get('badShare') or 0):.2%}, baseline "
            f"{'present' if baseline else 'none'}, "
            + (f"{len(drift)} drift finding(s)" if drift else "no drift"))
        for finding in drift:
            log(f"    DRIFT: {finding}")
        if drift and "--accept-drift" in sys.argv:
            log("    --accept-drift: loading anyway on a human's say-so")
        elif drift:
            findings.extend(drift)
        if findings:
            log("  FATAL: refused before any write: " + "; ".join(findings))
            log("  Re-run the parser with --dump-header on the newest file, read the "
                "columns, then pass --accept-drift to this loader if DOL really changed it.")
            return 1
    else:
        log("  guard: the artifact carries no fingerprint (an older parser); loading unguarded")

    incremental = "--incremental" in sys.argv
    if incremental:
        # CREATE TABLE runs only on a full load; an incremental load writes into
        # the live table, which would reject a column it has never had.
        added = add_missing_columns(db, "perm_cases", {c: "TEXT" for c in EXTRA})
        if added:
            log(f"  added column(s) {added} to the live table")
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
        pending.append(stmt(insert_head + ",".join([placeholders] * len(batch)),
                            [v for row in batch for v in row]))
        batch = []

    def flush_request():
        nonlocal pending
        if not pending:
            return
        db.pipeline(pending + [{"type": "close"}])
        pending = []

    skipped = 0
    narrow: list[tuple] = []
    narrowed = 0

    def flush_narrow():
        nonlocal narrow, narrowed
        if not narrow:
            return
        pending.append(case_update("perm_cases", "case_number", EXTRA,
                                   [(r[0], *r[CORE:]) for r in narrow]))
        narrowed += len(narrow)
        narrow = []
        if len(pending) >= STMTS_PER_REQUEST:
            flush_request()

    for row in rows_from(cases, employers, firms):
        if incremental:
            stored = have.get(str(row[0]))
            if stored and stored[0] == row_fingerprint(row):
                if stored[1] == extras_of(row):
                    skipped += 1
                else:
                    narrow.append(row)
                    if len(narrow) >= NARROW_ROWS:
                        flush_narrow()
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
    flush_narrow()
    flush_request()
    log(f"  wrote {sent:,} rows in {time.time() - t0:,.0f}s"
        + (f"  ({skipped:,} unchanged, skipped; {narrowed:,} updated in "
           f"{', '.join(EXTRA)} only)" if incremental else ""))

    if incremental:
        # The indexes already exist and were maintained by the writes above.
        # Rebuilding them would undo the entire point of the incremental path.
        got = int(db.scalar("SELECT count(*) FROM perm_cases") or 0)
        log(f"  VERIFY count(*) = {got:,}")
        write_fingerprint(db, fingerprint)
        return 0

    log("  building indexes")
    ti = time.time()
    for ddl in INDEXES:
        db.execute(ddl)
    log(f"  {len(INDEXES)} indexes in {time.time() - ti:,.0f}s")

    # Verify against the table, never against the counter that wrote it: a
    # loader that reports its own intent is not a verification.
    got = int(db.scalar("SELECT count(*) FROM perm_cases") or 0)
    log(f"  VERIFY count(*) = {got:,}  (streamed {sent:,})")
    if got != sent:
        log("  FATAL: row count disagrees with what was streamed"); return 1
    write_fingerprint(db, fingerprint)
    return 0


# Rows per narrow UPDATE. A row costs two parameters per EXTRA column plus one
# in the IN list (19 with nine columns), so 200 rows is 3,800 parameters.
NARROW_ROWS = 200

FINGERPRINT_KEY = "perm_cases_fingerprint"


def read_fingerprint(db) -> dict | None:
    try:
        return read_doc(db, FINGERPRINT_KEY)
    except Exception:  # noqa: BLE001 - a database that has never had perm_docs
        return None


def write_fingerprint(db, fingerprint: dict | None) -> None:
    """Recorded only after VERIFY passed: a refused or failed load must not
    become the baseline the next load is judged against."""
    if not fingerprint:
        return
    db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    write_doc(db, FINGERPRINT_KEY, fingerprint)
    log("  guard: fingerprint recorded as the baseline for the next load")


if __name__ == "__main__":
    sys.exit(main())
