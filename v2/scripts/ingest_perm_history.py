#!/usr/bin/env python3
"""PERM decisions from FY2008 to FY2023: a record per employer per year, and
the cases themselves from FY2016.

The current corpus (`perm_cases`) starts with decisions on 2023-10-01, the
first day of FY2024, because that is where the quarterly ingest's `--since-fy`
starts. DOL publishes every year back to FY2008. This reads those files once
and writes two things, chosen for what they answer and what they cost:

    perm_employer_years   slug, fiscal year, certified / denied / withdrawn.
                          FY2008 onward. An employer's track record, the thing
                          an older year is actually useful for.
    perm_cases_history    the case rows for FY2016 to FY2023, perm_cases'
                          columns plus the worker's (citizenship, birth
                          country, visa at filing, education, field of study,
                          school, the job's required education: the old form
                          carries them, the new one doesn't), so a case can be
                          looked up, listed and searched. FY2016 is where
                          those fields begin; older years are counted.
    perm_country_years    decisions by country of citizenship and year,
                          national, FY2008 onward.
    perm_history_facets   each employer's and occupation's top values for the
                          worker's fields, from the history rows.

`--current` fills FY2024 onward of `perm_employer_years` from `perm_cases`, so
one table carries the whole series; the quarterly ingest runs it after each
load.

WHAT THE OLD FILES DIFFER IN, read off DOL's record layouts (FY10 .doc, FY16,
FY2020 PDFs; Sep 26 2026):
- the case number is `CASE_NO` (to FY2014) or `CASE_NUMBER`, and old numbers
  are `A-YYDDD-NNNNN`;
- there is NO received date before FY2015, so a row is kept on its decision
  date alone and its duration is left empty;
- the law firm is `AGENT_FIRM_NAME` (FY2015 to FY2019) or
  `AGENT_ATTORNEY_FIRM_NAME` (FY2020 on), and absent before;
- the industry is `2007_NAICS_US_CODE`, `NAICS_US_CODE` or `NAICS_CODE`.
Every name that resolves nothing degrades to an empty field and is logged.

File names are DISCOVERED from DOL's performance page, never built: they run
`PERM_FY2008.xlsx`, `PERM_FY14_Q4.xlsx`, `PERM_Disclosure_Data_FY17.xlsx`,
`PERM_Disclosure_Data_FY2018_EOY.xlsx`, and no pattern covers them all.

RESUMABLE, because www.dol.gov refuses sustained traffic from one address
(measured: 200, then 403 about 240 MB later). Each file is downloaded, parsed,
written and recorded in `perm_docs['perm_history']` before the next is asked
for, and a recorded file is skipped next time unless `--force`.

Usage:
    python3 scripts/ingest_perm_history.py                 # every year not yet loaded
    python3 scripts/ingest_perm_history.py --from-fy 2020 --to-fy 2021
    python3 scripts/ingest_perm_history.py --local PERM_FY2010.xlsx --dry-run
    python3 scripts/ingest_perm_history.py --current       # FY2024 onward only
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import pathlib
import re
import sys
import tempfile
import time
import zipfile
from collections import defaultdict
from datetime import date
from xml.etree.ElementTree import iterparse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_perm_disclosure as ipd  # noqa: E402
from entity_identity import entity_key  # noqa: E402
from lib_naics import normalize_naics  # noqa: E402
from lib_turso import Turso, lit, record_run  # noqa: E402
from store_entities import slugify  # noqa: E402

FIRST_FY, LAST_FY = 2008, 2023
ROWS_FROM_FY = 2016
DOC_KEY = "perm_history"
NS = ipd.NS
PAUSE_BETWEEN_FILES_S = 30

# The current parser's names, plus the old forms'. Copied, never mutated: the
# quarterly parser's candidate list is its own contract.
CANDIDATES: dict[str, list[str]] = copy.deepcopy(ipd.COLUMN_CANDIDATES)
CANDIDATES["attorney"] = CANDIDATES["attorney"] + ["AGENT_FIRM_NAME"]
CANDIDATES["naics"] = CANDIDATES["naics"] + ["2007_NAICS_US_CODE", "2012_NAICS_US_CODE"]
REQUIRED = ("case", "status", "decision", "employer")

COLUMNS = [
    "case_number", "status", "received_date", "decision_date", "days",
    "fiscal_year", "employer_name", "employer_slug", "state", "job_title",
    "soc_code", "soc_title", "attorney_name", "attorney_slug", "wage",
    "naics", "worksite_city",
    "citizenship", "birth_country", "visa_class", "education", "major",
    "institution", "job_education",
]
# The first CORE columns decide whether a stored row is the same case record;
# the rest (the worker's fields, added Sep 26) can be filled into a row that
# is otherwise unchanged with a narrow UPDATE instead of a whole-row replace.
CORE = 17
EXTRA = COLUMNS[CORE:]

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS perm_employer_years (
         slug      TEXT NOT NULL,
         fy        INTEGER NOT NULL,
         certified INTEGER NOT NULL,
         denied    INTEGER NOT NULL,
         withdrawn INTEGER NOT NULL,
         PRIMARY KEY (slug, fy)
       )""",
    """CREATE TABLE IF NOT EXISTS perm_cases_history (
         case_number   TEXT PRIMARY KEY,
         status        TEXT NOT NULL,
         received_date TEXT,
         decision_date TEXT,
         days          INTEGER,
         fiscal_year   TEXT,
         employer_name TEXT,
         employer_slug TEXT,
         state         TEXT,
         job_title     TEXT,
         soc_code      TEXT,
         soc_title     TEXT,
         attorney_name TEXT,
         attorney_slug TEXT,
         wage          REAL,
         naics         TEXT,
         worksite_city TEXT,
         citizenship   TEXT,
         birth_country TEXT,
         visa_class    TEXT,
         education     TEXT,
         major         TEXT,
         institution   TEXT,
         job_education TEXT
       )""",
    # An employer page lists its own cases, newest first: one equality and
    # the ordering column last, so the index supplies the order.
    "CREATE INDEX IF NOT EXISTS idx_pch_emp_dec ON perm_cases_history(employer_slug, decision_date)",
    """CREATE TABLE IF NOT EXISTS perm_country_years (
         country   TEXT NOT NULL,
         fy        INTEGER NOT NULL,
         certified INTEGER NOT NULL,
         denied    INTEGER NOT NULL,
         withdrawn INTEGER NOT NULL,
         PRIMARY KEY (country, fy)
       )""",
    """CREATE TABLE IF NOT EXISTS perm_history_facets (
         kind  TEXT NOT NULL,
         slug  TEXT NOT NULL,
         facet TEXT NOT NULL,
         pos   INTEGER NOT NULL,
         key   TEXT NOT NULL,
         label TEXT NOT NULL,
         n     INTEGER NOT NULL,
         PRIMARY KEY (kind, slug, facet, pos)
       )""",
]

# The master case search reads history under the same leads as perm_cases.
# Built AFTER the rows (one pass each rather than maintained per insert), and
# every reader must work without them: they are the first thing to drop if the
# write budget cannot hold them.
SEARCH_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_pch_dec ON perm_cases_history(decision_date)",
    "CREATE INDEX IF NOT EXISTS idx_pch_state_dec ON perm_cases_history(state, decision_date)",
    "CREATE INDEX IF NOT EXISTS idx_pch_socg_dec ON perm_cases_history(substr(soc_code, 1, 7), decision_date)",
    "CREATE INDEX IF NOT EXISTS idx_pch_att_dec ON perm_cases_history(attorney_slug, decision_date)",
    "CREATE INDEX IF NOT EXISTS idx_pch_cit_dec ON perm_cases_history(citizenship, decision_date)",
]


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def history_files(html: str, first: int, last: int) -> list[tuple[str, str, int]]:
    """(name, url, fiscal year) for every PERM workbook DOL links in range, newest first.

    Pure, so it can be tested against the page's real names. A year DOL
    publishes as two workbooks keeps both; the rows are de-duplicated by case
    number when read.
    """
    found: dict[str, tuple[str, int]] = {}
    for href in re.findall(r'href="([^"]+)"', html):
        href = href.replace("&amp;", "&")
        name = href.rsplit("/", 1)[-1]
        if not re.match(r"^PERM_[^/]*\.xlsx$", name, re.I) or re.search(r"layout", name, re.I):
            continue
        fy = ipd.file_fiscal_year(name)
        if not first <= fy <= last:
            continue
        url = href if href.startswith("http") else f"https://www.dol.gov{href}"
        found[name] = (url, fy)
    return sorted(((n, u, fy) for n, (u, fy) in found.items()),
                  key=lambda t: (t[2], t[0]), reverse=True)


# ---------------------------------------------------------------------------
# Reading a workbook
# ---------------------------------------------------------------------------

def first_sheet(z: zipfile.ZipFile) -> str:
    """The path of the workbook's first sheet, read from the workbook itself.

    `xl/worksheets/sheet1.xml` is only a convention. An older export can put
    the first tab under another number, and reading the wrong one is a
    silently empty year.
    """
    rel_ns = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    try:
        with z.open("xl/workbook.xml") as f:
            for _, el in iterparse(f, events=("end",)):
                if el.tag == NS + "sheet":
                    rid = el.get(rel_ns + "id")
                    break
            else:
                rid = None
        if rid:
            with z.open("xl/_rels/workbook.xml.rels") as f:
                for _, el in iterparse(f, events=("end",)):
                    if el.get("Id") == rid:
                        target = el.get("Target", "").lstrip("/")
                        return target if target.startswith("xl/") else f"xl/{target}"
    except KeyError:
        pass
    return "xl/worksheets/sheet1.xml"


def iter_rows(path: str):
    """Each row of the first sheet as {column index: text}, header first."""
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        with z.open("xl/sharedStrings.xml") as f:
            for _, el in iterparse(f, events=("end",)):
                if el.tag == NS + "si":
                    shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
                    el.clear()
    with z.open(first_sheet(z)) as f:
        for _, el in iterparse(f, events=("end",)):
            if el.tag != NS + "row":
                continue
            cells: dict[int, str] = {}
            for c in el.findall(NS + "c"):
                ci = ipd.col_index(c.get("r", "A1"))
                if c.get("t") == "inlineStr":
                    val = "".join(t.text or "" for t in c.iter(NS + "t"))
                else:
                    v = c.find(NS + "v")
                    if v is None or v.text is None:
                        val = ""
                    elif c.get("t") == "s":
                        i = int(v.text)
                        val = shared[i] if i < len(shared) else ""
                    else:
                        val = v.text
                cells[ci] = val
            el.clear()
            yield cells


def header_name(v: str) -> str:
    """FY2009's workbook writes "CASE STATUS" where every other year writes
    CASE_STATUS; one spelling for both."""
    return re.sub(r"\s+", "_", v.strip().upper())


def resolve(header_cells: dict[int, str]) -> dict[int, str]:
    header = {header_name(v): k for k, v in header_cells.items() if v}
    colmap: dict[int, str] = {}
    for field, names in CANDIDATES.items():
        for name in names:
            if name in header:
                colmap[header[name]] = field
                break
    return colmap


def clean(s: str | None, n: int) -> str:
    return " ".join((s or "").split())[:n]


def parse_workbook(path: str, seen: set[str]) -> dict:
    """One workbook -> counts per (employer key, fiscal year) and case rows.

    Returns {counts, countries, rows, resolved, sheetRows, kept}. `rows`
    holds only decisions from ROWS_FROM_FY on; older years are counted, by
    employer and by country of citizenship.
    """
    counts: dict[tuple[str, int], list[int]] = defaultdict(lambda: [0, 0, 0])
    countries: dict[tuple[str, int], list[int]] = defaultdict(lambda: [0, 0, 0])
    rows: list[dict] = []
    colmap: dict[int, str] = {}
    sheet_rows = kept = 0
    for cells in iter_rows(path):
        sheet_rows += 1
        if sheet_rows == 1:
            colmap = resolve(cells)
            got = set(colmap.values())
            missing = [f for f in REQUIRED if f not in got]
            if missing:
                raise ValueError(f"{os.path.basename(path)} resolves none of {missing}. "
                                 f"Header was: {sorted(v for v in cells.values() if v)[:40]}")
            absent = sorted(f for f in CANDIDATES if f not in got)
            log(f"    resolved {sorted(got)}" + (f"; absent {absent}" if absent else ""))
            continue
        rec = {colmap[ci]: v for ci, v in cells.items() if ci in colmap}
        case_no = (rec.get("case") or "").strip()
        outcome = ipd.norm_status(rec.get("status") or "")
        decided = ipd.to_iso(rec.get("decision") or "")
        if not case_no or not outcome or not decided or case_no in seen:
            continue
        fy = int(ipd.fiscal_year(decided))
        if not FIRST_FY <= fy <= LAST_FY:
            continue
        seen.add(case_no)
        kept += 1
        employer = clean(rec.get("employer"), 80)
        key = entity_key(employer) if employer else ""
        slot = {"certified": 0, "denied": 1, "withdrawn": 2}[outcome]
        counts[(key, fy)][slot] += 1
        worker = ipd.worker_fields(rec)
        citizenship = worker["citizenship"] or ""
        if citizenship:
            countries[(citizenship, fy)][slot] += 1
        if fy < ROWS_FROM_FY:
            continue

        received = ipd.to_iso(rec.get("received") or "")
        days = None
        if received:
            d = (date.fromisoformat(decided) - date.fromisoformat(received)).days
            days = d if 0 <= d <= ipd.MAX_PLAUSIBLE_DAYS else None
        raw_state = (rec.get("state") or "").strip().upper()
        state = raw_state if raw_state in ipd.US_STATES else ipd.STATE_NAMES.get(raw_state, "")
        attorney = clean(rec.get("attorney"), 80)
        if attorney.lower() in ("n/a", "na", "none"):
            attorney = ""
        rows.append({
            "caseNumber": case_no, "status": outcome, "receivedDate": received,
            "decisionDate": decided, "days": days, "fiscalYear": str(fy),
            "employerName": employer, "state": state or None,
            "jobTitle": clean(rec.get("job_title"), 80) or None,
            "socCode": (rec.get("soc_code") or "").strip()[:10] or None,
            "socTitle": clean(rec.get("soc_title"), 80) or None,
            "attorneyName": attorney, "wage": ipd.annual_wage(rec.get("wage") or "",
                                                               rec.get("wage_unit") or ""),
            "naics": normalize_naics(rec.get("naics")),
            "worksiteCity": clean(rec.get("worksite_city"), 60) or None,
            **worker,
        })
    return {"counts": counts, "countries": countries, "rows": rows,
            "resolved": sorted(set(colmap.values())),
            "sheetRows": sheet_rows - 1, "kept": kept}


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def _rows(res) -> list[list]:
    return res["response"]["result"]["rows"]


def _cell(c):
    return None if c["type"] == "null" else c["value"]


def slug_maps(db) -> tuple[dict[str, str], dict[str, str]]:
    """entity_key -> slug for today's employer and law-firm pages."""
    emp: dict[str, str] = {}
    att: dict[str, str] = {}
    res = db.execute("SELECT kind, merge_key, slug FROM perm_entities "
                     "WHERE kind IN ('employer','attorney') AND merge_key IS NOT NULL")
    for r in _rows(res):
        kind, key, slug = (_cell(c) for c in r)
        (emp if kind == "employer" else att).setdefault(key, slug)
    return emp, att


def fold_counts(counts: dict, emp: dict[str, str]) -> tuple[dict[tuple[str, int], list[int]], dict]:
    """Counts by entity key -> counts by page slug, and how much of the year matched."""
    out: dict[tuple[str, int], list[int]] = defaultdict(lambda: [0, 0, 0])
    total = matched = 0
    for (key, fy), c in counts.items():
        n = sum(c)
        total += n
        slug = emp.get(key) if key else None
        if not slug:
            continue
        matched += n
        acc = out[(slug, fy)]
        for i in range(3):
            acc[i] += c[i]
    return out, {"cases": total, "matched": matched,
                 "matchedShare": round(matched / total, 4) if total else 0.0}


def write_years(db, folded: dict[tuple[str, int], list[int]], fys: list[int],
                delete_missing: bool = False) -> int:
    """Diff against the stored rows for these years and write what moved."""
    if not fys:
        return 0
    have: dict[tuple[str, int], tuple[int, int, int]] = {}
    marks = ",".join("?" * len(fys))
    res = db.execute(f"SELECT slug, fy, certified, denied, withdrawn FROM perm_employer_years "
                     f"WHERE fy IN ({marks})", list(fys))
    for r in _rows(res):
        s, fy, c, d, w = (_cell(x) for x in r)
        have[(s, int(fy))] = (int(c), int(d), int(w))
    changed = [(s, fy, *c) for (s, fy), c in folded.items() if have.get((s, fy)) != tuple(c)]
    stmts = []
    for i in range(0, len(changed), 400):
        chunk = changed[i:i + 400]
        stmts.append({"type": "execute", "stmt": {
            "sql": "INSERT OR REPLACE INTO perm_employer_years (slug, fy, certified, denied, withdrawn) VALUES "
                   + ",".join(["(?,?,?,?,?)"] * len(chunk)),
            "args": [lit(v) for row in chunk for v in row]}})
    if delete_missing:
        gone = [k for k in have if k not in folded]
        for i in range(0, len(gone), 200):
            chunk = gone[i:i + 200]
            stmts.append({"type": "execute", "stmt": {
                "sql": "DELETE FROM perm_employer_years WHERE " + " OR ".join(["(slug = ? AND fy = ?)"] * len(chunk)),
                "args": [lit(v) for k in chunk for v in k]}})
    for i in range(0, len(stmts), 4):
        db.pipeline(stmts[i:i + 4] + [{"type": "close"}])
    return len(changed)


def _canon(v) -> str:
    if v is None or v == "":
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return str(int(f)) if f == int(f) else repr(f)


def employer_slug_for(name: str | None, emp: dict[str, str]) -> str:
    """The employer's page slug when it has one, else its own name slugified.

    The case search finds an employer by slug PREFIX, so a row with no slug
    was unreachable by name: 241,817 of 867,646 history rows (28%) on Sep 27
    2026, among them 505 filed as ADOBE SYSTEMS INCORPORATED, Adobe's name
    before 2018. The fallback is perm_live_recent's rule. It is not a page:
    the facet and group builders check a slug against the employer pages
    before they use it.
    """
    if not name:
        return ""
    return emp.get(entity_key(name)) or slugify(name)


def row_tuple(r: dict, emp: dict[str, str], att: dict[str, str]) -> tuple:
    e, a = r["employerName"], r["attorneyName"]
    return (r["caseNumber"], r["status"], r["receivedDate"], r["decisionDate"], r["days"],
            r["fiscalYear"], e or None, employer_slug_for(e, emp),
            r["state"], r["jobTitle"], r["socCode"], r["socTitle"], a or None,
            att.get(entity_key(a), "") if a else "", r["wage"], r["naics"], r["worksiteCity"],
            r.get("citizenship"), r.get("birthCountry"), r.get("visaClass"), r.get("education"),
            r.get("major"), r.get("institution"), r.get("jobEducation"))


def fingerprint(t: tuple) -> str:
    """The core record: whether a stored row is this case as DOL published it."""
    return hashlib.blake2b("\x1f".join(_canon(v) for v in t[1:CORE]).encode(), digest_size=8).hexdigest()


def extras_of(t: tuple) -> tuple[str, ...]:
    return tuple(_canon(v) for v in t[CORE:])


def ensure_columns(db) -> list[str]:
    """A table made before the worker's fields existed gains them in place."""
    have = {_cell(r[1]) for r in _rows(db.execute("PRAGMA table_info(perm_cases_history)"))}
    added = [c for c in EXTRA if c not in have]
    for c in added:
        db.execute(f"ALTER TABLE perm_cases_history ADD COLUMN {c} TEXT")
    return added


def stored_fingerprints(db, fy: int) -> dict[str, tuple[str, tuple[str, ...]]]:
    out: dict[str, tuple[str, tuple[str, ...]]] = {}
    after = ""
    while True:
        res = db.execute(f"SELECT {','.join(COLUMNS)} FROM perm_cases_history "
                         "WHERE case_number > ? AND fiscal_year = ? ORDER BY case_number LIMIT 20000",
                         [after, str(fy)])
        rs = _rows(res)
        for r in rs:
            t = tuple(_cell(c) for c in r)
            out[str(t[0])] = (fingerprint(t), extras_of(t))
        if len(rs) < 20000:
            return out
        after = str(_cell(rs[-1][0]))


def narrow_update(rows: list[tuple]) -> dict:
    """One UPDATE setting only the EXTRA columns, a CASE arm per row.

    A row whose core record is unchanged costs one row write this way, where
    an INSERT OR REPLACE deletes and reinserts it and every index entry.
    """
    sets, args = [], []
    for i, col in enumerate(EXTRA):
        arms = " ".join("WHEN ? THEN ?" for _ in rows)
        sets.append(f"{col} = CASE case_number {arms} ELSE {col} END")
        for r in rows:
            args += [lit(r[0]), lit(r[CORE + i])]
    args += [lit(r[0]) for r in rows]
    return {"sql": f"UPDATE perm_cases_history SET {', '.join(sets)} "
                   f"WHERE case_number IN ({','.join('?' * len(rows))})",
            "args": args}


def write_cases(db, rows: list[dict], emp, att) -> int:
    """New or changed rows whole (400 per statement); rows whose only change is
    the worker's fields by a narrow UPDATE (60 per statement)."""
    by_fy: dict[int, list[tuple]] = defaultdict(list)
    for r in rows:
        by_fy[int(r["fiscalYear"])].append(row_tuple(r, emp, att))
    written = 0
    head = f"INSERT OR REPLACE INTO perm_cases_history ({','.join(COLUMNS)}) VALUES "
    mark = "(" + ",".join("?" * len(COLUMNS)) + ")"
    for fy, tuples in by_fy.items():
        have = stored_fingerprints(db, fy)
        whole, narrow = [], []
        for t in tuples:
            stored = have.get(str(t[0]))
            if stored is None or stored[0] != fingerprint(t):
                whole.append(t)
            elif stored[1] != extras_of(t):
                narrow.append(t)
        stmts = []
        for i in range(0, len(whole), 400):
            chunk = whole[i:i + 400]
            stmts.append({"type": "execute", "stmt": {
                "sql": head + ",".join([mark] * len(chunk)),
                "args": [lit(v) for t in chunk for v in t]}})
        for i in range(0, len(narrow), 60):
            stmts.append({"type": "execute", "stmt": narrow_update(narrow[i:i + 60])})
        for i in range(0, len(stmts), 4):
            db.pipeline(stmts[i:i + 4] + [{"type": "close"}])
        written += len(whole) + len(narrow)
        log(f"    FY{fy}: {len(tuples):,} case rows, {len(whole):,} written whole, "
            f"{len(narrow):,} given the worker's fields only")
    return written


def write_country_years(db, countries: dict[tuple[str, int], list[int]], fys: list[int]) -> int:
    """Decisions by country of citizenship and year, national, diffed."""
    if not fys:
        return 0
    marks = ",".join("?" * len(fys))
    have = {(_cell(r[0]), int(_cell(r[1]))): tuple(int(_cell(x)) for x in r[2:])
            for r in _rows(db.execute(
                f"SELECT country, fy, certified, denied, withdrawn FROM perm_country_years "
                f"WHERE fy IN ({marks})", list(fys)))}
    changed = [(c, fy, *v) for (c, fy), v in countries.items() if have.get((c, fy)) != tuple(v)]
    stmts = []
    for i in range(0, len(changed), 400):
        chunk = changed[i:i + 400]
        stmts.append({"type": "execute", "stmt": {
            "sql": "INSERT OR REPLACE INTO perm_country_years (country, fy, certified, denied, withdrawn) VALUES "
                   + ",".join(["(?,?,?,?,?)"] * len(chunk)),
            "args": [lit(v) for row in chunk for v in row]}})
    for i in range(0, len(stmts), 4):
        db.pipeline(stmts[i:i + 4] + [{"type": "close"}])
    return len(changed)


FACETS = ("citizenship", "education", "visa_class", "institution", "major")
FACET_FLOOR = 10  # history cases an entity needs before its breakdowns are written
FACET_TOP = 6


def display(facet: str, value: str) -> str:
    """Countries print in upper case in DOL's file; the page reads them in title case."""
    if facet in ("citizenship",):
        return " ".join(w.capitalize() if w.isalpha() else w for w in value.lower().split())
    return value


def employer_page_slugs(db) -> set[str]:
    """Every slug an employer page answers to: the published entities and the
    live-only employers. A history row's fallback slug is neither."""
    out = {str(_cell(r[0])) for r in _rows(db.execute(
        "SELECT slug FROM perm_entities WHERE kind = 'employer'"))}
    try:
        out |= {str(_cell(r[0])) for r in _rows(db.execute("SELECT slug FROM perm_live_only_index"))}
    except Exception:  # noqa: BLE001 - a database without the live table
        pass
    return out


def build_history_facets(db, occ_slug_by_code: dict[str, str]) -> int:
    """perm_history_facets: each employer's and occupation's top values per worker field.

    Grouped in SQL (one read of the table per facet), ranked here, written
    whole: the table is small and rebuilt only when the history is.
    """
    out: list[tuple] = []
    pages = employer_page_slugs(db)
    for kind, key_col in (("employer", "employer_slug"), ("occupation", "soc_code")):
        totals = {str(_cell(r[0])): int(_cell(r[1])) for r in _rows(db.execute(
            f"SELECT {key_col}, COUNT(*) FROM perm_cases_history WHERE {key_col} IS NOT NULL "
            f"AND {key_col} != '' GROUP BY {key_col}"))}
        for facet in FACETS:
            groups: dict[str, dict[str, int]] = defaultdict(dict)
            for r in _rows(db.execute(
                    f"SELECT {key_col}, {facet}, COUNT(*) FROM perm_cases_history "
                    f"WHERE {key_col} IS NOT NULL AND {key_col} != '' AND {facet} IS NOT NULL "
                    f"AND {facet} != '' GROUP BY {key_col}, {facet}")):
                k, v, n = str(_cell(r[0])), str(_cell(r[1])), int(_cell(r[2]))
                slug = (k if k in pages else None) if kind == "employer" else occ_slug_by_code.get(k)
                if not slug or totals.get(k, 0) < FACET_FLOOR:
                    continue
                groups[slug][v] = groups[slug].get(v, 0) + n
            for slug, values in groups.items():
                ranked = sorted(values.items(), key=lambda kv: (-kv[1], kv[0]))[:FACET_TOP]
                for pos, (v, n) in enumerate(ranked):
                    out.append((kind, slug, facet, pos, v, display(facet, v), n))
    db.execute("DELETE FROM perm_history_facets")
    stmts = []
    for i in range(0, len(out), 400):
        chunk = out[i:i + 400]
        stmts.append({"type": "execute", "stmt": {
            "sql": "INSERT OR REPLACE INTO perm_history_facets (kind, slug, facet, pos, key, label, n) VALUES "
                   + ",".join(["(?,?,?,?,?,?,?)"] * len(chunk)),
            "args": [lit(v) for row in chunk for v in row]}})
    for i in range(0, len(stmts), 4):
        db.pipeline(stmts[i:i + 4] + [{"type": "close"}])
    log(f"  history facets: {len(out):,} rows")
    return len(out)


def occupation_slugs(db) -> dict[str, str]:
    return {str(_cell(r[0])): str(_cell(r[1])) for r in _rows(db.execute(
        "SELECT code, slug FROM perm_entities WHERE kind = 'occupation' AND code IS NOT NULL"))}


def fill_slugs(db) -> int:
    """One pass over the rows written before the fallback existed: an UPDATE of
    the slug alone, 200 rows per statement, keyed on the primary key."""
    after, n = "", 0
    while True:
        rs = _rows(db.execute(
            "SELECT case_number, employer_name FROM perm_cases_history "
            "WHERE (employer_slug IS NULL OR employer_slug = '') AND employer_name IS NOT NULL "
            "AND employer_name != '' AND case_number > ? ORDER BY case_number LIMIT 5000", [after]))
        if not rs:
            break
        pairs = [(str(_cell(r[0])), slugify(str(_cell(r[1])))) for r in rs]
        pairs = [(c, s) for c, s in pairs if s]
        stmts = []
        for i in range(0, len(pairs), 200):
            chunk = pairs[i:i + 200]
            arms = " ".join("WHEN ? THEN ?" for _ in chunk)
            args = [lit(v) for c, s in chunk for v in (c, s)] + [lit(c) for c, _ in chunk]
            stmts.append({"type": "execute", "stmt": {
                "sql": f"UPDATE perm_cases_history SET employer_slug = CASE case_number {arms} "
                       f"ELSE employer_slug END WHERE case_number IN ({','.join('?' * len(chunk))})",
                "args": args}})
        for i in range(0, len(stmts), 5):
            db.pipeline(stmts[i:i + 5] + [{"type": "close"}])
        n += len(pairs)
        after = str(_cell(rs[-1][0]))
        log(f"  slugs filled: {n:,}")
    return n


def build_search_indexes(db) -> None:
    t = time.time()
    for stmt in SEARCH_INDEXES:
        db.execute(stmt)
    log(f"  search indexes ({len(SEARCH_INDEXES)}) in {time.time() - t:,.0f}s")


def read_doc(db) -> dict:
    try:
        raw = db.scalar("SELECT json FROM perm_docs WHERE key = ?", [DOC_KEY])
        return json.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001 - a database without perm_docs yet
        return {}


def write_doc(db, doc: dict) -> None:
    db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
               [DOC_KEY, json.dumps(doc, separators=(",", ":")), int(time.time() * 1000)])


def write_current_years(db) -> int:
    """FY2024 onward of perm_employer_years, from perm_cases.

    perm_cases already carries each case's employer slug and fiscal year, so
    this is one grouped read; the quarterly ingest runs it after each load so
    the series never stops at the history's last year.
    """
    res = db.execute("SELECT employer_slug, fiscal_year, status, COUNT(*) FROM perm_cases "
                     "WHERE employer_slug != '' GROUP BY employer_slug, fiscal_year, status")
    folded: dict[tuple[str, int], list[int]] = defaultdict(lambda: [0, 0, 0])
    fys: set[int] = set()
    for r in _rows(res):
        slug, fy, status, n = (_cell(c) for c in r)
        if not fy or status not in ("certified", "denied", "withdrawn"):
            continue
        fy = int(fy)
        fys.add(fy)
        folded[(slug, fy)][{"certified": 0, "denied": 1, "withdrawn": 2}[status]] += int(n)
    # Every year this table holds past the history's end, not just the years
    # perm_cases still has: a year whose last case left must be cleared too.
    held = {int(_cell(r[0])) for r in _rows(db.execute(
        "SELECT DISTINCT fy FROM perm_employer_years WHERE fy > ?", [LAST_FY]))}
    fys = sorted(f for f in fys | held if f > LAST_FY)
    folded = {k: v for k, v in folded.items() if k[1] > LAST_FY}
    n = write_years(db, folded, fys, delete_missing=True)
    log(f"  current years {fys}: {len(folded):,} employer-years, {n:,} written")
    return n


# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--from-fy", type=int, default=FIRST_FY)
    ap.add_argument("--to-fy", type=int, default=LAST_FY)
    ap.add_argument("--local", nargs="*", help="read these workbooks instead of DOL's")
    ap.add_argument("--force", action="store_true", help="reload files already recorded")
    ap.add_argument("--dry-run", action="store_true", help="parse and report; write nothing")
    ap.add_argument("--current", action="store_true", help="only FY2024 onward, from perm_cases")
    ap.add_argument("--no-indexes", action="store_true",
                    help="skip the search indexes (the write budget's first saving)")
    ap.add_argument("--fill-slugs", action="store_true",
                    help="give every history row without an employer slug its name's slug, then stop")
    ap.add_argument("--finish-only", action="store_true",
                    help="no workbooks: current years, search indexes and facets only")
    args = ap.parse_args()

    if args.fill_slugs:
        db = Turso()
        n = fill_slugs(db)
        record_run(db, "ingest_perm_history.py --fill-slugs", status="ok", rows_written=n,
                   note="employer slugs for rows no page matched")
        return 0

    if args.finish_only:
        db = Turso()
        db.script(SCHEMA)
        ensure_columns(db)
        n = write_current_years(db)
        if not args.no_indexes:
            build_search_indexes(db)
        n += build_history_facets(db, occupation_slugs(db))
        record_run(db, "ingest_perm_history.py --finish-only", status="ok", rows_written=n,
                   note="current years, search indexes and history facets")
        return 0

    if args.current:
        db = Turso()
        db.script(SCHEMA)
        n = write_current_years(db)
        record_run(db, "ingest_perm_history.py --current", status="ok", rows_written=n,
                   note="FY2024 onward of perm_employer_years from perm_cases")
        return 0

    if args.local:
        files = [(os.path.basename(p), p, ipd.file_fiscal_year(os.path.basename(p))) for p in args.local]
    else:
        html = ipd.fetch(ipd.PERFORMANCE_PAGE).decode("utf-8", "replace")
        files = history_files(html, args.from_fy, args.to_fy)
        if not files:
            raise SystemExit("FATAL: no PERM workbooks in range on DOL's performance page")
    log(f"  {len(files)} workbook(s): " + ", ".join(f"FY{fy} {n}" for n, _, fy in files))

    db = None if args.dry_run else Turso()
    if db:
        db.script(SCHEMA)
        added = ensure_columns(db)
        if added:
            log(f"  added {added} to perm_cases_history")
    doc = read_doc(db) if db else {}
    loaded = doc.setdefault("files", {})
    emp, att = slug_maps(db) if db else ({}, {})
    seen: set[str] = set()
    failures: list[str] = []
    wrote_years = wrote_cases = 0
    for i, (name, src, fy) in enumerate(files):
        if name in loaded and not args.force and not args.local:
            log(f"  FY{fy} {name}: loaded {loaded[name].get('loadedAt', '')}; skipping")
            continue
        log(f"  FY{fy} {name}")
        tmp = None
        try:
            if args.local:
                path = src
            else:
                if i and PAUSE_BETWEEN_FILES_S:
                    time.sleep(PAUSE_BETWEEN_FILES_S)
                data = ipd.fetch(src, referer=ipd.PERFORMANCE_PAGE)
                tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
                tmp.write(data)
                tmp.close()
                del data
                path = tmp.name
            got = parse_workbook(path, seen)
        except Exception as exc:  # noqa: BLE001 - one year failing must not cost the others
            log(f"    FAILED: {exc}")
            failures.append(f"{name}: {exc}")
            continue
        finally:
            if tmp is not None:
                os.unlink(tmp.name)
        folded, match = fold_counts(got["counts"], emp) if db else ({}, {"cases": got["kept"]})
        by_fy: dict[int, int] = defaultdict(int)
        for (_, y), c in got["counts"].items():
            by_fy[y] += sum(c)
        log(f"    {got['sheetRows']:,} sheet rows, {got['kept']:,} decided cases "
            f"({dict(sorted(by_fy.items()))}), {len(got['rows']):,} case rows"
            + (f", {match['matchedShare']:.1%} matched to an employer page" if db else ""))
        if not db:
            continue
        wrote_years += write_years(db, folded, sorted(by_fy))
        wrote_years += write_country_years(db, got["countries"],
                                           sorted({y for (_, y) in got["countries"]}))
        wrote_cases += write_cases(db, got["rows"], emp, att)
        loaded[name] = {"fy": fy, "cases": got["kept"], "caseRows": len(got["rows"]),
                        "matchedShare": match["matchedShare"], "resolved": got["resolved"],
                        "loadedAt": date.today().isoformat()}
        write_doc(db, doc)

    if db:
        wrote_years += write_current_years(db)
        if not args.no_indexes:
            build_search_indexes(db)
        wrote_years += build_history_facets(db, occupation_slugs(db))
        years = sorted({v["fy"] for v in loaded.values()})
        status = "ok" if not failures else "partial"
        note = (f"FY{years[0]} to FY{years[-1]} held; " if years else "") + (
            f"failed: {'; '.join(failures)[:300]}" if failures else "all requested files loaded")
        record_run(db, "ingest_perm_history.py", status=status,
                   rows_written=wrote_years + wrote_cases, note=note)
        log(f"  wrote {wrote_years:,} employer-years and {wrote_cases:,} case rows")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
