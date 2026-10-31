#!/usr/bin/env python3
"""The Wage and Hour loader reads DOL's file as printed and joins a case to a page only on strict rules (ingest_whd.py).

Each join rule below is a case seen in DOL's file on Oct 31 2026:

* a franchisee's trade name never reaches the brand ("Buena Vida LLC" trading as "McDonald's");
* a one-word name joins only a national sponsor ("Linde Corporation", a contractor, against Linde Inc.);
* a case in a state the sponsor never filed in doesn't join it, one in a state it did does;
* an H-1B case joins a no-PERM page only when that page files H-1B LCAs; an H-2A case only one that files H-2A;
* a bare one-word name never reaches a no-PERM page.

And the reading: DOL's byte-order mark, its typed year 3021, a changed layout and a short file refused.

Run: python3 scripts/test_whd.py
"""
from __future__ import annotations

import csv
import io
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_whd as w  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


HEADER = ["CASE_ID", "TRADE_NM", "LEGAL_NAME", "STREET_ADDR_1_TXT", "CTY_NM", "ST_CD", "ZIP_CD", "NAIC_CD",
          "NAICS_CODE_DESCRIPTION", "CASE_VIOLTN_CNT", "CMP_ASSD", "EE_VIOLTD_CNT", "BW_ATP_AMT", "EE_ATP_CNT",
          "FINDINGS_START_DATE", "FINDINGS_END_DATE", "FLSA_VIOLTN_CNT", "FLSA_REPEAT_VIOLATOR",
          "H1B_VIOLTN_CNT", "H1B_BW_ATP_AMT", "H1B_EE_ATP_CNT", "H1B_CMP_ASSD_AMT",
          "H2A_VIOLTN_CNT", "H2A_BW_ATP_AMT", "H2A_EE_ATP_CNT", "H2A_CMP_ASSD_AMT",
          "H2B_VIOLTN_CNT", "H2B_BW_ATP_AMT", "H2B_EE_ATP_CNT", "LOAD_DT"]


def case(cid, legal, trade, state, *, h1b=0, h1b_bw=0.0, h2a=0, bw=0.0, end="2024-06-30 00:00:00+00:00"):
    v = dict.fromkeys(HEADER, "0")
    v.update({"CASE_ID": cid, "LEGAL_NAME": legal, "TRADE_NM": trade, "ST_CD": state, "CTY_NM": "Town",
              "ZIP_CD": "00000", "STREET_ADDR_1_TXT": "1 Main", "NAIC_CD": "722511", "NAICS_CODE_DESCRIPTION": "Restaurants",
              "FINDINGS_START_DATE": "2023-07-01 00:00:00+00:00", "FINDINGS_END_DATE": end, "FLSA_REPEAT_VIOLATOR": "N/A",
              "BW_ATP_AMT": f"{bw:.2f}", "H1B_VIOLTN_CNT": str(h1b), "H1B_BW_ATP_AMT": f"{h1b_bw:,.2f}",
              "H2A_VIOLTN_CNT": str(h2a), "LOAD_DT": "2025-01-01 00:00:00+00:00"})
    return [v[h] for h in HEADER]


def archive(rows, header=HEADER, name="2026-10-26_chunk_1.csv") -> zipfile.ZipFile:
    text = io.StringIO()
    out = csv.writer(text)
    out.writerow(header)
    out.writerows(rows)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(name, "﻿" + text.getvalue())  # DOL's file starts with a byte-order mark
    buf.seek(0)
    return zipfile.ZipFile(buf)


SPONSORS = [  # (merge_key, slug, total), busiest first
    ("mcdonalds", "mcdonalds-corporation", 44),
    ("burger king", "burger-king-company-llc", 12),
    ("linde", "linde-inc", 12),
    ("johnson controls", "johnson-controls-inc", 41),
    ("pilgrims pride", "pilgrims-pride-corporation", 17),
]
STATES = {"mcdonalds-corporation": {"IL"}, "burger-king-company-llc": {"FL"}, "linde-inc": {"PA", "NJ"}, "johnson-controls-inc": {"FL", "WI"},
          "pilgrims-pride-corporation": {"TX"}}
OTHERS = [("ana data consulting", "ana-data-consulting-inc"), ("star farms", "star-farms-inc"), ("acme", "acme-llc")]
COUNTS = {"ana-data-consulting-inc": {"lca": 40, "h2a": 0, "h2b": 0}, "star-farms-inc": {"lca": 0, "h2a": 12, "h2b": 0},
          "acme-llc": {"lca": 9, "h2a": 0, "h2b": 0}}
match = w.make_matcher(SPONSORS, STATES, OTHERS, COUNTS)


def joined(*args, **kw):
    z = archive([case("1", *args, **kw)])
    return match(next(w.rows_of(z)))


check("a franchisee trading as the brand doesn't reach the brand",
      joined("Buena Vida LLC", "McDonald's", "IL") is None)
check("nor a two-word brand, in the brand's own state",
      joined("Carrols LLC", "Burger King", "FL") is None)
check("a one-word name doesn't reach a sponsor below national size",
      joined("Linde Corporation", "Linde Corporation", "PA") is None)
check("a sponsor's case in a state it files in joins it",
      joined("Johnson Controls, Inc.", "Johnson Controls", "FL") == "johnson-controls-inc")
check("the same sponsor's case in a state it never filed in doesn't",
      joined("Johnson Controls, Inc.", "Johnson Controls", "NV") is None)
check("an H-1B case joins a no-PERM page that files H-1B LCAs",
      joined("Ana-Data Consulting, Inc.", "Ana-Data", "NJ", h1b=2, h1b_bw=12_500.0) == "ana-data-consulting-inc")
check("an H-1B case doesn't join a no-PERM page that files no LCAs",
      joined("Star Farms LLC", "Star Farms", "KS", h1b=1) is None)
check("an H-2A case joins a no-PERM page that files H-2A",
      joined("Star Farms LLC", "Star Farms", "KS", h2a=3) == "star-farms-inc")
check("a bare one-word name never reaches a no-PERM page",
      joined("Acme", "Acme", "NY", h1b=1) is None)
check("the trade name stands in only when there is no legal name",
      joined("", "Pilgrim's Pride", "TX") == "pilgrims-pride-corporation")

# Reading the file.
z = archive([case("9", "Acme", "Acme", "NY", h1b_bw=1234567.5, end="3021-02-01 00:00:00+00:00")])
row = next(w.rows_of(z))
check("the byte-order mark is read off the first column", row["case_id"] == "9")
check("money with thousands separators reads as a number", row["h1b_back_wages"] == 1234567.5)
check("a findings date DOL typed in the year 3021 is no date", row["findings_end"] is None)
check("DOL's file date comes from the chunk's name", w.file_date(z) == "2026-10-26")
# LOAD_DT is DOL's bookkeeping and ours to ignore: a file without it still reads.
no_load = [h for h in HEADER if h != "LOAD_DT"]
got = next(w.rows_of(archive([case("1", "A", "A", "NY")[:-1]], header=no_load)))
check("a column we don't read can go missing", got["case_id"] == "1")
try:
    bad = [h for h in HEADER if h != "H1B_BW_ATP_AMT"]
    next(w.rows_of(archive([[c for h, c in zip(HEADER, case("1", "A", "A", "NY")) if h != "H1B_BW_ATP_AMT"]], header=bad)))
    check("a missing column we read refuses the file", False)
except RuntimeError as exc:
    check("a missing column we read refuses the file", "H1B_BW_ATP_AMT" in str(exc))

kept, seen = w.select(w.rows_of(archive([
    case("1", "Johnson Controls, Inc.", "Johnson Controls", "FL"),
    case("2", "Nobody Anywhere LLC", "Nobody", "OH"),
    case("3", "Unmatched Visa Employer LLC", "X", "OH", h2a=4),
])), match)
ids = {r[0] for r in kept}
check("keeps a joined case and an unjoined visa case, drops the rest", ids == {"1", "3"}, str(ids))
check("counts what it read", seen == {"cases": 3, "visa": 1, "matched": 1, "visa_matched": 0}, str(seen))

# The pages a reload refreshes: a changed case names its old and new page, a gone case its old one.
def stored_row(cid, slug, violations=1):
    r = dict.fromkeys(w.COLS, 0)
    r.update({"case_id": cid, "employer_slug": slug, "violations": violations})
    return [r[c] for c in w.COLS]

table = [stored_row("1", "a-co"), stored_row("2", "b-co"), stored_row("3", "c-co")]
real_query = w.dol.query_rows
w.dol.query_rows = lambda db, sql, args=None: [list(r) for r in table]
moved = w.moved_pages(None, [stored_row("1", "a-co"), stored_row("2", "d-co"), stored_row("4", "e-co")])
w.dol.query_rows = real_query
check("a reload refreshes the pages a case left, joined or vanished from, and no other",
      sorted(moved) == ["b-co", "c-co", "d-co", "e-co"], str(moved))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
