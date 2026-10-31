#!/usr/bin/env python3
"""DOL's Trade Adjustment Assistance petitions of PERM sponsors: `taa_petitions`, joined to the employer pages.

WHAT IT IS. A TAA petition asks DOL to find that a group of workers lost their jobs, or hours, because of imports or
because the work moved abroad; a certified group could get training and income support. DOL's Office of Trade
Adjustment Assistance publishes every petition it has decided since 1975 (DOL open data catalog, dataset 10363,
"OTAA Petition"): the firm and its site, what it made, the dates, the workers DOL estimated, and the determination.
The program stopped on July 1 2022 (Trade Act section 285(a)): DOL "may not issue any determinations and may not
accept any new petitions", so the file ends June 30 2022 and will not grow (its catalog note, read Oct 31 2026).

THE CODES are DOL's own (its "Petition Data Dictionary", linked from the TAA petitions page, read Oct 31 2026 in a
browser; www.dol.gov refuses scripts): C1 certified for imports, C2 certified for a shift abroad or a foreign
acquisition, CU and CD certified as an upstream supplier or downstream producer of a certified firm, C certified
(reason unspecified), P partially certified, D denied, T investigation terminated (a certification already in
effect, or a denial just issued). A code the dictionary doesn't list is kept and never given a meaning.

WHAT IS KEPT. Determinations from FY2013 on (Oct 1 2012), so a page shows a decade, joined to a PERM sponsor by the
strict rule every DOL record uses (`lib_dol_records.sponsor_rule`) and the city test (`dol.same_city`): the
petition's city must be one the sponsor's own PERM filings name, unless the sponsor is national. The file names the
people who petitioned, investigated and certified: none of those columns is read.

Usage:
    python3 scripts/ingest_taa.py            # download, match, write
    python3 scripts/ingest_taa.py --dry-run  # match and print, write nothing
    python3 scripts/ingest_taa.py --file x.zip
"""
from __future__ import annotations

import argparse
import csv
import io
import pathlib
import re
import sys
import tempfile
import time
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_dol_records as dol  # noqa: E402
from lib_db import Database, record_run, stamp_freshness  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "ingest_taa.py"
DATASET = "taa-petitions"
SOURCE = "DOL Office of Trade Adjustment Assistance petitions (data.dol.gov)"
DATASET_ID = 10363
TABLE = "taa_petitions"
SINCE = "2012-10-01"
# DOL's file held 86,334 petitions on Oct 31 2026; a file a third that size is a broken download.
MIN_PETITIONS = 30_000
# DOL's codes (its Petition Data Dictionary). A code outside this list is stored and shown as DOL printed it.
CODES = {
    "C1": "certified: imports", "C2": "certified: a shift abroad or a foreign acquisition",
    "CU": "certified: an upstream supplier", "CD": "certified: a downstream producer",
    "C": "certified", "P": "partly certified", "D": "denied", "T": "investigation ended",
}
CERTIFIED = {"C1", "C2", "CU", "CD", "C", "P"}

SOURCE_COLS = {
    "petition": "TAWSUFF", "name": "WORKER_GROUP_NAME", "city": "CITY", "state": "STATE",
    "group_type": "WORKER_GROUP_TYPE", "product": "PRODUCT", "service": "SERVICE", "naics": "NAICS_CODE",
    "petition_date": "PETITION_DATE", "det_date": "DET_DATE", "det_code": "DET_CODE",
    "impact_date": "IMPACT_DATE", "expiration_date": "EXPIRATION_DATE", "workers": "EST_WORKERS_OBJ",
}
COLS = ["petition", "name", "city", "state", "group_type", "product", "naics", "petition_date", "det_date",
        "det_code", "impact_date", "expiration_date", "workers", "employer_slug"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        petition TEXT PRIMARY KEY,
        name TEXT, city TEXT, state TEXT, group_type TEXT, product TEXT, naics TEXT,
        petition_date TEXT, det_date TEXT, det_code TEXT, impact_date TEXT, expiration_date TEXT, workers INTEGER,
        employer_slug TEXT)""",
    f"CREATE INDEX IF NOT EXISTS taa_petitions_employer ON {TABLE} (employer_slug, det_date)",
]
DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
# DOL's file carries typed years like 1902 and 2203 (measured Oct 31 2026); a date outside this range is no date.
FIRST_YEAR, LAST_YEAR = 1974, 2023


def log(msg: str) -> None:
    print(f"[taa] {msg}", flush=True)


def day(value: str) -> str | None:
    m = DATE_RE.match((value or "").strip())
    if not m or not FIRST_YEAR <= int(m.group(1)[:4]) <= LAST_YEAR:
        return None
    return m.group(1)


def workers(value: str) -> int | None:
    try:
        n = int(float((value or "").strip().replace(",", "")))
    except ValueError:
        return None
    return n if n >= 0 else None


def records(archive: zipfile.ZipFile):
    names = sorted(n for n in archive.namelist() if n.lower().endswith(".csv"))
    if not names:
        raise RuntimeError("the zip holds no CSV")
    for name in names:
        with archive.open(name) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline=""))
            header = [h.strip() for h in next(reader)]
            missing = [c for c in SOURCE_COLS.values() if c not in header]
            if missing:
                raise RuntimeError(f"DOL's file lacks {missing}: its layout changed")
            at = {ours: header.index(theirs) for ours, theirs in SOURCE_COLS.items()}
            for row in reader:
                yield {ours: (row[i].strip() if i < len(row) else "") for ours, i in at.items()}


def select(rows, match, place_ok=None) -> tuple[list[list], dict[str, int]]:
    """The petitions to keep, each with its page. `place_ok(slug, city)` is the city test; None gathers candidates."""
    keep: dict[str, list] = {}
    seen = {"petitions": 0, "recent": 0, "named": 0, "matched": 0}
    for r in rows:
        seen["petitions"] += 1
        decided = day(r["det_date"])
        if not r["petition"] or not decided or decided < SINCE:
            continue
        seen["recent"] += 1
        slug = match(r["name"], r["state"])
        if not slug:
            continue
        seen["named"] += 1
        if place_ok is not None and not place_ok(slug, r["city"]):
            continue
        seen["matched"] += 1
        keep[r["petition"]] = [
            r["petition"], r["name"], r["city"] or None, r["state"] or None, r["group_type"] or None,
            (r["product"] or r["service"] or "")[:300] or None, (r["naics"] or "").split(".")[0] or None,
            day(r["petition_date"]), decided, r["det_code"] or None, day(r["impact_date"]), day(r["expiration_date"]),
            workers(r["workers"]), slug,
        ]
    return list(keep.values()), seen


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--file", type=pathlib.Path)
    args = ap.parse_args()
    started = time.time()
    db = Database()
    try:
        sponsors, states = dol.load_sponsors(db)
        match = dol.sponsor_rule(sponsors, states)
        with tempfile.TemporaryDirectory(prefix="taa-") as tmp:
            path = args.file
            if path is None:
                url = dol.catalog_url(DATASET_ID)
                path = pathlib.Path(tmp) / "taa.zip"
                dol.download(url, path)
                log(f"downloaded {path.stat().st_size:,} bytes from {url}")
            with zipfile.ZipFile(path) as archive:
                dated = dol.file_date(archive.namelist())
                rows = list(records(archive))
        if len(rows) < MIN_PETITIONS:
            raise RuntimeError(f"DOL's file held {len(rows):,} petitions, under {MIN_PETITIONS:,}: refusing a short file")
        first, _ = select(rows, match)
        totals = {str(slug): int(t or 0) for _, slug, t in sponsors}
        keep, seen = select(rows, match, dol.same_city(dol.sponsor_cities(db, {r[-1] for r in first}), totals))
        unknown = sorted({r[9] for r in keep if r[9] and r[9] not in CODES})
        log(f"{seen['petitions']:,} petitions; {seen['recent']:,} decided since {SINCE}; {seen['named']:,} named like a "
            f"sponsor, {seen['matched']:,} in a city its filings name; file dated {dated}"
            + (f"; codes not in DOL's dictionary: {unknown}" if unknown else ""))
        if args.dry_run:
            for r in sorted(keep, key=lambda r: r[8], reverse=True)[:25]:
                log(f"  {r[1]} ({r[2]}, {r[3]}): {r[9]} on {r[8]}, {r[12]} workers -> {r[13]}")
            return 0
        for ddl in DDL:
            db.execute(ddl)
        moved = dol.moved_pages(db, TABLE, COLS, keep)
        got = sync_rows(db, TABLE, ["petition"], COLS, keep, pause_s=0.3)
        note = (f"{len(keep):,} petitions on a sponsor's page of {seen['recent']:,} decided since {SINCE}; "
                f"{got['written']:,} written, {got['deleted']:,} removed; {dol.refresh_pages(moved, 'taa')}")
        # The program ended July 1 2022, so the file stays as it is: the row ages as the file does, and the budget
        # only needs to catch the file going away or the job stopping (read monthly).
        stamp_freshness(db, DATASET, as_of=dated, source=SOURCE, cadence="closed July 1 2022; read monthly",
                        note=note, max_age_days=45)
        record_run(db, SCRIPT, status="ok", rows_written=got["written"], note=note, started_at=started)
        log(note)
        return 0
    except Exception as exc:  # noqa: BLE001 - recorded, then raised
        if not args.dry_run:
            record_run(db, SCRIPT, status="failed", note=str(exc)[:300], started_at=started)
        raise


if __name__ == "__main__":
    sys.exit(main())
