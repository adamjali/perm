#!/usr/bin/env python3
"""SBA's Paycheck Protection Program loans to PERM sponsors: `ppp_loans`, joined to the employer pages.

WHAT IT IS. Every PPP loan SBA approved in 2020 and 2021, as SBA released them under FOIA (data.sba.gov, "PPP FOIA",
U.S. Government Works): the borrower and its city, the date, the amount approved and forgiven, and the jobs the
borrower reported at the time. Thirteen CSVs (one for loans over $150,000, twelve for the rest), 5.2 GB in all,
SBA's snapshot of Sep 30 2024 (read Oct 31 2026). The program closed in May 2021; the release is a closed record.

WHERE. The files are listed on SBA's own dataset page and found from it, never built; data.sba.gov's robots.txt asks
nothing of them. Each file is downloaded to disk on the server (/var/tmp, since /tmp there is memory), read, and
deleted before the next.

WHAT IS KEPT. Loans joined to a PERM sponsor under the strict rule every DOL record here uses
(`lib_dol_records.sponsor_rule`) and the city test (`dol.same_city`): the borrower's city must be one the sponsor's
own PERM filings name, unless the sponsor is national. The state is the borrower's, or the project's where SBA left
the borrower's blank (13 of the 968,524 large loans, Oct 31 2026). A loan whose business type is a person's (sole
proprietor, self-employed, independent contractor) is kept only when its name carries a company's legal form: the
borrower is then a company ("PLEASANT PLACES, INC." is filed as a sole proprietorship), and otherwise it's a person.
SBA's race, ethnicity, gender and veteran columns are never read.

Usage:
    python3 scripts/ingest_ppp.py            # download, match, write
    python3 scripts/ingest_ppp.py --dry-run  # match and print, write nothing
    python3 scripts/ingest_ppp.py --files a.csv b.csv
"""
from __future__ import annotations

import argparse
import csv
import os
import pathlib
import re
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_dol_records as dol  # noqa: E402
from ingest_warn import FORM_WORD  # noqa: E402
from lib_db import Database, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import robots_allowed  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "ingest_ppp.py"
DATASET = "ppp-loans"
SOURCE = "SBA Paycheck Protection Program loan data, FOIA release (data.sba.gov)"
PAGE = "https://data.sba.gov/dataset/ppp-foia"
TABLE = "ppp_loans"
FILE_RE = re.compile(r'href="(https://data\.sba\.gov/sites/default/files/distribution/[^"]+/public_[a-z0-9_]+_(\d{6})\.csv)"')
# SBA's release: 1 file over $150,000 and 12 under, read Oct 31 2026. Fewer is a changed page, not a smaller program.
MIN_FILES = 13
# The large-loan file held 968,524 loans; all thirteen together hold millions. A total under this is a cut download.
MIN_LOANS = 8_000_000
PERSON_TYPES = {"Sole Proprietorship", "Self-Employed Individuals", "Independent Contractors"}
WORKDIR = os.environ.get("PPP_WORKDIR") or ("/var/tmp" if os.path.isdir("/var/tmp") else None)

COLS = ["loan", "name", "city", "state", "approved", "amount", "forgiven", "forgiven_on", "jobs", "naics",
        "business_type", "draw", "employer_slug"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        loan TEXT PRIMARY KEY,
        name TEXT, city TEXT, state TEXT, approved TEXT, amount REAL, forgiven REAL, forgiven_on TEXT, jobs INTEGER,
        naics TEXT, business_type TEXT, draw TEXT,
        employer_slug TEXT)""",
    f"CREATE INDEX IF NOT EXISTS ppp_loans_employer ON {TABLE} (employer_slug, approved)",
]
NEED = ["LoanNumber", "DateApproved", "ProcessingMethod", "BorrowerName", "BorrowerCity", "BorrowerState",
        "ProjectState", "CurrentApprovalAmount", "ForgivenessAmount", "ForgivenessDate", "JobsReported", "NAICSCode",
        "BusinessType"]
US_DATE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def log(msg: str) -> None:
    print(f"[ppp] {msg}", flush=True)


def day(value: str) -> str | None:
    m = US_DATE.match((value or "").strip())
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


def money(value: str) -> float | None:
    try:
        return round(float((value or "").replace(",", "")), 2)
    except ValueError:
        return None


def count(value: str) -> int | None:
    try:
        n = int(float((value or "").strip()))
    except ValueError:
        return None
    return n if n >= 0 else None


def files_listed() -> list[tuple[str, str]]:
    """(url, snapshot yymmdd) for each CSV SBA's page lists."""
    req = urllib.request.Request(PAGE, headers=dol.HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        html = r.read().decode("utf-8", "replace")
    found = sorted({(m.group(1), m.group(2)) for m in FILE_RE.finditer(html)})
    for url, _ in found:
        if not robots_allowed(url):
            raise RuntimeError(f"robots.txt asks scripts off {url}")
    return found


def loans(path: pathlib.Path):
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.reader(f)
        header = [h.strip() for h in next(reader)]
        missing = [c for c in NEED if c not in header]
        if missing:
            raise RuntimeError(f"SBA's file {path.name} lacks {missing}: its layout changed")
        at = {c: header.index(c) for c in NEED}
        for row in reader:
            yield {c: (row[i].strip() if i < len(row) else "") for c, i in at.items()}


def is_person(r: dict) -> bool:
    return r["BusinessType"] in PERSON_TYPES and not FORM_WORD.search(r["BorrowerName"].lower())


def select(rows, match, place_ok=None, seen: dict | None = None) -> list[list]:
    """The loans to keep, each with its page. `place_ok(slug, city)` is the city test; None gathers candidates."""
    seen = seen if seen is not None else {}
    keep: list[list] = []
    for r in rows:
        seen["loans"] = seen.get("loans", 0) + 1
        if not r["LoanNumber"] or is_person(r):
            continue
        state = r["BorrowerState"] or r["ProjectState"]
        slug = match(r["BorrowerName"], state)
        if not slug:
            continue
        seen["named"] = seen.get("named", 0) + 1
        if place_ok is not None and not place_ok(slug, r["BorrowerCity"]):
            continue
        seen["matched"] = seen.get("matched", 0) + 1
        keep.append([r["LoanNumber"], r["BorrowerName"], r["BorrowerCity"] or None, state or None,
                     day(r["DateApproved"]), money(r["CurrentApprovalAmount"]), money(r["ForgivenessAmount"]),
                     day(r["ForgivenessDate"]), count(r["JobsReported"]), r["NAICSCode"] or None,
                     r["BusinessType"] or None, r["ProcessingMethod"] or None, slug])
    return keep


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--files", nargs="+", type=pathlib.Path)
    args = ap.parse_args()
    started = time.time()
    db = Database()
    try:
        sponsors, states = dol.load_sponsors(db)
        match = dol.sponsor_rule(sponsors, states)
        totals = {str(slug): int(t or 0) for _, slug, t in sponsors}
        listed = [(str(p), "") for p in args.files] if args.files else files_listed()
        if not args.files and len(listed) < MIN_FILES:
            raise RuntimeError(f"SBA's page lists {len(listed)} PPP files, under {MIN_FILES}: its layout changed")
        snapshot = next((s for _, s in listed if s), None)
        candidates: list[list] = []
        seen: dict[str, int] = {}
        with tempfile.TemporaryDirectory(dir=WORKDIR, prefix="ppp-") as tmp:
            for url, _ in listed:
                if args.files:
                    path = pathlib.Path(url)
                else:
                    path = pathlib.Path(tmp) / url.rsplit("/", 1)[-1]
                    dol.download(url, path)
                # The name rule first; the city test needs each candidate sponsor's cities, read once at the end.
                got = select(loans(path), match, None, seen)
                candidates.extend(got)
                log(f"{path.name}: {len(got):,} named like a sponsor ({seen.get('loans', 0):,} loans read so far)")
                if not args.files:
                    path.unlink(missing_ok=True)
        if not args.files and seen.get("loans", 0) < MIN_LOANS:
            raise RuntimeError(f"SBA's files held {seen.get('loans', 0):,} loans, under {MIN_LOANS:,}: a cut download")
        ok = dol.same_city(dol.sponsor_cities(db, {r[-1] for r in candidates}), totals)
        keep = [r for r in candidates if ok(r[-1], r[2])]
        dated = f"20{snapshot[:2]}-{snapshot[2:4]}-{snapshot[4:6]}" if snapshot else None
        log(f"{seen.get('loans', 0):,} loans; {len(candidates):,} named like a sponsor, {len(keep):,} in a city its "
            f"filings name, on {len({r[-1] for r in keep}):,} pages; SBA's snapshot of {dated}")
        if args.dry_run:
            for r in sorted(keep, key=lambda r: -(r[5] or 0))[:20]:
                log(f"  {r[1]} ({r[2]}, {r[3]}): ${r[5]:,.0f} on {r[4]}, {r[8]} jobs -> {r[12]}")
            return 0
        for ddl in DDL:
            db.execute(ddl)
        moved = dol.moved_pages(db, TABLE, COLS, keep)
        got = sync_rows(db, TABLE, ["loan"], COLS, keep, pause_s=0.3)
        note = (f"{len(keep):,} loans on a sponsor's page of {seen.get('loans', 0):,} (SBA's snapshot of {dated}); "
                f"{got['written']:,} written, {got['deleted']:,} removed; {dol.refresh_pages(moved, 'ppp')}")
        # A closed record: the row is dated by this read (the snapshot date is in the note), and the budget catches
        # the monthly read stopping or the files going away.
        stamp_freshness(db, DATASET, source=SOURCE, cadence="closed May 2021; SBA's release read monthly",
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
