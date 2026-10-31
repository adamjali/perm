#!/usr/bin/env python3
"""DOL Wage and Hour Division cases: `whd_cases`, joined to the employer pages they belong to.

DOL publishes every concluded Wage and Hour compliance action since FY2005 as one file (dataset 10362 in its
open data catalog, "Quarterly"): the employer's legal and trade names, where, the findings period, violations,
back wages the employer agreed to pay, workers owed them, civil money penalties, and the same four figures for each
law WHD enforces, H-1B, H-2A and H-2B among them. About 371,000 cases, one row each.

What this keeps, and why:

* every case with an H-1B, H-2A or H-2B violation or back wages, matched or not: the visa-program record, the part
  of the file this site is about (the national list reads it);
* every other case that joins an employer page here (a page's "Wage and Hour cases" section).

Joining a case to a page is where a wrong answer would hurt someone, so it is strict (a wrong link is worse than none).
The name is the legal name; the trade name only when DOL printed no legal name, because a franchisee's trade name is
the brand ("Buena Vida LLC" trading as "McDonald's" is not McDonald's Corporation, measured Oct 31 2026).

* An H-1B, H-2A or H-2B case joins a PERM sponsor by name (`sponsor_matcher`, the layoff notices' rule), or a page
  with no PERM record whose exact name key leads to one page that files that same program (an H-1B case only to a
  page with H-1B LCAs). A bare one-word name never reaches a no-PERM page (`fallback`).
* Any other case joins a PERM sponsor only, and only when the case's state is one the sponsor's own PERM filings
  name as a worksite, or the sponsor filed 50 or more PERM cases (a national employer). A small restaurant in Ohio
  doesn't land on a namesake that files only in Texas. A one-word name ("Linde Corporation", a contractor in
  Pittston, against Linde Inc., the gas company) joins only a national sponsor.

DOL's own words carried to every surface: findings dates aren't the case's open and close dates; "agreed to pay"
isn't paid; a case with no violations is a case, not a finding; counts loaded after Oct 1 2025 aren't directly
comparable with earlier ones (DOL's dataset notes, read Oct 31 2026).

The file is found from DOL's catalog record (agency, API path, table name), never typed by hand; it is read on the
server (www.dol.gov refuses it, data.dol.gov doesn't, measured Oct 31 2026).

Usage:
    python3 scripts/ingest_whd.py              # download, match, write
    python3 scripts/ingest_whd.py --dry-run    # download and match, print the counts, write nothing
    python3 scripts/ingest_whd.py --file x.zip # read a zip already on disk
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
from entity_identity import program_key  # noqa: E402
from ingest_warn import FORM_WORD, page_matcher  # noqa: E402
from lib_db import Database, query_rows, record_run, stamp_freshness  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "ingest_whd.py"
DATASET = "whd-cases"
SOURCE = "DOL Wage and Hour Division compliance actions (data.dol.gov)"
# DOL's open data catalog: "Wage and Hour Compliance Action Data".
DATASET_ID = 10362
TABLE = "whd_cases"
# DOL's file held 370,964 cases on Oct 26 2026; a file a tenth that size is a broken download, not a quarter.
MIN_CASES = 300_000

PROGRAMS = ("h1b", "h2a", "h2b")
COLS = [
    "case_id", "trade_name", "legal_name", "city", "state", "zip", "naics", "naics_title",
    "findings_start", "findings_end", "violations", "back_wages", "workers_owed", "penalties", "flsa_repeat",
    "h1b_violations", "h1b_back_wages", "h1b_workers", "h1b_penalties",
    "h2a_violations", "h2a_back_wages", "h2a_workers", "h2a_penalties",
    "h2b_violations", "h2b_back_wages", "h2b_workers",
    "employer_slug",
]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        case_id TEXT PRIMARY KEY,
        trade_name TEXT, legal_name TEXT, city TEXT, state TEXT, zip TEXT, naics TEXT, naics_title TEXT,
        findings_start TEXT, findings_end TEXT,
        violations INTEGER, back_wages REAL, workers_owed INTEGER, penalties REAL, flsa_repeat TEXT,
        h1b_violations INTEGER, h1b_back_wages REAL, h1b_workers INTEGER, h1b_penalties REAL,
        h2a_violations INTEGER, h2a_back_wages REAL, h2a_workers INTEGER, h2a_penalties REAL,
        h2b_violations INTEGER, h2b_back_wages REAL, h2b_workers INTEGER,
        employer_slug TEXT)""",
    f"CREATE INDEX IF NOT EXISTS whd_cases_employer ON {TABLE} (employer_slug, findings_end)",
    f"CREATE INDEX IF NOT EXISTS whd_cases_end ON {TABLE} (findings_end)",
]
# DOL's column for each of ours.
SOURCE_COLS = {
    "case_id": "CASE_ID", "trade_name": "TRADE_NM", "legal_name": "LEGAL_NAME", "city": "CTY_NM", "state": "ST_CD",
    "zip": "ZIP_CD", "naics": "NAIC_CD", "naics_title": "NAICS_CODE_DESCRIPTION",
    "findings_start": "FINDINGS_START_DATE", "findings_end": "FINDINGS_END_DATE",
    "violations": "CASE_VIOLTN_CNT", "back_wages": "BW_ATP_AMT", "workers_owed": "EE_ATP_CNT", "penalties": "CMP_ASSD",
    "flsa_repeat": "FLSA_REPEAT_VIOLATOR",
    "h1b_violations": "H1B_VIOLTN_CNT", "h1b_back_wages": "H1B_BW_ATP_AMT", "h1b_workers": "H1B_EE_ATP_CNT",
    "h1b_penalties": "H1B_CMP_ASSD_AMT",
    "h2a_violations": "H2A_VIOLTN_CNT", "h2a_back_wages": "H2A_BW_ATP_AMT", "h2a_workers": "H2A_EE_ATP_CNT",
    "h2a_penalties": "H2A_CMP_ASSD_AMT",
    "h2b_violations": "H2B_VIOLTN_CNT", "h2b_back_wages": "H2B_BW_ATP_AMT", "h2b_workers": "H2B_EE_ATP_CNT",
}
INT_COLS = {c for c in COLS if c.endswith(("violations", "workers", "workers_owed"))}
MONEY_COLS = {c for c in COLS if c.endswith(("back_wages", "penalties"))}
DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
# A findings date past this is DOL's typing ("3021-..."), shown as nothing rather than a date in the future.
LATEST_PLAUSIBLE_YEAR = 2100


def log(msg: str) -> None:
    print(f"[whd] {msg}", flush=True)


def number(value: str, kind: type):
    text = (value or "").strip().replace(",", "")
    if text == "":
        return 0
    try:
        return kind(float(text))
    except ValueError:
        return 0


def day(value: str) -> str | None:
    m = DATE_RE.match((value or "").strip())
    if not m or int(m.group(1)[:4]) > LATEST_PLAUSIBLE_YEAR:
        return None
    return m.group(1)


def rows_of(archive: zipfile.ZipFile):
    """Every case in every CSV chunk, as a dict of our columns. DOL's header starts with a byte-order mark."""
    names = sorted(n for n in archive.namelist() if n.lower().endswith(".csv"))
    if not names:
        raise RuntimeError("the zip holds no CSV")
    for name in names:
        with archive.open(name) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline=""))
            header = [h.strip() for h in next(reader)]
            missing = [c for c in SOURCE_COLS.values() if c not in header]
            if missing:
                raise RuntimeError(f"{name}: DOL's file has no {', '.join(missing)}; its layout changed")
            at = {c: header.index(src) for c, src in SOURCE_COLS.items()}
            for cells in reader:
                if len(cells) < len(header):
                    continue
                row = {c: cells[i].strip() for c, i in at.items()}
                for c in INT_COLS:
                    row[c] = number(row[c], int)
                for c in MONEY_COLS:
                    row[c] = round(number(row[c], float), 2)
                row["findings_start"] = day(row["findings_start"])
                row["findings_end"] = day(row["findings_end"])
                yield row


def file_date(archive: zipfile.ZipFile) -> str | None:
    return dol.file_date(archive.namelist())


def visa_programs(row: dict) -> list[str]:
    """The visa programs a case found something under: a violation or back wages."""
    return [p for p in PROGRAMS if row[f"{p}_violations"] > 0 or row[f"{p}_back_wages"] > 0]


def make_matcher(sponsors, states, others, program_counts):
    """`sponsors`: (merge_key, slug, total) busiest first. `states`: sponsor slug -> the worksite states its PERM
    filings name. `others`: (key, page_slug) of no-PERM pages. `program_counts`: page slug -> {"lca": n, "h2a": n,
    "h2b": n} for no-PERM pages. A PERM sponsor first, under the shared rule (lib_dol_records.sponsor_rule), with
    the state waived for a visa-program case; then a no-PERM page that files the same program."""
    rule = dol.sponsor_rule(sponsors, states)
    other = page_matcher(others)
    needs = {"h1b": "lca", "h2a": "h2a", "h2b": "h2b"}

    def match(row: dict) -> str | None:
        programs = visa_programs(row)
        name = row["legal_name"] or row["trade_name"]
        slug = rule(name, row["state"], lenient=bool(programs))
        if slug:
            return slug
        key = program_key(name)
        if key and programs and (len(key.split()) > 1 or FORM_WORD.search(name)):
            page = other(key)
            counts = program_counts.get(page or "", {})
            if page and all(counts.get(needs[p], 0) > 0 for p in programs):
                return page
        return None

    return match


def load_matcher(db: Database):
    sponsors, states = dol.load_sponsors(db)
    others = query_rows(db, "SELECT key, page_slug FROM employer_page_map WHERE page_kind = 'other'")
    counts = {str(s): {"lca": int(l or 0), "h2a": int(a or 0), "h2b": int(b or 0)}
              for s, l, a, b in query_rows(db, "SELECT slug, lca, h2a, h2b FROM employer_other_index")}
    if not others:
        raise RuntimeError("the no-PERM page map read empty; a match against nothing would unlink every case")
    return make_matcher(sponsors, states, others, counts)


def select(rows, match) -> tuple[list[list], dict[str, int]]:
    """The cases to keep, each with its page, and the counts the run reports."""
    keep: list[list] = []
    seen: dict[str, int] = {"cases": 0, "visa": 0, "matched": 0, "visa_matched": 0}
    for row in rows:
        seen["cases"] += 1
        slug = match(row)
        visa = bool(visa_programs(row))
        seen["visa"] += visa
        seen["matched"] += slug is not None
        seen["visa_matched"] += visa and slug is not None
        if visa or slug:
            row["employer_slug"] = slug
            keep.append([row[c] for c in COLS])
    return keep, seen


def moved_pages(db: Database, keep: list[list]) -> list[str]:
    return dol.moved_pages(db, TABLE, COLS, keep)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--file", type=pathlib.Path)
    args = ap.parse_args()
    started = time.time()
    db = Database()
    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = args.file
            if path is None:
                url = dol.catalog_url(DATASET_ID)
                path = pathlib.Path(tmp) / "whd.zip"
                dol.download(url, path)
                log(f"downloaded {path.stat().st_size:,} bytes from {url}")
            with zipfile.ZipFile(path) as archive:
                dated = file_date(archive)
                keep, seen = select(rows_of(archive), load_matcher(db))
        if seen["cases"] < MIN_CASES:
            raise RuntimeError(f"DOL's file held {seen['cases']:,} cases, under {MIN_CASES:,}: refusing a short file")
        log(f"{seen['cases']:,} cases; {seen['visa']:,} with H-1B, H-2A or H-2B findings ({seen['visa_matched']:,} on a page); "
            f"{seen['matched']:,} joined to an employer page; {len(keep):,} kept; file dated {dated}")
        if args.dry_run:
            return 0
        for ddl in DDL:
            db.execute(ddl)
        moved = moved_pages(db, keep)
        got = sync_rows(db, TABLE, ["case_id"], COLS, keep, pause_s=0.3)
        note = (f"{len(keep):,} cases kept of {seen['cases']:,}; {seen['matched']:,} on an employer page; "
                f"{got['written']:,} written, {got['deleted']:,} removed; {dol.refresh_pages(moved, 'whd')}")
        stamp_freshness(db, DATASET, as_of=dated, source=SOURCE, cadence="DOL updates quarterly; read weekly",
                        note=note, max_age_days=150)
        record_run(db, SCRIPT, status="ok", rows_written=got["written"], note=note, started_at=started)
        log(note)
        return 0
    except Exception as exc:  # noqa: BLE001 - recorded, then raised
        if not args.dry_run:
            record_run(db, SCRIPT, status="failed", note=str(exc)[:300], started_at=started)
        raise


if __name__ == "__main__":
    sys.exit(main())
