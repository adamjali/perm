#!/usr/bin/env python3
"""SAM.gov exclusions of PERM sponsors: `sam_exclusions`, joined to the employer pages they belong to.

WHAT IT IS. The federal government's list of parties excluded from federal contracts, certain subcontracts and
certain kinds of federal assistance and benefits (debarments, suspensions, statutory exclusions, voluntary
exclusions), by the agency that excluded them. SAM.gov publishes every active exclusion as one public file a day
on its Data Services page ("refreshed daily", its own description), with no key: 169,190 records on Oct 31 2026,
133,934 of them people, 25,560 special entity designations, 8,374 firms and 1,322 vessels.

WHERE. The file list and the file are SAM.gov's own Data Services downloads, the channel its terms of use name for
data (with open.gsa.gov's APIs). robots.txt asks nothing of them. The API route needs a key and answered an empty
404 to every request tried on Oct 31 2026; the public file needs none.

WHAT IS KEPT. Firms and special entity designations only, and only those that join a PERM sponsor's page under the
strict rule every DOL record here uses (`lib_dol_records.sponsor_rule`: the legal name's key, then a national
sponsor from any state, else a name of two words or more from a state the sponsor's own PERM filings name). SAM
prints the legal name and the address it has on file. People and vessels are never kept: no page here is about a
person.

One more test than WHD's, because an exclusion is the gravest thing a page can say about an employer: unless the
sponsor is national, SAM's city must be one the sponsor's own PERM filings name as a worksite (`dol.same_city`). Measured
Oct 31 2026: the name rule alone joined 11 records, and checked by hand against each sponsor's filings, 6 were
plainly the same company and city (Royal Caribbean Cruises in Miami, Q Link Wireless in Dania Beach, XChange Logistics
in West Covina) while 5 weren't certain: "Maverick Services" in Clarksville against a one-case Houston sponsor, and
"Harmony Home Health Care", a common name, in Boston against filings in Brookline and Chicopee. The city test keeps
the 6 and drops the 5; a dropped record is a missing line, a wrong one names the wrong company.

What SAM says about its own records goes with them: an exclusion names the excluding agency, its type and its
dates; "Indefinite" is how SAM prints an exclusion with no end date; a record in the file is active today.

Usage:
    python3 scripts/ingest_sam_exclusions.py            # download today's file, match, write
    python3 scripts/ingest_sam_exclusions.py --dry-run  # match and print, write nothing
    python3 scripts/ingest_sam_exclusions.py --file x.zip
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import pathlib
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_dol_records as dol  # noqa: E402
from lib_db import Database, record_run, stamp_freshness  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "ingest_sam_exclusions.py"
DATASET = "sam-exclusions"
SOURCE = "SAM.gov exclusions, daily public extract (Data Services)"
API = "https://sam.gov/api/prod/fileextractservices/v1/api"
DOMAIN = "Exclusions/Public V2"
UA = "PERMTracker/1.0 (+https://permtracker.app; support@permtracker.app)"
TABLE = "sam_exclusions"
KEEP_CLASSES = ("Firm", "Special Entity Designation")
# SAM's file held 169,190 active exclusions on Oct 31 2026; a file a third that size is a broken download.
MIN_RECORDS = 60_000
FILE_RE = re.compile(r"^SAM_Exclusions_Public_Extract_V2_(\d{5})\.ZIP$", re.I)

SOURCE_COLS = {
    "name": "Name", "city": "City", "state": "State / Province", "country": "Country", "uei": "Unique Entity ID",
    "classification": "Classification", "program": "Exclusion Program", "agency": "Excluding Agency",
    "kind": "Exclusion Type", "active": "Active Date", "ends": "Termination Date", "cage": "CAGE",
    "comments": "Additional Comments", "created": "Creation_Date",
}
COLS = ["record_id", "name", "city", "state", "country", "uei", "classification", "program", "agency", "kind",
        "active", "ends", "indefinite", "cage", "comments", "employer_slug"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        record_id TEXT PRIMARY KEY,
        name TEXT, city TEXT, state TEXT, country TEXT, uei TEXT, classification TEXT, program TEXT, agency TEXT,
        kind TEXT, active TEXT, ends TEXT, indefinite INTEGER, cage TEXT, comments TEXT,
        employer_slug TEXT)""",
    f"CREATE INDEX IF NOT EXISTS sam_exclusions_employer ON {TABLE} (employer_slug, active)",
]
DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
US_DATE_RE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def log(msg: str) -> None:
    print(f"[sam] {msg}", flush=True)


def day(value: str) -> str | None:
    t = (value or "").strip()
    m = DATE_RE.match(t)
    if m:
        return m.group(1)
    m = US_DATE_RE.match(t)
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


def get(url: str, *, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status == 204:
                    return b""
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(20 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < 3:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def newest_file() -> tuple[str, str]:
    """(file name, day code) of the newest public extract SAM lists. Discovered from SAM's own list, never built."""
    q = urllib.parse.urlencode({"domain": DOMAIN, "privacy": "Public"})
    listing = json.loads(get(f"{API}/listfiles?{q}", timeout=60))
    names = [str(o.get("displayKey") or "") for o in (listing.get("_embedded") or {}).get("customS3ObjectSummaryList") or []]
    dated = sorted((m.group(1), n) for n in names if (m := FILE_RE.match(n)))
    if not dated:
        raise RuntimeError(f"SAM listed no exclusions extract ({len(names)} names)")
    code, name = dated[-1]
    return name, code


def download(name: str, dest: pathlib.Path) -> None:
    path = urllib.parse.quote(f"{DOMAIN}/{name}")
    body = get(f"{API}/download/{path}?privacy=Public")
    if not body.startswith(b"PK"):
        raise RuntimeError(f"SAM's download of {name} wasn't a zip ({len(body):,} bytes)")
    dest.write_bytes(body)


def records(archive: zipfile.ZipFile):
    names = [n for n in archive.namelist() if n.lower().endswith(".csv")]
    if not names:
        raise RuntimeError("the zip holds no CSV")
    with archive.open(names[0]) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline=""))
        header = [h.strip() for h in next(reader)]
        missing = [c for c in SOURCE_COLS.values() if c not in header]
        if missing:
            raise RuntimeError(f"SAM's file lacks {missing}: its layout changed")
        at = {ours: header.index(theirs) for ours, theirs in SOURCE_COLS.items()}
        for row in reader:
            yield {ours: (row[i].strip() if i < len(row) else "") for ours, i in at.items()}


def record_id(r: dict) -> str:
    """SAM gives a record no id of its own in this file; its name, place, agency, type and dates make one."""
    parts = [r["name"].upper(), r["state"].upper(), r["agency"], r["kind"], r["active"], r["uei"], r["cage"]]
    return "|".join(parts)


def select(rows, match, place_ok=None) -> tuple[list[list], dict[str, int]]:
    """The exclusions to keep, each with its page. `place_ok(slug, city)` is the city test; None skips it (the first
    pass, which only gathers the candidate sponsors)."""
    keep: dict[str, list] = {}
    seen = {"records": 0, "firms": 0, "named": 0, "matched": 0}
    for r in rows:
        seen["records"] += 1
        if r["classification"] not in KEEP_CLASSES:
            continue
        seen["firms"] += 1
        slug = match(r["name"], r["state"])
        if not slug:
            continue
        seen["named"] += 1
        if place_ok is not None and not place_ok(slug, r["city"]):
            continue
        seen["matched"] += 1
        ends = day(r["ends"])
        indefinite = 1 if r["ends"].strip().lower() == "indefinite" else 0
        rid = record_id(r)
        keep[rid] = [rid, r["name"], r["city"] or None, r["state"] or None, r["country"] or None, r["uei"] or None,
                     r["classification"], r["program"] or None, r["agency"] or None, r["kind"] or None,
                     day(r["active"]), ends, indefinite, r["cage"] or None, (r["comments"] or "")[:600] or None, slug]
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
        with tempfile.TemporaryDirectory(prefix="sam-") as tmp:
            path = args.file
            code = None
            if path is None:
                name, code = newest_file()
                path = pathlib.Path(tmp) / name
                download(name, path)
                log(f"downloaded {path.stat().st_size:,} bytes: {name}")
            else:
                m = FILE_RE.match(path.name)
                code = m.group(1) if m else None
            with zipfile.ZipFile(path) as archive:
                rows = list(records(archive))
            first, _ = select(rows, match)
            totals = {str(slug): int(t or 0) for _, slug, t in sponsors}
            keep, seen = select(rows, match, dol.same_city(dol.sponsor_cities(db, {r[-1] for r in first}), totals))
        if seen["records"] < MIN_RECORDS:
            raise RuntimeError(f"SAM's file held {seen['records']:,} records, under {MIN_RECORDS:,}: refusing a short file")
        # The file's day code is YYDDD (two-digit year, day of the year).
        dated = None
        if code:
            dated = (dt.date(2000 + int(code[:2]), 1, 1) + dt.timedelta(days=int(code[2:]) - 1)).isoformat()
        log(f"{seen['records']:,} records; {seen['firms']:,} firms and special entity designations; "
            f"{seen['named']:,} named like a sponsor, {seen['matched']:,} in a city its filings name; file of {dated}")
        for row in keep:
            log(f"  {row[1]} ({row[3]}): {row[8]}, {row[9]}, from {row[10]} -> {row[15]}")
        if args.dry_run:
            return 0
        for ddl in DDL:
            db.execute(ddl)
        moved = dol.moved_pages(db, TABLE, COLS, keep)
        got = sync_rows(db, TABLE, ["record_id"], COLS, keep)
        note = (f"{len(keep):,} exclusions on a sponsor's page of {seen['records']:,} active; "
                f"{got['written']:,} written, {got['deleted']:,} removed; {dol.refresh_pages(moved, 'sam')}")
        stamp_freshness(db, DATASET, as_of=dated, source=SOURCE, cadence="SAM refreshes daily; read weekly",
                        note=note, max_age_days=21)
        record_run(db, SCRIPT, status="ok", rows_written=got["written"], note=note, started_at=started)
        log(note)
        return 0
    except Exception as exc:  # noqa: BLE001 - recorded, then raised
        if not args.dry_run:
            record_run(db, SCRIPT, status="failed", note=str(exc)[:300], started_at=started)
        raise


if __name__ == "__main__":
    sys.exit(main())
