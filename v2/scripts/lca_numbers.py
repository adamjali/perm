#!/usr/bin/env python3
"""The main database file's list of published LCA case numbers.

The H-1B LCA filings live in a database file of their own since Oct 19 2026
(see LCA_TABLE_RE in lib_db.py: the main file is held in memory whole, and the
LCA table and its indexes were 2.75 GB of its 6.69). Three nightly reads in the
main file need to know which LCA numbers DOL has published, and a join can't
reach the other file:

  - the gap sweep counts a published number as held (sweep_serial_gaps.py),
  - the published-to-live sync looks for numbers the live table lacks
    (sync_published_live.py),
  - the employer map leaves a live row out when its case is published, so it
    isn't counted twice (build_employer_map.py).

So the main file keeps this list: the number and its received date, nothing
else (about 0.2 GB for 3.75 million numbers). The loader writes it beside every
batch of rows (`record_stmts`); `sync` repairs it by walking both files in case
number order, a page at a time, and the health check compares the two counts.

    python3 scripts/lca_numbers.py            # repair: add, change and remove until both agree
    python3 scripts/lca_numbers.py --dry-run  # say what a repair would write
"""
from __future__ import annotations

import argparse
import sys
import time

from lib_db import Database, query_rows, stmt

TABLE = "lca_case_numbers"
DDL = (f"CREATE TABLE IF NOT EXISTS {TABLE} "
       "(case_number TEXT PRIMARY KEY, received_date TEXT) WITHOUT ROWID")
ROWS_PER_STMT = 400          # two values a row, far under SQLite's variable limit
PAGE = 20_000                # numbers read from each file per step
PAUSE_S = 0.5                # between write requests, so the site's reads keep their turn


def record_stmts(pairs) -> list[dict]:
    """INSERT statements for (case_number, received_date) pairs, ROWS_PER_STMT a
    statement. A number already listed takes the newest received date."""
    pairs = [(str(c), d) for c, d in pairs if c]
    out = []
    for i in range(0, len(pairs), ROWS_PER_STMT):
        chunk = pairs[i:i + ROWS_PER_STMT]
        out.append(stmt(
            f"INSERT INTO {TABLE} (case_number, received_date) VALUES "
            + ",".join(["(?,?)"] * len(chunk))
            + " ON CONFLICT(case_number) DO UPDATE SET received_date = excluded.received_date"
            " WHERE received_date IS NOT excluded.received_date",
            [v for pair in chunk for v in pair]))
    return out


def ensure_table(db) -> None:
    db.execute(DDL, [])


def _page(db, table: str, after: str, limit: int, upto: str | None = None) -> list[tuple[str, str | None]]:
    sql = f"SELECT case_number, received_date FROM {table} WHERE case_number > ?"
    args: list = [after]
    if upto is not None:
        sql += " AND case_number <= ?"
        args.append(upto)
    sql += " ORDER BY case_number"
    if upto is None:
        sql += f" LIMIT {int(limit)}"
    return [(str(r[0]), None if r[1] in (None, "") else str(r[1])) for r in query_rows(db, sql, args)]


def plan(source: list[tuple[str, str | None]], listed: list[tuple[str, str | None]]):
    """What to write so `listed` matches `source` over the same numbers:
    (pairs to insert or update, numbers to delete)."""
    want = dict(source)
    have = dict(listed)
    upserts = [(c, d) for c, d in source if c not in have or have[c] != d]
    deletes = [c for c in have if c not in want]
    return upserts, deletes


def delete_stmts(numbers: list[str]) -> list[dict]:
    out = []
    for i in range(0, len(numbers), ROWS_PER_STMT):
        chunk = numbers[i:i + ROWS_PER_STMT]
        out.append(stmt(f"DELETE FROM {TABLE} WHERE case_number IN ({','.join('?' * len(chunk))})", chunk))
    return out


def sync(db, *, page: int = PAGE, pause: float = PAUSE_S, dry: bool = False,
         sleep=time.sleep, log=print) -> dict:
    """Make the list match the LCA table, page by page in case number order.

    Each step reads the next `page` numbers from the LCA table and every listed
    number up to the last of them, so a number listed but no longer published
    is found as well as one published but not yet listed."""
    if not dry:
        ensure_table(db)
    after = ""
    out = {"read": 0, "upserted": 0, "deleted": 0, "pages": 0}
    while True:
        source = _page(db, "lca_cases", after, page)
        if not source:
            # Anything listed past the last published number isn't published.
            tail = _page(db, TABLE, after, 0, upto="￿")
            if out["read"] == 0 and tail:
                # An empty LCA table means the wrong server, never that DOL
                # withdrew every filing: emptying the list would cost the gap
                # sweep, the sync and the employer map their LCA numbers.
                raise SystemExit("the LCA table answered empty while the list holds "
                                 f"{len(tail):,} numbers; check DATABASE_LCA_URL, nothing changed")
            _, deletes = plan([], tail)
            out["deleted"] += len(deletes)
            if deletes and not dry:
                db.pipeline(delete_stmts(deletes) + [{"type": "close"}])
            break
        last = source[-1][0]
        listed = _page(db, TABLE, after, 0, upto=last)
        upserts, deletes = plan(source, listed)
        out["read"] += len(source)
        out["pages"] += 1
        out["upserted"] += len(upserts)
        out["deleted"] += len(deletes)
        if (upserts or deletes) and not dry:
            # Two requests: one statement list per request keeps each one small.
            if upserts:
                db.pipeline(record_stmts(upserts) + [{"type": "close"}])
            if deletes:
                db.pipeline(delete_stmts(deletes) + [{"type": "close"}])
            if pause > 0:
                sleep(pause)
        after = last
        if out["pages"] % 20 == 0:
            log(f"  {out['read']:,} numbers read, {out['upserted']:,} to write, {out['deleted']:,} to remove")
    return out


def counts(db) -> tuple[int, int]:
    """(published LCAs, listed numbers): equal when the list is whole."""
    published = int(query_rows(db, "SELECT COUNT(*) FROM lca_cases", [])[0][0])
    listed = int(query_rows(db, f"SELECT COUNT(*) FROM {TABLE}", [])[0][0])
    return published, listed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--pause", type=float, default=PAUSE_S)
    args = ap.parse_args()
    db = Database()
    t0 = time.time()
    out = sync(db, pause=args.pause, dry=args.dry_run)
    verb = "would write" if args.dry_run else "wrote"
    print(f"lca_case_numbers: read {out['read']:,} published numbers; {verb} "
          f"{out['upserted']:,} and removed {out['deleted']:,} in {time.time() - t0:,.0f}s", flush=True)
    if not args.dry_run:
        published, listed = counts(db)
        print(f"  {published:,} published, {listed:,} listed", flush=True)
        if published != listed:
            print("::error::the list still differs from the LCA table", flush=True)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
