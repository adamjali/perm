#!/usr/bin/env python3
"""ingest_visa_issuances: names, totals, the PDF line reader and the categories.

Run: python3 scripts/test_visa_issuances.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_visa_issuances as iv  # noqa: E402
from lib_test_xlsx import xlsx_bytes  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def words(*items):
    """(text, x0, x1) on one line, as pdfplumber gives them."""
    return [{"text": t, "x0": a, "x1": b, "top": 100.0} for t, a, b in items]


def main() -> int:
    for name, want in [("MAY2024 - IV Issuances by FSC or Place of Birth and Visa Class.pdf", "2024-05"),
                       ("SEPT 2018 - IV Issuances by FSC and Visa Class.pdf", "2018-09"),
                       ("March 2017 - IV Issuances by FSC and Visa Class - Worldwide.pdf", "2017-03"),
                       ("FEBRUARY 2026 - IV Issuances by Post and Visa Class.xlsx", "2026-02"),
                       ("Immigrant Visa Symbols_2024.pdf", None)]:
        check(f"month of {name[:24]}", iv.month_of(name), want)
    check("by post", iv.dim_of("JUNE 2025 - IV Issuances by Post and Visa Class.pdf"), "post")
    check("by FSC", iv.dim_of("JUNE 2025 - IV Issuances by FSC or Place of Birth and Visa Class.pdf"), "fsc")

    base = "/content/dam/visas/Statistics/Immigrant-Statistics/MonthlyIVIssuances/"
    html = "".join(f'<a href="{base}{h}">' for h in [
        "JANUARY%202025%20-%20IV%20Issuances%20by%20FSC%20or%20Place%20of%20Birth%20and%20Visa%20Class.pdf",
        "Excel/FY2025/JANUARY%202025%20-%20IV%20Issuances%20by%20FSC%20or%20Place%20of%20Birth%20and%20Visa%20Class.xlsx",
        "JANUARY%202025%20-%20IV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf",
        "Immigrant%20Visa%20Symbols_2024.pdf"])
    found = iv.listing(html)
    check("one file per month and table", sorted(found), [("2025-01", "fsc"), ("2025-01", "post")])
    check("Excel when a month has both", found[("2025-01", "fsc")].endswith(".xlsx"), True)

    saved = iv.MIN_ROWS
    iv.MIN_ROWS = 1
    try:
        good = xlsx_bytes({"Sheet1": [["Immigrant Visa Issuances February 2026"],
                                      ["Foreign State", "Visa Class", "Issuances"],
                                      ["India", "E2", "1,204"], ["India", "E3", "96"], ["Mexico", "IR1", "3"],
                                      [], ["GRAND TOTAL", "", "1303"]]})
        rows = iv.from_xlsx(good, "t")
        check("rows keyed by name and symbol", rows, {("India", "E2"): 1204, ("India", "E3"): 96, ("Mexico", "IR1"): 3})
        bad = xlsx_bytes({"Sheet1": [["India", "E2", "1204"], ["GRAND TOTAL", "", "1300"]]})
        try:
            iv.from_xlsx(bad, "t")
            refused = False
        except iv.Refusal:
            refused = True
        check("rows that don't add up to the GRAND TOTAL are refused", refused, True)
        try:
            iv.from_xlsx(xlsx_bytes({"Sheet1": [["India", "E2", "4"]]}), "t")
            refused = False
        except iv.Refusal:
            refused = True
        check("a table with no GRAND TOTAL is refused", refused, True)
    finally:
        iv.MIN_ROWS = saved

    check("a count split into touching pieces is joined",
          iv.parse_line(words(("GRAND", 112, 155), ("TOTAL", 159, 198), ("5", 458, 465), ("7,983", 465, 495))),
          ("GRAND TOTAL", None, 57983))
    check("a row: name, symbol, count",
          iv.parse_line(words(("Bosnia", 100, 140), ("and", 142, 160), ("Herzegovina", 162, 230),
                              ("IR1", 300, 320), ("1,957", 460, 495))),
          ("Bosnia and Herzegovina", "IR1", 1957))
    check("numbers far apart aren't one number",
          iv.parse_line(words(("Page", 274, 298), ("39", 299, 311), ("of", 313, 322), ("39", 325, 336))),
          ("Page 39 of", None, 39))
    check("a continuation row has no name", iv.parse_line(words(("F4", 300, 315), ("1,002", 460, 495))),
          ("", "F4", 1002))

    for symbol, cat in [("E1", "EB-1"), ("E13", "EB-1"), ("E2", "EB-2"), ("E23", "EB-2"), ("E3", "EB-3"),
                        ("EW", "EB-3 other workers"), ("EW4", "EB-3 other workers"), ("T5", "EB-5"),
                        ("C51", "EB-5"), ("RU1", "EB-5"), ("RI3", "EB-5"), ("SD1", "EB-4"), ("SR2", "EB-4"),
                        ("IR1", "Immediate relatives"), ("CR2", "Immediate relatives"), ("F2A", "Family preferences"),
                        ("FX", "Family preferences"), ("CX1", "Family preferences"), ("B23", "Family preferences"),
                        ("DV", "Diversity"), ("SQ1", "Special immigrants"), ("GV3", "Special immigrants"),
                        ("ZZ9", "Other")]:
        check(f"{symbol} is {cat}", iv.category_of(symbol), cat)
    check("State's spellings of one place are one key",
          len({iv.group_key(n) for n in ("China-Mainland born", "China - mainland born", "China – mainland born")}), 1)

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
