#!/usr/bin/env python3
"""Ingest USCIS's quarterly I-129 "Request for Evidence" files.

USCIS posts, with each quarter's performance data, one file per form I-129
visa classification: petitions received, initially approved, initially
denied, total completions, and how many of those completions had a request
for evidence (an RFE), and how many of those were approved. It's the only
published RFE count USCIS keeps, and it covers the work visas on the I-129
alone: H-1B, H-2A, H-2B, Blanket L, L-1A, L-1B, O, P, R-1 and TN. Nothing
like it exists for the I-140 or the I-485.

    table  uscis_i129_rfe (fy, month, visa) -> the month's counts
    doc    perm_docs['uscis_rfe_summary']  -> newest quarter, per-FY totals
    fresh  data_freshness['uscis-rfe']     -> as of the quarter's last day

WHY THE FILES ARE READ THE WAY THEY ARE:

* DISCOVERED, NEVER CONSTRUCTED. The files sit under `/document/data/` and
  `/document/reports/`, in three formats over the years (spreadsheet from
  FY2023 Q4, CSV and PDF before that), and their names drift in case and
  shape. They're found on the immigration-and-citizenship data page.
* A FILE'S NAME DOESN'T SAY WHERE IT STARTS. `fy2016_fy2023_q4` begins with
  FY2017 and `FY2015_FY2021_Q4` with FY2016. The fiscal years come from the
  rows themselves (the year printed on each October) and the date range
  under the title, and the range must end on the quarter the name gives.
* THE NEWEST FILE WINS, PER FISCAL YEAR. USCIS revises earlier months in
  later files (the FY2016 H-1B total moved by 74 completions between two
  editions), so each fiscal year is read from the newest file that covers it
  and its rows replace any older file's. A fiscal year already held from a
  newer file is never overwritten by an older one.
* SHARES ARE COMPUTED, NEVER READ. Every edition's footnote defines "Approved
  with RFE (%)" over the completions that had an RFE; the CSV and PDF editions
  print it that way, and the spreadsheets print it over ALL completions
  (FY2026 October: 2,739 approved of 3,185 with an RFE, printed as 0.083, which
  is 2,739 of 33,105). Counts are stored; the page computes every share from
  them. The one share column checked against the counts is "Completions with
  RFE (%)", which means the same in every edition.
* WHAT ISN'T READ. The spreadsheets' table of L-1 petitions not yet assigned
  to L-1A or L-1B is left out by name (`LEFT_OUT`, with the reason). With
  --history, an older edition is opened only as far as the date range under
  its title when every year in that range came from a newer file, so a stale
  edition that doesn't add up, or a later PDF whose text layer splits its
  figures apart, can't stop a load it gives nothing to.
* THE FILE'S OWN TOTALS ARE THE RECONCILIATION. Each table carries a TOTAL
  row (and the multi-year editions a total per fiscal year). Before a row is
  written: approved plus denied equals completions on every row, the months
  sum to every total, every printed RFE share is within 0.0015 of the count's
  own, the months run without a gap from October to the quarter's end, and
  every table is a visa we know. A file that fails any of these is refused
  and nothing is written.
* PARSED MUST EQUAL STORED, counted back after each fiscal year's write.

www.uscis.gov 403s GitHub's datacenter runners, so the server's timer is the
only runner (scripts/oracle/bin/permtracker-uscis quarterly, after the
quarterly performance workbooks); no workflow runs it.

Usage:
    python3 scripts/ingest_uscis_rfe.py                 # the newest file only
    python3 scripts/ingest_uscis_rfe.py --history       # every fiscal year USCIS lists
    python3 scripts/ingest_uscis_rfe.py --dry-run       # parse and reconcile, write nothing
    python3 scripts/ingest_uscis_rfe.py --file A --file B   # parse local copies instead
    python3 scripts/ingest_uscis_rfe.py --force         # rewrite years already held from the same file
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import pathlib
import re
import sys
import time
import zipfile
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import (  # noqa: E402
    POLITE_PAUSE_S, fetch, iter_rows, log, quarter_end, read_shared_strings,
)
from lib_db import (  # noqa: E402
    Database, add_missing_columns, insert_rows, query_rows, record_run, stamp_freshness, write_doc,
)

DATA_PAGE = ("https://www.uscis.gov/tools/reports-and-studies/"
             "immigration-and-citizenship-data?items_per_page=100")
HOST = "https://www.uscis.gov"
MAX_PAGES = 10

TABLE = "uscis_i129_rfe"
SUMMARY_DOC = "uscis_rfe_summary"
DATASET = "uscis-rfe"
SOURCE = "USCIS quarterly I-129 requests for evidence (uscis.gov)"
# The as-of is the quarter's last day and USCIS posts a quarter about 80 to
# 90 days after it ends, so the newest as-of is about 175 days old when the
# next file lands; 200 days means the next quarter is late. The same budget
# as the quarterly performance workbooks, which arrive with it.
MAX_AGE_DAYS = 200
SHARE_TOLERANCE = 0.0015

# `i129_quarterly_request_for_evidence_fy2026_q3_v1.xlsx`,
# `i129_quarterly_request_for_evidence_fy2017_fy2024_q4.xlsx`,
# `I129_Quarterly_Request_for_Evidence_FY2015_FY2021_Q4.pdf`.
NAME_RE = re.compile(
    r"^i129_quarterly_request_for_evidence_fy(\d{4})(?:_fy(\d{4}))?_q([1-4])(?:_v(\d+))?"
    r"\.(xlsx|csv|pdf)$", re.I)
FORMAT_RANK = {"pdf": 1, "csv": 2, "xlsx": 3}

MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}
FY_ORDER = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]
RANGE_RE = re.compile(r"([A-Z][a-z]+) (\d{1,2}), (\d{4})\s*-\s*([A-Z][a-z]+) (\d{1,2}), (\d{4})")

# Visa keys, matched against a table's title in this order: the PDFs print
# L-1A and L-1B as one table, and the spreadsheets carry a separate table of
# L-1 petitions not yet assigned to either, so those two come first.
VISAS: list[tuple[str, str, re.Pattern[str]]] = [
    ("l1", "L-1A and L-1B", re.compile(r"\(L-1A\).*\(L-1B\)", re.S)),
    ("l1_unassigned", "L-1, not yet L-1A or L-1B", re.compile(r"Not Assigned L-1A or L-1B", re.I)),
    ("l1_blanket", "Blanket L", re.compile(r"Blanket L\b", re.I)),
    ("l1a", "L-1A", re.compile(r"\(L-1A\)")),
    ("l1b", "L-1B", re.compile(r"\(L-1B\)")),
    ("h1b", "H-1B", re.compile(r"\(H-1B\)")),
    ("h2a", "H-2A", re.compile(r"\(H-2A\)")),
    ("h2b", "H-2B", re.compile(r"\(H-2B\)")),
    ("o", "O-1 and O-2", re.compile(r"\(O\)")),
    ("p", "P", re.compile(r"\(P\)")),
    ("r1", "R-1", re.compile(r"\(R-1\)")),
    ("tn", "TN", re.compile(r"\(TN\)")),
]
VISA_LABELS = {k: label for k, label, _ in VISAS}
# Read and left out, by name. The spreadsheets' "L-1, Not Assigned L-1A or
# L-1B" table is petitions USCIS hadn't yet sorted into either class: 186 in
# eight years. It isn't a classification anyone files under, and in the
# FY2017-FY2024 edition its own received column doesn't add up to its totals
# (FY2020's months sum to 6 where the total says 0). Every other table in
# that file reconciles exactly, so this one is dropped rather than letting it
# refuse the only file that holds FY2024.
LEFT_OUT = {"l1_unassigned"}

COUNTS = ("received", "approved", "denied", "completions", "rfe_completions", "rfe_approved")
# Header text, footnote digits stripped -> field. "Completions with RFE" must
# not swallow "Completions with RFE (%)", so each pattern is anchored.
HEADERS: dict[str, re.Pattern[str]] = {
    "received": re.compile(r"^Petitions Received$", re.I),
    "approved": re.compile(r"^Initially Approved$", re.I),
    "denied": re.compile(r"^Initially Denied$", re.I),
    "completions": re.compile(r"^Total Completions$", re.I),
    "pending": re.compile(r"^Pending$", re.I),
    "rfe_completions": re.compile(r"^Completions with RFE$", re.I),
    "rfe_share": re.compile(r"^Completions with RFE \(%\)$", re.I),
    "rfe_approved": re.compile(r"^Approved with RFE$", re.I),
}
REQUIRED = ("received", "approved", "denied", "completions", "rfe_completions", "rfe_share", "rfe_approved")
# The PDFs' column headings, footnote digits stripped, in the two layouts USCIS
# has printed: the older one on two lines (this is its second), the later one
# on one. Nine numbers a row in this order either way; a PDF printing anything
# else is refused rather than guessed at.
PDF_HEADERS = {
    "Fiscal Year Month Received Approved Denied Completions (%) with RFE RFE (%) with RFE (%)",
    "Fiscal Year Month Petitions Received Initially Approved Initially Denied Total Completions "
    "Approved (%) Completions with RFE Completions with RFE (%) Approved with RFE Approved with RFE (%)",
}
PDF_FIELDS = ("received", "approved", "denied", "completions", None,
              "rfe_completions", "rfe_share", "rfe_approved", None)

BLANK = {"", "This cell left intentionally blank"}


class Refusal(SystemExit):
    """A file that does not reconcile. Nothing is written; the run fails."""


@dataclass
class Listed:
    name: str
    url: str
    fmt: str
    named_first: int
    last_fy: int
    quarter: int
    version: int

    @property
    def rank(self) -> tuple[int, int, int, int]:
        return (self.last_fy, self.quarter, self.version, FORMAT_RANK[self.fmt])

    @property
    def end(self) -> str:
        return quarter_end(self.last_fy, self.quarter)


@dataclass
class Table:
    visa: str
    start: str
    end: str
    months: list[dict] = field(default_factory=list)
    year_totals: dict[int, dict] = field(default_factory=dict)
    grand: dict | None = None
    has_pending: bool = False


@dataclass
class Parsed:
    listed: Listed
    tables: list[Table]

    def fys(self) -> list[int]:
        return sorted({r["fy"] for t in self.tables for r in t.months})

    def rows_for(self, fy: int) -> list[dict]:
        return [dict(r, visa=t.visa) for t in self.tables for r in t.months if r["fy"] == fy]


# ---------------------------------------------------------------------------
# Names and discovery
# ---------------------------------------------------------------------------

def identify(name: str, url: str = "") -> Listed | None:
    m = NAME_RE.match(name)
    if not m:
        return None
    first, second, q, v, fmt = m.groups()
    last = int(second or first)
    return Listed(name=name, url=url or name, fmt=fmt.lower(), named_first=int(first),
                  last_fy=last, quarter=int(q), version=int(v or 0))


def discover(html: str) -> list[Listed]:
    """Every RFE file a listing page links, one per filename."""
    out: dict[str, Listed] = {}
    for href in re.findall(r'href="([^"]+\.(?:xlsx|csv|pdf))"', html, re.I):
        name = href.rsplit("/", 1)[-1]
        url = href if href.startswith("http") else HOST + href
        item = identify(name, url)
        if item and name not in out:
            out[name] = item
    return list(out.values())


def page_url(n: int) -> str:
    return DATA_PAGE if n == 0 else f"{DATA_PAGE}&page={n}"


# ---------------------------------------------------------------------------
# Cells
# ---------------------------------------------------------------------------

def strip_note(text: object) -> str:
    """A heading with its footnote marker taken off: `Initially Denied3` -> `Initially Denied`."""
    s = re.sub(r"\s+", " ", str(text or "")).strip()
    return re.sub(r"\s*\d+$", "", s)


def count(v: object, where: str) -> int | None:
    """A count: `1,234` and `1234` read alike, `-` is zero, blank is None."""
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s in BLANK or s in ("N/A", "n/a", "D"):
        return None
    if s == "-":
        return 0
    try:
        f = float(s)
    except ValueError:
        raise Refusal(f"{where}: expected a count, got {s!r}") from None
    if f != int(f) or f < 0:
        raise Refusal(f"{where}: expected a whole count, got {s!r}")
    return int(f)


def share(v: object, where: str) -> float | None:
    """A share printed as `8.5%` (CSV, PDF) or stored as 0.085 (spreadsheet)."""
    if v is None:
        return None
    s = str(v).strip()
    if s in BLANK or s in ("N/A", "n/a", "-", "D"):
        return None
    pct = s.endswith("%")
    try:
        f = float(s.rstrip("%").replace(",", ""))
    except ValueError:
        raise Refusal(f"{where}: expected a share, got {s!r}") from None
    return f / 100 if pct else f


def range_of(text: str) -> tuple[str, str] | None:
    m = RANGE_RE.search(text)
    if not m:
        return None
    m1, d1, y1, m2, d2, y2 = m.groups()
    if m1 not in MONTHS or m2 not in MONTHS:
        return None
    return (f"{y1}-{MONTHS[m1]:02d}-{int(d1):02d}", f"{y2}-{MONTHS[m2]:02d}-{int(d2):02d}")


def visa_of(title: str) -> str | None:
    for key, _label, rx in VISAS:
        if rx.search(title):
            return key
    return None


# ---------------------------------------------------------------------------
# Spreadsheet and CSV: a block of {column: text} rows per table
# ---------------------------------------------------------------------------

def sheet_paths(z: zipfile.ZipFile) -> list[tuple[str, str]]:
    """(sheet name, part path) in workbook order, through the workbook's own rels."""
    book = z.read("xl/workbook.xml").decode("utf8", "ignore")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf8", "ignore")
    target = {}
    for rel in re.findall(r"<Relationship\b[^>]*>", rels):
        rid = re.search(r'\bId="([^"]+)"', rel)
        tgt = re.search(r'\bTarget="([^"]+)"', rel)
        if rid and tgt:
            t = tgt.group(1).lstrip("/")
            target[rid.group(1)] = t if t.startswith("xl/") else "xl/" + t
    out = []
    for sheet in re.findall(r"<sheet\b[^>]*>", book):
        name = re.search(r'\bname="([^"]+)"', sheet)
        rid = re.search(r'\br:id="([^"]+)"', sheet)
        if name and rid and rid.group(1) in target:
            out.append((name.group(1).replace("&amp;", "&"), target[rid.group(1)]))
    return out


def xlsx_blocks(blob: bytes) -> list[tuple[str, list[dict[int, str]]]]:
    z = zipfile.ZipFile(io.BytesIO(blob))
    shared = read_shared_strings(z)
    return [(name, list(iter_rows(z, path, shared))) for name, path in sheet_paths(z)]


def csv_blocks(blob: bytes) -> list[tuple[str, list[dict[int, str]]]]:
    """The CSV editions stack every table in one file; each starts at its title."""
    text = blob.decode("utf-8-sig", "replace")
    blocks: list[tuple[str, list[dict[int, str]]]] = []
    for row in csv.reader(io.StringIO(text)):
        cells = {i: c.strip() for i, c in enumerate(row) if c.strip() not in BLANK}
        if not cells:
            continue
        if cells.get(0, "").startswith("Form I-129"):
            blocks.append((cells[0], []))
        if blocks:
            blocks[-1][1].append(cells)
    return blocks


def parse_block(name: str, rows: list[dict[int, str]], where: str) -> Table | None:
    """One visa's table, or None for a block that holds no table (the notes)."""
    header_at = next((i for i, r in enumerate(rows) if strip_note(r.get(0)) == "Fiscal Year"), None)
    if header_at is None:
        return None
    title = " ".join(str(r.get(0, "")) for r in rows[:header_at])
    visa = visa_of(title)
    if visa is None:
        raise Refusal(f"{where} {name!r}: a table under a title no visa key matches: {title[:120]!r}")
    span = range_of(title)
    if span is None:
        raise Refusal(f"{where} {name!r}: no date range under the title")
    cols: dict[str, int] = {}
    for i, h in rows[header_at].items():
        text = strip_note(h)
        for fld, rx in HEADERS.items():
            if rx.match(text):
                if fld in cols:
                    raise Refusal(f"{where} {name!r}: two columns read as {fld}")
                cols[fld] = i
    missing = [f for f in REQUIRED if f not in cols]
    if missing:
        raise Refusal(f"{where} {name!r}: no column for {missing}; headings were "
                      f"{[strip_note(h) for h in rows[header_at].values()]}")
    table = Table(visa=visa, start=span[0], end=span[1], has_pending="pending" in cols)
    fy: int | None = None
    for r in rows[header_at + 1:]:
        first = str(r.get(0, "")).strip()
        month = str(r.get(1, "")).strip()
        label = f"{where} {name!r} {first or fy} {month}".strip()

        def values() -> dict:
            out = {f: count(r.get(cols[f]), label) for f in COUNTS}
            out["pending"] = count(r.get(cols["pending"]), label) if "pending" in cols else None
            out["rfe_share"] = share(r.get(cols["rfe_share"]), label)
            return out

        if first.upper() in ("TOTAL", "GRAND TOTAL"):
            table.grand = values()
            continue
        mt = re.match(r"^(\d{4})(?:\.0)? Total$", first)
        if mt:
            table.year_totals[int(mt.group(1))] = values()
            continue
        if month in MONTHS:
            if first:
                my = re.match(r"^(\d{4})(?:\.0)?$", first)
                if not my:
                    raise Refusal(f"{label}: a month row whose year cell reads {first!r}")
                fy = int(my.group(1))
            if fy is None:
                raise Refusal(f"{label}: a month before any fiscal year")
            table.months.append(dict(fy=fy, month=MONTHS[month], **values()))
    return table


# ---------------------------------------------------------------------------
# PDF: text lines, nine numbers a row
# ---------------------------------------------------------------------------

# A month and nine figures. The date range under the title also starts with
# "October", so the rest of the line must be figures.
FIGURE = r"(?:[\d,.]+%?|-|N/A)"
MONTH_LINE = re.compile(r"^(?:(\d{4}) )?(" + "|".join(MONTHS) + r") (" + FIGURE + r"(?: " + FIGURE + r")*)$")
YEAR_LINE = re.compile(r"^(\d{4}) Total (.+)$")
GRAND_LINE = re.compile(r"^(?:Grand Total|TOTAL) (.+)$")


def pdf_values(tokens: list[str], label: str) -> dict:
    if len(tokens) != len(PDF_FIELDS):
        raise Refusal(f"{label}: expected {len(PDF_FIELDS)} figures, read {len(tokens)}: {tokens}")
    out: dict = {"pending": None}
    for fld, tok in zip(PDF_FIELDS, tokens):
        if fld is None:
            continue
        out[fld] = share(tok, label) if fld == "rfe_share" else count(tok, label)
    return out


# The later PDFs' text layer garbles a visa code inside its parentheses:
# "(H -1B)", "(-H 2A)". Letters and digits survive in order, so the code is
# rebuilt from them before the title is matched.
CODES = {"H1B": "H-1B", "H2A": "H-2A", "H2B": "H-2B", "L1A": "L-1A", "L1B": "L-1B",
         "L1": "L-1", "R1": "R-1", "O": "O", "P": "P", "TN": "TN"}
TITLE_START = re.compile(r"^(?:Form )?I-+ ?129\b")


def clean_title(title: str) -> str:
    def fix(m: re.Match[str]) -> str:
        bare = re.sub(r"[\s-]", "", m.group(1))
        return f"({CODES[bare]})" if bare in CODES else m.group(0)
    return re.sub(r"\(([^()]{1,8})\)", fix, title)


def pdf_tables(pages: list[str], where: str) -> list[Table]:
    """Read the month tables, skip the quarter tables that follow each one."""
    tables: list[Table] = []
    current: Table | None = None
    fy: int | None = None
    for n, text in enumerate(pages):
        lines = [re.sub(r"\s+", " ", ln).strip() for ln in (text or "").split("\n")]
        if lines and TITLE_START.match(lines[0]):
            title = clean_title(" ".join(lines[:6]))
            if re.search(r"by Fiscal Year, Quarter", title, re.I):
                current = None
                continue
            if not re.search(r"by Fiscal Year, Month", title, re.I):
                raise Refusal(f"{where} page {n + 1}: a table that is neither by month nor by quarter")
            visa = visa_of(title)
            span = range_of(title)
            if visa is None or span is None:
                raise Refusal(f"{where} page {n + 1}: no visa key or date range in {title[:160]!r}")
            current = Table(visa=visa, start=span[0], end=span[1])
            tables.append(current)
            fy = None
        if current is None:
            continue
        header = next((ln for ln in lines if ln.startswith("Fiscal Year Month")), None)
        if header is None or re.sub(r"\s*\d+(?=\s|$)", "", header) not in PDF_HEADERS:
            raise Refusal(f"{where} page {n + 1}: the column headings changed: {header!r}")
        for ln in lines:
            label = f"{where} page {n + 1} {ln[:40]!r}"
            if m := GRAND_LINE.match(ln):
                current.grand = pdf_values(m.group(1).split(), label)
            elif m := YEAR_LINE.match(ln):
                current.year_totals[int(m.group(1))] = pdf_values(m.group(2).split(), label)
            elif m := MONTH_LINE.match(ln):
                if m.group(1):
                    fy = int(m.group(1))
                if fy is None:
                    raise Refusal(f"{label}: a month before any fiscal year")
                current.months.append(dict(fy=fy, month=MONTHS[m.group(2)],
                                           **pdf_values(m.group(3).split(), label)))
    return tables


def pdf_pages(blob: bytes) -> list[str]:
    import pdfplumber  # imported here: the spreadsheets need no PDF library
    with pdfplumber.open(io.BytesIO(blob)) as pdf:
        return [page.extract_text() or "" for page in pdf.pages]


# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------

def month_seq(start: str, end: str) -> list[tuple[int, int]]:
    """(fiscal year, calendar month) for every month from `start` to `end`."""
    y, m = int(start[:4]), int(start[5:7])
    ey, em = int(end[:4]), int(end[5:7])
    out = []
    while (y, m) <= (ey, em):
        out.append((y + 1 if m >= 10 else y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def problems_in(listed: Listed, tables: list[Table]) -> list[str]:
    """Every way the file fails to add up, so one refusal names them all."""
    where = listed.name
    if not tables:
        return [f"{where}: no tables read"]
    out: list[str] = []
    seen: set[str] = set()
    for t in tables:
        tag = f"{where} {VISA_LABELS[t.visa]}"
        if t.visa in seen:
            out.append(f"{tag}: two tables for one visa")
        seen.add(t.visa)
        if t.end != listed.end:
            out.append(f"{tag}: the table ends {t.end} but the file is named for {listed.end}")
        if not t.start.endswith("-10-01"):
            out.append(f"{tag}: the table starts {t.start}, which isn't an October 1")
        got = [(r["fy"], r["month"]) for r in t.months]
        want = month_seq(t.start, t.end)
        if got != want:
            out.append(f"{tag}: months don't run from {t.start} to {t.end} without a gap "
                       f"(read {len(got)}, expected {len(want)})")
        for r in [*t.months, *t.year_totals.values(), *([t.grand] if t.grand else [])]:
            at = f"{r.get('fy', 'total')} {r.get('month', '')}".strip()
            if any(r[f] is None for f in COUNTS):
                out.append(f"{tag} {at}: a blank count")
                continue
            if r["approved"] + r["denied"] != r["completions"]:
                out.append(f"{tag} {at}: approved {r['approved']:,} + denied {r['denied']:,} is not "
                           f"completions {r['completions']:,}")
            if not r["rfe_approved"] <= r["rfe_completions"] <= r["completions"]:
                out.append(f"{tag} {at}: RFE counts out of order")
            if r["rfe_share"] is not None and r["completions"] > 0:
                own = r["rfe_completions"] / r["completions"]
                if abs(own - r["rfe_share"]) > SHARE_TOLERANCE:
                    out.append(f"{tag} {at}: the printed RFE share {r['rfe_share']:.4f} is not the "
                               f"counts' {own:.4f}")
        if any(r[f] is None for r in t.months for f in COUNTS):
            continue
        fys = sorted({r["fy"] for r in t.months})
        if t.year_totals:
            if sorted(t.year_totals) != fys:
                out.append(f"{tag}: year totals for {sorted(t.year_totals)} but months for {fys}")
            for fy, total in t.year_totals.items():
                for f in COUNTS:
                    s = sum(r[f] for r in t.months if r["fy"] == fy)
                    if total[f] is not None and s != total[f]:
                        out.append(f"{tag} FY{fy}: {f} months sum to {s:,}, the total says {total[f]:,}")
        if t.grand is None:
            out.append(f"{tag}: no TOTAL row to reconcile against")
        else:
            # Pending is a count on one day: the TOTAL row carries the newest
            # month's figure and never a sum.
            if t.has_pending and t.months and t.grand["pending"] != t.months[-1]["pending"]:
                out.append(f"{tag}: the TOTAL row's pending {t.grand['pending']} is not the newest "
                           f"month's {t.months[-1]['pending']}")
            for f in COUNTS:
                s = sum(r[f] for r in t.months)
                if t.grand[f] is not None and s != t.grand[f]:
                    out.append(f"{tag}: {f} months sum to {s:,}, the TOTAL row says {t.grand[f]:,}")
    if "h1b" not in seen:
        out.append(f"{where}: no H-1B table")
    return out


def reconcile(listed: Listed, tables: list[Table]) -> None:
    found = problems_in(listed, tables)
    if found:
        raise Refusal(f"REFUSING {listed.name}: {len(found)} problem(s), nothing written:\n  "
                      + "\n  ".join(found[:25]) + ("\n  ..." if len(found) > 25 else ""))


def read_tables(listed: Listed, blob: bytes) -> Parsed:
    """Every table in the file, the left-out ones dropped. Not yet reconciled."""
    if listed.fmt == "pdf":
        tables = pdf_tables(pdf_pages(blob), listed.name)
    else:
        blocks = xlsx_blocks(blob) if listed.fmt == "xlsx" else csv_blocks(blob)
        tables = [t for name, rows in blocks if (t := parse_block(name, rows, listed.name))]
    return Parsed(listed, [t for t in tables if t.visa not in LEFT_OUT])


def fiscal_year_of(day: str) -> int:
    """`2016-10-01` -> 2017: October opens the next fiscal year."""
    return int(day[:4]) + (1 if int(day[5:7]) >= 10 else 0)


def span_of(listed: Listed, blob: bytes) -> tuple[str, str] | None:
    """The date range under the file's first title, read as cheaply as the format allows."""
    if listed.fmt == "pdf":
        import pdfplumber
        with pdfplumber.open(io.BytesIO(blob)) as pdf:
            first = (pdf.pages[0].extract_text() or "") if pdf.pages else ""
        return range_of(re.sub(r"\s+", " ", first))
    blocks = xlsx_blocks(blob) if listed.fmt == "xlsx" else csv_blocks(blob)
    for _name, rows in blocks:
        span = range_of(" ".join(str(r.get(0, "")) for r in rows[:6]))
        if span:
            return span
    return None


def parse_blob(listed: Listed, blob: bytes) -> Parsed:
    p = read_tables(listed, blob)
    reconcile(listed, p.tables)
    return p


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

COLUMNS = {
    "fy": "INTEGER NOT NULL", "month": "INTEGER NOT NULL", "visa": "TEXT NOT NULL",
    "received": "INTEGER", "approved": "INTEGER", "denied": "INTEGER", "completions": "INTEGER",
    "pending": "INTEGER", "rfe_completions": "INTEGER", "rfe_approved": "INTEGER",
    "source_file": "TEXT NOT NULL",
}
WRITE_COLUMNS = ["fy", "month", "visa", "received", "approved", "denied", "completions",
                 "pending", "rfe_completions", "rfe_approved", "source_file"]


def ensure_tables(db: Database) -> None:
    db.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        {", ".join(f"{c} {t}" for c, t in COLUMNS.items())},
        PRIMARY KEY (fy, month, visa))""")
    add_missing_columns(db, TABLE, {c: t.replace(" NOT NULL", "") for c, t in COLUMNS.items()})
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER NOT NULL)""")


def held_sources(db: Database) -> dict[int, str]:
    """The file each fiscal year's rows were read from."""
    return {int(r[0]): str(r[1]) for r in query_rows(
        db, f"SELECT fy, max(source_file) FROM {TABLE} GROUP BY fy")}


def store_year(db: Database, p: Parsed, fy: int) -> int:
    rows = p.rows_for(fy)
    db.execute(f"DELETE FROM {TABLE} WHERE fy = ?", [fy])
    insert_rows(db, TABLE, WRITE_COLUMNS, [[r[c] if c != "source_file" else p.listed.name
                                            for c in WRITE_COLUMNS] for r in rows])
    n = int(db.scalar(f"SELECT count(*) FROM {TABLE} WHERE fy = ?", [fy]) or 0)
    if n != len(rows):
        raise Refusal(f"REFUSING {p.listed.name}: FY{fy} parsed {len(rows):,} rows but stored {n:,}")
    return n


def summarize(rows: list[list], newest: Listed | None) -> dict:
    """The doc: the newest quarter, and each visa's totals per fiscal year."""
    by: dict[tuple[str, int], dict] = {}
    for fy, month, visa, received, approved, denied, completions, rfe, rfe_ok in rows:
        key = (str(visa), int(fy))
        y = by.setdefault(key, {"fy": int(fy), "months": 0, "received": 0, "approved": 0, "denied": 0,
                                "completions": 0, "rfeCompletions": 0, "rfeApproved": 0})
        y["months"] += 1
        for k, v in (("received", received), ("approved", approved), ("denied", denied),
                     ("completions", completions), ("rfeCompletions", rfe), ("rfeApproved", rfe_ok)):
            y[k] += int(v or 0)
    visas: dict[str, dict] = {}
    for (visa, _fy), y in sorted(by.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        v = visas.setdefault(visa, {"label": VISA_LABELS.get(visa, visa), "years": []})
        v["years"].append(y)
    fys = sorted({fy for _v, fy in by})
    last = fys[-1] if fys else None
    months_last = max((y["months"] for (v, fy), y in by.items() if fy == last), default=0)
    return {
        "asOf": newest.end if newest else None,
        "quarterLabel": f"FY{newest.last_fy} Q{newest.quarter}" if newest else None,
        "sourceFile": newest.name if newest else None,
        "firstFy": fys[0] if fys else None,
        "lastFy": last,
        "currentFy": {"fy": last, "months": months_last,
                      "complete": months_last == 12} if last else None,
        "visas": visas,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def plan(listed: list[Listed], history: bool) -> list[Listed]:
    """The files to read, newest first. Without --history, the newest alone.

    With --history, an older file is read only when its name reaches a fiscal
    year no newer file has given. Names can start a year early, never late,
    so the name is a safe upper bound on what the file could add.
    """
    ordered = sorted(listed, key=lambda x: x.rank, reverse=True)
    return ordered if history else ordered[:1]


def describe(p: Parsed) -> str:
    h = next(t for t in p.tables if t.visa == "h1b")
    last = [r for r in h.months if r["fy"] == h.months[-1]["fy"]]
    comp = sum(r["completions"] for r in last)
    rfe = sum(r["rfe_completions"] for r in last)
    return (f"FY{p.fys()[0]}-FY{p.fys()[-1]}, {len(p.tables)} visas "
            f"({', '.join(t.visa for t in p.tables)}); H-1B FY{last[0]['fy']} to date: "
            f"{rfe:,} of {comp:,} completions had an RFE ({rfe / comp:.1%})")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--history", action="store_true",
                    help=f"Walk up to {MAX_PAGES} listing pages and load every fiscal year USCIS lists")
    ap.add_argument("--file", action="append", default=[],
                    help="Parse this local copy instead of discovering (repeatable)")
    ap.add_argument("--dry-run", action="store_true", help="Parse and reconcile; write nothing")
    ap.add_argument("--force", action="store_true",
                    help="Rewrite fiscal years already held from the same file")
    args = ap.parse_args(argv)
    started = time.time()

    if args.file:
        listed = []
        for f in args.file:
            path = pathlib.Path(f)
            item = identify(path.name, str(path))
            if not item:
                raise SystemExit(f"{path.name}: not a name this ingest knows")
            listed.append(item)
        history = True if len(listed) > 1 else args.history
        read = lambda item: pathlib.Path(item.url).read_bytes()  # noqa: E731
    else:
        history = args.history
        listed, seen = [], set()
        for n in range(MAX_PAGES):
            url = page_url(n)
            log(f"Listing {url}")
            html = fetch(url).decode("utf8", "ignore")
            files = [x for x in discover(html) if x.name not in seen]
            seen.update(x.name for x in files)
            listed.extend(files)
            links = re.findall(r'href="[^"]+\.(?:xlsx|csv|pdf)"', html, re.I)
            if not links or (listed and not history):
                break
            time.sleep(POLITE_PAUSE_S)
        read = lambda item: fetch(item.url, referer=DATA_PAGE)  # noqa: E731
    if not listed:
        raise SystemExit("no I-129 RFE file found on the USCIS data page")
    log("  listed: " + ", ".join(x.name for x in sorted(listed, key=lambda x: x.rank, reverse=True)))

    db = None if args.dry_run else Database()
    held = {} if db is None else (ensure_tables(db) or held_sources(db))

    # Newest file first; each fiscal year comes from the first (newest) file that has it.
    taken: dict[int, Parsed] = {}
    read_files: list[Parsed] = []
    for item in plan(listed, history):
        named = set(range(item.named_first, item.last_fy + 1))
        if history and named and named <= set(taken):
            log(f"  {item.name}: every year it could hold is read from a newer file; skipped")
            continue
        log(f"  {item.name}: reading")
        blob = read(item)
        if not args.file:
            time.sleep(POLITE_PAUSE_S)
        # Its name reached a year no newer file gave; the date range under its
        # title says whether its rows do. A file nothing is taken from isn't
        # parsed or reconciled: the CSV edition ending FY2022 has an H-2B FY2021
        # that doesn't add up, the later PDFs' text layer splits figures apart
        # ("1 ,376"), and every year either holds comes from a newer
        # spreadsheet anyway.
        span = span_of(item, blob) if history else None
        if span:
            covers = set(range(fiscal_year_of(span[0]), fiscal_year_of(span[1]) + 1))
            if covers <= set(taken):
                log(f"    holds FY{min(covers)}-FY{max(covers)}, all read from newer files; not used")
                continue
        p = read_tables(item, blob)
        new = [fy for fy in p.fys() if fy not in taken]
        if p.tables and not new:
            log(f"    holds FY{p.fys()[0]}-FY{p.fys()[-1]}, all read from newer files; not used")
            continue
        reconcile(item, p.tables)
        read_files.append(p)
        log(f"    reconciled: {describe(p)}; gives FY {new}")
        for fy in new:
            taken[fy] = p
    newest = max((p.listed for p in read_files), key=lambda x: x.rank, default=None)

    for fy in sorted(taken):
        rows = taken[fy].rows_for(fy)
        counts = {}
        for r in rows:
            counts[r["visa"]] = counts.get(r["visa"], 0) + 1
        log(f"  FY{fy}: {len(rows):3d} rows from {taken[fy].listed.name}  "
            + " ".join(f"{v}={n}" for v, n in sorted(counts.items())))

    if db is None:
        log(f"dry run: {len(read_files)} file(s) read and reconciled, {len(taken)} fiscal year(s), "
            "nothing written")
        return 0

    written, loaded = 0, []
    for fy in sorted(taken):
        p = taken[fy]
        prior = held.get(fy)
        prior_item = identify(prior) if prior else None
        if prior_item and prior_item.rank > p.listed.rank:
            log(f"  FY{fy}: held from the newer {prior}; left as it is")
            continue
        if prior == p.listed.name and not args.force:
            log(f"  FY{fy}: already held from {prior}; skipped")
            continue
        n = store_year(db, p, fy)
        written += n
        loaded.append(f"FY{fy}")
        log(f"  FY{fy}: stored {n:,} rows")

    all_rows = query_rows(db, f"""SELECT fy, month, visa, received, approved, denied, completions,
        rfe_completions, rfe_approved FROM {TABLE} ORDER BY fy, month, visa""")
    sources = held_sources(db)
    newest_held = max((x for x in (identify(s) for s in sources.values()) if x),
                      key=lambda x: x.rank, default=None)
    doc = summarize(all_rows, newest_held)
    write_doc(db, SUMMARY_DOC, doc)
    if newest_held:
        stamp_freshness(db, DATASET, as_of=newest_held.end, source=SOURCE, cadence="Quarterly",
                        note=f"{len(sources)} fiscal year(s) held, FY{doc['firstFy']} to FY{doc['lastFy']}; "
                             f"newest {newest_held.name}",
                        max_age_days=MAX_AGE_DAYS)
    note = (f"loaded {', '.join(loaded)} from {', '.join(sorted({taken[int(f[2:])].listed.name for f in loaded}))}"
            if loaded else f"nothing new; newest {newest.name if newest else 'none'} already held")
    record_run(db, "ingest_uscis_rfe.py", status="ok", rows_written=written, note=note, started_at=started)
    log(f"done: {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
