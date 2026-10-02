#!/usr/bin/env python3
"""Load H-1B lottery registrations per employer, FY2021 to FY2024, from USCIS's FOIA release.

WHAT IT IS. Bloomberg News sued DHS under FOIA and published what USCIS
produced: every H-1B cap registration for lottery years 2021 to 2024, one row
each, with whether it was selected and, if a petition followed, USCIS's first
decision on it. Repository `BloombergGraphics/2024-h1b-immigration-data`,
Apache-2.0, last pushed June 27 2025 (the update that un-redacted the DOL case
number). Bloomberg asks that it be cited as "sourced from USCIS and obtained
by Bloomberg". It is a frozen snapshot: USCIS queried it in May 2024 (the
data dictionary's own source line), and nothing here updates it.

WHAT IS KEPT. One row per employer name per lottery year: registrations,
selected, petitions filed, approved and denied on first decision. NOTHING
about any beneficiary is stored: no country, age, gender, wage, education or
agent name, and no row-level record at all. The employer's full tax number is
read and dropped.

HOW A YEAR IS CHECKED BEFORE IT IS WRITTEN, against two independent sources:

* the file's own data dictionary ("Report" sheet) gives total registrations
  and total petition receipts per year; the rows must match both exactly;
* USCIS's public registration table (`src/lib/h1bLottery.ts`, read from its
  page) gives eligible registrations and selections per year; the rows must
  match the eligible count, and selected rows plus the rows USCIS withheld
  under (b)(3)/(b)(6)/(b)(7)(c) must equal USCIS's selected count. Measured
  on FY2021: 269,424 rows, 124,368 selected plus 47 withheld = 124,415, both
  exactly USCIS's figures.

Withheld rows carry no employer and are counted only in the year's totals.

Files are DISCOVERED from the repository's contents listing, never typed:
FY2023 is split into three parts that concatenate into one zip, and FY2024
is two files (single and multiple registrations).

Run once, somewhere with room (about 110 MB down, 2.5 GB of CSV streamed):
    python3 scripts/ingest_h1b_lottery_foia.py              # all four years
    python3 scripts/ingest_h1b_lottery_foia.py --fy 2021    # one year
    python3 scripts/ingest_h1b_lottery_foia.py --dry-run    # reconcile, write nothing
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import pathlib
import re
import sys
import tempfile
import time
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_slugs import slugify  # noqa: E402
from lib_gov_data import iter_rows, log, read_shared_strings  # noqa: E402
from lib_turso import Turso, read_doc, record_run, write_doc  # noqa: E402

SCRIPT = "ingest_h1b_lottery_foia.py"
REPO = "BloombergGraphics/2024-h1b-immigration-data"
LISTING = f"https://api.github.com/repos/{REPO}/contents"
SOURCE = f"https://github.com/{REPO}"
TABLE = "h1b_lottery_employers"
STAGE = "h1b_lottery_employers_stage"
DOC = "h1b_lottery_foia"
WITHHELD = re.compile(r"^\(b\)\(")
# A registration that went in and wasn't picked: FY2021's file says CREATED, the later ones
# ELIGIBLE (FY2022: 169,523 ELIGIBLE + 131,896 SELECTED + 28 withheld = USCIS's 301,447 eligible).
NOT_SELECTED = {"CREATED", "ELIGIBLE"}
# Selected registrations the file holds fewer of than USCIS's table, by year, measured and
# allowed exactly. FY2024: 188,364 selected + 27 withheld = 188,391 against the table's
# 188,400, while the rows equal USCIS's 758,994 eligible and the receipts equal the data
# dictionary's, so the file is whole; which side is off by 9 isn't established.
KNOWN_SELECTED_GAP = {2024: 9}
LOTTERY_TS = pathlib.Path(__file__).resolve().parent.parent / "src" / "lib" / "h1bLottery.ts"

COUNTS = ["registrations", "selected", "petitioned", "approved", "denied"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        fy INTEGER NOT NULL, employer TEXT NOT NULL, employer_slug TEXT,
        {", ".join(f"{c} INTEGER NOT NULL" for c in COUNTS)},
        PRIMARY KEY (fy, employer))""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_emp ON {TABLE} (employer_slug, fy)",
]


class Refusal(Exception):
    """A year that must not be written, with the reason."""


# ---------------------------------------------------------------------------
# Sources of truth for the reconciliation
# ---------------------------------------------------------------------------

def uscis_table(ts_text: str) -> dict[int, dict[str, int]]:
    """USCIS's eligible and selected counts per cap year, as transcribed in h1bLottery.ts."""
    out: dict[int, dict[str, int]] = {}
    for m in re.finditer(r"\{\s*fy:\s*(\d{4}),([^}]*)\}", ts_text):
        body = m.group(2)
        nums = {k: int(v.replace("_", "")) for k, v in re.findall(r"(\w+):\s*([\d_]+)", body)}
        if "eligible" in nums and "selected" in nums:
            out[int(m.group(1))] = {"eligible": nums["eligible"], "selected": nums["selected"]}
    return out


def report_totals(xlsx: bytes) -> dict[int, dict[str, int]]:
    """The data dictionary's own per-year totals: receipts and registrations."""
    z = zipfile.ZipFile(io.BytesIO(xlsx))
    shared = read_shared_strings(z)
    sheets = sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
    for sheet in sheets:
        rows = [r for r in iter_rows(z, sheet, shared)]
        header = next((i for i, r in enumerate(rows) if "Total Registrations" in r.values()), None)
        if header is None:
            continue
        cols = {v: k for k, v in rows[header].items()}
        out: dict[int, dict[str, int]] = {}
        for r in rows[header + 1:]:
            year = str(r.get(cols["Lottery Year"], "")).strip()
            if not re.fullmatch(r"\d{4}", year):
                if out:
                    break
                continue
            out[int(year)] = {
                "receipts": int(float(r[cols["Count of Receipts"]])),
                "registrations": int(float(r[cols["Total Registrations"]])),
            }
        if out:
            return out
    raise Refusal("the data dictionary has no per-year Report table")


# ---------------------------------------------------------------------------
# Reading a year
# ---------------------------------------------------------------------------

def year_files(listing: list[dict]) -> dict[int, list[list[dict]]]:
    """Group the repository's data files by year: each inner list is one zip, parts in order."""
    out: dict[int, dict[str, list[dict]]] = {}
    for f in listing:
        m = re.fullmatch(r"TRK_\d+_FY(\d{4})(_[a-z_]+)?\.zip(\.\d{3})?", f.get("name", ""))
        if not m:
            continue
        stem = f"FY{m.group(1)}{m.group(2) or ''}"
        out.setdefault(int(m.group(1)), {}).setdefault(stem, []).append(f)
    return {fy: [sorted(parts, key=lambda f: f["name"]) for _, parts in sorted(stems.items())]
            for fy, stems in out.items()}


def aggregate(rows, fy: int) -> tuple[dict[str, dict[str, int]], dict[str, int]]:
    """Per-employer counts and the year's totals, from registration rows."""
    by: dict[str, dict[str, int]] = {}
    tot = {"rows": 0, "selected": 0, "withheld": 0, "receipts": 0}
    for r in rows:
        tot["rows"] += 1
        status = (r.get("status_type") or "").strip()
        if WITHHELD.match(status):
            tot["withheld"] += 1
            if (r.get("RECEIPT_NUMBER") or "").strip():
                tot["receipts"] += 1
            continue
        year = (r.get("lottery_year") or "").strip()
        if year != str(fy):
            raise Refusal(f"a FY{fy} file holds a row for lottery year {year!r}")
        name = (r.get("employer_name") or "").strip()
        if not name:
            raise Refusal(f"FY{fy}: a registration with no employer name")
        e = by.setdefault(name, dict.fromkeys(COUNTS, 0))
        e["registrations"] += 1
        if status == "SELECTED":
            e["selected"] += 1
            tot["selected"] += 1
        elif status not in NOT_SELECTED:
            raise Refusal(f"FY{fy}: an unknown registration status {status!r}")
        if (r.get("RECEIPT_NUMBER") or "").strip():
            e["petitioned"] += 1
            tot["receipts"] += 1
        decision = (r.get("FIRST_DECISION") or "").strip()
        if decision == "Approved":
            e["approved"] += 1
        elif decision == "Denied":
            e["denied"] += 1
    return by, tot


def reconcile(fy: int, tot: dict[str, int], report: dict[int, dict], uscis: dict[int, dict]) -> None:
    rep = report.get(fy)
    pub = uscis.get(fy)
    if not rep or not pub:
        raise Refusal(f"FY{fy} has no total to check against (report {bool(rep)}, USCIS table {bool(pub)})")
    problems = []
    if tot["rows"] != rep["registrations"]:
        problems.append(f"{tot['rows']:,} rows against the report's {rep['registrations']:,} registrations")
    if tot["receipts"] != rep["receipts"]:
        problems.append(f"{tot['receipts']:,} receipts against the report's {rep['receipts']:,}")
    if tot["rows"] != pub["eligible"]:
        problems.append(f"{tot['rows']:,} rows against USCIS's {pub['eligible']:,} eligible")
    if tot["selected"] + tot["withheld"] + KNOWN_SELECTED_GAP.get(fy, 0) != pub["selected"]:
        problems.append(f"{tot['selected']:,} selected + {tot['withheld']:,} withheld against USCIS's {pub['selected']:,}")
    if problems:
        raise Refusal(f"FY{fy} doesn't add up: {'; '.join(problems)}")


def download(url: str, dest) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "permtracker-ingest", "Accept": "application/octet-stream"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        while chunk := resp.read(1 << 20):
            dest.write(chunk)


def read_year(fy: int, zips: list[list[dict]]):
    """Yield every registration row of a year, zip by zip, without holding a file in memory."""
    for parts in zips:
        with tempfile.TemporaryFile() as tmp:
            for part in parts:  # a split archive is its parts end to end
                log(f"  downloading {part['name']} ({int(part.get('size', 0)) / 1e6:.1f} MB)")
                download(part["download_url"], tmp)
            tmp.seek(0)
            z = zipfile.ZipFile(tmp)
            for name in z.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with z.open(name) as f:
                    yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="replace"))


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

def store(db: Turso, fy: int, by: dict[str, dict[str, int]]) -> int:
    for ddl in DDL:
        db.execute(ddl)
    db.execute(f"DROP TABLE IF EXISTS {STAGE}")
    db.execute(DDL[0].replace(f"IF NOT EXISTS {TABLE}", STAGE))
    cols = ["fy", "employer", "employer_slug", *COUNTS]
    rows = [[fy, name, slugify(name) or None, *[c[k] for k in COUNTS]] for name, c in by.items()]
    holes = "(" + ",".join("?" * len(cols)) + ")"
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        db.execute(f"INSERT INTO {STAGE} ({', '.join(cols)}) VALUES " + ",".join([holes] * len(chunk)),
                   [v for r in chunk for v in r])
    if int(db.scalar(f"SELECT count(*) FROM {STAGE}") or 0) != len(rows):
        raise Refusal(f"FY{fy}: staged a different number of employers than were read")
    year = int(fy)
    db.script(["BEGIN", f"DELETE FROM {TABLE} WHERE fy = {year}", f"INSERT INTO {TABLE} SELECT * FROM {STAGE}", "COMMIT"])
    db.execute(f"DROP TABLE IF EXISTS {STAGE}")
    held = int(db.scalar(f"SELECT count(*) FROM {TABLE} WHERE fy = ?", [year]) or 0)
    if held != len(rows):
        raise Refusal(f"FY{fy}: {held:,} employers held after the swap, {len(rows):,} read")
    return held


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fy", type=int, help="load one lottery year")
    ap.add_argument("--dry-run", action="store_true", help="download and reconcile, write nothing")
    args = ap.parse_args(argv)
    started = int(time.time() * 1000)

    req = urllib.request.Request(LISTING, headers={"User-Agent": "permtracker-ingest", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        listing = json.loads(resp.read())
    files = year_files(listing)
    dictionary = next((f for f in listing if re.search(r"FOIA_FIN\.xlsx$", f.get("name", ""))), None)
    if not dictionary:
        raise SystemExit("the repository no longer carries its data dictionary")
    buf = io.BytesIO()
    download(dictionary["download_url"], buf)
    report = report_totals(buf.getvalue())
    uscis = uscis_table(LOTTERY_TS.read_text())
    log(f"years in the repository: {sorted(files)}; report totals for {sorted(report)}")

    db = None if args.dry_run else Turso()
    doc: dict = {"source": SOURCE, "license": "Apache-2.0", "credit": "USCIS, obtained by Bloomberg News under FOIA",
                 "queried": "2024-05", "read": time.strftime("%Y-%m-%d"), "years": {}}
    if db:
        doc["years"] = (read_doc(db, DOC) or {}).get("years", {})
    wanted = [args.fy] if args.fy else sorted(files)
    written = 0
    try:
        for fy in wanted:
            if fy not in files:
                raise Refusal(f"the repository has no FY{fy} files")
            by, tot = aggregate(read_year(fy, files[fy]), fy)
            reconcile(fy, tot, report, uscis)
            log(f"  FY{fy}: {tot['rows']:,} registrations from {len(by):,} employer names; "
                f"{tot['selected']:,} selected, {tot['withheld']:,} withheld; reconciled")
            if db:
                written += store(db, fy, by)
                doc["years"][str(fy)] = {**tot, "employers": len(by), "uscisSelected": uscis[fy]["selected"]}
                write_doc(db, DOC, json.dumps(doc, sort_keys=True))
    except Refusal as e:
        log(f"REFUSED: {e}")
        if db:
            record_run(db, SCRIPT, status="failed", rows_written=written, note=str(e)[:300], started_at=started)
        return 1
    if db:
        record_run(db, SCRIPT, status="ok", rows_written=written,
                   note=f"FOIA lottery years {wanted}, frozen USCIS snapshot (May 2024)", started_at=started)
    log(f"done: {written:,} employer-year rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
