#!/usr/bin/env python3
"""DOL's debarment lists: who may not file, and until when.

Two primary sources, both public, read as published:

  * OFLC's "Program Debarments" PDF at
    https://www.dol.gov/agencies/eta/foreign-labor/program-debarments
    (the page URL serves the PDF). It carries one table per program: the
    Permanent Labor Certification list (PERM employers, attorneys and
    agents), the H-2A list and the H-2B list. Each row is an entity, its
    type, its location, the debarment's start and end, the violation and,
    for PERM, the CFR citation. The PDF prints no "as of" date; its own
    modification stamp is the freshest thing it says about itself, so that
    is what the page shows.
  * The Wage and Hour Division's H-1B debarment page at
    https://www.dol.gov/agencies/whd/immigration/h1b/debarment, an HTML
    table (employer, address, willful violator, "M/D/YYYY to M/D/YYYY")
    with its own "effective as of" line.

WHY. On Sep 8 2026 DOL's Inspector General announced the suspension of one
employer's PERM filings, and the question people brought to this site was
who else. A debarment is the formal, dated answer to that question, and it
was not on this site.

RULES. The row is the record: nothing is inferred, and the violation text
is DOL's. A row keeps its identity by (program, entity, start date), so a
list that drops an entry after its end date leaves our row in place with
its end date, which is the honest history. The run writes nothing when a
source could not be read (a 403 from this network is DOL policy, not our
bug) and stamps freshness only when both sources answered. `www.dol.gov`
answers GitHub's runners with a full browser header set and refuses this
laptop; the parser is tested on fixtures, not on the live fetch.
"""
from __future__ import annotations

import argparse
import datetime
import html
import io
import re
import sys
import time
import urllib.request

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402
from store_entities import slugify  # noqa: E402

OFLC_URL = "https://www.dol.gov/agencies/eta/foreign-labor/program-debarments"
WHD_URL = "https://www.dol.gov/agencies/whd/immigration/h1b/debarment"
DATASET = "debarments"
SCRIPT = "ingest_debarments.py"

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
}

PROGRAM_HEADINGS = {
    "Permanent Labor Certification Debarment List": "perm",
    "H-2A Labor Certification Debarment List": "h2a",
    "H-2B Labor Certification Debarment List": "h2b",
}

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"], 1)}


def log(msg: str) -> None:
    print(msg, flush=True)


def fetch(url: str, retries: int = 4) -> bytes:
    delay = 20
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            if attempt == retries:
                raise
            log(f"  HTTP {e.code} (attempt {attempt}/{retries}); waiting {delay}s")
            time.sleep(delay)
            delay *= 3
    raise RuntimeError("unreachable")


# ---------------------------------------------------------------------------
# Dates, in the two shapes the two sources use
# ---------------------------------------------------------------------------

def parse_long_date(text: str) -> str | None:
    """'May 29, 2025' -> '2025-05-29'; anything else -> None."""
    m = re.match(r"^\s*([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})\s*$", text or "")
    if not m:
        return None
    mon = MONTHS.get(m.group(1).lower())
    if not mon:
        return None
    return f"{m.group(3)}-{mon:02d}-{int(m.group(2)):02d}"


def parse_short_date(text: str) -> str | None:
    """'5/12/2025' -> '2025-05-12'."""
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", text or "")
    if not m:
        return None
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"


def parse_whd_period(text: str) -> tuple[str | None, str | None]:
    """'5/12/2025 to 5/11/2027' -> ('2025-05-12', '2027-05-11')."""
    parts = re.split(r"\s+(?:to|-|through)\s+", (text or "").strip(), maxsplit=1)
    if len(parts) != 2:
        return (None, None)
    return (parse_short_date(parts[0]), parse_short_date(parts[1]))


# ---------------------------------------------------------------------------
# OFLC PDF: one table per program, continued across pages
# ---------------------------------------------------------------------------

def clean(cell) -> str:
    return re.sub(r"\s+", " ", (cell or "")).strip()


def parse_oflc_pages(pages: list[dict]) -> list[dict]:
    """Fold the PDF's pages into rows.

    `pages` is a list of {"text": str, "tables": [[[cell, ...], ...], ...]},
    which is exactly what pdfplumber yields per page and what the test hands
    in. The program in force is the last program heading seen in page order,
    read from the page TEXT (the heading is a merged cell in the table on
    the page it starts and absent on continuation pages). A row counts when
    its fourth and fifth cells parse as dates; header rows, blank spacer
    rows and the merged heading rows fail that test and are skipped, which
    is the whole filter.
    """
    program: str | None = None
    out: list[dict] = []
    for page in pages:
        text = page.get("text") or ""
        # A page can open a new list part-way down; take the LAST heading on
        # the page for rows after it, but rows before it belong to the
        # previous program. Split the page text at each heading and use the
        # table order, which follows text order in this document.
        headings = [(text.find(h), key) for h, key in PROGRAM_HEADINGS.items() if h in text]
        headings.sort()
        tables = page.get("tables") or []
        # A page holding k headings and t tables: when t > k, the first t - k
        # tables are the tail of the previous list (the real PDF's page 4 is
        # six H-2A rows, then the H-2B heading and its table), and the rest
        # take the headings in order. When t <= k the tables take headings
        # in order and any surplus heading has no rows on this page.
        lead = max(0, len(tables) - len(headings))
        table_programs: list[str | None] = []
        for i, _table in enumerate(tables):
            if headings and i >= lead:
                program = headings[i - lead][1]
            table_programs.append(program)
        for table, prog in zip(tables, table_programs):
            if prog is None:
                continue
            for row in table:
                cells = [clean(c) for c in row]
                if len(cells) < 5:
                    continue
                start = parse_long_date(cells[3])
                end = parse_long_date(cells[4])
                if not start or not end or not cells[0]:
                    continue
                out.append({
                    "program": prog,
                    "entity": cells[0].rstrip("*").strip(),
                    "entity_type": cells[1] or None,
                    "location": cells[2] or None,
                    "start_date": start,
                    "end_date": end,
                    "violation": cells[5] if len(cells) > 5 and cells[5] else None,
                    "citation": cells[6] if len(cells) > 6 and cells[6] else None,
                    "source_url": OFLC_URL,
                })
    return out


def read_pdf(data: bytes) -> tuple[list[dict], str | None]:
    """The PDF's pages in the shape parse_oflc_pages takes, plus its modification date."""
    import pdfplumber  # imported here so the parser tests need no PDF library
    pages = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            pages.append({"text": page.extract_text() or "", "tables": page.extract_tables() or []})
        meta = pdf.metadata or {}
    mod = str(meta.get("ModDate") or meta.get("CreationDate") or "")
    m = re.match(r"D:(\d{4})(\d{2})(\d{2})", mod)
    return pages, (f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None)


# ---------------------------------------------------------------------------
# WHD H-1B page: one HTML table
# ---------------------------------------------------------------------------

def parse_whd_html(page: str) -> tuple[list[dict], str | None]:
    """Rows from the H-1B debarment table and the page's own effective date."""
    text = html.unescape(page)
    eff = re.search(r"effective as of\s+([A-Za-z]+ \d{1,2}, \d{4})", text, re.I)
    effective = parse_long_date(eff.group(1)) if eff else None
    out: list[dict] = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.S | re.I):
        cells = [re.sub(r"<[^>]+>", " ", c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S | re.I)]
        cells = [re.sub(r"\s+", " ", c).strip() for c in cells]
        if len(cells) < 4:
            continue
        start, end = parse_whd_period(cells[3])
        if not start or not end or not cells[0]:
            continue
        out.append({
            "program": "h1b",
            "entity": cells[0],
            "entity_type": "Employer",
            "location": cells[1] or None,
            "start_date": start,
            "end_date": end,
            "violation": "Willful violator" if cells[2].lower().startswith("y") else None,
            "citation": None,
            "source_url": WHD_URL,
        })
    return out, effective


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

DDL = [
    """CREATE TABLE IF NOT EXISTS debarments (
        program TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_slug TEXT NOT NULL,
        entity_type TEXT,
        location TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        violation TEXT,
        citation TEXT,
        source_url TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (program, entity, start_date))""",
    "CREATE INDEX IF NOT EXISTS debarments_slug ON debarments (entity_slug)",
    "CREATE INDEX IF NOT EXISTS debarments_end ON debarments (end_date)",
]


def write(db: Turso, rows: list[dict]) -> int:
    for ddl in DDL:
        db.execute(ddl)
    now = int(time.time() * 1000)
    n = 0
    for r in rows:
        db.execute(
            "INSERT OR REPLACE INTO debarments (program, entity, entity_slug, entity_type, location, "
            "start_date, end_date, violation, citation, source_url, fetched_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [r["program"], r["entity"], slugify(r["entity"]), r["entity_type"], r["location"],
             r["start_date"], r["end_date"], r["violation"], r["citation"], r["source_url"], now])
        n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pdf", help="parse a saved OFLC PDF instead of fetching")
    ap.add_argument("--html", help="parse a saved WHD page instead of fetching")
    ap.add_argument("--dry-run", action="store_true", help="parse and report, write nothing")
    args = ap.parse_args()

    t0 = time.time()
    pdf_bytes = open(args.pdf, "rb").read() if args.pdf else fetch(OFLC_URL)
    pages, pdf_date = read_pdf(pdf_bytes)
    oflc = parse_oflc_pages(pages)
    log(f"OFLC PDF: {len(pages)} pages, {len(oflc)} rows "
        f"({', '.join(f'{p}={sum(1 for r in oflc if r['program'] == p)}' for p in ('perm', 'h2a', 'h2b'))}), "
        f"modified {pdf_date}")
    if len(oflc) < 10:
        raise SystemExit(f"FATAL: {len(oflc)} OFLC rows; the layout has changed or the fetch was refused")

    whd_page = open(args.html, encoding="utf-8").read() if args.html else fetch(WHD_URL).decode("utf-8", "replace")
    whd, effective = parse_whd_html(whd_page)
    log(f"WHD H-1B page: {len(whd)} rows, effective {effective}")
    if len(whd) < 1:
        raise SystemExit("FATAL: 0 H-1B rows; the table layout has changed or the fetch was refused")

    rows = oflc + whd
    if args.dry_run:
        for r in rows[:5]:
            log(f"  {r['program']:4} {r['entity'][:40]:40} {r['start_date']} to {r['end_date']}  {r['violation'] or ''}")
        return 0

    db = Turso()
    before = int(db.scalar("SELECT COUNT(*) FROM debarments") or 0) if db.scalar(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='debarments'") else 0
    n = write(db, rows)
    after = int(db.scalar("SELECT COUNT(*) FROM debarments") or 0)
    as_of = datetime.date.today().isoformat()
    doc = {"asOf": as_of, "pdfDate": pdf_date, "h1bEffective": effective,
           "counts": {p: sum(1 for r in rows if r["program"] == p) for p in ("perm", "h1b", "h2a", "h2b")},
           "sources": {"oflc": OFLC_URL, "whd": WHD_URL}}
    import json
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
               ["debarments_summary", json.dumps(doc, separators=(",", ":")), int(time.time() * 1000)])
    # `as_of` is the day this run confirmed the lists, not the PDF's own
    # date: OFLC's document can legitimately go months without a change, and
    # a budget on ITS date would trip on a healthy ingest. The document's date
    # and the H-1B page's effective date are in the summary doc and the note.
    stamp_freshness(db, DATASET, source="dol.gov OFLC program debarments PDF + WHD H-1B page",
                    cadence="daily", note=f"OFLC document modified {pdf_date}; H-1B list effective {effective}",
                    max_age_days=10)
    record_run(db, SCRIPT, status="ok", rows_written=n,
               note=f"{len(oflc)} OFLC + {len(whd)} H-1B rows; table {before} -> {after}; {time.time() - t0:.0f}s")
    log(f"wrote {n} rows; table {before} -> {after}; freshness {as_of}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
