#!/usr/bin/env python3
"""Contract tests for ingest_h1b_lottery_foia.py, offline.

The loader writes per-employer lottery counts only after a year adds up to
two independent totals (the file's own report and USCIS's public table), so
most of these cases are the refusals. Run: python3 scripts/test_h1b_lottery_foia.py
"""
from __future__ import annotations

import io
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_h1b_lottery_foia as foia  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want) -> None:
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def refuses(label, fn) -> None:
    global N
    N += 1
    try:
        fn()
    except foia.Refusal:
        return
    FAILS.append(f"{label}: did not refuse")


def reg(employer: str, status: str = "CREATED", receipt: str = "", decision: str = "", fy: str = "2021") -> dict:
    return {"employer_name": employer, "status_type": status, "RECEIPT_NUMBER": receipt,
            "FIRST_DECISION": decision, "lottery_year": fy, "country_of_birth": "IND", "gender": "male"}


ROWS = [
    reg("Acme Corp"), reg("Acme Corp", "SELECTED", "EAC1", "Approved"), reg("Acme Corp", "SELECTED", "EAC2", "Denied"),
    reg(" Beta LLC ", "SELECTED"),
    {"employer_name": "", "status_type": "(b)(3) (b)(6) (b)(7)(c)", "RECEIPT_NUMBER": "EAC3",
     "FIRST_DECISION": "(b)(3)", "lottery_year": "(b)(3)"},
]


def xlsx(rows: list[list[str]]) -> bytes:
    """A one-sheet workbook with inline strings, enough for the report reader."""
    def cell(ref: str, v: str) -> str:
        return f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>'
    body = "".join(
        f'<row r="{i + 1}">' + "".join(cell(f"{'ABC'[j]}{i + 1}", v) for j, v in enumerate(r)) + "</row>"
        for i, r in enumerate(rows))
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet xmlns="{ns}"><sheetData>{body}</sheetData></worksheet>')
    return buf.getvalue()


def test_aggregate() -> None:
    by, tot = foia.aggregate(iter(ROWS), 2021)
    check("year totals", tot, {"rows": 5, "selected": 3, "withheld": 1, "receipts": 3})
    check("per employer", by["Acme Corp"], {"registrations": 3, "selected": 2, "petitioned": 2, "approved": 1, "denied": 1})
    check("names trimmed", "Beta LLC" in by, True)
    check("withheld rows carry no employer", len(by), 2)
    check("nothing about a beneficiary is kept", set(by["Acme Corp"]), set(foia.COUNTS))
    refuses("a row of another lottery year", lambda: foia.aggregate(iter([reg("A", fy="2022")]), 2021))
    refuses("an unknown status", lambda: foia.aggregate(iter([reg("A", "PENDING")]), 2021))
    # From FY2022 the file says ELIGIBLE where FY2021 said CREATED: registered, not selected.
    by22, tot22 = foia.aggregate(iter([reg("A", "ELIGIBLE", fy="2022"), reg("A", "SELECTED", "EAC9", fy="2022")]), 2022)
    check("ELIGIBLE counts as registered, not selected", by22["A"]["registrations"], 2)
    check("only SELECTED is selected", tot22["selected"], 1)
    refuses("a registration with no employer", lambda: foia.aggregate(iter([reg("")]), 2021))


def test_reconcile() -> None:
    tot = {"rows": 5, "selected": 3, "withheld": 1, "receipts": 3}
    report = {2021: {"registrations": 5, "receipts": 3}}
    uscis = {2021: {"eligible": 5, "selected": 4}}
    foia.reconcile(2021, tot, report, uscis)  # adds up: no refusal
    refuses("rows short of the report", lambda: foia.reconcile(2021, {**tot, "rows": 4}, report, uscis))
    refuses("receipts off", lambda: foia.reconcile(2021, {**tot, "receipts": 2}, report, uscis))
    refuses("selected plus withheld off USCIS's count", lambda: foia.reconcile(2021, {**tot, "withheld": 0}, report, uscis))
    refuses("a year with nothing to check against", lambda: foia.reconcile(2022, tot, report, uscis))
    # FY2024's measured 9-registration gap is allowed exactly, and nowhere else.
    r24 = {2024: {"registrations": 5, "receipts": 3}}
    foia.reconcile(2024, tot, r24, {2024: {"eligible": 5, "selected": 4 + 9}})
    refuses("a gap one larger than measured", lambda: foia.reconcile(2024, tot, r24, {2024: {"eligible": 5, "selected": 4 + 10}}))
    refuses("the FY2024 gap in another year", lambda: foia.reconcile(2021, tot, report, {2021: {"eligible": 5, "selected": 4 + 9}}))


def test_sources() -> None:
    table = foia.uscis_table(foia.LOTTERY_TS.read_text())
    check("USCIS's FY2021 row, read from h1bLottery.ts", table.get(2021), {"eligible": 269_424, "selected": 124_415})
    report = foia.report_totals(xlsx([
        ["I-129"], ["Lottery Year", "Count of Receipts", "Total Registrations"],
        ["TOTAL", "30", "70"], ["2021", "10", "20"], ["2022", "20", "50"], ["Note(s):"]]))
    check("the dictionary's per-year table, TOTAL skipped", report,
          {2021: {"receipts": 10, "registrations": 20}, 2022: {"receipts": 20, "registrations": 50}})
    refuses("a dictionary without the table", lambda: foia.report_totals(xlsx([["nothing here"]])))


def test_files() -> None:
    listing = [{"name": n, "download_url": n} for n in [
        "README.md", "TRK_13139_FY2021.zip", "TRK_13139_FY2023.zip.002", "TRK_13139_FY2023.zip.001",
        "TRK_13139_FY2023.zip.003", "TRK_13139_FY2024_single_reg.zip", "TRK_13139_FY2024_multi_reg.zip",
        "TRK_13139_I129_H1B_Registrations_FY21_FY24_Update_FOIA_FIN.xlsx"]]
    files = foia.year_files(listing)
    check("years found", sorted(files), [2021, 2023, 2024])
    check("a split archive's parts in order", [p["name"][-3:] for p in files[2023][0]], ["001", "002", "003"])
    check("FY2024 is two archives", len(files[2024]), 2)


def test_store() -> None:
    db = SqliteTurso()
    by, _ = foia.aggregate(iter(ROWS), 2021)
    check("stored", foia.store(db, 2021, by), 2)
    by2, _ = foia.aggregate(iter([reg("Acme Corp")]), 2021)
    foia.store(db, 2021, by2)
    check("a reload replaces the year", int(db.scalar(f"SELECT count(*) FROM {foia.TABLE}")), 1)
    check("slugged for the employer pages", db.scalar(f"SELECT employer_slug FROM {foia.TABLE}"), "acme-corp")


def main() -> int:
    for t in (test_aggregate, test_reconcile, test_sources, test_files, test_store):
        t()
    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
