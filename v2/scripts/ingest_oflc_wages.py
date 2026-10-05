#!/usr/bin/env python3
"""Load DOL's prevailing wage tables, every wage year it publishes.

WHAT IT IS. Each July the Office of Foreign Labor Certification publishes the
wage tables it sets prevailing wages from, for the year July to June: the four
wage levels for every occupation in every OEWS area (the "ALC" file, all
industries), the same for institutions covered by ACWIA (the "EDC" file:
universities, their affiliates and research organizations), the counties in
each area, and, from 2023-24 on, the Job Zone and education DOL applies to
each occupation when it picks a level.

FLAG's live wage search (src/lib/wageLevels.ts) answers 2023 to 2026 only;
these files reach 2021-22, and they're the tables themselves rather than one
lookup at a time.

WHAT'S KEPT. `oflc_wage_levels`: wage year, collection (alc / edc), area, SOC,
DOL's GeoLvl as printed, the four levels and the average, hourly, and DOL's
label ("High Wage" means OEWS put the wage at or above $115 an hour, $239,200
a year, and DOL issues that figure). The average is for the H-2 programs only:
DOL says it isn't a wage level for H-1B or PERM, and the pages never present
it as one. `oflc_wage_geography`: each county's area for that year (areas
moved with the 2023 metro delineation). `oflc_occupation_basis`: DOL's Job
Zone and education per O*NET code, and whether the occupation is on its
Appendix A list.

PACED. About 770,000 rows a year; a history year writes with a one-second
pause between requests so the site's reads go first (a back-catalogue load
stalled the database for 38 minutes on Oct 3 2026). Each year's files are
skipped when their bytes match the last load.

Usage:
    python3 scripts/ingest_oflc_wages.py                 # discover; load new or changed years
    python3 scripts/ingest_oflc_wages.py --year 2024     # one wage year (2024 = 2024-25)
    python3 scripts/ingest_oflc_wages.py --dry-run [--local ZIP]
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
import time
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import POLITE_PAUSE_S, discover_links, fetch, log  # noqa: E402
from lib_reference import keep_record, seen_before, sha256, sheet_paths, sheet_rows, sync_rows  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_oflc_wages.py"
PAGE = "https://flag.dol.gov/wage-data/wage-data-downloads"
HOST = "https://flag.dol.gov"
LEVELS = "oflc_wage_levels"
GEO = "oflc_wage_geography"
BASIS = "oflc_occupation_basis"
LEVEL_COLS = ("wage_year", "collection", "area", "soc7", "geo_lvl", "l1", "l2", "l3", "l4", "avg", "label")
GEO_COLS = ("wage_year", "state_ab", "county", "area", "area_name", "state")
BASIS_COLS = ("wage_year", "onet_code", "soc7", "title", "job_zone", "education", "appendix_a")
SOC = re.compile(r"^\d{2}-\d{4}$")
ONET = re.compile(r"^\d{2}-\d{4}\.\d{2}$")
# A full year's all-industry table: ~450,000 rows in every year 2021-22 to 2026-27.
MIN_ALC_ROWS = 300_000
MIN_COUNTIES = 3_000
HISTORY_PAUSE_S = 1.0
NEWEST_PAUSE_S = 0.35

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {LEVELS} (
        wage_year INTEGER NOT NULL, collection TEXT NOT NULL, area TEXT NOT NULL, soc7 TEXT NOT NULL,
        geo_lvl INTEGER, l1 REAL, l2 REAL, l3 REAL, l4 REAL, avg REAL, label TEXT,
        PRIMARY KEY (wage_year, collection, area, soc7))""",
    # The two reads: one job in one area across years, and one area's jobs in one year.
    f"CREATE INDEX IF NOT EXISTS {LEVELS}_soc ON {LEVELS} (soc7, area, collection, wage_year)",
    f"""CREATE TABLE IF NOT EXISTS {GEO} (
        wage_year INTEGER NOT NULL, state_ab TEXT NOT NULL, county TEXT NOT NULL, area TEXT NOT NULL,
        area_name TEXT NOT NULL, state TEXT NOT NULL,
        PRIMARY KEY (wage_year, state_ab, county))""",
    f"CREATE INDEX IF NOT EXISTS {GEO}_area ON {GEO} (wage_year, area)",
    f"""CREATE TABLE IF NOT EXISTS {BASIS} (
        wage_year INTEGER NOT NULL, onet_code TEXT NOT NULL, soc7 TEXT NOT NULL, title TEXT NOT NULL,
        job_zone TEXT, education TEXT, appendix_a INTEGER,
        PRIMARY KEY (wage_year, onet_code))""",
    f"CREATE INDEX IF NOT EXISTS {BASIS}_soc ON {BASIS} (soc7, wage_year)",
]


class Refusal(Exception):
    """A year that must not be written, with the reason."""


def wage_year_of(name: str) -> int | None:
    """`OFLC_Wages_2024-25.zip` is the year that opened in July 2024."""
    m = re.search(r"(20\d\d)-(\d\d)", name)
    if not m or (int(m.group(1)) + 1) % 100 != int(m.group(2)):
        return None
    return int(m.group(1))


def member(z: zipfile.ZipFile, basename: str) -> str:
    hits = [n for n in z.namelist() if n.rsplit("/", 1)[-1].lower() == basename.lower()]
    if not hits:
        raise Refusal(f"{basename} is missing")
    return hits[0]


def rate(text: str) -> float | None:
    t = (text or "").strip()
    if not t:
        return None
    try:
        return round(float(t), 2)
    except ValueError:
        return None


def decoded(raw: bytes) -> str:
    """UTF-8, or the DOS code page DOL's older files use: the 2021-22 and
    2022-23 county lists spell Mayagüez, PR with byte 0x81, which is "ü" in
    code page 437 and undefined in Windows-1252."""
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp437")


def level_rows(z: zipfile.ZipFile, year: int, collection: str, basename: str) -> list[tuple]:
    reader = csv.DictReader(io.StringIO(decoded(z.read(member(z, basename))), newline=""))
    need = {"Area", "SocCode", "GeoLvl", "Level1", "Level2", "Level3", "Level4", "Average"}
    if not need.issubset(reader.fieldnames or []):
        raise Refusal(f"{basename} header is {reader.fieldnames}")
    out = []
    for r in reader:
        soc = (r["SocCode"] or "").strip()
        area = (r["Area"] or "").strip()
        if not SOC.match(soc) or not area.isdigit():
            continue
        geo = (r["GeoLvl"] or "").strip()
        out.append((year, collection, area, soc, int(geo) if geo.isdigit() else None,
                    rate(r["Level1"]), rate(r["Level2"]), rate(r["Level3"]), rate(r["Level4"]),
                    rate(r["Average"]), (r.get("Label") or "").strip() or None))
    return out


def geography_rows(z: zipfile.ZipFile, year: int) -> list[tuple]:
    out = {}
    for r in csv.DictReader(io.StringIO(decoded(z.read(member(z, "Geography.csv"))), newline="")):
        area = (r.get("Area") or "").strip()
        st = (r.get("StateAb") or "").strip()
        county = (r.get("CountyTownName") or "").strip()
        if area.isdigit() and st and county:
            out[(st, county)] = (year, st, county, area, (r.get("AreaName") or "").strip(),
                                 (r.get("State") or "").strip())
    return list(out.values())


def basis_rows(z: zipfile.ZipFile, year: int) -> list[tuple]:
    """DOL's Job Zone and education per O*NET code, from whatever workbooks the
    year's zip carries (2023-24 on); an older year simply has none."""
    zones: dict[str, tuple[str, str, str]] = {}
    edu: dict[str, str] = {}
    appendix: set[str] = set()
    # DOL first published its Appendix A list with 2024-25. A year without the
    # sheet stores NULL, never 0: "not on the list" and "no list" differ.
    has_appendix = False
    for name in z.namelist():
        if not name.lower().endswith(".xlsx"):
            continue
        book = z.read(name)
        for sheet in sheet_paths(zipfile.ZipFile(io.BytesIO(book))):
            has_appendix = has_appendix or "appendix a" in sheet.lower()
            rows = sheet_rows(book, sheet)
            header = [c.strip() for c in next(rows, [])]
            if "O*NET Code" not in header:
                continue
            i_code = header.index("O*NET Code")
            title_col = "Title" if "Title" in header else "Occupation" if "Occupation" in header else None
            for r in rows:
                code = r[i_code].strip() if i_code < len(r) else ""
                if not ONET.match(code):
                    continue
                get = lambda col: r[header.index(col)].strip() if col in header and header.index(col) < len(r) else ""  # noqa: E731
                title = get(title_col) if title_col else ""
                if "Job Zone" in header:
                    zones[code] = (code[:7], title, get("Job Zone"))
                if "Education" in header:
                    edu[code] = get("Education")
                    # The workbook is named for all three sheets, so only the
                    # sheet's own name says it's the Appendix A list.
                    if "appendix a" in sheet.lower():
                        appendix.add(code)
                    if code not in zones:
                        zones.setdefault(code, (code[:7], title, ""))
    return [(year, code, soc, title, zone or None, edu.get(code) or None,
             (1 if code in appendix else 0) if has_appendix else None)
            for code, (soc, title, zone) in sorted(zones.items())]


def parse_year(zip_bytes: bytes, year: int) -> dict[str, list[tuple]]:
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    alc = level_rows(z, year, "alc", "ALC_Export.csv")
    edc = level_rows(z, year, "edc", "EDC_Export.csv")
    geo = geography_rows(z, year)
    if len(alc) < MIN_ALC_ROWS:
        raise Refusal(f"{year}: only {len(alc)} all-industry rows (expected {MIN_ALC_ROWS}+)")
    if len(geo) < MIN_COUNTIES:
        raise Refusal(f"{year}: only {len(geo)} counties in Geography.csv")
    bad = [r for r in alc if all(v is not None for v in r[5:9]) and not (r[5] <= r[6] <= r[7] <= r[8])]
    if len(bad) > len(alc) * 0.001:
        raise Refusal(f"{year}: {len(bad)} rows whose levels run backwards, e.g. {bad[0]}")
    return {"alc": alc, "edc": edc, "geo": geo, "basis": basis_rows(z, year)}


def load_year(db: Turso, year: int, zip_bytes: bytes, *, newest: bool, force: bool) -> dict:
    digest = sha256(zip_bytes)
    record = f"oflc_wages_load_{year}"
    if not force and seen_before(db, record, digest):
        log(f"  {year}-{(year + 1) % 100:02d}: unchanged since the last load")
        return {"year": year, "skipped": True}
    parts = parse_year(zip_bytes, year)
    pause = NEWEST_PAUSE_S if newest else HISTORY_PAUSE_S
    out = {"year": year}
    for collection in ("alc", "edc"):
        got = sync_rows(db, LEVELS, ("wage_year", "collection", "area", "soc7"), LEVEL_COLS, parts[collection],
                        scope_sql="wage_year = ? AND collection = ?", scope_args=[year, collection],
                        per_stmt=500, pause_s=pause)
        out[collection] = got
        log(f"  {year} {collection}: {got}")
    out["geo"] = sync_rows(db, GEO, ("wage_year", "state_ab", "county"), GEO_COLS, parts["geo"],
                           scope_sql="wage_year = ?", scope_args=[year])
    out["basis"] = sync_rows(db, BASIS, ("wage_year", "onet_code"), BASIS_COLS, parts["basis"],
                             scope_sql="wage_year = ?", scope_args=[year])
    keep_record(db, record, digest, rows=len(parts["alc"]) + len(parts["edc"]))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--local")
    args = ap.parse_args()
    started = time.time()

    if args.local:
        year = wage_year_of(os.path.basename(args.local)) or args.year
        if year is None:
            raise SystemExit("name the year with --year when the file name doesn't carry one")
        sources = {year: lambda: open(args.local, "rb").read()}
    else:
        links = discover_links(fetch(PAGE).decode("utf-8", "replace"), r"OFLC_Wages_20\d\d-\d\d\.zip$", HOST)
        years = {wage_year_of(n): u for n, u in links.items() if wage_year_of(n)}
        if not years:
            raise SystemExit("no OFLC wage zips linked from the downloads page")
        log(f"wage years linked: {sorted(years)}")
        if args.year:
            years = {y: u for y, u in years.items() if y == args.year}
        sources = {y: (lambda u=u: fetch(u, referer=PAGE)) for y, u in years.items()}
    newest = max(sources)

    if args.dry_run:
        for year in sorted(sources, reverse=True):
            parts = parse_year(sources[year](), year)
            log(f"  {year}: alc {len(parts['alc'])}, edc {len(parts['edc'])}, counties {len(parts['geo'])}, "
                f"basis {len(parts['basis'])} ({sum(r[6] or 0 for r in parts['basis'])} on Appendix A)")
        return 0

    db = Turso()
    db.script(DDL)
    results, failed = [], []
    # Newest first, so the year the site reads most is current before history.
    for year in sorted(sources, reverse=True):
        try:
            results.append(load_year(db, year, sources[year](), newest=year == newest, force=args.force))
        except Refusal as exc:
            log(f"REFUSED {year}: {exc}")
            failed.append(f"{year}: {exc}")
        time.sleep(POLITE_PAUSE_S)
    held = [r["year"] for r in query_years(db)]
    write_doc(db, "oflc_wage_years", {"years": held, "newest": max(held) if held else None})
    written = sum(r.get(c, {}).get("written", 0) for r in results for c in ("alc", "edc"))
    if failed:
        record_run(db, SCRIPT, status="failed", rows_written=written, note="; ".join(failed), started_at=started)
        return 1
    if newest in held:
        stamp_freshness(db, "oflc-wage-levels", as_of=f"{newest}-07-01", source=PAGE, cadence="yearly, each July",
                        note=f"wage years {min(held)}-{max(held) + 1} held", max_age_days=400)
    record_run(db, SCRIPT, status="ok", rows_written=written,
               note=f"years {sorted(r['year'] for r in results)}; written {written}", started_at=started)
    return 0


def query_years(db: Turso) -> list[dict]:
    from lib_turso import query_rows
    return [{"year": int(r[0])} for r in query_rows(db, f"SELECT DISTINCT wage_year FROM {LEVELS} ORDER BY 1")]


if __name__ == "__main__":
    sys.exit(main())
