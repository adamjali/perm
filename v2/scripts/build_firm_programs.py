#!/usr/bin/env python3
"""Each law firm's work outside PERM, worked out once a night: `firm_programs`.

A law firm's page shows its H-1B LCAs, prevailing wage requests and H-2A,
H-2B and CW-1 applications, and the employers it filed them for
(src/lib/db/firmPrograms.ts). Read live, the biggest firm's employers took
12.7 s and its count 8.7 s on the LCA database (permtracker-db-stats, Oct 31
2026), close to the read layer's 20-second deadline, on every page build. The
files behind them change only when DOL's disclosure files load, so this reads
each program table once, grouped by the printed firm and employer, rolls the
groups up to each firm page through `firm_page_map` (every printed spelling
that belongs to a firm with a PERM page, build_employer_map.py), and writes
one row per firm page and program. The page reads its row.

The arithmetic is the page's own: CERTIFIED_SQL below is held to the
TypeScript's by scripts/test_firm_programs.py, which also checks the rolled-up
rows against the live query on a fixture.

Usage:
    python3 scripts/build_firm_programs.py            # rebuild the table
    python3 scripts/build_firm_programs.py --dry-run  # print the biggest firms
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, query_rows, record_run  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "build_firm_programs.py"
TABLE = "firm_programs"
MAP = "firm_page_map"
# FIRM_TOP_EMPLOYERS in src/lib/db/firmPrograms.ts.
TOP_EMPLOYERS = 8
# CERTIFIED_SQL in src/lib/db/firmPrograms.ts, table for table.
CERTIFIED_SQL = {
    "lca_cases": "SUM(CASE WHEN case_status = 'CERTIFIED' THEN 1 ELSE 0 END)",
    "pwd_cases": "NULL",
    "seasonal_cases": "SUM(CASE WHEN case_status LIKE '%CERTIFICATION%' AND case_status NOT LIKE '%WITHDRAWN%' THEN 1 ELSE 0 END)",
}
PROGRAM = {"lca_cases": "lca", "pwd_cases": "pwd", "seasonal_cases": "seasonal"}
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        page_slug TEXT NOT NULL,
        program TEXT NOT NULL,
        filings INTEGER NOT NULL,
        certified INTEGER,
        first_decided TEXT,
        last_decided TEXT,
        employers TEXT NOT NULL,
        PRIMARY KEY (page_slug, program))""",
]
COLS = ["page_slug", "program", "filings", "certified", "first_decided", "last_decided", "employers"]


def log(msg: str) -> None:
    print(f"[firm-programs] {msg}", flush=True)


def page_of(db: Database) -> dict[str, str]:
    """Every printed firm spelling and the page it belongs to."""
    return {str(s): str(p) for s, p in query_rows(db, f"SELECT source_slug, page_slug FROM {MAP}")}


def groups(db: Database, table: str) -> list[tuple]:
    """(attorney_slug, employer_slug, name, n, certified, first, last), one per printed firm and employer."""
    return query_rows(
        db,
        f"SELECT attorney_slug, employer_slug, MAX(employer_name), COUNT(*), {CERTIFIED_SQL[table]}, "
        f"MIN(decision_date), MAX(decision_date) FROM {table} "
        "WHERE attorney_slug IS NOT NULL AND attorney_slug <> '' GROUP BY attorney_slug, employer_slug",
    )


def roll_up(rows: list[tuple], page: dict[str, str], program: str, counts_certified: bool) -> list[list]:
    """One row per firm page: totals, dates, and its busiest employers, the page's own query rolled up."""
    total: dict[str, int] = defaultdict(int)
    certified: dict[str, int] = defaultdict(int)
    first: dict[str, str] = {}
    last: dict[str, str] = {}
    by_employer: dict[str, dict[str | None, list]] = defaultdict(dict)
    for att, emp, name, n, cert, lo, hi in rows:
        p = page.get(str(att))
        if p is None:
            continue
        n = int(n or 0)
        total[p] += n
        certified[p] += int(cert or 0)
        if lo and (p not in first or str(lo) < first[p]):
            first[p] = str(lo)
        if hi and (p not in last or str(hi) > last[p]):
            last[p] = str(hi)
        key = None if emp is None else str(emp)
        got = by_employer[p].get(key)
        if got is None:
            by_employer[p][key] = [n, name]
        else:
            got[0] += n
            if name is not None and (got[1] is None or str(name) > str(got[1])):
                got[1] = name
    out = []
    for p, n in sorted(total.items()):
        if n == 0:
            continue
        # The busiest first; equal counts by slug, so a rebuild writes the same row.
        top = sorted(by_employer[p].items(), key=lambda kv: (-kv[1][0], kv[0] is None, kv[0] or ""))[:TOP_EMPLOYERS]
        employers = [{"slug": s, "name": "" if v[1] is None else str(v[1]), "n": v[0]} for s, v in top]
        out.append([
            p, program, n, certified[p] if counts_certified else None,
            first.get(p, "")[:10] or None, last.get(p, "")[:10] or None,
            json.dumps(employers, separators=(",", ":"), ensure_ascii=False),
        ])
    return out


def build(db: Database) -> list[list]:
    page = page_of(db)
    if not page:
        raise RuntimeError(f"{MAP} is empty: build_employer_map.py hasn't run, and a firm page would read nothing")
    want: list[list] = []
    for table, program in PROGRAM.items():
        started = time.time()
        rows = groups(db, table)
        lines = roll_up(rows, page, program, CERTIFIED_SQL[table] != "NULL")
        log(f"{table}: {len(rows):,} firm and employer groups, {len(lines):,} firm pages ({time.time() - started:.0f}s)")
        want.extend(lines)
    return want


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    try:
        want = build(db)
    except Exception as exc:  # noqa: BLE001 - recorded, then raised
        if not args.dry_run:
            record_run(db, SCRIPT, status="failed", note=str(exc)[:300], started_at=started)
        raise
    if args.dry_run:
        for r in sorted(want, key=lambda r: -r[2])[:10]:
            log(f"{r[0]} {r[1]}: {r[2]:,} filings, {json.loads(r[6])[0]['name'] if r[6] != '[]' else '-'} first")
        log(f"{len(want):,} rows (dry run, nothing written)")
        return 0
    for ddl in DDL:
        db.execute(ddl)
    got = sync_rows(db, TABLE, ["page_slug", "program"], COLS, want, pause_s=0.2)
    note = f"{len(want):,} firm and program rows; {got['written']:,} written, {got['deleted']:,} removed"
    log(note)
    record_run(db, SCRIPT, status="ok", rows_written=got["written"], note=note, started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
