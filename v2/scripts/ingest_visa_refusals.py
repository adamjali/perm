#!/usr/bin/env python3
"""Load State's yearly table of visa refusals by ground of ineligibility.

WHAT IT IS. Each year's Report of the Visa Office carries a table titled "Immigrant and
Nonimmigrant Visa Ineligibilities (by Grounds for Refusal Under the Immigration and
Nationality Act)": for every ground in the law, worldwide, how many applications consular
officers found ineligible on it that fiscal year and how many such findings were overcome,
for immigrant and nonimmigrant visas apart. Public charge is 212(a)(4); a missing document
is 221(g); a visitor or student who couldn't show they'd return home is 214(b).

READ THE TABLE BY ITS TITLE, NEVER ITS NUMBER. It's Table XX for FY2000 to FY2019 and
Table XIX from FY2020, and in FY2000 to FY2012 the file named Table XIX is a different table
(nonimmigrant visas by post). A file without the title is refused.

WHAT A CELL MEANS. "-" (and N/A, or the footnote marker State printed instead in FY2000 to
FY2002) is "not applicable": that ground can't apply to that kind of visa. It's stored as
NULL, never 0. Overcome can exceed findings: State's footnote 2 says a refusal may be
overcome in a later fiscal year and each action is recorded in the year it happened.

HOW A FILE IS READ, by word position. The four figures are a line's last four tokens; a
ground's code sits left of the description column, which is found on each page from where
the INA codes' descriptions start. A ground wraps onto two or three lines, and State has put
its figures on the first line (FY2002 on) and on the last (FY2000, FY2001): the lines between
two lines of figures belong to the next ground from the first line that starts a code, else
to the ground above. Footnote markers (the small type) are dropped from the text.

HOW IT'S CHECKED. Every table ends in "Total Grounds of Ineligibility:" and its four totals;
each column of grounds must add up to its total exactly, every ground must have a code and
a description, and the fiscal year in the title must be the one asked for. A file failing
any check writes nothing.

Usage:
    python3 scripts/ingest_visa_refusals.py --local FILE [FILE ...]     # the year is read from each table's title
    python3 scripts/ingest_visa_refusals.py --local FILE --fy 2024      # and must be 2024
    python3 scripts/ingest_visa_refusals.py --local DIR/fy*.pdf --manifest DIR/manifest.json  # keeps each year's State address
    python3 scripts/ingest_visa_refusals.py --dry-run --local FILE      # parse and check, write nothing

travel.state.gov refuses scripts, so a year's PDF comes from a person's browser (or the
Internet Archive's copy, for older years); any year's file loads with no code change.

Writes `visa_refusals`, `perm_docs['visa_refusals_summary']` and `['visa_refusals_load']`, the
`visa-refusals` freshness row and a run row; asks the site to rebuild /visa-refusals after a
write (/api/revalidate-consular, which lists it).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import statistics
import sys
import time
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_visa_issuances import lines_of  # noqa: E402
from lib_db import Database, et_today, read_doc, record_run, stamp_freshness, write_doc  # noqa: E402
from lib_gov_data import log  # noqa: E402
from lib_policy_feed import expire_policy_page  # noqa: E402
from lib_reference import sha256, sync_rows  # noqa: E402

SCRIPT = "ingest_visa_refusals.py"
DATASET = "visa-refusals"
SOURCE = "State Department, Report of the Visa Office: visa ineligibilities by ground (state.gov)"
TABLE = "visa_refusals"
KEY = ("fy", "line")
FIGURES = ("iv_found", "iv_overcome", "niv_found", "niv_overcome")
COLS = (*KEY, "ground_code", "ground", *FIGURES)
RECORD = "visa_refusals_load"
SUMMARY = "visa_refusals_summary"
REFRESH_ROUTE = "/api/revalidate-consular"
TITLE = "Immigrant and Nonimmigrant Visa Ineligibilities"
# A year's table is posted in the next year's Report of the Visa Office, more than a year
# after the fiscal year ends: FY2025's wasn't out on Nov 5 2026, thirteen months after it
# ended. The row is dated the year's last day (Sept 30), so 900 days warns when the next
# year's table is about 17 months later than its year's end.
MAX_AGE_DAYS = 900
# State's tables hold 55 grounds (FY2000) to 83 (FY2024); fewer is a truncated read.
MIN_GROUNDS = 40

NUMBER = re.compile(r"^(?:\d{1,3}(?:,\d{3})+|\d+)$")
NOT_APPLICABLE = re.compile(r"^(?:[-‐-―−]|N/A)$")
INA_CODE = re.compile(r"^\d{3}(?:\([0-9A-Za-z]+\))+\)?$|^\d{3}(?:\([0-9A-Za-z]+\))*\([0-9A-Za-z]*$")
FY_RE = re.compile(r"Fiscal\s+Year\s+(\d{4})")
TOTAL_RE = re.compile(r"total\s+grounds\s+of\s+ineligibility", re.I)
# Section 212(a)(4), the ground the pages lead with; tests hold its figures.
PUBLIC_CHARGE = "212(a)(4)"
# Where State's own total disagrees with its own rows, allowed by name only: (fy, column) ->
# (the difference, the one ground that is exactly that difference, why). Any other mismatch
# refuses the file. Each is recorded in the summary doc and said on the page.
KNOWN_GAPS: dict[tuple[int, str], tuple[int, str, str]] = {
    # FY2024's rows add to 273,928 immigrant findings and State's total says 273,845: 83 short,
    # exactly its first row, 101(a)(27)(D)(i), a ground no earlier year's table carries. Every
    # other column adds up exactly. Read Nov 5 2026 in State's own PDF.
    (2024, "iv_found"): (83, "101(a)(27)(D)(i)",
                         "State's total for immigrant findings leaves out the table's first row, 101(a)(27)(D)(i) "
                         "(Unqualified Special Immigrant, 83 findings), a ground the table carries for the first time "
                         "in FY2024. Every other row adds up to the total exactly."),
}


class Refusal(Exception):
    """A file that must not be written, with the reason."""


def _small(w: dict, body: float) -> bool:
    """A footnote marker: type well under the table's body size."""
    return float(w.get("size") or body) < body * 0.8


def _value_token(w: dict, body: float) -> bool:
    t = w["text"]
    return bool(NUMBER.match(t) or NOT_APPLICABLE.match(t))


def _figure(w: dict, body: float) -> int | None:
    """A cell: a count, or None for "not applicable" (a dash, N/A, or a footnote marker in the cell)."""
    if _small(w, body) or NOT_APPLICABLE.match(w["text"]):
        return None
    return int(w["text"].replace(",", ""))


def _join_code(pieces: list[str]) -> str:
    """A code wrapped over lines: "212(a)(2)(A)(i)(II" and ")" are one code."""
    out = ""
    for p in pieces:
        if not out:
            out = p
        elif p.startswith(")") or out.endswith("("):
            out += p
        else:
            out += " " + p
    return out


def description_x(lines: list[list[dict]]) -> float | None:
    """Where the description column starts on a page: where the INA codes' descriptions do."""
    starts = Counter(round(float(ln[1]["x0"])) for ln in lines if len(ln) > 1 and INA_CODE.match(ln[0]["text"]))
    return starts.most_common(1)[0][0] - 3 if starts else None


def page_lines(page, carried_x: float | None = None) -> tuple[list[dict], float | None]:
    """A page's lines, each as its code text, description text and figures (None when it has none),
    and the description column's edge. A page with no INA code on it (the total alone, on the last
    page from FY2016) takes the edge the page before it had."""
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=["size"])
    if not words:
        return [], carried_x
    body = statistics.median(float(w.get("size") or 10) for w in words)
    lines = lines_of(words)
    desc_x = description_x(lines) or carried_x
    if desc_x is None:
        return [], None
    out: list[dict] = []
    begun = False
    for ln in lines:
        run = 0
        while run < len(ln) and float(ln[-1 - run]["x0"]) >= desc_x and _value_token(ln[-1 - run], body):
            run += 1
        # Four cells, at least one in the table's own type: a header's row of footnote markers
        # ("1 2 1 2" over Finding and Overcome) is a line of its own and no ground's figures.
        figures = ([_figure(w, body) for w in ln[-4:]]
                   if run >= 4 and any(not _small(w, body) for w in ln[-4:]) else None)
        text_words = ln[:-4] if figures is not None else ln
        code = [w["text"] for w in text_words if float(w["x0"]) < desc_x and not _small(w, body)]
        desc = [w["text"] for w in text_words if float(w["x0"]) >= desc_x and not _small(w, body)]
        joined = " ".join(w["text"] for w in ln)
        if TOTAL_RE.search(joined):
            out.append({"total": figures, "text": joined})
            break
        if not begun:
            # The table starts at its first ground: a line of figures, or a line opening with a code.
            if figures is None and not (code and INA_CODE.match(code[0])):
                continue
            begun = True
        if not code and not desc and figures is None:
            continue
        if set("".join(code + desc)) <= {"_"}:
            continue
        out.append({"code": code, "desc": desc, "figures": figures})
    return out, desc_x


def _starts_code(line: dict) -> bool:
    """A line whose code column opens a ground (a closing fragment like ")" doesn't)."""
    text = " ".join(line["code"])
    return bool(text) and not re.fullmatch(r"[)\]\s]+", text)


def parse(data: bytes, label: str) -> dict:
    """{"fy", "grounds": [{line, ground_code, ground, iv_found, ...}], "totals": {...}} from one table's PDF."""
    import pdfplumber  # the server and CI have it

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        first = " ".join((pdf.pages[0].extract_text() or "").split())
        if TITLE.casefold() not in first.casefold() or "grounds for refusal" not in first.casefold():
            raise Refusal(f"{label}: not State's table of visa ineligibilities by ground (its title is missing)")
        m = FY_RE.search(first)
        if not m:
            raise Refusal(f"{label}: no 'Fiscal Year' in the table's title")
        fy = int(m.group(1))
        body: list[dict] = []
        totals = None
        desc_x: float | None = None
        for page in pdf.pages:
            lines, desc_x = page_lines(page, desc_x)
            for line in lines:
                if "total" in line:
                    totals = line["total"]
                    break
                body.append(line)
            if totals is not None:
                break
    return read_table(fy, body, totals, label)


def read_table(fy: int, body: list[dict], totals: list | None, label: str) -> dict:
    """The grounds from a table's lines (`page_lines`), checked against State's total line."""
    if totals is None or any(t is None for t in totals):
        raise Refusal(f"{label}: no 'Total Grounds of Ineligibility' line with four totals")

    groups: list[list[dict]] = []
    pending: list[dict] = []
    for line in body:
        if line["figures"] is None:
            pending.append(line)
            continue
        if _starts_code(line):
            cut = len(pending)
        else:
            cut = next((i for i, p in enumerate(pending) if _starts_code(p)), len(pending))
        if groups:
            groups[-1].extend(pending[:cut])
        groups.append(pending[cut:] + [line])
        pending = []
    if groups:
        groups[-1].extend(pending)

    grounds = []
    for i, g in enumerate(groups, start=1):
        figures = next(x["figures"] for x in g if x["figures"] is not None)
        code = _join_code([w for x in g for w in x["code"]])
        ground = " ".join(" ".join(w for x in g for w in x["desc"]).split())
        if not code or not ground:
            raise Refusal(f"{label}: ground {i} has no {'code' if not code else 'description'} ({code or ground!r})")
        grounds.append({"line": i, "ground_code": code, "ground": ground,
                        **dict(zip(FIGURES, figures))})
    if len(grounds) < MIN_GROUNDS:
        raise Refusal(f"{label}: only {len(grounds)} grounds")
    want = dict(zip(FIGURES, totals))
    sums = {col: sum(g[col] or 0 for g in grounds) for col in FIGURES}
    gaps = {col: sums[col] - want[col] for col in FIGURES if sums[col] != want[col]}
    known = []
    for col, gap in gaps.items():
        allowed = KNOWN_GAPS.get((fy, col))
        row = next((g for g in grounds if allowed and g["ground_code"] == allowed[1]), None)
        if not (allowed and gap == allowed[0] and row and row[col] == gap):
            off = "; ".join(f"{c} adds to {sums[c]:,}, State's total says {want[c]:,}" for c in gaps)
            raise Refusal(f"{label}: FY{fy} {off}")
        known.append({"column": col, "rowsAddTo": sums[col], "stateTotal": want[col], "ground": allowed[1],
                      "why": allowed[2]})
    return {"fy": fy, "grounds": grounds, "totals": want, "knownGaps": known}


def store(db: Database, table: dict) -> dict:
    rows = [(table["fy"], g["line"], g["ground_code"], g["ground"], *(g[c] for c in FIGURES)) for g in table["grounds"]]
    return sync_rows(db, TABLE, KEY, COLS, rows, scope_sql="fy = ?", scope_args=[table["fy"]])


DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        fy INTEGER NOT NULL, line INTEGER NOT NULL, ground_code TEXT NOT NULL, ground TEXT NOT NULL,
        iv_found INTEGER, iv_overcome INTEGER, niv_found INTEGER, niv_overcome INTEGER,
        PRIMARY KEY (fy, line))""",
    # One ground across the years: public charge, 221(g), 214(b).
    f"CREATE INDEX IF NOT EXISTS {TABLE}_code ON {TABLE} (ground_code, fy)",
]


def summary(db: Database, totals: dict[int, dict], gaps: dict[int, list], sources: dict[int, str],
            changed_on: str | None) -> dict:
    """The years held, each year's own totals (State's line, which isn't a ground row), any named
    gap between a year's rows and its total (KNOWN_GAPS), the address State serves each year's file
    at (when a manifest vouched for the exact bytes), and the Eastern day the table last changed,
    which dates the page."""
    from lib_db import query_rows
    years = sorted(int(r[0]) for r in query_rows(db, f"SELECT DISTINCT fy FROM {TABLE}"))
    return {"years": years, "newest": years[-1] if years else None,
            "totals": {str(fy): totals[fy] for fy in years if fy in totals},
            "knownGaps": {str(fy): gaps[fy] for fy in years if gaps.get(fy)},
            "sources": {str(fy): sources[fy] for fy in years if sources.get(fy)},
            "changedOn": changed_on}


def source_of(manifest: dict, fy: int, data: bytes) -> str | None:
    """State's address for a year's file, from a manifest of {fy: {url, sha}}, only when the sha is
    the file's own: the page links the exact file its rows came from."""
    entry = manifest.get(str(fy)) or {}
    url = entry.get("url") or ""
    if url.startswith("https://") and entry.get("sha") == sha256(data):
        return url
    if entry:
        log(f"::warning::FY{fy}: the manifest's sha isn't this file's, so its address isn't kept")
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", nargs="+", required=True, help="the year's table as State's PDF")
    ap.add_argument("--fy", type=int, help="the fiscal year one --local file must hold")
    ap.add_argument("--manifest", help="JSON of {fy: {url, sha}} for the files given: the page links each year's file")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    if args.fy and len(args.local) != 1:
        ap.error("--fy names the fiscal year of one --local file")

    parsed: list[tuple[dict, bytes]] = []
    refused: list[str] = []
    for path in args.local:
        label = os.path.basename(path)
        data = open(path, "rb").read()
        try:
            if data[:5] != b"%PDF-":
                raise Refusal(f"{label}: not a PDF")
            table = parse(data, label)
            if args.fy and table["fy"] != args.fy:
                raise Refusal(f"{label}: asked for FY{args.fy}, but its title says Fiscal Year {table['fy']}")
        except Refusal as exc:
            log(f"REFUSED {exc}")
            refused.append(str(exc))
            continue
        pc = next((g for g in table["grounds"] if g["ground_code"] == PUBLIC_CHARGE), None)
        log(f"  FY{table['fy']}: {len(table['grounds'])} grounds, totals {table['totals']}; public charge "
            f"{ {c: pc[c] for c in FIGURES} if pc else 'not in the table'}")
        parsed.append((table, data))
    if args.dry_run:
        return 1 if refused else 0

    db = Database()
    if not parsed:
        record_run(db, SCRIPT, status="failed", rows_written=0,
                   note=f"every file refused: {'; '.join(refused[:3])}"[:900], started_at=started)
        return 1
    db.script(DDL)
    record = read_doc(db, RECORD) or {}
    files = record.setdefault("files", {})
    held = read_doc(db, SUMMARY) or {}
    totals_held = {int(k): v for k, v in held.get("totals", {}).items()}
    gaps_held = {int(k): v for k, v in held.get("knownGaps", {}).items()}
    sources_held = {int(k): v for k, v in held.get("sources", {}).items()}
    manifest = json.loads(open(args.manifest, encoding="utf-8").read()) if args.manifest else {}
    changed_on = held.get("changedOn")
    written = 0
    for table, data in parsed:
        got = store(db, table)
        written += got["written"] + got["deleted"]
        files[str(table["fy"])] = sha256(data)
        if got["written"] or got["deleted"] or totals_held.get(table["fy"]) != table["totals"]:
            changed_on = et_today()
        totals_held[table["fy"]] = table["totals"]
        gaps_held[table["fy"]] = table["knownGaps"]
        url = source_of(manifest, table["fy"], data)
        if url:
            sources_held[table["fy"]] = url
        log(f"  FY{table['fy']}: {got}")
    write_doc(db, RECORD, record)
    doc = summary(db, totals_held, gaps_held, sources_held, changed_on)
    write_doc(db, SUMMARY, doc)
    if doc["newest"]:
        stamp_freshness(db, DATASET, as_of=f"{doc['newest']}-09-30", source=SOURCE,
                        cadence="yearly, in the Report of the Visa Office, more than a year after the fiscal year",
                        note=f"FY{doc['years'][0]} to FY{doc['newest']}, {len(doc['years'])} years",
                        max_age_days=MAX_AGE_DAYS)
    refreshed = expire_policy_page(log, route=REFRESH_ROUTE) if written else None
    note = f"{len(parsed)} years loaded, {written} rows written; refused {len(refused)}"
    if refused:
        note += ": " + "; ".join(refused[:3])
    if refreshed is False:
        note += "; the page's refresh didn't answer 200"
    record_run(db, SCRIPT, status="failed" if refused else "ok", rows_written=written, note=note[:900],
               started_at=started)
    return 1 if refused else 0


if __name__ == "__main__":
    sys.exit(main())
