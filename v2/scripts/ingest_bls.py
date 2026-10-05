#!/usr/bin/env python3
"""Load BLS market pay (OEWS) and the BLS employment projections.

WHAT IT IS. Two Bureau of Labor Statistics products the PERM figures sit
inside:

* OEWS, Occupational Employment and Wage Statistics: what every occupation
  pays, nationally, by state, by metro area and by non-metro area, as five
  percentiles and a mean, from BLS's own survey of employers. DOL's
  prevailing wage levels are built from these same estimates, a year behind
  (the July 2026 wage year uses May 2025). One release a year, each spring.
* Employment projections: each occupation's employment now and in ten years,
  its yearly openings, and the entry education, experience and training BLS
  says is typical. One release a year, each autumn.

HOW IT'S READ. BLS answers a browser User-Agent from a script with 403 and
serves one that names who's asking (lib_gov_data.CONTACT_HEADERS). Files are
discovered from BLS's own tables pages, never constructed: the newest
`oesmYYnat/st/ma.zip` linked from /oes/tables.htm, and the projections
workbook linked from the projections tables page. Columns are found by their
header names, so a moved column fails loudly instead of loading the wrong one.

OEWS SYMBOLS, KEPT AS BLS PRINTS THEM. A percentile BLS publishes as "#" is
at or above the top-coding ceiling BLS states in that release's notes; it's
stored as NULL with the percentile's name in `top_coded`, and the page says
"at least" the ceiling. (May 2025 has no such cell nationally: BLS printed
every chief executive percentile, to $507,730.) "*" and "**" mean BLS published no estimate, and
are NULL. An occupation BLS reports only as an annual figure (teachers, for
example) has `annual_only` = 1, because its hourly figure doesn't exist.

Usage:
    python3 scripts/ingest_bls.py                       # both, discover and load if changed
    python3 scripts/ingest_bls.py --only oews|projections
    python3 scripts/ingest_bls.py --dry-run [--local-oews DIR] [--local-projections XLSX]
"""
from __future__ import annotations

import argparse
import io
import os
import re
import sys
import time
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import POLITE_PAUSE_S, discover_links, fetch, log  # noqa: E402
from lib_reference import keep_record, seen_before, sha256, sheet_rows, sync_rows  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_bls.py"
# Readable source names for the site's source line, never bare URLs.
OEWS_SOURCE = "BLS Occupational Employment and Wage Statistics (bls.gov)"
PROJ_SOURCE = "BLS Employment Projections (bls.gov)"
OEWS_PAGE = "https://www.bls.gov/oes/tables.htm"
PROJ_PAGE = "https://www.bls.gov/emp/tables.htm"
HOST = "https://www.bls.gov"
OEWS_TABLE = "bls_oews"
PROJ_TABLE = "bls_projections"
SOC = re.compile(r"^\d{2}-\d{4}$")
# BLS's area types: 1 national, 2 state, 4 metropolitan, 6 non-metropolitan.
AREA_TYPES = {"1", "2", "4", "6"}
PCTS = ("A_PCT10", "A_PCT25", "A_MEDIAN", "A_PCT75", "A_PCT90")
OEWS_COLS = ("area", "soc7", "area_type", "area_title", "title", "o_group", "tot_emp", "a_mean",
             "a_p10", "a_p25", "a_median", "a_p75", "a_p90", "h_median", "top_coded", "annual_only",
             "series")
PROJ_COLS = ("soc7", "title", "base_year", "proj_year", "emp_base", "emp_proj", "change_num",
             "change_pct", "openings", "median_wage", "education", "experience", "training")
# Floors for a full release; a smaller one is a broken or partial file.
MIN_NATIONAL = 700
MIN_METRO_ROWS = 50_000
MIN_PROJECTIONS = 700

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {OEWS_TABLE} (
        area TEXT NOT NULL, soc7 TEXT NOT NULL, area_type INTEGER NOT NULL,
        area_title TEXT NOT NULL, title TEXT NOT NULL, o_group TEXT NOT NULL,
        tot_emp INTEGER, a_mean INTEGER,
        a_p10 INTEGER, a_p25 INTEGER, a_median INTEGER, a_p75 INTEGER, a_p90 INTEGER,
        h_median REAL, top_coded TEXT, annual_only INTEGER NOT NULL, series TEXT NOT NULL,
        PRIMARY KEY (area, soc7))""",
    # Every read is one occupation across areas, or one area across occupations.
    f"CREATE INDEX IF NOT EXISTS {OEWS_TABLE}_soc ON {OEWS_TABLE} (soc7, area_type, area)",
    f"""CREATE TABLE IF NOT EXISTS {PROJ_TABLE} (
        soc7 TEXT PRIMARY KEY, title TEXT NOT NULL, base_year INTEGER NOT NULL,
        proj_year INTEGER NOT NULL, emp_base REAL, emp_proj REAL, change_num REAL,
        change_pct REAL, openings REAL, median_wage INTEGER,
        education TEXT, experience TEXT, training TEXT)""",
]


class Refusal(Exception):
    """A release that must not be written, with the reason."""


def num(text: str) -> float | None:
    """BLS's number cell, or None for its no-estimate symbols."""
    t = (text or "").strip().replace(",", "")
    if t in ("", "*", "**", "#", "~", "-", "—"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def whole(text: str) -> int | None:
    v = num(text)
    return None if v is None else int(round(v))


def header_index(header: list[str], wanted: tuple[str, ...]) -> dict[str, int]:
    pos = {h.strip().upper(): i for i, h in enumerate(header)}
    missing = [w for w in wanted if w not in pos]
    if missing:
        raise Refusal(f"columns missing: {missing}")
    return {w: pos[w] for w in wanted}


def oews_rows(xlsx: bytes, series: str) -> list[tuple]:
    """One sheet of an OEWS release as table rows, cross-industry and all ownerships only."""
    it = sheet_rows(xlsx)
    header = next(it)
    need = ("AREA", "AREA_TITLE", "AREA_TYPE", "OCC_CODE", "OCC_TITLE", "O_GROUP", "TOT_EMP",
            "A_MEAN", "H_MEDIAN", "ANNUAL", *PCTS)
    ix = header_index(header, need)
    has = {h.strip().upper(): i for i, h in enumerate(header)}
    out = []
    for r in it:
        cell = lambda k: r[ix[k]] if ix[k] < len(r) else ""  # noqa: E731
        if "NAICS" in has and has["NAICS"] < len(r) and r[has["NAICS"]] not in ("000000", ""):
            continue
        if "I_GROUP" in has and has["I_GROUP"] < len(r) and r[has["I_GROUP"]] not in ("cross-industry", ""):
            continue
        if "OWN_CODE" in has and has["OWN_CODE"] < len(r) and r[has["OWN_CODE"]] not in ("1235", ""):
            continue
        code = cell("OCC_CODE").strip()
        group = cell("O_GROUP").strip().lower()
        area_type = cell("AREA_TYPE").strip()
        if not SOC.match(code) or group not in ("detailed", "broad") or area_type not in AREA_TYPES:
            continue
        top = [p for p in PCTS if cell(p).strip() == "#"]
        out.append((
            cell("AREA").strip(), code, int(area_type), cell("AREA_TITLE").strip(),
            cell("OCC_TITLE").strip(), group, whole(cell("TOT_EMP")), whole(cell("A_MEAN")),
            *(whole(cell(p)) for p in PCTS),
            num(cell("H_MEDIAN")), ",".join(p.replace("A_", "").lower() for p in top) or None,
            1 if cell("ANNUAL").strip().upper() == "TRUE" else 0, series,
        ))
    return out


def merge_detailed(rows: list[tuple]) -> list[tuple]:
    """One row per (area, SOC): BLS lists a few codes under both its detailed and
    its broad grouping; the detailed one is the occupation itself."""
    keep: dict[tuple[str, str], tuple] = {}
    for r in rows:
        k = (r[0], r[1])
        if k not in keep or (keep[k][5] == "broad" and r[5] == "detailed"):
            keep[k] = r
    return list(keep.values())


def check_oews(rows: list[tuple]) -> None:
    national = sum(1 for r in rows if r[2] == 1)
    if national < MIN_NATIONAL:
        raise Refusal(f"only {national} national occupations (expected {MIN_NATIONAL}+)")
    metro = sum(1 for r in rows if r[2] in (4, 6))
    if metro < MIN_METRO_ROWS:
        raise Refusal(f"only {metro} metro and non-metro rows (expected {MIN_METRO_ROWS}+)")
    # A percentile ladder that runs backwards is a misread column, not BLS data.
    for r in rows:
        ladder = [v for v in r[8:13] if v is not None]
        if ladder != sorted(ladder):
            raise Refusal(f"{r[0]} {r[1]}: percentiles out of order {r[8:13]}")
    sd = next((r for r in rows if r[2] == 1 and r[1] == "15-1252"), None)
    if sd is None or not (60_000 <= (sd[10] or 0) <= 300_000):
        raise Refusal(f"software developers' national median is {sd and sd[10]!r}, outside a sane range")


def projection_rows(xlsx: bytes) -> list[tuple]:
    """Table 1.2 of BLS's occupation workbook, line items only, by header name."""
    it = sheet_rows(xlsx, "Table 1.2")
    header: list[str] = []
    for r in it:
        if any("National Employment Matrix code" in c for c in r):
            header = [c.strip() for c in r]
            break
    if not header:
        raise Refusal("Table 1.2 has no header row")

    def find(prefix: str) -> int:
        hits = [i for i, h in enumerate(header) if h.startswith(prefix)]
        if not hits:
            raise Refusal(f"Table 1.2 has no column starting {prefix!r}")
        return hits[0]

    emp = [i for i, h in enumerate(header) if re.match(r"^Employment, \d{4}$", h)]
    if len(emp) != 2:
        raise Refusal(f"expected two employment years, found {[header[i] for i in emp]}")
    base_year, proj_year = (int(header[i][-4:]) for i in emp)
    i_title = next(i for i, h in enumerate(header) if h.endswith("National Employment Matrix title"))
    i_code = next(i for i, h in enumerate(header) if h.endswith("National Employment Matrix code"))
    i_type = find("Occupation type")
    i_cnum, i_cpct = find("Employment change, numeric"), find("Employment change, percent")
    i_open, i_wage = find("Occupational openings"), find("Median annual wage")
    i_edu, i_exp, i_train = (find("Typical education needed"), find("Work experience"),
                             find("Typical on-the-job training"))
    out = []
    for r in it:
        if len(r) <= i_train:
            continue
        code = r[i_code].strip()
        if not SOC.match(code) or r[i_type].strip() != "Line item":
            continue
        text = lambda i: (r[i].strip() or None) if r[i].strip() not in ("—", "-") else None  # noqa: E731
        rnd = lambda v, d=1: None if v is None else round(v, d)  # noqa: E731
        out.append((code, r[i_title].strip(), base_year, proj_year, rnd(num(r[emp[0]])),
                    rnd(num(r[emp[1]])), rnd(num(r[i_cnum])), rnd(num(r[i_cpct])), rnd(num(r[i_open])),
                    whole(r[i_wage]), text(i_edu), text(i_exp), text(i_train)))
    if len(out) < MIN_PROJECTIONS:
        raise Refusal(f"only {len(out)} occupations in Table 1.2 (expected {MIN_PROJECTIONS}+)")
    return out


def newest_oews(html: str) -> tuple[str, dict[str, str]]:
    """The newest year's nat/st/ma zips linked from the tables page."""
    links = discover_links(html, r"oesm\d\d(nat|st|ma)\.zip$", HOST)
    years = sorted({re.match(r"oesm(\d\d)", n).group(1) for n in links})
    for yy in reversed(years):
        trio = {kind: links.get(f"oesm{yy}{kind}.zip") for kind in ("nat", "st", "ma")}
        if all(trio.values()):
            return yy, trio
    raise Refusal("no year has all three OEWS zips linked")


def xlsx_members(zip_bytes: bytes) -> list[bytes]:
    """The data workbooks inside an OEWS zip (not its file-description sheet)."""
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    names = [n for n in z.namelist() if n.lower().endswith("_dl.xlsx")]
    if not names:
        raise Refusal(f"no *_dl.xlsx in the zip (has {z.namelist()})")
    return [z.read(n) for n in sorted(names)]


def load_oews(db: Turso | None, args, started: float) -> int:
    if args.local_oews:
        yy = re.search(r"(\d\d)", os.path.basename(args.local_oews.rstrip("/"))).group(1)
        files = {k: open(os.path.join(args.local_oews, f"oesm{yy}{k}.zip"), "rb").read() for k in ("nat", "st", "ma")}
    else:
        yy, trio = newest_oews(fetch(OEWS_PAGE).decode("utf-8", "replace"))
        files = {}
        for kind, url in trio.items():
            log(f"OEWS May 20{yy} {kind}: {url}")
            files[kind] = fetch(url, referer=OEWS_PAGE)
            time.sleep(POLITE_PAUSE_S)
    series = f"May 20{yy}"
    digest = sha256(b"".join(files[k] for k in ("nat", "st", "ma")))
    rows: list[tuple] = []
    for kind in ("nat", "st", "ma"):
        for book in xlsx_members(files[kind]):
            rows += oews_rows(book, series)
    rows = merge_detailed(rows)
    check_oews(rows)
    counts = {t: sum(1 for r in rows if r[2] == t) for t in (1, 2, 4, 6)}
    log(f"  {len(rows)} rows: national {counts[1]}, state {counts[2]}, metro {counts[4]}, non-metro {counts[6]}")
    if db is None:
        return 0
    if not args.force and seen_before(db, "bls_oews_load", digest):
        log("  OEWS unchanged since the last load")
        return 0
    got = sync_rows(db, OEWS_TABLE, ("area", "soc7"), OEWS_COLS, rows, pause_s=0.5)
    ceiling = next((r for r in rows if r[14]), None)
    write_doc(db, "bls_oews_meta", {"series": series, "rows": len(rows), "byType": counts,
                                    "topCodedExample": ceiling[1] if ceiling else None})
    keep_record(db, "bls_oews_load", digest, series=series, rows=len(rows))
    # The estimates describe May of the series year; BLS publishes them the next spring.
    stamp_freshness(db, "bls-oews", as_of=f"20{yy}-05-31", source=OEWS_SOURCE, cadence="yearly, each spring",
                    note=f"OEWS {series}: {len(rows)} occupation and area rows", max_age_days=760)
    record_run(db, SCRIPT + " --only oews", status="ok", rows_written=got["written"],
               note=f"OEWS {series}: {got}", started_at=started)
    log(f"  OEWS written: {got}")
    return 0


def load_projections(db: Turso | None, args, started: float) -> int:
    if args.local_projections:
        book = open(args.local_projections, "rb").read()
    else:
        links = discover_links(fetch(PROJ_PAGE).decode("utf-8", "replace"), r"occupation\.xlsx$", HOST)
        url = links.get("occupation.xlsx")
        if url is None:
            raise Refusal("the projections tables page links no occupation.xlsx")
        log(f"projections: {url}")
        book = fetch(url, referer=PROJ_PAGE)
    rows = projection_rows(book)
    base, proj = rows[0][2], rows[0][3]
    log(f"  {len(rows)} occupations, {base} to {proj}")
    if db is None:
        return 0
    digest = sha256(book)
    if not args.force and seen_before(db, "bls_projections_load", digest):
        log("  projections unchanged since the last load")
        return 0
    got = sync_rows(db, PROJ_TABLE, ("soc7",), PROJ_COLS, rows)
    keep_record(db, "bls_projections_load", digest, baseYear=base, projYear=proj, rows=len(rows))
    stamp_freshness(db, "bls-projections", as_of=f"{base}-12-31", source=PROJ_SOURCE, cadence="yearly, each autumn",
                    note=f"{base} to {proj}: {len(rows)} occupations", max_age_days=760)
    record_run(db, SCRIPT + " --only projections", status="ok", rows_written=got["written"],
               note=f"{base}-{proj}: {got}", started_at=started)
    log(f"  projections written: {got}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=("oews", "projections"))
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--local-oews", help="a directory holding oesmYYnat.zip, oesmYYst.zip and oesmYYma.zip")
    ap.add_argument("--local-projections")
    args = ap.parse_args()
    started = time.time()
    db = None
    if not args.dry_run:
        db = Turso()
        db.script(DDL)
    rc = 0
    for name, step in (("oews", load_oews), ("projections", load_projections)):
        if args.only and args.only != name:
            continue
        try:
            rc |= step(db, args, started)
        except Refusal as exc:
            log(f"REFUSED ({name}): {exc}")
            if db is not None:
                record_run(db, f"{SCRIPT} --only {name}", status="failed", note=f"refused: {exc}", started_at=started)
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
