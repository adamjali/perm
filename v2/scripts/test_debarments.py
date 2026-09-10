#!/usr/bin/env python3
"""The debarment parsers, on fixtures shaped like the two sources.

The OFLC fixture mirrors what pdfplumber yields for the real PDF (read Sep 8
2026): a merged heading row, a blank spacer, the column header split over two
rows, then entries; a program's table continues on the next page with no
heading; a page can hold the tail of one list and the head of the next. The
WHD fixture is the H-1B page's table shape with its "effective as of" line.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("deb", HERE / "ingest_debarments.py")
deb = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(deb)

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        failures.append(label)


PAGES = [
    {
        "text": "Program Debarments\nPermanent Labor Certification Debarment List\nEntity Entity Type ...",
        "tables": [[
            ["Permanent Labor Certification Debarment List", None, None, None, None, None, None],
            ["", None, None, None, None, None, None],
            ["Entity", "Entity Type", "Employer", "Start of Debarment", "End of Debarment", "Violation", "CFR Citation"],
            ["", "", "Location", "", "", "", ""],
            ["Dwight Molina", "Agent", "Hialeah, Florida", "May 29, 2025", "May 29, 2028",
             "Failure to respond to\nan audit", "20 C.F.R. § 656.31(f)(1)(ii)"],
            ["Hercules Staffing, LLC", "Employer", "Orem, Utah", "May 29, 2025", "May 29, 2027",
             "Failure to respond to an audit", "20 C.F.R. § 656.31(f)(1)(ii)"],
        ]],
    },
    {
        "text": "H-2A Labor Certification Debarment List\n...",
        "tables": [[
            ["H-2A Labor Certification Debarment List", None, None, None, None, None],
            ["Entity", "Entity Type", "Employer Location", "Start of Debarment", "End of Debarment", "Violation"],
            ["AA Huapilla, LLC", "Employer", "Immokalee, Florida", "February 25, 2024", "February 25, 2027", "WHD Debarment"],
            ["Agrofarms and Grains, LLC*", "Employer", "Santa Maria, California", "November 2, 2024", "November 1, 2027", "WHD Debarment"],
        ]],
    },
    {
        # A continuation page: no heading, rows still belong to H-2A.
        "text": "continued",
        "tables": [[
            ["Gumara Canela", "Labor Contractor", "Alma, Georgia", "January 15, 2026", "January 16, 2029", "Plea Agreement"],
        ]],
    },
    {
        # The tail of H-2A, then the H-2B list starting part-way down the page.
        "text": "tail rows\nH-2B Labor Certification Debarment List\n",
        "tables": [
            [["RYM Trucking LLC*", "Employer", "Dexter, New Mexico", "September 16, 2025", "September 15, 2028", "WHD Debarment"]],
            [["H-2B Labor Certification Debarment List", "", "", "", "", ""],
             ["Entity", "Entity Type", "Employer Location", "Start of Debarment", "End of Debarment", "Violation"],
             ["Stone Masonry, LLC dba Rock and Stone", "Employer", "Ozark, Missouri", "April 14, 2025", "April 13, 2030", "WHD Debarment"]],
        ],
    },
]

WHD_HTML = """
<p>This list is effective as of September 1, 2026.</p>
<table><thead><tr><th>Employer Name</th><th>Employer Address</th><th>Willful Violator</th><th>Debarment Period</th></tr></thead>
<tbody>
<tr><td>GowraTech, LLC</td><td></td><td>Yes</td><td>5/12/2025 to 5/11/2027</td></tr>
<tr><td>Seeloz, Inc.</td><td>Palo Alto, CA</td><td>No</td><td>3/4/2026 to 3/3/2028</td></tr>
</tbody></table>
<p>Last Updated on August 28, 2026.</p>
"""


def main() -> int:
    rows = deb.parse_oflc_pages(PAGES)
    by = {}
    for r in rows:
        by.setdefault(r["program"], []).append(r)
    check("OFLC: header, spacer and heading rows are skipped; entries kept",
          len(rows) == 7, f"{len(rows)} rows: {[r['entity'] for r in rows]}")
    check("OFLC: PERM rows carry type, location, dates and the CFR citation",
          by.get("perm", [{}])[0].get("citation") == "20 C.F.R. § 656.31(f)(1)(ii)"
          and by["perm"][0]["start_date"] == "2025-05-29" and by["perm"][0]["end_date"] == "2028-05-29",
          str(by.get("perm")))
    check("OFLC: a multi-line violation is joined with one space",
          by["perm"][0]["violation"] == "Failure to respond to an audit", by["perm"][0]["violation"])
    check("OFLC: a continuation page inherits the last program seen",
          [r["entity"] for r in by.get("h2a", [])] == ["AA Huapilla, LLC", "Agrofarms and Grains, LLC", "Gumara Canela", "RYM Trucking LLC"],
          str([r["entity"] for r in by.get("h2a", [])]))
    check("OFLC: the trailing asterisk DOL prints is stripped from the name",
          all("*" not in r["entity"] for r in rows), "")
    check("OFLC: a list that starts part-way down a page takes its own heading",
          [r["entity"] for r in by.get("h2b", [])] == ["Stone Masonry, LLC dba Rock and Stone"], str(by.get("h2b")))

    whd, effective = deb.parse_whd_html(WHD_HTML)
    check("WHD: effective date read from the page", effective == "2026-09-01", str(effective))
    check("WHD: two rows, dates from M/D/YYYY, willful flag as the violation",
          len(whd) == 2 and whd[0]["start_date"] == "2025-05-12" and whd[0]["end_date"] == "2027-05-11"
          and whd[0]["violation"] == "Willful violator" and whd[1]["violation"] is None, str(whd))
    check("WHD: the header row is not an entry", all(r["entity"] != "Employer Name" for r in whd), "")

    # A row DOL publishes that we cannot parse must be counted and named, not
    # absorbed: a date-format change would otherwise shrink the list while the
    # run still logs "N rows" and reads as healthy.
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        kept, _ = deb.parse_whd_html(
            "<p>effective as of September 1, 2026</p><table>"
            "<tr><th>Employer Name</th><th>City</th><th>Willful</th><th>Period</th></tr>"
            "<tr><td>Good Corp</td><td>Austin, TX</td><td>Y</td><td>5/12/2025 to 5/11/2027</td></tr>"
            "<tr><td>Indefinite Co</td><td>Reno, NV</td><td>N</td><td>Indefinite</td></tr>"
            "</table>")
    noise = buf.getvalue()
    check("WHD: an unparseable period is reported, not silently dropped",
          len(kept) == 1 and "1 row(s) skipped" in noise and "Indefinite Co" in noise,
          f"kept={len(kept)} log={noise!r}")
    check("WHD: the header row is not counted as a drop",
          "Employer Name" not in noise, noise)

    check("dates: long and short forms, and garbage",
          deb.parse_long_date("January 16, 2029") == "2029-01-16" and deb.parse_short_date("3/4/2026") == "2026-03-04"
          and deb.parse_long_date("Employer") is None and deb.parse_whd_period("nonsense") == (None, None), "")

    print(f"\n{'ALL PASS' if not failures else f'{len(failures)} FAILED'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
