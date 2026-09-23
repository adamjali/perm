#!/usr/bin/env python3
"""Ingest USCIS's quarterly performance data into Turso.

Four spreadsheets USCIS posts each quarter on its immigration-and-citizenship
data page, plus one static factsheet, none of which the site read before:

* `quarterly_all_forms_fy<FY>_q<Q>` - every form USCIS adjudicates: receipts,
  approvals, denials, completions, pending, and the MEDIAN months to complete
  in that quarter. This is the one place USCIS prints a median: the figure on
  egov.uscis.gov is the 80th percentile, and the two are routinely confused.
* `i485_performance_data_fy<FY>_q<Q>` - the I-485 by field office and service
  center, family / employment / humanitarian / other, received, approved,
  denied and pending. The only public answer to "which office is slowest".
* `eb_i140_i360_i526_performancedata_fy<FY>_q<Q>` - approved employment-based
  petitions whose beneficiary is waiting for a visa number, by preference and
  country of birth. The India wait, counted rather than guessed.
* `i140_rec_by_class_country_fy<FY>_q<Q>` - I-140 receipts by fiscal year
  received and current status, all countries and the top five, with approvals
  by class (E11, E12, E13, E21, NIW, E31, E32, EW3).
* `historical_pt_factsheet_fy16_to_fy24.pdf` - median months FY2016 to FY2024
  for sixteen form/basis rows, the only history USCIS publishes for medians.
  Not linked from the data page; fetched at its own URL.

WHY THESE FILES ARE READ THE WAY THEY ARE, each a lesson from a sibling ingest:

* EVERY LISTED QUARTER IS LOADED, oldest first, and a file is identified by
  its FILENAME. USCIS carries the recent four quarters and no archive, so a
  quarter a run misses is gone; and it re-issues a file under `_v2` when it
  corrects one, which is a new name and therefore a reload that replaces the
  quarter's rows. A quarter already recorded under the same name is skipped,
  so a monthly poll costs one listing request on the months nothing changed.
* DISCOVERED, NEVER CONSTRUCTED. FY2026 Q1 sits under `/document/reports/`
  while Q2 and Q3 sit under `/document/data/`, and FY2025 Q4's awaiting-visa
  file spells it `performance_data` where the later ones say
  `performancedata`. A guessed URL 404s in a styled page that reads exactly
  like a dead link.
* FOOTNOTE GLUE. USCIS types its footnote markers into the cell, so `I-600`
  with footnote 7 arrives as `I-6007`, `I-924` with footnote 10 as `I-92410`,
  and `Legalization` with 13 as `Legalization13`. A form number is a letter
  prefix, a hyphen and exactly three digits, optionally one letter; every
  digit after that is a footnote. The same glue puts `(E21)2` on a class
  label and `9.16` on a median that is 9.1 with footnote 6.
* PARSED MUST EQUAL STORED. `INSERT OR REPLACE` overwrites a primary-key
  collision silently and the only evidence is a smaller count, which is how
  the I-485 inventory lost 130 cells on its first run. Every store here
  counts back and refuses on a mismatch.
* THE FILE'S OWN TOTALS ARE THE RECONCILIATION. Each workbook carries a total
  the parts must sum to (the TOTAL row per category, the TOTAL column per
  year, approvals by class against approved), and a parse that does not add
  up is refused before a row is written. A renamed column or a shifted block
  cannot pass that; a plausible-looking wrong number is worse than none.

www.uscis.gov serves residential addresses and 403s GitHub's datacenter
runners on some days; the workflow tries first and the Mac's launchd agent
retries the day after (scripts/residential_job.sh quarterly).

Usage:
    python3 scripts/ingest_uscis_quarterly.py                  # discover, load what is new
    python3 scripts/ingest_uscis_quarterly.py --dry-run        # parse and reconcile, write nothing
    python3 scripts/ingest_uscis_quarterly.py --local DIR      # parse the files in DIR instead
    python3 scripts/ingest_uscis_quarterly.py --force          # reload files already recorded
"""
from __future__ import annotations

import argparse
import io
import json
import os
import pathlib
import re
import sys
import time
import zipfile
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import fetch, iter_rows, log, read_shared_strings  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

# THE FULL LISTING, NOT THE LANDING PAGE. The bare page shows ten items and
# the quarterly files push each other off it; `items_per_page=100` is the
# page's own control and lists every file it carries.
DATA_PAGE = ("https://www.uscis.gov/tools/reports-and-studies/"
             "immigration-and-citizenship-data?items_per_page=100")
HOST = "https://www.uscis.gov"
FACTSHEET_URL = ("https://www.uscis.gov/sites/default/files/document/fact-sheets/"
                 "historical_pt_factsheet_fy16_to_fy24.pdf")
LOADS_DOC = "uscis_quarterly_loads"
FACTSHEET_DOC = "uscis_historical_pt"

# Filename -> (kind, fiscal year, quarter). The version suffix is optional and
# a re-issued `_v2` is a NEW name on purpose (see the module docstring).
KINDS: dict[str, re.Pattern[str]] = {
    "all_forms": re.compile(
        r"^quarterly_all_forms_fy(\d{4})_q(\d)(?:_v[\d.]+)?\.xlsx$", re.I),
    "i485_offices": re.compile(
        r"^i485_performance_data_fy(\d{4})_q(\d)(?:_v[\d.]+)?\.xlsx$", re.I),
    "eb_awaiting": re.compile(
        r"^eb_i140_i360_i526_performance_?data_fy(\d{4})_q(\d)(?:_v[\d.]+)?\.xlsx$", re.I),
    "i140_class_country": re.compile(
        r"^i140_rec_by_class_country_fy(\d{4})_q(\d)(?:_v[\d.]+)?\.xlsx$", re.I),
}

# What each kind stamps in data_freshness. The as-of is the quarter's last
# day and USCIS posts a quarter roughly 80 to 90 days after it ends, so at
# the moment the next file lands the newest as-of is about 175 days old. A
# 200-day budget is therefore "the next quarter is late", not ordinary lag;
# the health check warns on a paused source up to three times that before it
# fails, so a quarter USCIS skips is visible without crying wolf monthly.
FRESHNESS: dict[str, dict[str, str]] = {
    "all_forms": dict(dataset="uscis-form-quarters",
                      source="USCIS quarterly all-forms performance data (uscis.gov)"),
    "i485_offices": dict(dataset="uscis-i485-offices",
                         source="USCIS quarterly I-485 by field office (uscis.gov)"),
    "eb_awaiting": dict(dataset="uscis-eb-awaiting-visa",
                        source="USCIS approved employment-based petitions awaiting a visa (uscis.gov)"),
    "i140_class_country": dict(dataset="uscis-i140-class-country",
                               source="USCIS I-140 receipts by class and country of birth (uscis.gov)"),
}
MAX_AGE_DAYS = 200

MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}

# A form number: a letter prefix, a hyphen, exactly three digits, and at most
# one letter (I-129F, I-601A, I-956K, G-325A). Everything after that is a
# footnote marker USCIS typed into the cell.
FORM_RE = re.compile(r"^([A-Z]{1,2}-\d{3}[A-Z]?)(\d{1,2})?$")
# A prose label with a footnote glued on: "Legalization13", "Waivers21",
# "EOIR Adjustment22", "Professionals with Advanced Degrees (E21)2".
LABEL_GLUE_RE = re.compile(r"^(.*[A-Za-z)])(\d{1,2})$")
QUARTER_RANGE_RE = re.compile(
    r"^([A-Z][a-z]+) (\d{1,2}), (\d{4})\s*-\s*([A-Z][a-z]+) (\d{1,2}), (\d{4})$")
CLASS_CODE_RE = re.compile(r"\(([A-Z]{1,2}\d{1,2}|NIW)\)\s*\d{0,2}\s*$")
PREFERENCE_RE = re.compile(r"\((EB\d)\)\s*$")
YEAR_RE = re.compile(r"^(\d{4})(?:\.0)?$")

# Awaiting-visa column headings, normalised (whitespace collapsed) and matched
# in this order; the two-part ones must precede their one-part siblings.
AWAITING_CATEGORIES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^1st\b", re.I), "EB1"),
    (re.compile(r"^2nd\b", re.I), "EB2"),
    (re.compile(r"^3rd\b.*Other", re.I), "EW3"),
    (re.compile(r"^3rd\b", re.I), "EB3"),
    (re.compile(r"^4th\b.*Religious", re.I), "EB4R"),
    (re.compile(r"^4th\b", re.I), "EB4"),
    (re.compile(r"^5th\b.*Set", re.I), "EB5S"),
    (re.compile(r"^5th\b", re.I), "EB5U"),
    (re.compile(r"^TOTAL$", re.I), "TOTAL"),
]
AWAITING_COUNTRIES = {"TOTAL", "China", "India", "Mexico", "Philippines", "Rest of the World"}

# The office sheet's twenty measures, in column order after the code column:
# five groups (family, employment, humanitarian, other, all) of four.
OFFICE_GROUPS = ("fam", "emp", "hum", "oth", "all")
OFFICE_MEASURES = ("received", "approved", "denied", "pending")
OFFICE_COLUMNS = [f"{g}_{m}" for g in OFFICE_GROUPS for m in OFFICE_MEASURES]


class Refusal(SystemExit):
    """A parse that does not reconcile. Nothing is written; the run fails."""


@dataclass
class Listed:
    kind: str
    fy: int
    quarter: int
    name: str
    url: str

    @property
    def key(self) -> tuple[int, int]:
        return (self.fy, self.quarter)


@dataclass
class Parsed:
    kind: str
    fy: int
    quarter: int
    name: str
    quarter_start: str | None = None
    quarter_end: str | None = None
    as_of: str | None = None
    rows: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Cells and labels
# ---------------------------------------------------------------------------

def cell_int(v: object) -> int | None:
    """An integer cell, or None where USCIS withheld it.

    `N/A` is "not available" and `D` is "disclosure standards not met" (a
    count of 1 to 9); both are None, because 0 would be a claim. A bare `-`
    is the table key's "zero or rounds to 0.0" and IS zero.
    """
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s in ("", "N/A", "D", "n/a"):
        return None
    if s == "-":
        return 0
    try:
        f = float(s)
    except ValueError:
        return None
    if f != int(f):
        raise Refusal(f"expected a whole number, got {s!r}")
    return int(f)


def cell_float(v: object) -> float | None:
    """A months figure, or None for N/A. Footnote glue is refused loudly."""
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "N/A", "n/a", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def strip_footnote(label: str) -> str:
    """`I-6007` -> `I-600`, `Legalization13` -> `Legalization`, `I-129F` unchanged."""
    s = label.strip()
    m = FORM_RE.match(s)
    if m:
        return m.group(1)
    m = LABEL_GLUE_RE.match(s)
    if m:
        return m.group(1).strip()
    return s


def quarter_bounds(text: str) -> tuple[str, str] | None:
    """`April 1, 2026 - June 30, 2026` -> ('2026-04-01', '2026-06-30')."""
    m = QUARTER_RANGE_RE.match(text.strip())
    if not m:
        return None
    m1, d1, y1, m2, d2, y2 = m.groups()
    if m1 not in MONTHS or m2 not in MONTHS:
        return None
    return (f"{y1}-{MONTHS[m1]:02d}-{int(d1):02d}", f"{y2}-{MONTHS[m2]:02d}-{int(d2):02d}")


def norm(s: object) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def quarter_end(fy: int, quarter: int) -> str:
    """The last day of a USCIS fiscal quarter: Q1 ends December 31 of the prior calendar year."""
    return {1: f"{fy - 1}-12-31", 2: f"{fy}-03-31", 3: f"{fy}-06-30", 4: f"{fy}-09-30"}[quarter]


# ---------------------------------------------------------------------------
# Workbooks
# ---------------------------------------------------------------------------

def workbook_sheets(blob: bytes) -> list[tuple[str, list[dict[int, str]]]]:
    """Every sheet as (name, rows), rows being {column_index: text}."""
    z = zipfile.ZipFile(io.BytesIO(blob))
    shared = read_shared_strings(z)
    names = re.findall(r'<sheet [^>]*name="([^"]+)"',
                       z.read("xl/workbook.xml").decode("utf8", "ignore"))
    out: list[tuple[str, list[dict[int, str]]]] = []
    for i, name in enumerate(names, start=1):
        path = f"xl/worksheets/sheet{i}.xml"
        if path not in z.namelist():
            continue
        out.append((name.replace("&amp;", "&"), list(iter_rows(z, path, shared))))
    return out


def identify(name: str) -> tuple[str, int, int] | None:
    for kind, rx in KINDS.items():
        m = rx.match(name)
        if m:
            return kind, int(m.group(1)), int(m.group(2))
    return None


def discover(html: str) -> list[Listed]:
    """Every quarterly file the page lists, one per filename, oldest first."""
    seen: dict[str, Listed] = {}
    for href in re.findall(r'href="([^"]+\.xlsx)"', html, re.I):
        name = href.rsplit("/", 1)[-1]
        ident = identify(name)
        if not ident or name in seen:
            continue
        kind, fy, q = ident
        url = href if href.startswith("http") else HOST + href
        seen[name] = Listed(kind, fy, q, name, url)
    return sorted(seen.values(), key=lambda x: (x.kind, x.fy, x.quarter, x.name))


# ---------------------------------------------------------------------------
# all_forms
# ---------------------------------------------------------------------------

def parse_all_forms(rows: list[dict[int, str]], listed: Listed) -> Parsed:
    p = Parsed(listed.kind, listed.fy, listed.quarter, listed.name)
    header_at = None
    for i, r in enumerate(rows):
        first = norm(r.get(0))
        if p.quarter_start is None:
            qb = quarter_bounds(first)
            if qb:
                p.quarter_start, p.quarter_end = qb
        if first == "Category and Form Number":
            header_at = i
            break
    if header_at is None or not p.quarter_end:
        raise Refusal(f"{listed.name}: no header row or quarter range found")
    category = ""
    for r in rows[header_at + 1:]:
        first = norm(r.get(0))
        if not first:
            continue
        if first.startswith(("Table Key", "References", "Notes", "Source")):
            break
        numbers = [r.get(c) for c in range(2, 13)]
        has_numbers = any(v not in (None, "") for v in numbers)
        title = norm(r.get(1))
        if not has_numbers and not title:
            category = strip_footnote(first)
            continue
        if first == "TOTAL":
            form, title, cat = "TOTAL", "All forms", ""
        else:
            form, cat = strip_footnote(first), category
            if not title:
                raise Refusal(f"{listed.name}: form {first!r} has no title")
        p.rows.append({
            "form": form, "title": title, "category": cat,
            "received": cell_int(r.get(2)), "approved": cell_int(r.get(3)),
            "denied": cell_int(r.get(4)), "completed": cell_int(r.get(5)),
            "pending": cell_int(r.get(6)), "median_months": cell_float(r.get(7)),
            "ytd_received": cell_int(r.get(8)), "ytd_approved": cell_int(r.get(9)),
            "ytd_denied": cell_int(r.get(10)), "ytd_completed": cell_int(r.get(11)),
            "ytd_pending": cell_int(r.get(12)),
        })
    reconcile_all_forms(p)
    return p


def reconcile_all_forms(p: Parsed) -> None:
    forms = {r["form"] for r in p.rows}
    for must in ("TOTAL", "I-140", "I-485", "I-765", "I-131", "N-400"):
        if must not in forms:
            raise Refusal(f"{p.name}: {must} missing from the all-forms sheet")
    if len(p.rows) < 60:
        raise Refusal(f"{p.name}: only {len(p.rows)} form rows; expected 60 or more")
    keys = [(r["form"], r["title"]) for r in p.rows]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        raise Refusal(f"{p.name}: duplicate form/title keys {dupes[:3]}")
    for r in p.rows:
        for k in ("received", "approved", "denied", "completed", "pending"):
            v = r[k]
            if v is not None and v < 0:
                raise Refusal(f"{p.name}: {r['form']} {k} is negative")
        m = r["median_months"]
        if m is not None and not (0 <= m <= 240):
            raise Refusal(f"{p.name}: {r['form']} median {m} months is implausible")
    total = next(r for r in p.rows if r["form"] == "TOTAL")
    # The six I-485 rows and the four I-765 rows sum to their form's total
    # (note 6 on the sheet); the TOTAL row is the whole service, so every
    # form's pending must be inside it. A shifted column fails this at once.
    for r in p.rows:
        if r["form"] != "TOTAL" and r["pending"] is not None and total["pending"] is not None:
            if r["pending"] > total["pending"]:
                raise Refusal(f"{p.name}: {r['form']} pending exceeds the TOTAL row")
    i485 = sum(r["pending"] or 0 for r in p.rows if r["form"] == "I-485")
    if i485 < 100_000:
        raise Refusal(f"{p.name}: I-485 pending sums to {i485:,}; a column has shifted")


# ---------------------------------------------------------------------------
# i485_offices
# ---------------------------------------------------------------------------

def parse_i485_offices(rows: list[dict[int, str]], listed: Listed) -> Parsed:
    p = Parsed(listed.kind, listed.fy, listed.quarter, listed.name)
    header_at = None
    for i, r in enumerate(rows):
        first = norm(r.get(0))
        if p.quarter_start is None:
            qb = quarter_bounds(first)
            if qb:
                p.quarter_start, p.quarter_end = qb
        if first.startswith("Field Office by State"):
            header_at = i
            break
    if header_at is None or not p.quarter_end:
        raise Refusal(f"{listed.name}: no header row or quarter range found")
    groups = rows[header_at - 1]
    labels = [norm(groups.get(c)) for c in (2, 6, 10, 14)]
    for want, got in zip(("Family", "Employment", "Humanitarian", "Other"), labels):
        if not got.startswith(want):
            raise Refusal(f"{listed.name}: column group {want!r} not where expected (got {got!r})")
    state = ""
    for r in rows[header_at + 1:]:
        first = norm(r.get(0))
        if not first:
            continue
        if first.startswith(("Table Key", "References", "Notes", "Source", "- Represents", "D ")):
            break
        code = norm(r.get(1))
        values = [r.get(c) for c in range(2, 22)]
        has_numbers = any(v not in (None, "") for v in values)
        if not code and not has_numbers:
            state = first
            continue
        if first == "Total" and not code:
            row = {"state": "", "office": "Total", "code": "ALL"}
        else:
            if not code:
                raise Refusal(f"{listed.name}: office {first!r} has no code")
            row = {"state": state, "office": first, "code": code}
        row["suppressed"] = sum(1 for v in values if str(v or "").strip() == "D")
        for col, v in zip(OFFICE_COLUMNS, values):
            row[col] = cell_int(v)
        p.rows.append(row)
    reconcile_offices(p)
    return p


def reconcile_offices(p: Parsed) -> None:
    total = next((r for r in p.rows if r["code"] == "ALL"), None)
    if not total:
        raise Refusal(f"{p.name}: no Total row")
    offices = [r for r in p.rows if r["code"] != "ALL"]
    if len(offices) < 80:
        raise Refusal(f"{p.name}: only {len(offices)} office rows; expected 80 or more")
    states = {r["state"] for r in offices} - {"Service Center"}
    if len(states) < 45:
        raise Refusal(f"{p.name}: only {len(states)} states; expected 45 or more")
    codes = [r["code"] for r in offices]
    if len(set(codes)) != len(codes):
        raise Refusal(f"{p.name}: duplicate office codes")
    # The published Total is the reconciliation. Where USCIS suppressed a
    # cell the parts can only sum to LESS than the total (each D is 1 to 9),
    # so the check is exact when nothing is suppressed and a floor when
    # something is. Either way a shifted column or a dropped block fails.
    for col in OFFICE_COLUMNS:
        published = total[col]
        if published is None:
            continue
        parts = [r[col] for r in offices]
        held = sum(v for v in parts if v is not None)
        missing = sum(1 for v in parts if v is None)
        if missing == 0 and held != published:
            raise Refusal(f"{p.name}: {col} sums to {held:,} against a published {published:,}")
        if missing and not (held <= published <= held + 9 * missing):
            raise Refusal(f"{p.name}: {col} sums to {held:,} with {missing} suppressed "
                          f"cells against a published {published:,}")


# ---------------------------------------------------------------------------
# eb_awaiting
# ---------------------------------------------------------------------------

def parse_eb_awaiting(rows: list[dict[int, str]], listed: Listed) -> Parsed:
    p = Parsed(listed.kind, listed.fy, listed.quarter, listed.name)
    header_at = None
    for i, r in enumerate(rows):
        first = norm(r.get(0))
        m = re.match(r"^As of ([A-Z][a-z]+) (\d{4})$", first)
        if m and m.group(1) in MONTHS:
            p.as_of = f"{m.group(2)}-{MONTHS[m.group(1)]:02d}"
        if first == "Country":
            header_at = i
            break
    if header_at is None or not p.as_of:
        raise Refusal(f"{listed.name}: no Country header or 'As of' line")
    header = rows[header_at]
    columns: list[tuple[int, str]] = []
    for c in sorted(k for k in header if k > 0):
        label = norm(header[c])
        if not label:
            continue
        code = next((code for rx, code in AWAITING_CATEGORIES if rx.search(label)), None)
        if not code:
            raise Refusal(f"{listed.name}: unrecognised category heading {label!r}")
        columns.append((c, code))
    if {code for _, code in columns} != {c for _, c in AWAITING_CATEGORIES} or len(columns) != len(AWAITING_CATEGORIES):
        raise Refusal(f"{listed.name}: category columns are {[c for _, c in columns]}")
    for r in rows[header_at + 1:]:
        country = norm(r.get(0))
        if not country:
            continue
        if country.startswith(("Table Key", "Notes", "Source", "- Represents")):
            break
        if country not in AWAITING_COUNTRIES:
            raise Refusal(f"{listed.name}: unexpected country row {country!r}")
        for c, code in columns:
            n = cell_int(r.get(c))
            if n is None:
                raise Refusal(f"{listed.name}: {country} {code} is blank")
            p.rows.append({"country": country, "category": code, "count": n})
    reconcile_awaiting(p)
    return p


def reconcile_awaiting(p: Parsed) -> None:
    countries = {r["country"] for r in p.rows}
    if countries != AWAITING_COUNTRIES:
        raise Refusal(f"{p.name}: countries are {sorted(countries)}")
    by = {(r["country"], r["category"]): r["count"] for r in p.rows}
    parts = sorted(AWAITING_COUNTRIES - {"TOTAL"})
    for _, code in AWAITING_CATEGORIES:
        summed = sum(by[(c, code)] for c in parts)
        if summed != by[("TOTAL", code)]:
            raise Refusal(f"{p.name}: {code} countries sum to {summed:,} against a "
                          f"TOTAL row of {by[('TOTAL', code)]:,}")
    for c in AWAITING_COUNTRIES:
        summed = sum(by[(c, code)] for _, code in AWAITING_CATEGORIES if code != "TOTAL")
        if summed != by[(c, "TOTAL")]:
            raise Refusal(f"{p.name}: {c} categories sum to {summed:,} against a "
                          f"TOTAL column of {by[(c, 'TOTAL')]:,}")


# ---------------------------------------------------------------------------
# i140_class_country
# ---------------------------------------------------------------------------

def sheet_country(name: str) -> str:
    """`India FY26` -> India, `Vietnam 2026` -> Vietnam, `All Countries FY26` -> All Countries."""
    return re.sub(r"\s+(FY\s?\d{2,4}|\d{4})$", "", name.strip(), flags=re.I).strip()


def parse_i140_class_country(sheets: list[tuple[str, list[dict[int, str]]]],
                             listed: Listed) -> Parsed:
    p = Parsed(listed.kind, listed.fy, listed.quarter, listed.name)
    p.as_of = f"{listed.fy}-Q{listed.quarter}"
    for name, rows in sheets:
        country = sheet_country(name)
        header_at = None
        for i, r in enumerate(rows):
            if norm(r.get(0)).startswith("Petitions by Employment Preference"):
                header_at = i
                break
        if header_at is None:
            raise Refusal(f"{listed.name}: sheet {name!r} has no year header")
        header = rows[header_at]
        years: list[tuple[int, int]] = []
        total_col = None
        for c in sorted(k for k in header if k > 0):
            label = norm(header[c])
            m = YEAR_RE.match(label)
            if m:
                years.append((c, int(m.group(1))))
            elif label.upper() == "TOTAL":
                total_col = c
        fys = [fy for _, fy in years]
        if len(years) < 3 or total_col is None or fys != list(range(fys[0], fys[0] + len(fys))):
            raise Refusal(f"{listed.name}: sheet {name!r} header years are {fys} (TOTAL column: {total_col})")
        preference, approvals_block = "ALL", False
        for r in rows[header_at + 1:]:
            label = norm(r.get(0))
            if not label:
                continue
            if label.startswith(("Table Key", "References", "Notes", "Source")):
                break
            has_numbers = any(r.get(c) not in (None, "") for c, _ in years)
            pm = PREFERENCE_RE.search(label)
            if pm:
                preference, approvals_block = pm.group(1), False
                if has_numbers:
                    p.rows += measure_rows(country, preference, "total", r, years, total_col, p)
                continue
            if label.lower().startswith("other and unknown"):
                preference, approvals_block = "OTHER", False
                if has_numbers:
                    p.rows += measure_rows(country, preference, "total", r, years, total_col, p)
                continue
            if label.lower().startswith("approvals by category"):
                approvals_block = True
                continue
            if not has_numbers:
                continue
            if approvals_block:
                cm = CLASS_CODE_RE.search(label)
                if not cm:
                    raise Refusal(f"{listed.name}: no class code in {label!r}")
                measure = f"approved_{cm.group(1)}"
            else:
                low = label.lower()
                if low in ("total", "total petitions"):
                    measure = "total"
                elif low == "approved":
                    measure = "approved"
                elif low == "denied":
                    measure = "denied"
                elif low.startswith("pending"):
                    measure = "pending"
                else:
                    raise Refusal(f"{listed.name}: unrecognised row {label!r} in {name!r}")
            p.rows += measure_rows(country, preference, measure, r, years, total_col, p)
    reconcile_class_country(p)
    return p


def measure_rows(country: str, preference: str, measure: str, r: dict[int, str],
                 years: list[tuple[int, int]], total_col: int, p: Parsed) -> list[dict]:
    out = []
    summed = 0
    for c, fy in years:
        n = cell_int(r.get(c))
        if n is None:
            # USCIS leaves a class-approval cell EMPTY where nothing was
            # approved (Philippines E12 in 2018, for one). Read as zero, and
            # let the TOTAL column below say whether that was right.
            p.notes.append(f"{country} {preference} {measure} {fy} blank, read as 0")
            n = 0
        summed += n
        out.append({"country": country, "preference": preference,
                    "measure": measure, "fy": fy, "count": n})
    published = cell_int(r.get(total_col))
    # The TOTAL column is the sum of the years, printed by USCIS. A parse that
    # read the wrong columns cannot reproduce it.
    if published is not None and published != summed:
        raise Refusal(f"{p.name}: {country} {preference} {measure} years sum to "
                      f"{summed:,} against a TOTAL column of {published:,}")
    return out


def reconcile_class_country(p: Parsed) -> None:
    by: dict[tuple[str, str, str, int], int] = {
        (r["country"], r["preference"], r["measure"], r["fy"]): r["count"] for r in p.rows}
    countries = {r["country"] for r in p.rows}
    if "All Countries" not in countries or len(countries) < 2:
        raise Refusal(f"{p.name}: sheets held {sorted(countries)}")
    years = sorted({r["fy"] for r in p.rows})
    for country in countries:
        for fy in years:
            for pref in ("ALL", "EB1", "EB2", "EB3", "OTHER"):
                t = by.get((country, pref, "total", fy))
                if t is None:
                    raise Refusal(f"{p.name}: {country} {pref} has no total for {fy}")
                parts = sum(by.get((country, pref, m, fy), 0)
                            for m in ("approved", "denied", "pending"))
                if parts != t:
                    raise Refusal(f"{p.name}: {country} {pref} {fy}: approved+denied+pending "
                                  f"{parts:,} against a total of {t:,}")
            prefs = sum(by[(country, pr, "total", fy)] for pr in ("EB1", "EB2", "EB3", "OTHER"))
            if prefs != by[(country, "ALL", "total", fy)]:
                raise Refusal(f"{p.name}: {country} {fy}: preferences sum to {prefs:,} "
                              f"against {by[(country, 'ALL', 'total', fy)]:,}")
            # Approvals by class must sum to the preference's approvals.
            for pref in ("EB1", "EB2", "EB3"):
                classes = sum(v for (c, pr, m, y), v in by.items()
                              if c == country and pr == pref and y == fy
                              and m.startswith("approved_"))
                if classes != by[(country, pref, "approved", fy)]:
                    raise Refusal(f"{p.name}: {country} {pref} {fy}: classes sum to "
                                  f"{classes:,} against approved {by[(country, pref, 'approved', fy)]:,}")


# ---------------------------------------------------------------------------
# The historical factsheet (PDF)
# ---------------------------------------------------------------------------

FACTSHEET_ROW_RE = re.compile(r"^([A-Z]-\d{2,3}) (.+?) ((?:\d+(?:\.\d+)? ?){9})$")


def parse_factsheet_text(text: str) -> dict:
    """Table 1 of the factsheet, from its extracted text.

    One value per year per row, and two kinds of footnote glue: a
    classification ending in a marker ("Advance Parole Document3") and a
    median with the marker fused to its decimals ("9.16" is 9.1 with
    footnote 6 - the table never prints more than one decimal place).
    """
    m = re.search(r"Data as of (\d{2})/(\d{2})/(\d{4})", text)
    if not m:
        raise Refusal("factsheet: no 'Data as of' line")
    as_of = f"{m.group(3)}-{m.group(1)}-{m.group(2)}"
    ym = re.search(r"Basis for Filing ((?:\d{4}\d? ?){9})", text)
    if not ym:
        raise Refusal("factsheet: no year header")
    years = [int(y[:4]) for y in ym.group(1).split()]
    rows: list[dict] = []
    glued: list[str] = []
    for line in text.splitlines():
        if "%" in line:
            continue          # Table 2 is percent change and repeats the labels
        rm = FACTSHEET_ROW_RE.match(line.strip())
        if not rm:
            continue
        form, basis, values = rm.groups()
        basis = strip_footnote(basis)
        months: list[float] = []
        for v in values.split():
            if "." in v and len(v.split(".")[1]) > 1:
                glued.append(f"{form} {basis}: {v}")
                v = v[:v.index(".") + 2]
            months.append(float(v))
        if len(months) != len(years):
            raise Refusal(f"factsheet: {form} {basis} has {len(months)} values for {len(years)} years")
        rows.append({"form": form, "basis": basis, "months": months})
    if len(rows) < 12:
        raise Refusal(f"factsheet: only {len(rows)} rows parsed")
    if not any(r["form"] == "I-485" and "Employment" in r["basis"] for r in rows):
        raise Refusal("factsheet: the employment-based I-485 row is missing")
    return {"asOf": as_of, "years": years, "rows": rows, "glued": glued,
            "note": "FY2024 covers October 1, 2023 to January 31, 2024 (USCIS footnote 2).",
            "source": FACTSHEET_URL}


def fetch_factsheet() -> dict:
    import pdfplumber  # imported here: the four workbooks need no PDF library
    blob = fetch(FACTSHEET_URL, referer=DATA_PAGE)
    with pdfplumber.open(io.BytesIO(blob)) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    return parse_factsheet_text(text)


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

DDL = [
    """CREATE TABLE IF NOT EXISTS uscis_form_quarters (
        fy INTEGER NOT NULL, quarter INTEGER NOT NULL, form TEXT NOT NULL, title TEXT NOT NULL,
        category TEXT NOT NULL, quarter_start TEXT NOT NULL, quarter_end TEXT NOT NULL,
        received INTEGER, approved INTEGER, denied INTEGER, completed INTEGER, pending INTEGER,
        median_months REAL,
        ytd_received INTEGER, ytd_approved INTEGER, ytd_denied INTEGER, ytd_completed INTEGER,
        ytd_pending INTEGER, source_file TEXT NOT NULL,
        PRIMARY KEY (fy, quarter, form, title))""",
    """CREATE INDEX IF NOT EXISTS idx_ufq_form ON uscis_form_quarters (form, fy, quarter)""",
    """CREATE TABLE IF NOT EXISTS uscis_i485_offices (
        fy INTEGER NOT NULL, quarter INTEGER NOT NULL, quarter_end TEXT NOT NULL,
        state TEXT NOT NULL, office TEXT NOT NULL, code TEXT NOT NULL,
        """ + ", ".join(f"{c} INTEGER" for c in OFFICE_COLUMNS) + """,
        suppressed INTEGER NOT NULL DEFAULT 0, source_file TEXT NOT NULL,
        PRIMARY KEY (fy, quarter, code))""",
    """CREATE TABLE IF NOT EXISTS uscis_eb_awaiting_visa (
        as_of TEXT NOT NULL, country TEXT NOT NULL, category TEXT NOT NULL,
        count INTEGER NOT NULL, source_file TEXT NOT NULL,
        PRIMARY KEY (as_of, country, category))""",
    """CREATE TABLE IF NOT EXISTS uscis_i140_class_country (
        as_of TEXT NOT NULL, country TEXT NOT NULL, preference TEXT NOT NULL,
        measure TEXT NOT NULL, fy INTEGER NOT NULL, count INTEGER NOT NULL,
        source_file TEXT NOT NULL,
        PRIMARY KEY (as_of, country, preference, measure, fy))""",
    """CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER NOT NULL)""",
]


def ensure_tables(db: Turso) -> None:
    for ddl in DDL:
        db.execute(ddl)


def insert_chunks(db: Turso, table: str, columns: list[str], rows: list[list], size: int = 200) -> None:
    placeholders = "(" + ",".join("?" * len(columns)) + ")"
    for i in range(0, len(rows), size):
        chunk = rows[i:i + size]
        args: list = []
        for r in chunk:
            args += r
        db.execute(f"INSERT OR REPLACE INTO {table} ({', '.join(columns)}) VALUES "
                   + ",".join([placeholders] * len(chunk)), args)


def count_where(db: Turso, table: str, where: str, args: list) -> int:
    return int(db.scalar(f"SELECT count(*) FROM {table} WHERE {where}", args) or 0)


def store(db: Turso, p: Parsed) -> int:
    """Replace one file's rows wholesale, then count back. Refuses on loss."""
    if p.kind == "all_forms":
        cols = ["fy", "quarter", "form", "title", "category", "quarter_start", "quarter_end",
                "received", "approved", "denied", "completed", "pending", "median_months",
                "ytd_received", "ytd_approved", "ytd_denied", "ytd_completed", "ytd_pending",
                "source_file"]
        db.execute("DELETE FROM uscis_form_quarters WHERE fy = ? AND quarter = ?", [p.fy, p.quarter])
        insert_chunks(db, "uscis_form_quarters", cols, [
            [p.fy, p.quarter, r["form"], r["title"], r["category"], p.quarter_start, p.quarter_end,
             r["received"], r["approved"], r["denied"], r["completed"], r["pending"],
             r["median_months"], r["ytd_received"], r["ytd_approved"], r["ytd_denied"],
             r["ytd_completed"], r["ytd_pending"], p.name] for r in p.rows])
        n = count_where(db, "uscis_form_quarters", "fy = ? AND quarter = ?", [p.fy, p.quarter])
    elif p.kind == "i485_offices":
        cols = ["fy", "quarter", "quarter_end", "state", "office", "code", *OFFICE_COLUMNS,
                "suppressed", "source_file"]
        db.execute("DELETE FROM uscis_i485_offices WHERE fy = ? AND quarter = ?", [p.fy, p.quarter])
        insert_chunks(db, "uscis_i485_offices", cols, [
            [p.fy, p.quarter, p.quarter_end, r["state"], r["office"], r["code"],
             *[r[c] for c in OFFICE_COLUMNS], r["suppressed"], p.name] for r in p.rows])
        n = count_where(db, "uscis_i485_offices", "fy = ? AND quarter = ?", [p.fy, p.quarter])
    elif p.kind == "eb_awaiting":
        cols = ["as_of", "country", "category", "count", "source_file"]
        db.execute("DELETE FROM uscis_eb_awaiting_visa WHERE as_of = ?", [p.as_of])
        insert_chunks(db, "uscis_eb_awaiting_visa", cols, [
            [p.as_of, r["country"], r["category"], r["count"], p.name] for r in p.rows])
        n = count_where(db, "uscis_eb_awaiting_visa", "as_of = ?", [p.as_of])
    elif p.kind == "i140_class_country":
        cols = ["as_of", "country", "preference", "measure", "fy", "count", "source_file"]
        db.execute("DELETE FROM uscis_i140_class_country WHERE as_of = ?", [p.as_of])
        insert_chunks(db, "uscis_i140_class_country", cols, [
            [p.as_of, r["country"], r["preference"], r["measure"], r["fy"], r["count"], p.name]
            for r in p.rows])
        n = count_where(db, "uscis_i140_class_country", "as_of = ?", [p.as_of])
    else:
        raise Refusal(f"unknown kind {p.kind}")
    if n != len(p.rows):
        raise Refusal(f"REFUSING {p.name}: parsed {len(p.rows):,} rows but stored {n:,} - "
                      f"{len(p.rows) - n:,} collided on the primary key")
    return n


def read_loads(db: Turso) -> dict:
    raw = db.scalar("SELECT json FROM perm_docs WHERE key = ?", [LOADS_DOC])
    if not raw:
        return {}
    try:
        return json.loads(str(raw))
    except ValueError:
        return {}


def write_doc(db: Turso, key: str, doc: dict) -> None:
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?,?,?)",
               [key, json.dumps(doc, separators=(",", ":")), int(time.time() * 1000)])


def previous_keys(db: Turso, p: Parsed) -> set[str] | None:
    """The identifying keys of the newest quarter held BEFORE this one, for drift."""
    if p.kind == "all_forms":
        table, expr = "uscis_form_quarters", "form || '|' || title"
    elif p.kind == "i485_offices":
        table, expr = "uscis_i485_offices", "code"
    else:
        return None
    prev = db.execute(
        f"SELECT fy, quarter FROM {table} WHERE (fy < ?) OR (fy = ? AND quarter < ?) "
        "ORDER BY fy DESC, quarter DESC LIMIT 1", [p.fy, p.fy, p.quarter])
    rows = prev["response"]["result"]["rows"]
    if not rows:
        return None
    fy, q = int(rows[0][0]["value"]), int(rows[0][1]["value"])
    res = db.execute(f"SELECT {expr} FROM {table} WHERE fy = ? AND quarter = ?", [fy, q])
    return {str(r[0]["value"]) for r in res["response"]["result"]["rows"]}


def drift_findings(previous: set[str] | None, p: Parsed) -> list[str]:
    """Keys the previous quarter carried and this one does not.

    A form USCIS retires is legitimate (I-924 is decommissioned and still
    listed); a form that vanishes because its row was misread is not, and
    the parser cannot tell them apart. So a loss is refused unless a human
    passes --accept-drift after reading the list. No baseline, no findings.
    """
    if previous is None:
        return []
    if p.kind == "all_forms":
        now = {f"{r['form']}|{r['title']}" for r in p.rows}
    else:
        now = {r["code"] for r in p.rows}
    lost = sorted(previous - now)
    return [f"{p.kind}: keys held last quarter and not now: {lost}"] if lost else []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_blob(listed: Listed, blob: bytes) -> Parsed:
    sheets = workbook_sheets(blob)
    if not sheets:
        raise Refusal(f"{listed.name}: no worksheets")
    if listed.kind == "all_forms":
        return parse_all_forms(sheets[0][1], listed)
    if listed.kind == "i485_offices":
        return parse_i485_offices(sheets[0][1], listed)
    if listed.kind == "eb_awaiting":
        return parse_eb_awaiting(sheets[0][1], listed)
    return parse_i140_class_country(sheets, listed)


def local_listing(directory: pathlib.Path) -> list[Listed]:
    out = []
    for path in sorted(directory.iterdir()):
        ident = identify(path.name)
        if ident:
            kind, fy, q = ident
            out.append(Listed(kind, fy, q, path.name, str(path)))
    return sorted(out, key=lambda x: (x.kind, x.fy, x.quarter, x.name))


def describe(p: Parsed) -> str:
    if p.kind == "all_forms":
        i140 = next((r for r in p.rows if r["form"] == "I-140"), None)
        med = i140["median_months"] if i140 else None
        return (f"{len(p.rows)} forms, {p.quarter_start}..{p.quarter_end}; "
                f"I-140 median {med} months, pending {i140['pending']:,}" if i140 else
                f"{len(p.rows)} forms")
    if p.kind == "i485_offices":
        total = next(r for r in p.rows if r["code"] == "ALL")
        return (f"{len(p.rows) - 1} offices; employment pending {total['emp_pending']:,}; "
                f"{sum(r['suppressed'] for r in p.rows)} suppressed cells")
    if p.kind == "eb_awaiting":
        total = next(r["count"] for r in p.rows if r["country"] == "TOTAL" and r["category"] == "TOTAL")
        india = next(r["count"] for r in p.rows if r["country"] == "India" and r["category"] == "TOTAL")
        return f"as of {p.as_of}: {total:,} awaiting a visa, India {india:,}"
    countries = sorted({r["country"] for r in p.rows})
    return f"{len(p.rows)} cells across {len(countries)} sheets ({', '.join(countries)})"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--local", help="Parse the quarterly workbooks in this directory instead of discovering")
    ap.add_argument("--dry-run", action="store_true", help="Parse and reconcile; write nothing")
    ap.add_argument("--force", action="store_true", help="Reload files already recorded as loaded")
    ap.add_argument("--accept-drift", action="store_true",
                    help="Load a quarter that lost keys the previous one carried")
    ap.add_argument("--skip-factsheet", action="store_true", help="Do not fetch the historical PDF")
    args = ap.parse_args(argv)
    started = time.time()

    if args.local:
        listed = local_listing(pathlib.Path(args.local))
        read = lambda item: pathlib.Path(item.url).read_bytes()  # noqa: E731
    else:
        log(f"Discovering the quarterly files from {DATA_PAGE}")
        html = fetch(DATA_PAGE).decode("utf8", "ignore")
        listed = discover(html)
        read = lambda item: fetch(item.url, referer=DATA_PAGE)  # noqa: E731
    if not listed:
        raise SystemExit("no quarterly file found on the USCIS data page")
    by_kind: dict[str, list[Listed]] = {}
    for item in listed:
        by_kind.setdefault(item.kind, []).append(item)
    for kind, items in sorted(by_kind.items()):
        log(f"  {kind}: " + ", ".join(f"FY{i.fy} Q{i.quarter}" for i in items))
    for kind in KINDS:
        if kind not in by_kind:
            log(f"  WARNING: no {kind} file listed")

    db = None if args.dry_run else Turso()
    loads = {} if db is None else read_loads(db)
    if db is not None:
        ensure_tables(db)

    written = 0
    loaded_names: list[str] = []
    newest_as_of: dict[str, str] = {}
    for item in listed:
        if not args.force and item.name in loads:
            log(f"  {item.name}: already loaded {loads[item.name].get('loadedOn', '')}; skipping")
            prior = quarter_end(item.fy, item.quarter)
            if prior > newest_as_of.get(item.kind, ""):
                newest_as_of[item.kind] = prior
            continue
        log(f"  {item.name}: fetching")
        p = parse_blob(item, read(item))
        log(f"    parsed: {describe(p)}")
        # The freshness stamp is the quarter's last day for every kind. The
        # awaiting-visa sheet says "As of June 2026" and the class sheet names
        # a quarter, and neither is a date the health check can age.
        as_of = quarter_end(item.fy, item.quarter)
        if db is None:
            if as_of > newest_as_of.get(item.kind, ""):
                newest_as_of[item.kind] = as_of
            continue
        findings = drift_findings(previous_keys(db, p), p)
        if findings and not args.accept_drift:
            for f in findings:
                log(f"    DRIFT: {f}")
            raise Refusal(f"REFUSING {item.name}: keys were lost against the previous quarter; "
                          "read the list and re-run with --accept-drift if USCIS retired them")
        for f in findings:
            log(f"    drift accepted: {f}")
        n = store(db, p)
        written += n
        loaded_names.append(item.name)
        loads[item.name] = {"kind": item.kind, "fy": item.fy, "quarter": item.quarter,
                            "rows": n, "asOf": as_of,
                            "loadedOn": time.strftime("%Y-%m-%d")}
        write_doc(db, LOADS_DOC, loads)
        if as_of > newest_as_of.get(item.kind, ""):
            newest_as_of[item.kind] = as_of
        log(f"    stored {n:,} rows")
        if not args.local:
            time.sleep(1.5)   # polite between federal fetches

    factsheet_note = ""
    if not args.skip_factsheet:
        try:
            doc = fetch_factsheet()
            factsheet_note = f"; factsheet as of {doc['asOf']} ({len(doc['rows'])} rows)"
            for g in doc["glued"]:
                log(f"  factsheet footnote glue read past: {g}")
            if db is not None:
                write_doc(db, FACTSHEET_DOC, doc)
            log(f"  factsheet: {len(doc['rows'])} rows, data as of {doc['asOf']}")
        except (Exception, SystemExit) as exc:  # noqa: BLE001 - optional step, named in the run note
            # The factsheet is static and optional: a refusal here must not
            # fail the quarterly load it rides with. It is named in the run
            # note so the miss is on the record.
            factsheet_note = f"; factsheet NOT read ({exc})"
            log(f"  factsheet: not read ({exc})")

    if db is None:
        log(f"dry run: {len(listed)} file(s) parsed and reconciled, nothing written")
        return 0

    for kind, fresh in FRESHNESS.items():
        dataset, source = fresh["dataset"], fresh["source"]
        as_of = newest_as_of.get(kind)
        if not as_of:
            log(f"  {dataset}: nothing held, not stamped")
            continue
        stamp_freshness(db, dataset, as_of=as_of, source=source, cadence="Quarterly",
                        note=f"{len(by_kind.get(kind, []))} quarter(s) listed by USCIS; "
                             f"newest as of {as_of}",
                        max_age_days=MAX_AGE_DAYS)
    note = (f"loaded {', '.join(loaded_names)}" if loaded_names
            else f"nothing new among {len(listed)} listed file(s)") + factsheet_note
    record_run(db, "ingest_uscis_quarterly.py", status="ok", rows_written=written,
               note=note, started_at=started)
    log(f"done: {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
