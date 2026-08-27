#!/usr/bin/env python3
"""USCIS I-140 quarterly volumes and outcomes -> Turso. First-party.

The competitor ships an I-140 Trends page sourced from "USCIS Dataset A".
This reads the same USCIS release directly, so the figures owe nothing to a
mirror and cannot go stale behind someone else's ingest.

WHAT THE WORKBOOK ACTUALLY LOOKS LIKE, read rather than assumed:
- One file per fiscal year, holding all four quarters of it. Two files cover
  the eight quarters the rival displays: fy2025_q4 (all of FY2025) and
  fy2026_q2 (FY2026 so far).
- Sheet 1 "RADP Summary" is a matrix, not a table. Row 3 puts a quarter label
  at columns 1/5/9/13 and "Fiscal Year Total" at 17; row 4 repeats
  Received/Approved/Denied/Pending under each. So a quarter's four metrics
  live at a fixed stride of 4, and column 17 is a TOTAL that must never be
  ingested as a fifth quarter.
- Column 0 carries BOTH preference rows ("First Preference (EB1)") and
  subcategory rows ("Alien of Extraordinary Ability (E11)"). Both are kept:
  the subcategory is what a reader actually belongs to, and the preference is
  what most people know the name of.
- A quarter USCIS has not reported yet is all zeros, not absent. Those rows
  are skipped rather than stored, because a stored zero draws as a real
  collapse to nothing on any chart.
"""
from __future__ import annotations

import pathlib
import re
import sys
import time
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_gov_data import fetch, log, read_shared_strings, iter_rows  # noqa: E402
from lib_turso import Turso  # noqa: E402

DATA_PAGE = ("https://www.uscis.gov/tools/reports-and-studies/"
             "immigration-and-citizenship-data")
HOST = "https://www.uscis.gov"
SOURCE = "USCIS Form I-140 by Fiscal Year, Quarter and Case Status (uscis.gov)"

# Quarter block start columns. 17 is the fiscal-year TOTAL and is deliberately
# absent - ingesting it would double every category's annual figures.
QUARTER_COLS = {1: 1, 2: 5, 3: 9, 4: 13}
# The code in the trailing parens. E11..EW3 end in a digit; NIW does not,
# and an earlier `[A-Z]{1,2}\d{1,2}` required one, so the National Interest
# Waiver row - whose volume (92,802) is LARGER than E21 itself - was skipped
# in silence. Two to four uppercase letters and digits, ending on either.
CODE_RE = re.compile(r"\(([A-Z]{1,3}\d{0,2})\)\s*$")


def discover() -> list[str]:
    """Every i140 fiscal-year workbook we can find, oldest first.

    The current year is linked from the data page; older years stay at a
    predictable path after the page stops listing them, so the page is the
    primary source and the pattern is the fallback - never the other way
    round, because a guessed URL returns a styled 404 that reads exactly
    like a dead link.
    """
    urls: dict[str, None] = {}
    try:
        html = fetch(DATA_PAGE).decode("utf8", "ignore")
        for m in re.findall(r'href="([^"]*i140_fy\d{4}_q\d_v[\d.]+\.xlsx)"', html, re.I):
            urls[m if m.startswith("http") else HOST + m] = None
    except Exception as e:
        log(f"    data page unreadable ({type(e).__name__}); falling back to known paths")
    # FY2025's own file is no longer listed but is still served.
    urls.setdefault(f"{HOST}/sites/default/files/document/data/i140_fy2025_q4_v1.xlsx", None)
    return sorted(urls)


def parse(blob: bytes) -> tuple[int | None, list[dict]]:
    tmp = pathlib.Path("/tmp/i140.xlsx")
    tmp.write_bytes(blob)
    z = zipfile.ZipFile(tmp)
    shared = read_shared_strings(z)
    rows = list(iter_rows(z, "xl/worksheets/sheet1.xml", shared))

    fy = None
    for r in rows[:6]:
        m = re.search(r"Fiscal Year (\d{4})", str(r.get(0, "")))
        if m:
            fy = int(m.group(1))
            break
    if fy is None:
        return None, []

    out: list[dict] = []
    for r in rows:
        label = str(r.get(0, "")).strip()
        if not label or label.upper() == "TOTAL" or "Preference" not in label and not CODE_RE.search(label):
            continue
        m = CODE_RE.search(label)
        code = m.group(1) if m else None
        if not code:
            continue
        name = CODE_RE.sub("", label).strip()
        for q, c0 in QUARTER_COLS.items():
            def num(col: int) -> int:
                try:
                    return int(float(str(r.get(col, "0")).replace(",", "") or 0))
                except ValueError:
                    return 0
            rec, app, den, pend = num(c0), num(c0 + 1), num(c0 + 2), num(c0 + 3)
            # An unreported quarter is all zeros. Storing it would draw a
            # cliff to nothing on every chart that reads this table.
            if rec == app == den == pend == 0:
                continue
            out.append({"fy": fy, "q": q, "code": code, "name": name,
                        "received": rec, "approved": app, "denied": den,
                        "pending": pend})
    return fy, out


def main() -> int:
    db = Turso()
    db.execute("""CREATE TABLE IF NOT EXISTS i140_trends (
        fiscal_year INTEGER NOT NULL, quarter INTEGER NOT NULL,
        category TEXT NOT NULL, category_label TEXT,
        received INTEGER, approved INTEGER, denied INTEGER, pending INTEGER,
        source TEXT NOT NULL, fetched_at INTEGER NOT NULL,
        PRIMARY KEY (fiscal_year, quarter, category))""")

    stamp = int(time.time() * 1000)
    total = 0
    for url in discover():
        log(f"  {url.rsplit('/', 1)[-1]}")
        try:
            fy, recs = parse(fetch(url, referer=DATA_PAGE))
        except Exception as e:
            log(f"    unreadable ({type(e).__name__}), skipping")
            continue
        if not recs:
            log("    parsed nothing, skipping")
            continue
        for i in range(0, len(recs), 200):
            chunk = recs[i:i + 200]
            vals = ",".join(["(?,?,?,?,?,?,?,?,?,?)"] * len(chunk))
            args: list = []
            for r in chunk:
                args += [r["fy"], r["q"], r["code"], r["name"], r["received"],
                         r["approved"], r["denied"], r["pending"], SOURCE, stamp]
            db.execute(f"INSERT OR REPLACE INTO i140_trends VALUES {vals}", args)
        qs = sorted({r["q"] for r in recs})
        log(f"    FY{fy}: {len(recs):,} rows across quarters {qs}")
        total += len(recs)
        time.sleep(1.5)

    if total == 0:
        raise SystemExit("stored nothing - refusing to report success")

    held = int(db.scalar("SELECT count(*) FROM i140_trends") or 0)
    cats = int(db.scalar("SELECT count(DISTINCT category) FROM i140_trends") or 0)
    span = db.execute("SELECT min(fiscal_year), max(fiscal_year), count(DISTINCT fiscal_year || '-' || quarter) FROM i140_trends")["response"]["result"]["rows"][0]
    log(f"  VERIFY {held:,} rows | {cats} categories | FY{span[0]['value']}-FY{span[1]['value']}, {span[2]['value']} quarters")

    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    newest = db.scalar("SELECT max(fiscal_year || 'Q' || quarter) FROM i140_trends")
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               ["i140-trends", str(newest), stamp, SOURCE, "Quarterly",
                f"{held:,} rows across {cats} preference categories and subcategories", 135])
    return 0


if __name__ == "__main__":
    sys.exit(main())
