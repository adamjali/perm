"""Dump the tables that cannot be rebuilt from DOL's files.

WHY. Turso's point-in-time restore is 24 hours on the Free plan and 10 days
on Developer. Most of this database is rebuildable: perm_cases, pwd_cases and
lca_cases come from DOL's quarterly disclosure files, and every perm_entities*
table is derived from them. What is NOT rebuildable is what this project
OBSERVED: the per-case status rows and the event log (DOL serves a case's
current status and never says when it changed, so the transitions exist
nowhere else), the precomputed docs, the audit trail, and the small federal
series whose sources keep no archive (USCIS republishes monthly and drops the
previous month; travel.state.gov refuses scripts). A bad INSERT OR REPLACE
older than the restore window would lose all of it.

WHAT. One gzipped JSONL per table, read in primary-key-ordered pages so no
single request is large. ~1M rows a week, which Turso meters as reads and
which is far inside any plan. Rebuildable tables are deliberately absent.

The workflow uploads the directory as a GitHub Actions artifact. The rows are
public DOL data (case numbers, employers, job titles, statuses) plus this
project's own timestamps; there is no user data in any of these tables.

    python3 scripts/dump_observations.py --out backups/
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

# (table, expected floor) - a table that dumps fewer rows than its floor fails
# the run: a dump that is silently empty is a backup that does not exist.
TABLES: list[tuple[str, int]] = [
    ("perm_case_status", 300_000),
    ("pwd_case_status", 50_000),
    ("lca_case_status", 100_000),
    ("perm_case_events", 100_000),
    ("pwd_case_events", 1),
    ("lca_case_events", 1),
    ("perm_docs", 10),
    ("data_freshness", 10),
    ("ingest_runs", 1),
    ("sweep_runs", 1),
    ("rfi_funnel", 1),
    ("daily_decisions", 100),
    ("visa_bulletins", 50),
    ("processing_times", 1),
    ("i140_trends", 1),
    ("i485_inventory", 1),
    ("perm_month_stats", 0),
]
PAGE = 5_000


def _cells(res) -> tuple[list[str], list[list]]:
    result = res["response"]["result"]
    cols = [c["name"] for c in result["cols"]]
    rows = [[None if c["type"] == "null" else c["value"] for c in r] for r in result["rows"]]
    return cols, rows


def dump_table(db: Turso, table: str, out: pathlib.Path) -> int:
    """Page by rowid so each request is bounded; returns rows written."""
    n = 0
    last = 0
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        while True:
            cols, rows = _cells(db.execute(
                f"SELECT rowid AS _rowid, * FROM {table} WHERE rowid > ? "
                f"ORDER BY rowid LIMIT {PAGE}", [last]))
            if not rows:
                break
            for r in rows:
                rec = dict(zip(cols, r))
                last = int(rec.pop("_rowid"))
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                n += 1
            if len(rows) < PAGE:
                break
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", default="backups", help="Directory for the .jsonl.gz files")
    ap.add_argument("--only", nargs="*", help="Restrict to these tables (testing)")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    db = Turso()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    manifest: dict[str, int] = {}
    short: list[str] = []
    for table, floor in TABLES:
        if args.only and table not in args.only:
            continue
        path = out / f"{table}.jsonl.gz"
        n = dump_table(db, table, path)
        manifest[table] = n
        flag = "" if n >= floor else "  SHORT"
        print(f"  {table:22s} {n:>9,} rows  {path.stat().st_size / 1e6:6.1f} MB{flag}", flush=True)
        if n < floor:
            short.append(f"{table} ({n} < {floor})")
    (out / "manifest.json").write_text(json.dumps(
        {"dumped_at": stamp, "rows": manifest}, indent=2))
    print(f"\n{sum(manifest.values()):,} rows across {len(manifest)} tables -> {out}/")
    if short:
        print(f"::error::short dump: {', '.join(short)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
