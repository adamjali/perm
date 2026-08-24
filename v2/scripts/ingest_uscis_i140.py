#!/usr/bin/env python3
"""Ingest USCIS's quarterly I-140 counts into aggregates.

USCIS publishes two different things in two different places, and only one of
them is reachable:

* `egov.uscis.gov` carries the processing-time figures and sits behind a
  Cloudflare challenge that refuses every automated client. Nothing here
  touches it; those figures live in a small dated table in
  `src/lib/processing-times/i140ProcessingTimes.ts` with a test that fails when
  they go stale.
* `www.uscis.gov` publishes quarterly spreadsheets of received, approved,
  denied and PENDING petitions by preference category, and serves them to
  scripts. That is what this reads.

The file is a few hundred KB, so unlike DOL's 1.21 GB disclosure sheet this
could in principle run inside a Convex action. It runs here anyway, because
adding a spreadsheet parser to the app bundle to save one workflow step is a
bad trade, and one ingest pattern is easier to keep working than two.

Usage:
    python3 scripts/ingest_uscis_i140.py --out /tmp/uscis.json
    npx convex run uscisI140:storeStats "$(cat /tmp/uscis.json)" --prod
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import (  # noqa: E402
    discover_links,
    fetch,
    iter_rows,
    log,
    read_shared_strings,
)

DATA_PAGE = "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data"
HOST = "https://www.uscis.gov"

# USCIS's row labels, mapped to the subtype codes the rest of the app uses.
# Matched on a distinctive prefix because the full labels carry footnote
# markers and non-breaking spaces that vary between quarters.
SUBTYPE_ROWS = [
    ("E11", "Alien of Extraordinary", "Extraordinary ability"),
    ("E12", "Outstanding Professor", "Outstanding professor or researcher"),
    ("E13", "Multi-national Executive", "Multinational executive or manager"),
    ("E21", "Professionals with Advan", "Advanced degree or exceptional ability"),
    ("NIW", "National Interest Waiver", "National interest waiver"),
    ("E31", "Skilled Worker", "Skilled worker"),
    ("E32", "Professionals with Bacca", "Professional with a bachelor's degree"),
    ("EW3", "Unskilled Workers", "Unskilled worker"),
]

# Each quarter occupies four columns: received, approved, denied, pending.
QUARTER_START_COLUMNS = {1: 1, 2: 5, 3: 9, 4: 13}


def discover_file() -> tuple[str, str]:
    """Newest `i140_fyYYYY_qN` workbook, from USCIS's own index page."""
    log(f"Discovering the I-140 dataset from {DATA_PAGE}")
    html = fetch(DATA_PAGE).decode("utf-8", "replace")
    found = discover_links(html, r"i140_fy\d{4}_q\d.*\.xlsx$", HOST)
    if not found:
        raise SystemExit(
            "FATAL: no I-140 dataset on the USCIS data page. The page changed or "
            "the fetch was blocked. Refusing to report success."
        )

    def key(name: str) -> tuple[int, int]:
        m = re.search(r"fy(\d{4})_q(\d)", name, re.I)
        return (int(m.group(1)), int(m.group(2))) if m else (0, 0)

    name = max(found, key=key)
    log(f"  found {len(found)}; newest is {name}")
    return name, found[name]


def parse(path: str) -> tuple[str, list[dict]]:
    """Return (quarter label, per-subtype counts) for the newest real quarter."""
    archive = zipfile.ZipFile(path)
    shared = read_shared_strings(archive)
    rows = list(iter_rows(archive, "xl/worksheets/sheet1.xml", shared))

    fiscal_year = ""
    for row in rows[:6]:
        text = " ".join(str(v) for v in row.values())
        m = re.search(r"Fiscal Year (\d{4})", text)
        if m:
            fiscal_year = m.group(1)
            break
    if not fiscal_year:
        raise SystemExit("FATAL: could not read the fiscal year from the sheet header")

    def value(row: dict, column: int) -> int:
        try:
            return int(float(row.get(column, 0) or 0))
        except (TypeError, ValueError):
            return 0

    # Later quarters are present as all-zero columns until USCIS publishes them.
    # Taking the last column block regardless would report a quarter of zeros as
    # the current state of the queue.
    matched = {}
    for code, prefix, label in SUBTYPE_ROWS:
        for row in rows:
            first = str(row.get(0, ""))
            if first.strip().startswith(prefix):
                matched[code] = (label, row)
                break

    missing = [c for c, _, _ in SUBTYPE_ROWS if c not in matched]
    if missing:
        raise SystemExit(
            f"FATAL: USCIS row labels changed; no match for {missing}. "
            "Refusing to write a partial payload."
        )

    latest_quarter = 0
    for quarter, start in QUARTER_START_COLUMNS.items():
        if any(value(row, start + 3) > 0 for _, row in matched.values()):
            latest_quarter = quarter
    if latest_quarter == 0:
        raise SystemExit("FATAL: every quarter column is empty")

    start = QUARTER_START_COLUMNS[latest_quarter]
    subtypes = [
        {
            "code": code,
            "label": label,
            "received": value(row, start),
            "approved": value(row, start + 1),
            "denied": value(row, start + 2),
            "pending": value(row, start + 3),
        }
        for code, (label, row) in matched.items()
    ]
    return f"FY{fiscal_year} Q{latest_quarter}", subtypes


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True, help="Write the aggregate payload here")
    ap.add_argument("--local", help="Parse this local file instead of downloading")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        if args.local:
            name, path = os.path.basename(args.local), args.local
        else:
            name, url = discover_file()
            log(f"Downloading {name}")
            data = fetch(url, referer=DATA_PAGE)
            if not data.startswith(b"PK"):
                raise SystemExit(
                    f"FATAL: {name} is not a workbook ({len(data):,} bytes). "
                    "USCIS served an error page. Refusing to report success."
                )
            path = os.path.join(tmp, name)
            with open(path, "wb") as fh:
                fh.write(data)
            log(f"  {len(data) / 1024:.0f} KB")

        quarter, subtypes = parse(path)

    payload = {
        "sourceFile": name,
        "asOfQuarter": quarter,
        "subtypes": subtypes,
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["contentHash"] = hashlib.sha256(body.encode()).hexdigest()

    # Counts before the verdict: a run that inspected nothing must be loud.
    log("")
    log(f"quarter          {quarter}")
    log(f"subtypes         {len(subtypes)}")
    log(f"total pending    {sum(s['pending'] for s in subtypes):,}")
    if len(subtypes) != len(SUBTYPE_ROWS):
        raise SystemExit("FATAL: incomplete subtype set. Refusing to write.")

    with open(args.out, "w") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    log(f"wrote {args.out} ({os.path.getsize(args.out) / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
