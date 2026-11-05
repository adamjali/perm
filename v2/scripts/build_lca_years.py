"""Each employer's H-1B LCAs by fiscal year, FY2008 on, for the employer pages' year chart.

    python3 scripts/build_lca_years.py            # every fiscal year either LCA table holds
    python3 scripts/build_lca_years.py --fy 2017  # one year

DOL's H-1B files live in two tables of the LCA database: `lca_cases` (FY2020 on) and `lca_cases_history`
(FY2008 to FY2019, scripts/ingest_flag_disclosure.py HISTORY_TABLES). This writes `lca_cases_years` beside
them, one row per spelling (employer_slug) and fiscal year: certified, denied and withdrawn H-1B LCAs
("CERTIFIED - WITHDRAWN" counts as withdrawn, as the case search's buckets do). Only the H-1B visa class:
H-1B1 and E-3 LCAs are other visas.

Each year is read as one grouped query (about 60,000 spellings at most, a few MB), compared with what the table
holds, and only the rows that changed are written, 200 to a write, then the spellings the year no longer holds
removed. One INSERT ... SELECT per year held the write lock too long for FY2019 (Nov 4 2026). A run that stops part
way leaves the year's old counts, never an empty year: the first version deleted the year and then inserted it, so
an insert that failed emptied every employer's chart for that year until the next load (audit, Nov 4 2026). A rerun
writes nothing. A page sums its own
spellings at render (src/lib/db/lcaYears.ts, through employer_page_map), so this needs no map of its own.

Run by the FLAG disclosure workflow after every LCA load, older files included.
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, record_run, rows_of, stmt  # noqa: E402

SCRIPT = "build_lca_years.py"
TABLE = "lca_cases_years"
HISTORY_TABLE, HISTORY_BEFORE = "lca_cases_history", 2020
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        employer_slug TEXT NOT NULL,
        fy INTEGER NOT NULL,
        certified INTEGER NOT NULL,
        denied INTEGER NOT NULL,
        withdrawn INTEGER NOT NULL,
        PRIMARY KEY (employer_slug, fy))""",
    # A year is read and cleared by `fy` alone; the key leads with the spelling.
    f"CREATE INDEX IF NOT EXISTS {TABLE}_fy ON {TABLE} (fy)",
]


def source(fy: int) -> str:
    """The table a fiscal year's LCAs are in."""
    return HISTORY_TABLE if fy < HISTORY_BEFORE else "lca_cases"


def fiscal_year_of(day: str) -> int:
    """The fiscal year an ISO day falls in (October 1 starts the next one)."""
    return int(day[:4]) + (1 if int(day[5:7]) >= 10 else 0)


# Each read is the first and last entry of an index: `lca_cases` has none on its fiscal year, and a
# SELECT DISTINCT over it read all 3.7 million rows (audit, Nov 4 2026). A year in the span with no rows
# rebuilds as empty, which is right.
SPANS = {
    "lca_cases": "SELECT MIN(decision_date), MAX(decision_date) FROM lca_cases",
    HISTORY_TABLE: f"SELECT MIN(fiscal_year), MAX(fiscal_year) FROM {HISTORY_TABLE}",
}


def years_held(db) -> list[int]:
    """Every fiscal year either table spans. A history table not loaded yet adds none."""
    found: set[int] = set()
    for table, sql in SPANS.items():
        try:
            rows = rows_of(db.execute(sql))
        except Exception as e:  # noqa: BLE001
            if "no such table" not in str(e):
                raise
            continue
        lo, hi = rows[0] if rows else (None, None)
        if lo is None or hi is None:
            continue
        if table == "lca_cases":
            lo, hi = fiscal_year_of(str(lo)), fiscal_year_of(str(hi))
        found.update(fy for fy in range(int(lo), int(hi) + 1) if source(fy) == table)
    return sorted(found)


BATCH = 200


def year_counts(db, fy: int) -> dict[str, tuple[int, int, int]]:
    """A year's certified, denied and withdrawn H-1B LCAs by spelling, read from its own table.

    The decided range rides `_decided` on lca_cases, which has no fiscal-year index; the history table's
    `_fy` index leads with the year. A fiscal year is October 1 to September 30, by the decision date.
    """
    table = source(fy)
    # The table is one of two fixed names (source()), never input.
    # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
    sql = (
        "SELECT employer_slug, "
        "SUM(CASE WHEN case_status = 'CERTIFIED' THEN 1 ELSE 0 END), "
        "SUM(CASE WHEN case_status = 'DENIED' THEN 1 ELSE 0 END), "
        "SUM(CASE WHEN case_status IN ('WITHDRAWN', 'CERTIFIED - WITHDRAWN') THEN 1 ELSE 0 END) "
        f"FROM {table} WHERE fiscal_year = ? AND decision_date >= ? AND decision_date <= ? "
        "AND visa_class = 'H-1B' AND employer_slug IS NOT NULL AND employer_slug <> '' "
        "GROUP BY employer_slug"
    )
    rows = rows_of(db.execute(sql, [fy, f"{fy - 1}-10-01", f"{fy}-09-30"]))
    return {str(r[0]): (int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)) for r in rows}


def held_counts(db, fy: int) -> dict[str, tuple[int, int, int]]:
    """What the table holds for a year now (libSQL may hand integers back as text: both sides are int()ed)."""
    rows = rows_of(db.execute(f"SELECT employer_slug, certified, denied, withdrawn FROM {TABLE} WHERE fy = ?", [fy]))
    return {str(r[0]): (int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)) for r in rows}


def year_writes(fy: int, want: dict, held: dict) -> list[list[dict]]:
    """The requests that bring a year from `held` to `want`: changed rows upserted first, 200 to a statement, then
    spellings the year no longer holds removed, 200 at a time. Each write is small, so none holds the database's
    write lock for long: FY2019 written as one INSERT ... SELECT (578,640 LCAs) ran past sqld's transaction limit on
    Nov 4 2026 ("Transaction timed out"), while every smaller year fitted. Writes come before removals, so a run that
    stops part way leaves the year's old counts, never an empty year."""
    changed = [(slug, *c) for slug, c in sorted(want.items()) if held.get(slug) != c]
    gone = sorted(set(held) - set(want))
    out: list[list[dict]] = []
    for i in range(0, len(changed), BATCH):
        part = changed[i:i + BATCH]
        args: list = []
        for slug, cert, den, wd in part:
            args += [slug, fy, cert, den, wd]
        out.append([stmt(
            f"INSERT INTO {TABLE} (employer_slug, fy, certified, denied, withdrawn) VALUES "
            + ",".join(["(?,?,?,?,?)"] * len(part))
            + " ON CONFLICT (employer_slug, fy) DO UPDATE SET certified = excluded.certified, "
            "denied = excluded.denied, withdrawn = excluded.withdrawn", args)])
    for i in range(0, len(gone), BATCH):
        part = gone[i:i + BATCH]
        out.append([stmt(f"DELETE FROM {TABLE} WHERE fy = ? AND employer_slug IN ({','.join('?' * len(part))})",
                         [fy, *part])])
    return out


def build(db, only: int | None = None) -> dict[int, int]:
    """Rebuild every year (or one); the rows each year holds after."""
    db.script(DDL)
    out: dict[int, int] = {}
    for fy in [only] if only else years_held(db):
        t = time.time()
        want = year_counts(db, fy)
        writes = year_writes(fy, want, held_counts(db, fy))
        for request in writes:
            db.pipeline([*request, {"type": "close"}])
        if want:  # a year inside the span with no LCAs is cleared, not reported
            out[fy] = len(want)
        print(f"  FY{fy}: {len(want):,} spellings from {source(fy)}, {len(writes)} write(s) "
              f"({time.time() - t:.1f}s)", flush=True)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--fy", type=int, help="rebuild one fiscal year")
    a = ap.parse_args(argv)
    started = time.time()
    db = Database()
    try:
        written = build(db, a.fy)
    except BaseException as exc:  # noqa: BLE001 - the run row must name the failure
        record_run(db, SCRIPT, status="failed", rows_written=0, note=str(exc)[:200], started_at=started)
        raise
    if not written:
        record_run(db, SCRIPT, status="failed", rows_written=0, note="no fiscal year in either LCA table",
                   started_at=started)
        print("FATAL: no fiscal year in either LCA table")
        return 1
    total = sum(written.values())
    record_run(db, SCRIPT, status="ok", rows_written=total,
               note=f"FY{min(written)} to FY{max(written)}: {total:,} employer-year rows", started_at=started)
    print(f"done: {len(written)} fiscal years, {total:,} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
