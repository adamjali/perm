#!/usr/bin/env python3
"""USCIS employment-based I-485 pending inventory -> Turso.

Closes the one substantive gap against permtrack: queue position for an
adjustment-of-status application. Built first-party from USCIS rather than
from their API, which turned out to matter more than expected.

WHY FIRST-PARTY WINS HERE. Their /api/i485/queue-position answers
`data_as_of: 2026-05-01`. USCIS publishes this monthly and had
`eb_inventory_august_2026` on the day this was written - the same underlying
release, three months fresher, with no dependency on a competitor's uptime.
Their own response note ("25 suppressed cells (1-10 applicants each)
estimated at 5") is what identified the source: that suppression rule is
USCIS's, not theirs.

THE SUPPRESSION IS THE INTERESTING PART. USCIS replaces any cell holding 1-10
applications with the letter `D`. permtrack resolves every `D` to 5 and
publishes one number with a plus-or-minus note. We keep the `D` count itself
and report a RANGE - low counts every suppressed cell as 1, high as 10 - so
the uncertainty is a property of the answer instead of a footnote under it.
On a page that refuses to blend denial factors into one score, publishing a
point estimate here would contradict the rest of the site.

SHAPE OF THE WORKBOOK, all of it verified by reading rather than assumed:
- One sheet per country, plus a separate `India (EB2 EB3)` sheet, because
  India's EB2/EB3 backlog sits in priority-date years 2006-2015 while every
  other sheet covers 2017-2026. A parser that assumes one year range silently
  drops the largest backlog in the system.
- Row 2 carries `As of <Month> <D>, <YYYY>`; that is the authoritative date.
- Row 3 is the header: country, category, visa status, priority-date MONTH,
  then one column per priority-date YEAR ("Prior Years" first).
- Cells are counts, or `D`.
- Two real statuses: `Awaiting Availability` (no visa number yet) and
  `Available` (number available, awaiting adjudication). Both are pending and
  both sit ahead of a later priority date, so both are stored and the
  distinction is kept rather than summed away at ingest.
"""
from __future__ import annotations

import datetime as dt
import pathlib
import re
import sys
import time
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_gov_data import fetch, log, read_shared_strings, iter_rows  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

DATA_PAGE = ("https://www.uscis.gov/tools/reports-and-studies/"
             "immigration-and-citizenship-data")
HOST = "https://www.uscis.gov"

MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}

# USCIS puts the authoritative code in parentheses at the end of every
# category label - "(EB2)", "(EW3)", "(CRW)". Read THAT, rather than matching
# the prose around it. The first version matched prose and mapped
# "3rd Preference Category Other Worker (EW3)" to EB3, because the pattern
# said "Other Workers" and the sheet says "Other Worker": 130 EW3 cells
# overwrote EB3 cells on the primary key. The code in the parentheses cannot
# drift like that.
#
# The four EB5 set-asides all print "(EB5)" and ARE distinct visa pools with
# their own allocations and cutoffs, so those alone need the prose, and it is
# read from the set-aside name rather than guessed.
EB5_SET_ASIDE = [
    (re.compile(r"Rural", re.I), "EB5R"),
    (re.compile(r"High Unemployment", re.I), "EB5HU"),
    (re.compile(r"Infrastructure", re.I), "EB5I"),
    (re.compile(r"Unreserved", re.I), "EB5U"),
]
KNOWN_CODES = {"EB1", "EB2", "EB3", "EW3", "EB4", "CRW", "EB5"}


def category_of(label: str) -> str | None:
    m = re.search(r"\(([A-Z0-9]{2,4})\)\s*$", label.strip())
    if not m:
        return None
    code = m.group(1).upper()
    if code not in KNOWN_CODES:
        # Loud rather than silent: an unrecognised code means USCIS added a
        # category, and dropping it quietly is how a backlog goes missing.
        raise SystemExit(f"unknown I-485 category code {code!r} in {label!r}")
    if code == "EB5":
        for rx, short in EB5_SET_ASIDE:
            if rx.search(label):
                return short
    return code


def discover_workbooks() -> list[tuple[str, str]]:
    """EVERY eb_inventory file the page currently lists, oldest first.

    Deliberately not just the newest. USCIS carries only the recent few
    releases and keeps no archive, so a month we fail to capture is gone
    permanently - and month-over-month movement in the backlog is the whole
    reason to store snapshots at all. Taking every listed month each run
    means a failed or skipped run is repaired by the next one instead of
    leaving a hole. Re-ingesting a month already held costs one request and
    rewrites identical rows.

    Discovered, never constructed: USCIS moves these between paths, and a
    guessed URL returns a styled 404 that reads exactly like a dead link.
    """
    html = fetch(DATA_PAGE).decode("utf8", "ignore")
    found = re.findall(
        r'href="(/sites/default/files/document/data/eb_inventory_'
        r'([a-z]+)_(\d{4})_v[\d.]+\.xlsx)"', html, re.I)
    if not found:
        raise SystemExit("no eb_inventory link on the USCIS data page")
    seen: dict[str, tuple[int, int, str]] = {}
    for path, month, year in found:
        key = f"{month.lower()}-{year}"
        seen[key] = (int(year), MONTHS.get(month.capitalize(), 0), path)
    ordered = sorted(seen.values())
    log(f"  {len(ordered)} month(s) listed: "
        f"{', '.join(f'{y}-{m:02d}' for y, m, _ in ordered)}")
    return [(HOST + p, f"{y}-{m:02d}") for y, m, p in ordered]


def rows_from(z: zipfile.ZipFile, shared: list[str], sheet_path: str) -> tuple[str | None, list[dict]]:
    rows = list(iter_rows(z, sheet_path, shared))
    as_of = None
    for r in rows[:6]:
        m = re.match(r"As of ([A-Za-z]+) (\d{1,2}), (\d{4})",
                     str(r.get(0, "")).strip())
        if m:
            as_of = dt.date(int(m.group(3)), MONTHS[m.group(1)],
                            int(m.group(2))).isoformat()
            break

    header = next((r for r in rows if r.get(0) == "Country Of Chargeability"), None)
    if header is None:
        return as_of, []
    # Year columns start at index 4. "Prior Years" is stored as 'prior' so it
    # sorts before every real year and is never mistaken for one.
    years: dict[int, str] = {}
    for col, label in sorted(header.items()):
        if col < 4:
            continue
        text = str(label)
        m = re.search(r"(\d{4})", text)
        years[col] = m.group(1) if m else "prior"

    out: list[dict] = []
    for r in rows:
        cat_label = str(r.get(1, ""))
        if "Preference" not in cat_label or cat_label == "Preference Category":
            continue
        cat = category_of(cat_label)
        month = MONTHS.get(str(r.get(3, "")).strip())
        if not cat or not month:
            continue
        status = "available" if str(r.get(2, "")).strip() == "Available" else "awaiting"
        country = str(r.get(0, "")).strip()
        for col, year in years.items():
            cell = str(r.get(col, "")).strip()
            if cell == "":
                continue
            if cell.upper() == "D":
                out.append({"country": country, "category": cat, "status": status,
                            "pd_year": year, "pd_month": month,
                            "count": 0, "suppressed": 1})
            else:
                try:
                    n = int(float(cell))
                except ValueError:
                    continue
                if n == 0:
                    continue
                out.append({"country": country, "category": cat, "status": status,
                            "pd_year": year, "pd_month": month,
                            "count": n, "suppressed": 0})
    return as_of, out


def store(db: Turso, as_of: str, records: list[dict]) -> int:
    """Replace one as-of wholesale. Idempotent, and it REFUSES on loss."""
    db.execute("DELETE FROM i485_inventory WHERE as_of = ?", [as_of])
    B = 300
    for i in range(0, len(records), B):
        chunk = records[i:i + B]
        vals = ",".join(["(?,?,?,?,?,?,?,?)"] * len(chunk))
        args: list = []
        for r in chunk:
            args += [as_of, r["country"], r["category"], r["status"],
                     r["pd_year"], r["pd_month"], r["count"], r["suppressed"]]
        db.execute(f"INSERT OR REPLACE INTO i485_inventory VALUES {vals}", args)
    n = int(db.scalar("SELECT count(*) FROM i485_inventory WHERE as_of = ?",
                      [as_of]) or 0)
    # Parsed must equal stored. A primary-key collision is otherwise silent:
    # INSERT OR REPLACE overwrites happily and the only evidence is a count
    # smaller than what was read. That is exactly how the four EB5 set-asides
    # and then 130 EW3 cells went missing on the first two runs.
    if n != len(records):
        raise SystemExit(
            f"REFUSING {as_of}: parsed {len(records):,} cells but stored "
            f"{n:,} - {len(records) - n:,} collided on the primary key")
    return n


def parse_workbook(blob: bytes) -> tuple[str | None, list[dict]]:
    tmp = pathlib.Path("/tmp/eb_inventory.xlsx")
    tmp.write_bytes(blob)
    z = zipfile.ZipFile(tmp)
    shared = read_shared_strings(z)
    names = re.findall(r'<sheet name="([^"]+)"',
                       z.read("xl/workbook.xml").decode("utf8", "ignore"))
    as_of: str | None = None
    records: list[dict] = []
    for i, name in enumerate(names[:12], start=1):
        if "How to Read" in name:
            continue
        path = f"xl/worksheets/sheet{i}.xml"
        if path not in z.namelist():
            continue
        sheet_asof, rows = rows_from(z, shared, path)
        if rows:
            as_of = as_of or sheet_asof
            records.extend(rows)
    return as_of, records


def main() -> int:
    db = Turso()
    db.execute("""CREATE TABLE IF NOT EXISTS i485_inventory (
        as_of TEXT NOT NULL, country TEXT NOT NULL, category TEXT NOT NULL,
        status TEXT NOT NULL, pd_year TEXT NOT NULL, pd_month INTEGER NOT NULL,
        count INTEGER NOT NULL, suppressed INTEGER NOT NULL,
        PRIMARY KEY (as_of, country, category, status, pd_year, pd_month))""")
    db.execute("""CREATE INDEX IF NOT EXISTS i485_lookup
        ON i485_inventory (country, category, as_of, pd_year, pd_month)""")

    newest_as_of, newest_total, newest_sup = None, 0, 0
    for url, label in discover_workbooks():
        log(f"  {label}: fetching")
        as_of, records = parse_workbook(fetch(url, referer=DATA_PAGE))
        if not records or not as_of:
            log("    parsed nothing, skipping")
            continue
        n = store(db, as_of, records)
        total = sum(r["count"] for r in records)
        sup = sum(r["suppressed"] for r in records)
        log(f"    as of {as_of}: {n:,} cells, {total:,} applications, "
            f"{sup:,} suppressed")
        newest_as_of, newest_total, newest_sup = as_of, total, sup
        time.sleep(1.5)   # polite between federal fetches

    if not newest_as_of:
        raise SystemExit("stored nothing - refusing to report success")

    log("  HISTORY held:")
    for r in db.execute(
        "SELECT as_of, sum(count) FROM i485_inventory GROUP BY as_of "
        "ORDER BY as_of")["response"]["result"]["rows"]:
        log(f"    {r[0]['value']}  {int(r[1]['value']):>8,} applications")

    # Via the shared helper: this script CREATE'd data_freshness with 6 columns
    # and INSERTed 6 VALUES into the live 7-column table (missing max_age_days),
    # which errors at runtime - and the workflow has never once run to expose
    # it. USCIS publishes monthly, so a 45-day budget is a real stall, not
    # ordinary lag between releases.
    stamp_freshness(
        db, "i485-inventory", as_of=newest_as_of,
        source="USCIS employment-based I-485 inventory (uscis.gov)",
        cadence="Monthly",
        note=f"{newest_total:,} pending applications; "
             f"{newest_sup:,} cells suppressed by USCIS",
        max_age_days=45,
    )
    record_run(db, "ingest_i485_inventory.py", status="ok",
               rows_written=newest_total, note=f"as of {newest_as_of}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
