#!/usr/bin/env python3
"""Load ICE's "Top 200 Employers" lists for OPT, STEM OPT and CPT students.

WHAT IT IS. In its yearly "SEVIS by the Numbers" release, ICE's Student and
Exchange Visitor Program names the 200 employers with the most F-1 students
in Optional Practical Training (OPT, and its STEM extension) and in
Curricular Practical Training (CPT). It is the only federal count of OPT
employers; every "OPT-friendly" badge elsewhere is inferred. Top 200 only,
under ICE's own names for employers ("Amazon", "University of California"),
which are not legal entities, so the page lists them as ICE printed them and
links a search rather than claiming a match to an employer's record.

ICE's footnote, kept with the data: a student employed at the same employer
in two programs is counted once in each, so an employer's OPT and STEM OPT
counts can add up to more than its combined count.

DISCOVERED, NEVER CONSTRUCTED. The PDFs are linked from ICE's "What's New"
page (https://www.ice.gov/sevis/whats-new) under names that change shape
from year to year (`17_0623_hsi_sevp-sevis-btn-2017-top200-employers-...`,
`2024/2024_Top200_Employers_OPT_STEM_OPT_Students.pdf`). Single-year lists
only; the cumulative 2003-2018 and 2003-2019 lists are skipped. Years ICE
didn't link (2020 to 2023 when this was written) aren't invented.

HOW A LIST IS CHECKED. Numbers are read by POSITION, not by order, because
a blank cell (an employer with only OPT students) would otherwise shift a
count into the wrong column: each number is assigned to the column whose
right edge it shares. A list must hold 190 to 210 employers, ranked by a
combined count that never rises, and on the OPT lists the combined count
must sit between the larger of the two parts and their sum.

Usage:
    python3 scripts/ingest_sevp_top_employers.py               # discover and load every list
    python3 scripts/ingest_sevp_top_employers.py --dry-run     # parse and check, write nothing
    python3 scripts/ingest_sevp_top_employers.py --local DIR   # parse the PDFs in DIR
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import discover_links, fetch, log  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_sevp_top_employers.py"
PAGE = "https://www.ice.gov/sevis/whats-new"
HOST = "https://www.ice.gov"
TABLE = "sevp_top_employers"
DOC = "sevp_top_employers"
NUM = re.compile(r"^\d{1,3}(?:,\d{3})*$")
EDGE_TOLERANCE = 6  # points: right-aligned numbers in one column share an edge within this


class Refusal(Exception):
    """A list that must not be written, with the reason."""


def identify(name: str) -> tuple[int, str] | None:
    """(year, "opt" | "cpt") for a single-year list's filename; None for anything else."""
    n = name.lower()
    if "top200" not in n or "employer" not in n or re.search(r"20\d\d-20\d\d", n):
        return None
    years = re.findall(r"(?<!\d)(20[12]\d)(?!\d)", n)
    if not years:
        return None
    kind = "cpt" if "cpt" in n else "opt" if "opt" in n else None
    return (int(years[-1]), kind) if kind else None


def lines_of(words: list[dict]) -> list[list[dict]]:
    """Words grouped into lines by their top edge, left to right."""
    rows: dict[int, list[dict]] = {}
    for w in words:
        rows.setdefault(round(float(w["top"])), []).append(w)
    out = []
    for top in sorted(rows):
        out.append(sorted(rows[top], key=lambda w: float(w["x0"])))
    return out


def trailing_numbers(line: list[dict]) -> list[dict]:
    """The numbers at the END of a line, after its last word: a data row's counts.

    A title ("2017 Top 200 Employers for CPT Students") and the column header
    carry numbers too, but followed by words, so they never qualify.
    """
    out: list[dict] = []
    for w in reversed(line):
        if not NUM.match(w["text"]):
            break
        out.append(w)
    return list(reversed(out)) if len(out) < len(line) else []


def parse(pages: list[list[dict]], kind: str) -> list[dict]:
    """Rows of (employer, total, opt, stem_opt) or (employer, cpt), from pdfplumber words per page."""
    want = 3 if kind == "opt" else 1
    rows: list[dict] = []
    for words in pages:
        lines = lines_of(words)
        # The columns' right edges, from the lines that carry every number.
        full = [ln for ln in lines if len(trailing_numbers(ln)) == want]
        if not full:
            continue
        edges = sorted({round(float(w["x1"])) for ln in full for w in trailing_numbers(ln)})
        cols: list[int] = []
        for e in edges:
            if not cols or e - cols[-1] > EDGE_TOLERANCE:
                cols.append(e)
        if len(cols) != want:
            raise Refusal(f"expected {want} number columns, found right edges {cols}")
        # A line of words between two rows would be a name that wrapped, and
        # its first half would be lost; none of the lists read so far wraps.
        data = [i for i, ln in enumerate(lines) if trailing_numbers(ln)]
        for i in range(data[0], data[-1] + 1) if data else ():
            if i not in data:
                raise Refusal(f"a line between rows with no count: {' '.join(w['text'] for w in lines[i])!r}")
        for ln in lines:
            # A number on a column's edge is a count; anywhere else it's part of the name ("Studio 54").
            def on_edge(w: dict) -> bool:
                return bool(NUM.match(w["text"])) and min(abs(c - round(float(w["x1"]))) for c in cols) <= EDGE_TOLERANCE
            nums = [w for w in trailing_numbers(ln) if on_edge(w)]
            if not nums:
                continue
            name = " ".join(w["text"] for w in ln if w not in nums).strip()
            if not name:
                raise Refusal(f"a line of numbers with no employer: {[w['text'] for w in ln]}")
            cells: list[int | None] = [None] * want
            for w in nums:
                x1 = round(float(w["x1"]))
                idx = min(range(want), key=lambda i: abs(cols[i] - x1))
                if cells[idx] is not None:
                    raise Refusal(f"two numbers in one column: {name} {w['text']} at {x1}")
                cells[idx] = int(w["text"].replace(",", ""))
            if kind == "opt":
                total, opt, stem = cells
                if total is None:
                    raise Refusal(f"{name}: no combined count")
                rows.append({"employer": name, "total": total, "opt": opt, "stem_opt": stem, "cpt": None})
            else:
                rows.append({"employer": name, "total": cells[0], "opt": None, "stem_opt": None, "cpt": cells[0]})
    check(rows, kind)
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return rows


# ICE's own lists aren't always in order: 2019's CPT list prints Populus Group
# (233) above Apple (323). One or two such rows are ICE's, and are kept as
# printed and named; more than that means the rows were read out of order.
MAX_OUT_OF_ORDER = 2


def out_of_order(rows: list[dict]) -> list[str]:
    return [f"{b['employer']} ({b['total']:,}) is listed below {a['employer']} ({a['total']:,})"
            for a, b in zip(rows, rows[1:]) if b["total"] > a["total"]]


def check(rows: list[dict], kind: str) -> None:
    if not 190 <= len(rows) <= 210:
        raise Refusal(f"{len(rows)} employers on a top-200 list")
    odd = out_of_order(rows)
    if len(odd) > MAX_OUT_OF_ORDER:
        raise Refusal(f"{len(odd)} rows out of order, more than ICE's own slips: {odd[:3]}")
    if kind == "opt":
        for r in rows:
            parts = [v for v in (r["opt"], r["stem_opt"]) if v is not None]
            if not parts or r["total"] < max(parts) or r["total"] > sum(parts):
                raise Refusal(f"{r['employer']}: combined {r['total']} against OPT {r['opt']} and STEM OPT {r['stem_opt']}")


def pdf_words(blob: bytes) -> list[list[dict]]:
    import pdfplumber  # imported here so the parser tests need no PDF library

    with pdfplumber.open(io.BytesIO(blob)) as pdf:
        return [[{"text": w["text"], "x0": w["x0"], "x1": w["x1"], "top": w["top"]} for w in p.extract_words()]
                for p in pdf.pages]


def store(db: Turso, year: int, kind: str, rows: list[dict], name: str) -> int:
    db.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        year INTEGER NOT NULL, list TEXT NOT NULL, rank INTEGER NOT NULL, employer TEXT NOT NULL,
        total INTEGER NOT NULL, opt INTEGER, stem_opt INTEGER, cpt INTEGER, source_file TEXT NOT NULL,
        PRIMARY KEY (year, list, rank))""")
    cols = ["year", "list", "rank", "employer", "total", "opt", "stem_opt", "cpt", "source_file"]
    values = [[year, kind, r["rank"], r["employer"], r["total"], r["opt"], r["stem_opt"], r["cpt"], name] for r in rows]
    db.execute(f"DELETE FROM {TABLE} WHERE year = ? AND list = ?", [year, kind])
    holes = "(" + ",".join("?" * len(cols)) + ")"
    for i in range(0, len(values), 100):
        chunk = values[i:i + 100]
        db.execute(f"INSERT INTO {TABLE} ({', '.join(cols)}) VALUES " + ",".join([holes] * len(chunk)),
                   [v for r in chunk for v in r])
    held = int(db.scalar(f"SELECT count(*) FROM {TABLE} WHERE year = ? AND list = ?", [year, kind]) or 0)
    if held != len(rows):
        raise Refusal(f"{year} {kind}: {held} rows held, {len(rows)} parsed")
    return held


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--local", help="parse the PDFs in this directory instead of fetching")
    args = ap.parse_args(argv)
    started = int(time.time() * 1000)

    if args.local:
        found = {p.name: p for p in pathlib.Path(args.local).glob("*.pdf")}
    else:
        html = fetch(PAGE).decode("utf-8", errors="replace")
        found = discover_links(html, r".*top200.*employer.*\.pdf$", HOST)
    lists: dict[tuple[int, str], tuple[str, object]] = {}
    for name, where in found.items():
        ident = identify(name)
        if ident:
            # A re-issued file (`..._0.pdf`) replaces the earlier one for its year.
            if ident not in lists or name > lists[ident][0]:
                lists[ident] = (name, where)
    if not lists:
        log("REFUSED: no single-year top-200 lists found")
        return 1
    db = None if args.dry_run else Turso()
    summary: dict[str, dict] = {}
    written = 0
    try:
        for (year, kind), (name, where) in sorted(lists.items()):
            blob = where.read_bytes() if isinstance(where, pathlib.Path) else fetch(str(where), referer=PAGE)
            rows = parse(pdf_words(blob), kind)
            log(f"  {year} {kind.upper()}: {len(rows)} employers, top {rows[0]['employer']} {rows[0]['total']:,} ({name})")
            summary[f"{year}-{kind}"] = {"year": year, "list": kind, "employers": len(rows), "file": name,
                                         "as_printed": out_of_order(rows)}
            if db:
                written += store(db, year, kind, rows, name)
    except Refusal as e:
        log(f"REFUSED: {e}")
        if db:
            record_run(db, SCRIPT, status="failed", rows_written=written, note=str(e)[:300], started_at=started)
        return 1
    if db:
        write_doc(db, DOC, json.dumps({"page": PAGE, "lists": summary, "read": time.strftime("%Y-%m-%d")}, sort_keys=True))
        newest = max(y for y, _ in lists)
        stamp_freshness(db, "sevp-top-employers", as_of=f"{newest}-12-31", source=PAGE, cadence="Yearly",
                        note=f"top-200 lists for {sorted({y for y, _ in lists})}", max_age_days=900)
        record_run(db, SCRIPT, status="ok", rows_written=written, note=f"{len(lists)} lists", started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
