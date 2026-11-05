#!/usr/bin/env python3
"""Load the State Department's monthly nonimmigrant visa issuances, by consulate.

WHAT IT IS. Each month State publishes how many nonimmigrant visas each consulate ("post")
issued, by visa class: H-1B, L-1, K-1 fiancé(e), B1/B2 visitors, F-1 students and about 70
more. It's the twin of the immigrant tables ingest_visa_issuances.py reads, from the same
page family, and it names the posts the same way, so a post's page reads both by one key
(`group_key`, shared). State calls the figures "preliminary data which are subject to change".
A K-1 is here and nowhere in State's IV Scheduling Status Tool, which lists immigrant visas
only.

WHERE. Excel from October 2022 (the Excel/FY<year>/ folder), PDF from March 2017. Since
Nov 2 2026 State's site refuses scripts (lib_gov_data.STATE_CLOSED), so a new month comes
from a file a person saves in a browser (--local, the same checks), and the months before
October 2022 from the Internet Archive's copies (--archive, run on the server, which the
Archive answers).

HOW A FILE IS CHECKED, before anything is written:
* The workbook's header row must be Post | Visa Class | Issuances, and every row under it
  a post, a class and a count, or the file is refused naming the row.
* It ends in a GRAND TOTAL row. Its cell is a number (two files) or a formula,
  "SUM(C3:C4145)", usually with Excel's cached sum. The rows must add to the number or the
  cached sum, and a formula's range must start at the first row read and end at the last,
  so no row sits outside the total.
* A PDF is read by word position with the immigrant loader's reader (`rows_from_lines`),
  each page's "Grand Total" line the check. February 2017's by-post table also splits each
  post by nationality, a layout this doesn't read: it's refused, never guessed at.
* The month in the file's own title must be the month it's loaded as.

Usage:
    python3 scripts/ingest_niv_issuances.py --local FILE [FILE ...]   # files saved from State's page
    python3 scripts/ingest_niv_issuances.py --local FILE --month 2026-02
    python3 scripts/ingest_niv_issuances.py --archive [--since 2017-03 --until 2022-09]
    python3 scripts/ingest_niv_issuances.py --dry-run --local FILE      # parse and check, write nothing
    python3 scripts/ingest_niv_issuances.py                             # State's page (refuses scripts since Nov 2 2026)

Writes `niv_issuances`, `perm_docs['niv_issuances_summary']` and `['niv_issuances_load']`,
the `niv-issuances` freshness row and a run row; asks the site to rebuild the consulate pages
after a write (/api/revalidate-consular).
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest_visa_issuances as iv  # noqa: E402
from lib_db import Database, read_doc, record_run, restamp_note, stamp_freshness, write_doc  # noqa: E402
from lib_gov_data import STATE_CLOSED, fetch, log, state_refused  # noqa: E402
from lib_policy_feed import expire_policy_page  # noqa: E402
from lib_reference import sha256, sheet_cells, sync_rows  # noqa: E402

SCRIPT = "ingest_niv_issuances.py"
DATASET = "niv-issuances"
# What the site prints as the source line: a readable name, never a bare URL.
SOURCE = "State Department monthly nonimmigrant visa issuances by post (state.gov)"
HOST = "https://adoption.state.gov"
PAGE = (HOST + "/content/travel/en/legal/visa-law0/visa-statistics/nonimmigrant-visa-statistics/"
        "monthly-nonimmigrant-visa-issuances.html")
DAM = "/content/dam/visas/Statistics/Non-Immigrant-Statistics/MonthlyNIVIssuances/"
CDX = "https://web.archive.org/cdx/search/cdx"
TABLE = "niv_issuances"
KEY = ("month", "post_key", "visa_class")
COLS = (*KEY, "post", "n")
RECORD = "niv_issuances_load"
SUMMARY = "niv_issuances_summary"
CONSULAR_ROUTE = "/api/revalidate-consular"
# State's class symbols, as 22 CFR 41.12 lists them (9 FAM 402.1) and its statistics print
# them: "H1B", "NATO2", "B1/B2", "C1/D", "BBBCC". Upper case only, so "Total" never matches.
NIV_CLASS = re.compile(r"^[A-Z][A-Z0-9]{0,4}(?:/[A-Z][A-Z0-9]{0,2})?$")
COUNT = re.compile(r"^\d[\d,]*(?:\.0+)?$")
# A month's table holds 3,500 to 4,700 rows since 2022 and about 1,400 at the low of
# June 2020, when consulates were closed. The grand total is the real check; this only
# stops an empty or truncated read.
MIN_ROWS = 500
# State posts each month about eight months after it ends (February 2026 was the newest on
# Nov 5 2026, 250 days after Feb 28), and since Nov 2 2026 a month arrives only through a
# browser read. 330 days is the immigrant twin's budget: both tables are posted together, so
# they go quiet together, and the row warns when a month is about three months later than usual.
MAX_AGE_DAYS = 330
# The Internet Archive asks for a pause between requests, and refuses busy clients (HTTP 429).
ARCHIVE_PAUSE_S = 6.0
# The first month State's own page lists; the Archive's copies of these 67 months to September 2022
# are the only by-post files before State's Excel folder begins.
ARCHIVE_FIRST = "2017-03"
# The classes the summary counts for every month, so a page needs no scan for them.
SUMMARY_CLASSES = ("H1B", "L1", "K1")

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        month TEXT NOT NULL, post_key TEXT NOT NULL, visa_class TEXT NOT NULL,
        post TEXT NOT NULL, n INTEGER NOT NULL,
        PRIMARY KEY (month, post_key, visa_class))""",
    # A post's page: its months. The consulate ranking: one class in one month.
    f"CREATE INDEX IF NOT EXISTS {TABLE}_post ON {TABLE} (post_key, month)",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_class ON {TABLE} (visa_class, month)",
]

Refusal = iv.Refusal


def month_of(name: str) -> str | None:
    return iv.month_of(name)


def is_by_post(name: str) -> bool:
    return iv.dim_of(name) == "post"


def listing(html: str) -> dict[str, str]:
    """month -> the by-post file State links, the Excel one when a month has both."""
    found: dict[str, str] = {}
    for href in re.findall(r'href="(' + re.escape(DAM) + r'[^"]+)"', html):
        name = urllib.parse.unquote(href.rsplit("/", 1)[-1])
        month = month_of(name)
        if not month or not is_by_post(name) or not name.lower().endswith((".pdf", ".xlsx")):
            continue
        prev = found.get(month)
        if prev is None or (href.lower().endswith(".xlsx") and not prev.lower().endswith(".xlsx")):
            found[month] = HOST + href
    return found


def _count(text: str) -> int:
    return int(float(text.replace(",", "")))


def from_xlsx(data: bytes, label: str) -> tuple[dict[tuple[str, str], int], str | None]:
    """(post, class) -> issuances, and the month the title names. Refuses a file that fails its checks."""
    rows: dict[tuple[str, str], int] = {}
    title_month: str | None = None
    header = False
    first_row = last_row = None
    total: tuple[int, str, str | None] | None = None
    for number, cells, formulas in sheet_cells(data):
        c = [x.strip() for x in cells] + ["", "", ""]
        name, cls, count = c[0], c[1], c[2]
        if not header:
            if name.casefold() == "post" and cls.casefold() == "visa class" and count.casefold() == "issuances":
                header = True
            elif name and title_month is None:
                title_month = month_of(" ".join(name.split()))
            continue
        if name.upper().startswith("GRAND TOTAL"):
            total = (number, count, formulas.get(2))
            break
        if not (name or cls or count or formulas):
            continue
        if not name or not NIV_CLASS.match(cls) or not COUNT.match(count):
            raise Refusal(f"{label}: row {number} isn't a post, a class and a count: {c[:3]!r}")
        key = (name, cls)
        rows[key] = rows.get(key, 0) + _count(count)
        first_row = number if first_row is None else first_row
        last_row = number
    if not header:
        raise Refusal(f"{label}: no Post | Visa Class | Issuances header row")
    if total is None:
        raise Refusal(f"{label}: no GRAND TOTAL row")
    got = sum(rows.values())
    t_row, cached, formula = total
    if not cached and not formula:
        raise Refusal(f"{label}: the GRAND TOTAL row (row {t_row}) holds no figure")
    if cached:
        if not COUNT.match(cached):
            raise Refusal(f"{label}: the GRAND TOTAL reads {cached!r}")
        if _count(cached) != got:
            raise Refusal(f"{label}: rows add to {got:,}, GRAND TOTAL says {_count(cached):,}")
    if formula:
        m = re.fullmatch(r"=?SUM\(\$?C\$?(\d+):\$?C\$?(\d+)\)", formula.replace(" ", ""), re.I)
        if not m:
            raise Refusal(f"{label}: the GRAND TOTAL is a formula this doesn't read: {formula!r}")
        lo, hi = int(m.group(1)), int(m.group(2))
        if (lo, hi) != (first_row, last_row):
            raise Refusal(f"{label}: the GRAND TOTAL sums rows {lo} to {hi}; the table's rows are {first_row} to {last_row}")
    if len(rows) < MIN_ROWS:
        raise Refusal(f"{label}: only {len(rows)} rows")
    return rows, title_month


def from_pdf(data: bytes, label: str) -> tuple[dict[tuple[str, str], int], str | None]:
    lines = list(iv.pdf_lines(data))
    head = " ".join(w["text"] for line in lines[:8] for w in line)
    if re.search(r"\bNationality\b", head):
        raise Refusal(f"{label}: this table splits each post by nationality as well (February 2017's layout), "
                      "which this reader doesn't read")
    return iv.rows_from_lines(lines, label, NIV_CLASS, MIN_ROWS), month_of(head)


def parse(data: bytes, name: str) -> tuple[dict[tuple[str, str], int], str | None]:
    label = urllib.parse.unquote(name.rsplit("/", 1)[-1])
    if data[:2] == b"PK":
        return from_xlsx(data, label)
    if data[:5] == b"%PDF-":
        return from_pdf(data, label)
    raise Refusal(f"{label}: neither a workbook nor a PDF (starts {data[:16]!r})")


def table_rows(month: str, rows: dict[tuple[str, str], int]) -> list[tuple]:
    """One row per (post, class) under the post's key, the spelling State used kept beside it."""
    out: dict[tuple[str, str], list] = {}
    for (post, cls), n in sorted(rows.items()):
        k = (iv.group_key(post), cls)
        if k in out:
            out[k][4] += n
        else:
            out[k] = [month, k[0], cls, post, n]
    return [tuple(r) for _, r in sorted(out.items())]


def store(db: Database, month: str, rows: dict[tuple[str, str], int]) -> dict:
    """Make one month hold exactly this file's rows."""
    return sync_rows(db, TABLE, KEY, COLS, table_rows(month, rows), scope_sql="month = ?", scope_args=[month])


def summary(db: Database) -> dict:
    from lib_db import query_rows
    totals: dict[str, int] = {}
    classes: dict[str, dict[str, int]] = {c: {} for c in SUMMARY_CLASSES}
    for month, n in query_rows(db, f"SELECT month, sum(n) FROM {TABLE} GROUP BY month"):
        totals[month] = int(n)
    marks = ",".join("?" for _ in SUMMARY_CLASSES)
    for cls, month, n in query_rows(db, f"SELECT visa_class, month, sum(n) FROM {TABLE} WHERE visa_class IN ({marks}) "
                                        "GROUP BY visa_class, month", list(SUMMARY_CLASSES)):
        classes[cls][month] = int(n)
    months = sorted(totals)
    return {"months": months, "newest": months[-1] if months else None, "totalByMonth": totals,
            "classByMonth": classes}


def finish(db: Database, written: int, loaded: int, refused: list[str], started: float,
           note_extra: str = "") -> int:
    """The summary the pages read, the freshness row, the run row and the pages' refresh, after any load."""
    doc = summary(db)
    write_doc(db, SUMMARY, doc)
    if doc["newest"]:
        y, m = map(int, doc["newest"].split("-"))
        stamp_freshness(db, DATASET, as_of=f"{doc['newest']}-{calendar.monthrange(y, m)[1]:02d}",
                        source=SOURCE, cadence="monthly, posted about eight months late",
                        note=f"{len(doc['months'])} months, newest {doc['newest']}", max_age_days=MAX_AGE_DAYS)
    refreshed = expire_policy_page(log, route=CONSULAR_ROUTE) if written else None
    note = f"{loaded} files loaded, {written} rows written; refused {len(refused)}"
    if refused:
        note += ": " + "; ".join(refused[:3])
    if refreshed is False:
        note += "; the consulate pages' refresh didn't answer 200"
    if note_extra:
        note += f"; {note_extra}"
    record_run(db, SCRIPT, status="failed" if refused else "ok", rows_written=written, note=note[:900],
               started_at=started)
    return 1 if refused else 0


def archive_files() -> dict[str, tuple[str, str]]:
    """month -> (capture time, State's URL) for every by-post file the Internet Archive holds:
    the Excel copy when a month has both, else its newest PDF capture."""
    query = urllib.parse.urlencode({"url": "travel.state.gov" + DAM, "matchType": "prefix", "output": "json",
                                    "filter": "statuscode:200", "fl": "timestamp,original"})
    rows = json.loads(fetch(f"{CDX}?{query}").decode("utf-8", "replace") or "[]")[1:]
    best: dict[str, tuple[str, str]] = {}
    for ts, original in rows:
        path = urllib.parse.urlparse(original)
        if path.query:
            continue
        name = urllib.parse.unquote(path.path.rsplit("/", 1)[-1])
        month = month_of(name)
        if not month or not is_by_post(name) or not name.lower().endswith((".pdf", ".xlsx")):
            continue
        rank = (name.lower().endswith(".xlsx"), ts)
        prev = best.get(month)
        if prev is None or rank > (urllib.parse.unquote(prev[1]).lower().endswith(".xlsx"), prev[0]):
            best[month] = (ts, original)
    return best


def load_archive(db: Database | None, args, started: float) -> int:
    try:
        files = archive_files()
    except (urllib.error.URLError, OSError, ValueError) as exc:
        note = f"the Internet Archive's index didn't answer ({type(exc).__name__}: {str(exc)[:120]}); try again later"
        log(f"::warning::{note}")
        if db:
            record_run(db, SCRIPT, status="ok", rows_written=0, note=note, started_at=started)
        return 0
    # State's own listing starts in March 2017. The Archive also holds February 2017, whose by-post table
    # splits each post by nationality too (refused by from_pdf); it's left out unless asked for by --since.
    since = args.since or ARCHIVE_FIRST
    files = {m: v for m, v in files.items() if m >= since and (not args.until or m <= args.until)}
    log(f"{len(files)} months on the Internet Archive, {min(files) if files else '-'} to {max(files) if files else '-'}")
    record = (read_doc(db, RECORD) or {}) if db else {}
    seen = record.setdefault("files", {})
    written = loaded = 0
    refused: list[str] = []
    stopped = ""
    for month in sorted(files):
        if db and not args.force and month in seen:
            continue
        ts, original = files[month]
        try:
            data = fetch(f"https://web.archive.org/web/{ts}id_/{original}")
        except (urllib.error.URLError, OSError) as exc:
            stopped = f"the Archive stopped answering at {month} ({type(exc).__name__}); the rest wait for the next run"
            log(f"::warning::{stopped}")
            break
        try:
            rows, titled = parse(data, original)
            if titled and titled != month:
                raise Refusal(f"{month}: the table's own title says {titled}")
        except Refusal as exc:
            log(f"  REFUSED {exc}")
            refused.append(str(exc))
            time.sleep(ARCHIVE_PAUSE_S)
            continue
        loaded += 1
        if db is None:
            log(f"  {month}: {len(rows)} rows, {sum(rows.values()):,} visas")
        else:
            got = store(db, month, rows)
            written += got["written"]
            seen[month] = sha256(data)
            write_doc(db, RECORD, record)
            log(f"  {month}: {got}")
        time.sleep(ARCHIVE_PAUSE_S)
    if db is None:
        return 1 if refused else 0
    return finish(db, written, loaded, refused, started, stopped)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", nargs="+", help="files saved from State's page; the month is read from each name")
    ap.add_argument("--month", help="YYYY-MM, for one --local file whose name doesn't carry it")
    ap.add_argument("--archive", action="store_true", help="the Internet Archive's copies of State's files")
    ap.add_argument("--since")
    ap.add_argument("--until")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    if args.month and (not args.local or len(args.local) != 1):
        ap.error("--month names the month of one --local file")
    if args.month and not re.fullmatch(r"20\d\d-(0[1-9]|1[0-2])", args.month):
        ap.error("--month is YYYY-MM")

    if args.local:
        parsed: list[tuple[str, dict, bytes]] = []
        refused: list[str] = []
        for path in args.local:
            data = open(path, "rb").read()
            month = args.month or month_of(os.path.basename(path))
            try:
                if not month:
                    raise Refusal(f"{os.path.basename(path)}: no month in the name; give --month")
                rows, titled = parse(data, path)
                if titled and titled != month:
                    raise Refusal(f"{os.path.basename(path)}: loaded as {month}, but its own title says {titled}")
            except Refusal as exc:
                log(f"REFUSED {exc}")
                refused.append(str(exc))
                continue
            log(f"  {month}: {len(rows)} rows, {sum(rows.values()):,} visas, "
                f"{sum(n for (_, c), n in rows.items() if c == 'K1'):,} K-1, "
                f"{sum(n for (_, c), n in rows.items() if c == 'H1B'):,} H-1B")
            parsed.append((month, rows, data))
        if args.dry_run:
            return 1 if refused else 0
        db = Database()
        if not parsed:
            record_run(db, SCRIPT, status="failed", rows_written=0,
                       note=f"every file refused: {'; '.join(refused[:3])}"[:900], started_at=started)
            return 1
        db.script(DDL)
        record = read_doc(db, RECORD) or {}
        written = 0
        for month, rows, data in parsed:
            got = store(db, month, rows)
            written += got["written"]
            record.setdefault("files", {})[month] = sha256(data)
            log(f"  {month}: {got}")
        write_doc(db, RECORD, record)
        return finish(db, written, len(parsed), refused, started)

    db = None if args.dry_run else Database()
    if db:
        db.script(DDL)
    if args.archive:
        return load_archive(db, args, started)

    try:
        files = listing(fetch(PAGE).decode("utf-8", "replace"))
    except urllib.error.HTTPError as exc:
        if not state_refused(exc):
            raise
        note = f"{STATE_CLOSED}; save a month's by-post file from a browser and load it with --local"
        log(f"::warning::{note}")
        if db:
            restamp_note(db, DATASET, note)
            record_run(db, SCRIPT, status="ok", rows_written=0, note=note, started_at=started)
        return 0
    if args.since:
        files = {m: u for m, u in files.items() if m >= args.since}
    log(f"{len(files)} by-post files linked, {min(files) if files else '-'} to {max(files) if files else '-'}")
    record = (read_doc(db, RECORD) or {}) if db else {}
    seen = record.setdefault("files", {})
    written = loaded = 0
    refused = []
    for month, url in sorted(files.items(), reverse=True):
        data = fetch(url, referer=PAGE)
        if db and not args.force and seen.get(month) == sha256(data):
            continue
        try:
            rows, titled = parse(data, url)
            if titled and titled != month:
                raise Refusal(f"{month}: the table's own title says {titled}")
        except Refusal as exc:
            log(f"  REFUSED {exc}")
            refused.append(str(exc))
            continue
        loaded += 1
        if db is None:
            log(f"  {month}: {len(rows)} rows, {sum(rows.values()):,} visas")
            continue
        got = store(db, month, rows)
        written += got["written"]
        seen[month] = sha256(data)
        write_doc(db, RECORD, record)
        time.sleep(iv.POLITE_PAUSE_S)
    if db is None:
        return 1 if refused else 0
    return finish(db, written, loaded, refused, started)


if __name__ == "__main__":
    sys.exit(main())
