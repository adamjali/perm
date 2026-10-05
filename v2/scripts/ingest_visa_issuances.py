#!/usr/bin/env python3
"""Load the State Department's monthly immigrant visa issuances.

WHAT IT IS. Each month State publishes how many immigrant visas its consulates
issued, by visa class, once by foreign state of chargeability (or place of
birth) and once by consulate ("post"): every green card issued ABROAD that
month. A green card granted inside the United States (adjustment of status at
USCIS) is not in these tables, and for employment categories that is most of
them, so the pages say whose count this is.

WHERE. travel.state.gov refuses scripts; the State Department serves the same
pages from adoption.state.gov, where the monthly page links each month's files:
Excel from October 2024, PDF from March 2017. Excel is read when a month has
both. Names are discovered from the page and the month read from each name
("MAY2024 - ...", "SEPT 2018 - ...", "March 2017 - ... - Worldwide").

HOW A FILE IS CHECKED. Each table ends in State's GRAND TOTAL; a file loads only
when its rows add up to it exactly. A PDF is read by word position: a line's
last number (its pieces joined, since the text layer splits "57,983" into "5"
and "7,983"), the symbol before it, and the name before that.

CATEGORIES come from State's own legend, "Immigrant Visa Symbols", linked from
the same page: E1 to EB-1, E2 to EB-2, E3 to EB-3 skilled and professional, EW
to EB-3 other workers, C5/T5/R5/I5 and the 2022 regional-center symbols to
EB-5, and so on (`category_of`).

Usage:
    python3 scripts/ingest_visa_issuances.py                 # discover; load new or changed months
    python3 scripts/ingest_visa_issuances.py --since 2024-01 # only months from then on
    python3 scripts/ingest_visa_issuances.py --dry-run [--local FILE --month YYYY-MM --dim fsc|post]
"""
from __future__ import annotations

import argparse
import calendar
import io
import os
import re
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import POLITE_PAUSE_S, fetch, log  # noqa: E402
from lib_reference import sha256, sheet_rows, sync_rows  # noqa: E402
from lib_turso import Turso, read_doc, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_visa_issuances.py"
HOST = "https://adoption.state.gov"
PAGE = HOST + "/content/travel/en/legal/visa-law0/visa-statistics/immigrant-visa-statistics/monthly-immigrant-visa-issuances.html"
TABLE = "visa_issuances"
COLS = ("month", "dim", "key", "visa_class", "n", "category", "group_key")
RECORD = "visa_issuances_load"
MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), start=1)}
SYMBOL = re.compile(r"^[A-Z][A-Z0-9]{0,3}$")
NUMBER = re.compile(r"^[\d,]+$")
# A month's worldwide table holds a few hundred to a few thousand rows.
MIN_ROWS = 200

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        month TEXT NOT NULL, dim TEXT NOT NULL, key TEXT NOT NULL, visa_class TEXT NOT NULL,
        n INTEGER NOT NULL, category TEXT NOT NULL, group_key TEXT NOT NULL,
        PRIMARY KEY (month, dim, key, visa_class))""",
    # The page's reads: one category over time, and one country's categories.
    f"CREATE INDEX IF NOT EXISTS {TABLE}_cat ON {TABLE} (dim, category, month)",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_group ON {TABLE} (dim, group_key, month)",
]

# State's legend groups. Order matters: the first prefix that matches wins.
CATEGORIES: list[tuple[str, tuple[str, ...]]] = [
    ("EB-1", ("E1",)),
    ("EB-2", ("E2",)),
    ("EB-3", ("E3",)),
    ("EB-3 other workers", ("EW",)),
    ("EB-4", ("BC", "SD", "SE", "SF", "SG", "SH", "SJ", "SK", "SL", "SN", "SR", "SS")),
    ("EB-5", ("C5", "T5", "R5", "I5", "NU", "NR", "NH", "RU", "RR", "RH", "RI")),
    ("Immediate relatives", ("IR", "IH", "CR", "IW", "IB", "VI")),
    ("Family preferences", ("F", "B1", "B2", "B3", "B4", "BX", "C2", "C3", "C4", "CX")),
    ("Diversity", ("DV",)),
    ("Special immigrants", ("GS", "GV", "SB", "SC", "SI", "SM", "SQ", "SU", "AM")),
]


class Refusal(Exception):
    """A file that must not be written, with the reason."""


def category_of(symbol: str) -> str:
    for name, prefixes in CATEGORIES:
        if symbol.startswith(prefixes):
            return name
    return "Other"


def group_key(name: str) -> str:
    """One key per country or post across State's spellings: "China-Mainland
    born" (2017) and "China - mainland born" (2024) are one place."""
    return re.sub(r"\s+", " ", re.sub(r"\s*-\s*", " - ", name)).strip().casefold()


def month_of(name: str) -> str | None:
    """'2024-05' from "MAY2024 - ...", "SEPT 2018 - ...", "March 2017 - ..."."""
    m = re.search(r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*-?\s*(20\d\d)", name)
    if not m:
        return None
    return f"{m.group(2)}-{MONTHS[m.group(1).lower()]:02d}"


def dim_of(name: str) -> str | None:
    n = name.lower()
    if "by post" in n:
        return "post"
    if "by fsc" in n:
        return "fsc"
    return None


def listing(html: str) -> dict[tuple[str, str], str]:
    """(month, dim) -> the file to read: the Excel one when a month has both."""
    found: dict[tuple[str, str], str] = {}
    for href in re.findall(r'href="(/content/dam/visas/Statistics/Immigrant-Statistics/MonthlyIVIssuances/[^"]+)"', html):
        name = urllib.parse.unquote(href.rsplit("/", 1)[-1])
        month, dim = month_of(name), dim_of(name)
        if not month or not dim or not name.lower().endswith((".pdf", ".xlsx")):
            continue
        prev = found.get((month, dim))
        if prev is None or (href.lower().endswith(".xlsx") and not prev.lower().endswith(".xlsx")):
            found[(month, dim)] = HOST + href
    return found


def total_check(rows: dict[tuple[str, str], int], grand: int | None, label: str) -> None:
    if grand is None:
        raise Refusal(f"{label}: no GRAND TOTAL row")
    got = sum(rows.values())
    if got != grand:
        raise Refusal(f"{label}: rows add to {got:,}, GRAND TOTAL says {grand:,}")
    if len(rows) < MIN_ROWS:
        raise Refusal(f"{label}: only {len(rows)} rows")


def from_xlsx(data: bytes, label: str) -> dict[tuple[str, str], int]:
    rows: dict[tuple[str, str], int] = {}
    grand = None
    for r in sheet_rows(data):
        cells = [c.strip() for c in r] + ["", "", ""]
        name, symbol, count = cells[0], cells[1], cells[2]
        if name.upper().startswith("GRAND TOTAL"):
            grand = int(float(count.replace(",", ""))) if count else None
            continue
        if not name or not SYMBOL.match(symbol) or not NUMBER.match(count.replace(".0", "")):
            continue
        key = (name, symbol)
        rows[key] = rows.get(key, 0) + int(float(count.replace(",", "")))
    total_check(rows, grand, label)
    return rows


def lines_of(words: list[dict]) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (round(float(w["top"])), float(w["x0"]))):
        if lines and abs(float(lines[-1][0]["top"]) - float(w["top"])) <= 2.5:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(line, key=lambda w: float(w["x0"])) for line in lines]


def parse_line(line: list[dict]) -> tuple[str, str | None, int | None]:
    """(name, symbol, count) from one line's words; symbol None for a line
    that isn't a table row. A count's pieces are joined when they touch."""
    texts = [w["text"] for w in line]
    i = len(line)
    while i > 0 and NUMBER.match(texts[i - 1]) and (
            i == len(line) or float(line[i]["x0"]) - float(line[i - 1]["x1"]) < 3):
        i -= 1
    if i == len(line):
        return " ".join(texts), None, None
    count = int("".join(texts[i:]).replace(",", ""))
    head = texts[:i]
    if head and SYMBOL.match(head[-1]) and not (len(head) >= 2 and head[-2].upper() == "GRAND"):
        return " ".join(head[:-1]), head[-1], count
    return " ".join(head), None, count


def from_pdf(data: bytes, label: str) -> dict[tuple[str, str], int]:
    import pdfplumber  # the server has it; only PDF months need it

    rows: dict[tuple[str, str], int] = {}
    grand = None
    name = ""
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            for line in lines_of(page.extract_words(keep_blank_chars=False, use_text_flow=False)):
                text, symbol, count = parse_line(line)
                if text.upper().startswith("GRAND TOTAL") and count is not None:
                    grand = count
                    continue
                if symbol is None or count is None:
                    continue
                # A row whose name cell is empty belongs to the name above it.
                name = text or name
                if not name:
                    continue
                key = (name, symbol)
                rows[key] = rows.get(key, 0) + count
    total_check(rows, grand, label)
    return rows


def parse(data: bytes, url: str) -> dict[tuple[str, str], int]:
    label = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    return from_xlsx(data, label) if url.lower().endswith(".xlsx") else from_pdf(data, label)


def summary(db: Turso) -> dict:
    from lib_turso import query_rows
    by_month: dict[str, dict[str, int]] = {}
    for month, cat, n in query_rows(db, f"SELECT month, category, sum(n) FROM {TABLE} WHERE dim = 'fsc' GROUP BY 1, 2"):
        by_month.setdefault(month, {})[cat] = int(n)
    months = sorted(by_month)
    return {"months": months, "newest": months[-1] if months else None,
            "byMonth": {m: by_month[m] for m in months}}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--local")
    ap.add_argument("--month")
    ap.add_argument("--dim", choices=("fsc", "post"))
    args = ap.parse_args()
    started = time.time()

    if args.local:
        rows = parse(open(args.local, "rb").read(), args.local)
        cats: dict[str, int] = {}
        for (_, symbol), n in rows.items():
            cats[category_of(symbol)] = cats.get(category_of(symbol), 0) + n
        log(f"  {len(rows)} rows, {sum(rows.values()):,} visas; {dict(sorted(cats.items()))}")
        return 0

    files = listing(fetch(PAGE).decode("utf-8", "replace"))
    if args.since:
        files = {k: v for k, v in files.items() if k[0] >= args.since}
    log(f"{len(files)} month files linked, {min(files)[0] if files else '-'} to {max(files)[0] if files else '-'}")
    db = None if args.dry_run else Turso()
    if db:
        db.script(DDL)
    record = (read_doc(db, RECORD) or {}) if db else {}
    seen = record.get("files", {})
    written = loaded = 0
    refused: list[str] = []
    for (month, dim), url in sorted(files.items(), reverse=True):
        data = fetch(url, referer=PAGE)
        digest = sha256(data)
        if not args.force and seen.get(f"{month}|{dim}") == digest:
            continue
        try:
            rows = parse(data, url)
        except Refusal as exc:
            log(f"  REFUSED {exc}")
            refused.append(str(exc))
            continue
        loaded += 1
        if db is None:
            log(f"  {month} {dim}: {len(rows)} rows, {sum(rows.values()):,} visas")
            continue
        got = sync_rows(db, TABLE, ("month", "dim", "key", "visa_class"), COLS,
                        [(month, dim, k, s, n, category_of(s), group_key(k)) for (k, s), n in sorted(rows.items())],
                        scope_sql="month = ? AND dim = ?", scope_args=[month, dim])
        written += got["written"]
        seen[f"{month}|{dim}"] = digest
        write_doc(db, RECORD, {"files": seen})
        log(f"  {month} {dim}: {got}")
        time.sleep(POLITE_PAUSE_S)
    if db is None:
        return 1 if refused else 0
    doc = summary(db)
    write_doc(db, "visa_issuances_summary", doc)
    if doc["newest"]:
        y, m = map(int, doc["newest"].split("-"))
        stamp_freshness(db, "visa-issuances", as_of=f"{doc['newest']}-{calendar.monthrange(y, m)[1]:02d}",
                        source=PAGE, cadence="monthly, posted months late",
                        note=f"{len(doc['months'])} months, newest {doc['newest']}", max_age_days=330)
    status = "ok" if not refused else "failed"
    record_run(db, SCRIPT, status=status, rows_written=written,
               note=f"{loaded} files loaded; refused {len(refused)}: {'; '.join(refused[:3])}", started_at=started)
    return 0 if not refused else 1


if __name__ == "__main__":
    sys.exit(main())
