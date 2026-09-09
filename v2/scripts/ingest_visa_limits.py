#!/usr/bin/env python3
"""The Department's own spillover numbers: annual limits and Table V.

    python3 scripts/ingest_visa_limits.py --limits <Annual Numerical Limits PDF>
    python3 scripts/ingest_visa_limits.py --table-v <Report of the Visa Office, Table V PDF>
    python3 scripts/ingest_visa_limits.py --limits a.pdf --table-v b.pdf --dry-run

WHAT THIS IS. Every October the employment-based categories reopen because
unused family-sponsored numbers from the year just ended "spill over" to
employment (INA 201(d)). Every rival site prints a guess for that number on
bulletin day. The State Department publishes the real one twice, and only
twice: in the Annual Numerical Limits sheet it posts near the start of a
fiscal year (the employment worldwide total minus the statutory 140,000 IS
the spillover, marked estimated until the official determination), and in
Table V of the Report of the Visa Office the following year (numbers used
per preference, so unused family numbers can be counted directly).

WHY FILES. travel.state.gov refuses every automated client (it 403s its own
robots.txt), so both PDFs are fetched in a browser and handed to this
script, the same route the current bulletin takes. Once a year for each.

WHAT IS STORED. One document, perm_docs['visa_annual_limits'], with a
`limits` entry per fiscal year and a `table_v` entry per fiscal year, every
figure as the Department printed it and the arithmetic (spillover, unused)
done here and labelled as ours. Nothing is forecast.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

DOC_KEY = "visa_annual_limits"
DATASET = "visa-annual-limits"
STATS_PAGE = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/immigrant-visa-statistics.html"
REPORTS_PAGE = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/annual-reports.html"
EMPLOYMENT_BASE = 140_000   # INA 201(d)(1)(A)
FAMILY_BASE = 226_000       # INA 201(c): the floor the Department prints every year

FAMILY_ROWS = ("F1", "FX", "F2A", "F2B", "F3", "F4", "Total")
EMPLOYMENT_ROWS = ("E1", "E2", "E3/EW", "E4/SR", "E5", "Unreserved", "Set-Asides", "Total")


def log(msg: str) -> None:
    print(f"[visa-limits] {msg}", flush=True)


def _n(s: str) -> int:
    return int(s.replace(",", "").replace("(", "").replace(")", ""))


def pdf_text(pdf_bytes: bytes) -> list[str]:
    import pdfplumber

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as p:
        return [(pg.extract_text() or "") for pg in p.pages]


def parse_limits(pdf_bytes: bytes) -> dict:
    """The one-page Annual Numerical Limits sheet, rows by their own labels."""
    text = "\n".join(pdf_text(pdf_bytes))
    m = re.search(r"FY[- ]?(\d{4})(\*?)", text)
    if not m:
        raise ValueError("no fiscal year on the sheet")
    fy, estimated = int(m.group(1)), bool(m.group(2))
    lines = [ln.strip() for ln in text.splitlines()]

    def section(name: str, rows: tuple[str, ...]) -> dict[str, dict]:
        start = next((i for i, ln in enumerate(lines) if ln.upper() == name), None)
        if start is None:
            raise ValueError(f"no {name} section")
        out: dict[str, dict] = {}
        for ln in lines[start + 1 :]:
            if ln.upper() in ("FAMILY", "EMPLOYMENT") and ln.upper() != name:
                break
            # Labels carry digits and slashes (F2A, E3/EW, E4/SR), so the label
            # is "a word starting with a letter" and the two figures follow.
            # A footnote marker rides on some labels ("E3/EW**"); it is not the label.
            mm = re.match(r"^([A-Za-z][A-Za-z0-9/\-]*)\**\s+(n/a|\(?[\d,]+\)?)\s+(\(?[\d,]+\)?)$", ln)
            if not mm:
                continue
            label = mm.group(1).strip()
            if label in rows:
                out[label] = {
                    "foreign_state": None if mm.group(2) == "n/a" else _n(mm.group(2)),
                    "worldwide": _n(mm.group(3)),
                }
            if label == "Total":
                break
        missing = [r for r in rows if r not in out]
        if missing:
            raise ValueError(f"{name}: rows missing {missing}")
        return out

    family = section("FAMILY", FAMILY_ROWS)
    employment = section("EMPLOYMENT", EMPLOYMENT_ROWS)
    notes = [ln for ln in lines if ln.startswith("*")]
    emp_total = employment["Total"]["worldwide"]
    return {
        "fiscal_year": fy,
        "estimated": estimated,
        "family": family,
        "employment": employment,
        "family_base": FAMILY_BASE,
        "employment_base": EMPLOYMENT_BASE,
        "spillover_to_employment": emp_total - EMPLOYMENT_BASE,
        "per_country_employment": employment["Total"]["foreign_state"],
        "notes": notes,
        "source": STATS_PAGE,
    }


def parse_table_v(pdf_bytes: bytes) -> dict:
    """Grand totals of each part of Table V, the per-country pages left alone.

    Part 1 is the family preferences, Part 2 the first through fourth
    employment preferences, Part 3 the fifth preference and its set-asides,
    Part 4 the employment total beside the grand total of both. The column
    labels are the parts' own headers, kept as printed.
    """
    pages = pdf_text(pdf_bytes)
    m = next((re.search(r"Fiscal Year (\d{4})", t) for t in pages if re.search(r"Fiscal Year (\d{4})", t)), None)
    if not m:
        raise ValueError("no fiscal year on Table V")
    fy = int(m.group(1))
    totals: dict[str, list[int]] = {}
    for t in pages:
        part = re.search(r"Table V \(Part (\d)\)", t)
        if not part:
            continue
        for ln in t.splitlines():
            if ln.startswith("Grand Totals") and re.search(r"\d", ln):
                totals[part.group(1)] = [_n(x) for x in re.findall(r"[\d,]+", ln)]
    for k in ("1", "2", "3", "4"):
        if k not in totals:
            raise ValueError(f"Table V part {k} has no Grand Totals line")
    p1, p2, p3, p4 = totals["1"], totals["2"], totals["3"], totals["4"]
    if len(p1) != 8 or len(p2) != 8 or len(p4) != 2:
        raise ValueError(f"unexpected column counts: part1 {len(p1)}, part2 {len(p2)}, part4 {len(p4)}")
    family = dict(zip(("1st", "2A_exempt", "2A_subject", "2A_total", "2B", "3rd", "4th", "total"), p1))
    employment = dict(zip(("1st", "2nd", "3rd", "3rd_other_workers", "3rd_total", "4th", "4th_religious", "4th_total"), p2))
    employment["5th_columns"] = p3
    employment["5th_total"] = p3[-1] if p3 else None
    employment["total"] = p4[0]
    if family["total"] + employment["total"] != p4[1]:
        raise ValueError(f"family {family['total']} + employment {employment['total']} != grand {p4[1]}")
    return {
        "fiscal_year": fy,
        "family": family,
        "employment": employment,
        "grand_total": p4[1],
        "family_base": FAMILY_BASE,
        "family_unused": FAMILY_BASE - family["total"],
        "source": f"{REPORTS_PAGE.rsplit('/', 1)[0]}/annual-reports/report-of-the-visa-office-{fy}.html",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limits", help="Annual Numerical Limits PDF, saved from a browser")
    ap.add_argument("--table-v", help="Table V PDF from a Report of the Visa Office, saved from a browser")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not a.limits and not a.table_v:
        ap.error("give --limits and/or --table-v")
    started = time.time()
    limits = parse_limits(open(a.limits, "rb").read()) if a.limits else None
    table_v = parse_table_v(open(a.table_v, "rb").read()) if a.table_v else None
    if limits:
        log(f"limits FY{limits['fiscal_year']}{'*' if limits['estimated'] else ''}: employment {limits['employment']['Total']['worldwide']:,} = {EMPLOYMENT_BASE:,} + {limits['spillover_to_employment']:,} unused family; family {limits['family']['Total']['worldwide']:,}")
    if table_v:
        log(f"Table V FY{table_v['fiscal_year']}: family used {table_v['family']['total']:,} of {FAMILY_BASE:,} ({table_v['family_unused']:,} unused), employment used {table_v['employment']['total']:,}, grand {table_v['grand_total']:,}")
    if a.dry_run:
        print(json.dumps({"limits": limits, "table_v": table_v}, indent=1)[:3000])
        return 0
    db = Turso()
    res = db.execute("SELECT json FROM perm_docs WHERE key = ?", [DOC_KEY])
    rows = res["response"]["result"]["rows"]
    doc = json.loads(rows[0][0]["value"]) if rows else {"limits": {}, "table_v": {}}
    if limits:
        doc.setdefault("limits", {})[str(limits["fiscal_year"])] = limits
    if table_v:
        doc.setdefault("table_v", {})[str(table_v["fiscal_year"])] = table_v
    doc["updated"] = dt.date.today().isoformat()
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)", [DOC_KEY, json.dumps(doc), int(time.time() * 1000)])
    newest = max(int(k) for k in doc.get("limits", {}))
    stamp_freshness(db, DATASET, as_of=f"{newest - 1}-10-01", source=STATS_PAGE, cadence="Yearly", max_age_days=420, note=f"limits FY{sorted(doc.get('limits', {}))}; Table V FY{sorted(doc.get('table_v', {}))}")
    record_run(db, "ingest_visa_limits.py", status="ok", rows_written=1, note=f"limits {sorted(doc.get('limits', {}))} table_v {sorted(doc.get('table_v', {}))}", started_at=started)
    log(f"wrote perm_docs['{DOC_KEY}']: limits {sorted(doc.get('limits', {}))}, Table V {sorted(doc.get('table_v', {}))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
