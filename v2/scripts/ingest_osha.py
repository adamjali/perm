#!/usr/bin/env python3
"""OSHA inspections of PERM sponsors: `osha_inspections`, one row per inspection, joined to the sponsor's page.

OSHA publishes every inspection it and the state plans have run (DOL's open data catalog, datasets 10334
"Inspection" and 10338 "Violation", updated daily): the establishment inspected, where, why (planned, a complaint,
a referral, an accident, a death), when it opened and closed, and each violation cited with its type and penalty.

What this keeps: inspections opened since `SINCE` (ten fiscal years) that join a PERM sponsor's page under the
strict rule every DOL record shares (lib_dol_records.sponsor_rule: the sponsor's own name, a state its PERM filings
name unless it's a national sponsor, a one-word or bare brand name only for a national one, and a big sponsor's
legal name in another state only when OSHA inspected that name in five or more states). A wrong link is worse than none, and
OSHA says so itself: "different companies may have similar names". An inspection that found no hazard OSHA could
reach ("no inspection", scope D) isn't an inspection and isn't kept.

Each inspection carries OSHA's own counting, from its inspection detail definitions (read Oct 31 2026):

* a violation deleted "as the result of settlement or judicial action" doesn't count;
* violations "grouped" because together they form a more serious hazard count once (citation item 01001A and
  01001B are one), with the group's type taken from its first item;
* a violation is Willful, Repeat, Serious, Other or Unclassified;
* the penalty is the amount "currently assessed", which "may differ from the Initial Penalty if settlement or
  judicial actions resulted in reductions"; both are kept.

An inspection still open can change: its citations can be contested, settled, cut or deleted. The page says so.

The files are found from DOL's catalog records, never typed by hand, and read on the server (data.dol.gov answers
it; www.osha.gov's own data pages ask robots off, and are only ever linked).

Usage:
    python3 scripts/ingest_osha.py                         # download, match, write
    python3 scripts/ingest_osha.py --dry-run               # download and match, print the counts, write nothing
    python3 scripts/ingest_osha.py --files insp.zip viol.zip
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import pathlib
import re
import sys
import tempfile
import time
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_dol_records as dol  # noqa: E402
from entity_identity import program_key  # noqa: E402
from lib_db import Database, record_run, stamp_freshness  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "ingest_osha.py"
DATASET = "osha-inspections"
SOURCE = "OSHA inspections and violations (data.dol.gov)"
INSPECTION_DATASET = 10334
VIOLATION_DATASET = 10338
TABLE = "osha_inspections"
# Ten fiscal years: FY2017 on.
SINCE = "2016-10-01"
# Measured Oct 31 2026: OSHA's files held 5,208,958 inspections and 13,287,335 violation items since 1970 (677,270
# inspections since SINCE, 16,140 of them joined to a sponsor's page). A file much shorter than that is a broken
# download, not a quiet week.
MIN_INSPECTIONS = 4_000_000
MIN_VIOLATIONS = 10_000_000

INSPECTION_COLS = {
    "activity_nr": "ACTIVITY_NR", "estab_name": "ESTAB_NAME", "city": "SITE_CITY", "state": "SITE_STATE",
    "zip": "SITE_ZIP", "naics": "NAICS_CODE", "insp_type": "INSP_TYPE", "scope": "INSP_SCOPE",
    "safety_health": "SAFETY_HLTH", "employees": "NR_IN_ESTAB", "open_date": "OPEN_DATE",
    "close_date": "CLOSE_CASE_DATE",
}
VIOLATION_COLS = {
    "activity_nr": "ACTIVITY_NR", "citation_id": "CITATION_ID", "delete_flag": "DELETE_FLAG",
    "viol_type": "VIOL_TYPE", "current_penalty": "CURRENT_PENALTY", "initial_penalty": "INITIAL_PENALTY",
}
# OSHA's violation types (its inspection detail definitions): Willful, Repeat, Serious, Other, Unclassified.
TYPE_COLUMN = {"W": "willful", "R": "repeat", "S": "serious", "O": "other"}
COLS = [
    "activity_nr", "estab_name", "city", "state", "zip", "naics", "insp_type", "safety_health", "employees",
    "open_date", "close_date", "violations", "serious", "willful", "repeat", "other",
    "initial_penalty", "current_penalty", "employer_slug",
]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        activity_nr TEXT PRIMARY KEY,
        estab_name TEXT, city TEXT, state TEXT, zip TEXT, naics TEXT, insp_type TEXT, safety_health TEXT,
        employees INTEGER, open_date TEXT, close_date TEXT,
        violations INTEGER, serious INTEGER, willful INTEGER, repeat INTEGER, other INTEGER,
        initial_penalty REAL, current_penalty REAL,
        employer_slug TEXT)""",
    f"CREATE INDEX IF NOT EXISTS osha_inspections_employer ON {TABLE} (employer_slug, open_date)",
]
DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
# A citation item: two digits of citation, three of item, then an optional one or two letter group marker.
GROUP_RE = re.compile(r"^(\d{5})[A-Z]{0,2}$")
# The two zips are 3.7 GB together and the server's /tmp is memory, so they go to disk.
WORKDIR = os.environ.get("OSHA_WORKDIR") or ("/var/tmp" if os.path.isdir("/var/tmp") else None)


def log(msg: str) -> None:
    print(f"[osha] {msg}", flush=True)


def day(value: str) -> str | None:
    m = DATE_RE.match((value or "").strip())
    return m.group(1) if m else None


def number(value: str) -> float:
    text = (value or "").strip().replace(",", "")
    if text in ("", "nan", "NaN"):
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def chunks(archive: zipfile.ZipFile, wanted: dict[str, str]):
    """Every row of every CSV chunk, as (our column -> cell). DOL's header starts with a byte-order mark."""
    names = sorted(n for n in archive.namelist() if n.lower().endswith(".csv"))
    if not names:
        raise RuntimeError("the zip holds no CSV")
    for name in names:
        with archive.open(name) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline=""))
            header = [h.strip() for h in next(reader)]
            missing = [c for c in wanted.values() if c not in header]
            if missing:
                raise RuntimeError(f"{name}: OSHA's file has no {', '.join(missing)}; its layout changed")
            at = [(c, header.index(src)) for c, src in wanted.items()]
            width = len(header)
            for cells in reader:
                if len(cells) < width:
                    continue
                yield {c: cells[i].strip() for c, i in at}


def inspections(archive: zipfile.ZipFile, match) -> tuple[dict[str, dict], dict[str, int]]:
    """The inspections to keep, by activity number, each joined to its sponsor's page.

    Two steps: every recent inspection whose name leads to a sponsor at all is held, with the states each name is
    inspected in (`spread`); then each is judged under the shared rule, which uses that spread for a big sponsor."""
    held: list[dict] = []
    states: dict[str, set[str]] = {}
    seen = {"inspections": 0, "recent": 0, "matched": 0}
    for row in chunks(archive, INSPECTION_COLS):
        seen["inspections"] += 1
        opened = day(row["open_date"])
        if not opened or opened < SINCE or row["scope"] == "D":
            continue
        seen["recent"] += 1
        key = program_key(row["estab_name"])
        if not key or not match.slug_of(key):
            continue
        row["open_date"] = opened
        held.append(row)
        states.setdefault(key, set()).add(row["state"].upper())
    spread = {k: len(v) for k, v in states.items()}
    keep: dict[str, dict] = {}
    for row in held:
        slug = match(row["estab_name"], row["state"], spread=spread)
        if not slug:
            continue
        seen["matched"] += 1
        keep[row["activity_nr"]] = {
            "activity_nr": row["activity_nr"], "estab_name": row["estab_name"], "city": row["city"].title() or None,
            "state": row["state"].upper() or None, "zip": row["zip"][:5] or None, "naics": row["naics"] or None,
            "insp_type": row["insp_type"] or None, "safety_health": row["safety_health"] or None,
            "employees": int(number(row["employees"])) or None, "open_date": row["open_date"],
            "close_date": day(row["close_date"]),
            "violations": 0, "serious": 0, "willful": 0, "repeat": 0, "other": 0,
            "initial_penalty": 0.0, "current_penalty": 0.0, "employer_slug": slug,
        }
    return keep, seen


def add_violations(archive: zipfile.ZipFile, keep: dict[str, dict]) -> int:
    """Count each kept inspection's violations OSHA's way; returns how many violation items the file held."""
    items = 0
    groups: dict[str, set[str]] = {}
    for row in chunks(archive, VIOLATION_COLS):
        items += 1
        insp = keep.get(row["activity_nr"])
        if insp is None or row["delete_flag"]:
            continue
        insp["initial_penalty"] += number(row["initial_penalty"])
        insp["current_penalty"] += number(row["current_penalty"])
        m = GROUP_RE.match(row["citation_id"])
        group = m.group(1) if m else row["citation_id"]
        held = groups.setdefault(row["activity_nr"], set())
        if group in held:
            continue
        held.add(group)
        insp["violations"] += 1
        kind = TYPE_COLUMN.get(row["viol_type"].upper())
        if kind:
            insp[kind] += 1
    for insp in keep.values():
        insp["initial_penalty"] = round(insp["initial_penalty"], 2)
        insp["current_penalty"] = round(insp["current_penalty"], 2)
    return items


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--files", nargs=2, type=pathlib.Path, metavar=("INSPECTIONS", "VIOLATIONS"))
    args = ap.parse_args()
    started = time.time()
    db = Database()
    try:
        sponsors, states = dol.load_sponsors(db)
        # OSHA prints only the establishment's name, so a bare brand joins only a national sponsor.
        match = dol.sponsor_rule(sponsors, states, bare_needs_national=True, national_states=dol.NATIONAL_STATES)
        with tempfile.TemporaryDirectory(dir=WORKDIR, prefix="osha-") as tmp:
            if args.files:
                insp_path, viol_path = args.files
            else:
                insp_path, viol_path = pathlib.Path(tmp) / "inspection.zip", pathlib.Path(tmp) / "violation.zip"
                for dataset, path in ((INSPECTION_DATASET, insp_path), (VIOLATION_DATASET, viol_path)):
                    url = dol.catalog_url(dataset)
                    dol.download(url, path)
                    log(f"downloaded {path.stat().st_size:,} bytes from {url}")
            with zipfile.ZipFile(insp_path) as archive:
                dated = dol.file_date(archive.namelist())
                keep, seen = inspections(archive, match)
            log(f"{seen['inspections']:,} inspections; {seen['recent']:,} since {SINCE}; {seen['matched']:,} on a sponsor's page")
            with zipfile.ZipFile(viol_path) as archive:
                items = add_violations(archive, keep)
        if seen["inspections"] < MIN_INSPECTIONS or items < MIN_VIOLATIONS:
            raise RuntimeError(f"OSHA's files held {seen['inspections']:,} inspections and {items:,} violation items, "
                               f"under {MIN_INSPECTIONS:,} and {MIN_VIOLATIONS:,}: refusing a short file")
        rows = [[insp[c] for c in COLS] for insp in keep.values()]
        cited = sum(1 for r in keep.values() if r["violations"] > 0)
        log(f"{items:,} violation items read; {cited:,} of {len(rows):,} kept inspections cited something; file dated {dated}")
        if args.dry_run:
            return 0
        for ddl in DDL:
            db.execute(ddl)
        moved = dol.moved_pages(db, TABLE, COLS, rows)
        got = sync_rows(db, TABLE, ["activity_nr"], COLS, rows, pause_s=0.3)
        note = (f"{len(rows):,} inspections of PERM sponsors since {SINCE} ({cited:,} with violations); "
                f"{got['written']:,} written, {got['deleted']:,} removed; {dol.refresh_pages(moved, 'osha')}")
        stamp_freshness(db, DATASET, as_of=dated, source=SOURCE, cadence="OSHA updates daily; read weekly",
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
