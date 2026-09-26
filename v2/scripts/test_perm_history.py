#!/usr/bin/env python3
"""The PERM history ingest, against workbooks built here and in-memory SQLite.

Asserts:
1. an FY2010-shaped workbook (CASE_NO, no received date, 2007_NAICS_US_CODE,
   its first sheet not named sheet1.xml) is COUNTED and never stored as rows;
2. an FY2021-shaped workbook is counted AND stored, with the law firm, the
   annualised wage, the state code and a duration;
3. counts land on today's employer page through entity_key, across the
   spellings DOL printed, and an employer with no page is counted as unmatched;
4. a second identical load writes nothing;
5. `--current` fills FY2024 onward from perm_cases and removes a year that
   no longer has cases;
6. discovery keeps every PERM workbook name DOL has used, drops layouts, LCA
   files and years out of range, newest first.

Run:  python3 scripts/test_perm_history.py
"""
from __future__ import annotations

import pathlib
import sys
import tempfile
import zipfile
from xml.sax.saxutils import escape

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ingest_perm_history as h  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []


def check(label: str, ok: bool) -> None:
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        FAILS.append(label)


def col(i: int) -> str:
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def workbook(rows: list[list], sheet_file: str = "sheet1.xml") -> str:
    """A minimal real .xlsx: shared strings, numbers as numbers, one sheet."""
    strings: list[str] = []
    idx: dict[str, int] = {}
    body = []
    for r, row in enumerate(rows, start=1):
        cells = []
        for c, v in enumerate(row):
            if v is None:
                continue
            ref = f"{col(c)}{r}"
            if isinstance(v, (int, float)):
                cells.append(f'<c r="{ref}"><v>{v}</v></c>')
            else:
                if v not in idx:
                    idx[v] = len(strings)
                    strings.append(v)
                cells.append(f'<c r="{ref}" t="s"><v>{idx[v]}</v></c>')
        body.append(f'<row r="{r}">{"".join(cells)}</row>')
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    path = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False).name
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", f'<workbook {ns} {rel}><sheets><sheet name="Data" sheetId="1" r:id="rId7"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   f'<Relationship Id="rId7" Target="worksheets/{sheet_file}" Type="x"/></Relationships>')
        z.writestr("xl/sharedStrings.xml",
                   f'<sst {ns}>' + "".join(f"<si><t>{escape(s)}</t></si>" for s in strings) + "</sst>")
        z.writestr(f"xl/worksheets/{sheet_file}", f'<worksheet {ns}><sheetData>{"".join(body)}</sheetData></worksheet>')
    return path


FY2010 = workbook([
    ["CASE_NO", "DECISION_DATE", "CASE_STATUS", "EMPLOYER_NAME", "JOB_INFO_WORK_STATE",
     "WAGE_OFFER_FROM_9089", "WAGE_OFFER_UNIT_OF_PAY_9089", "2007_NAICS_US_CODE", "JOB_INFO_WORK_CITY"],
    ["A-09111-00001", 40210, "Certified", "ACME, INC.", "WA", 90000, "yr", 541511, "Seattle"],
    ["A-09111-00002", 40211, "Certified-Expired", "Acme Inc", "WA", 90000, "yr", 541511, "Seattle"],
    ["A-09111-00003", 40212, "Denied", "ACME INC", "WA", 90000, "yr", 541511, "Seattle"],
    ["A-09111-00004", 40213, "Withdrawn", "NOBODY LLC", "TX", 50000, "yr", 111, "Austin"],
    ["A-09111-00005", "", "Certified", "ACME INC", "WA", 1, "yr", 1, "x"],
], sheet_file="sheet3.xml")

FY2021 = workbook([
    ["CASE_NUMBER", "CASE_STATUS", "RECEIVED_DATE", "DECISION_DATE", "EMPLOYER_NAME",
     "WORKSITE_STATE", "WORKSITE_CITY", "PW_SOC_CODE", "PW_SOC_TITLE", "JOB_TITLE",
     "WAGE_OFFER_FROM", "WAGE_OFFER_UNIT_OF_PAY", "AGENT_ATTORNEY_FIRM_NAME", "NAICS_CODE"],
    ["A-20001-11111", "Certified", "2020-01-02", "2021-03-01", "Acme Inc.", "Washington", "Seattle",
     "15-1252.00", "Software Developers", "Engineer", 50, "Hour", "Law Firm LLP", "541511"],
    ["A-20001-11112", "Denied", "2020-01-02", "2021-03-02", "ACME INC", "WA", "Redmond",
     "15-1252.00", "Software Developers", "Engineer", 120000, "Year", "N/A", "541511"],
])


def seeded_db() -> SqliteTurso:
    db = SqliteTurso()
    db.conn.execute("CREATE TABLE perm_entities (kind TEXT, slug TEXT, name TEXT, merge_key TEXT)")
    from entity_identity import entity_key
    db.conn.executemany("INSERT INTO perm_entities VALUES (?,?,?,?)", [
        ("employer", "acme-inc", "ACME INC", entity_key("ACME INC")),
        ("attorney", "law-firm-llp", "Law Firm LLP", entity_key("Law Firm LLP")),
    ])
    db.conn.commit()
    return db


def run(db, argv: list[str]) -> int:
    h.Turso = lambda: db
    old = sys.argv
    sys.argv = ["ingest_perm_history.py"] + argv
    try:
        return h.main()
    finally:
        sys.argv = old


def main() -> int:
    db = seeded_db()
    db.conn.execute("CREATE TABLE perm_cases (case_number TEXT, employer_slug TEXT, fiscal_year TEXT, status TEXT)")
    db.conn.executemany("INSERT INTO perm_cases VALUES (?,?,?,?)", [
        ("G-100-1", "acme-inc", "2025", "certified"), ("G-100-2", "acme-inc", "2025", "denied"),
        ("G-100-3", "acme-inc", "2026", "withdrawn"), ("G-100-4", "", "2026", "certified"),
    ])
    db.conn.commit()

    rc = run(db, ["--local", FY2010, FY2021])
    check(f"load exits 0 (got {rc})", rc == 0)
    years = {(s, fy): (c, d, w) for s, fy, c, d, w in
             db.conn.execute("SELECT slug, fy, certified, denied, withdrawn FROM perm_employer_years")}
    check("FY2010: three spellings of ACME counted on its page, expired counts as certified",
          years.get(("acme-inc", 2010)) == (2, 1, 0))
    check("an employer with no page is not written", not any(s == "" or s is None for s, _ in years))
    check("a row with no decision date is not counted",
          sum(sum(v) for (s, fy), v in years.items() if fy == 2010) == 3)
    check("FY2021 counted", years.get(("acme-inc", 2021)) == (1, 1, 0))
    check("--current's years ride along: FY2025 and FY2026 from perm_cases",
          years.get(("acme-inc", 2025)) == (1, 1, 0) and years.get(("acme-inc", 2026)) == (0, 0, 1))

    rows = {r[0]: r for r in db.conn.execute(
        "SELECT case_number, fiscal_year, employer_slug, state, wage, attorney_slug, days, naics, worksite_city "
        "FROM perm_cases_history")}
    check("FY2010 is counted, never stored as rows", not any(k.startswith("A-09") for k in rows))
    a = rows.get("A-20001-11111")
    check(f"FY2021 row stored whole (got {a})",
          a is not None and a[1] == "2021" and a[2] == "acme-inc" and a[3] == "WA"
          and a[4] == 104000.0 and a[5] == "law-firm-llp" and a[6] == 424
          and a[7] == "541511" and a[8] == "Seattle")
    b = rows.get("A-20001-11112")
    check("an 'N/A' firm is no firm", b is not None and b[5] == "")

    doc = h.read_doc(db)
    check("each workbook is recorded in perm_docs[perm_history]",
          len(doc.get("files", {})) == 2)

    # Identical reload writes nothing.
    before = db.conn.total_changes
    rc = run(db, ["--local", FY2010, FY2021])
    check(f"a second identical load writes no data rows (changes {db.conn.total_changes - before})",
          rc == 0 and db.conn.total_changes - before <= 4)

    # --current drops a year that lost its cases.
    db.conn.execute("DELETE FROM perm_cases WHERE fiscal_year = '2026'")
    db.conn.commit()
    run(db, ["--current"])
    left = {fy for (fy,) in db.conn.execute("SELECT fy FROM perm_employer_years WHERE slug='acme-inc'")}
    check(f"--current removes FY2026 once it has no cases (years {sorted(left)})",
          2026 not in left and 2025 in left and 2010 in left)

    html = " ".join(f'<a href="/sites/dolgov/files/ETA/oflc/pdfs/{n}">x</a>' for n in [
        "PERM_FY2008.xlsx", "PERM_FY14_Q4.xlsx", "PERM_Disclosure_Data_FY17.xlsx",
        "PERM_Disclosure_Data_FY2018_EOY.xlsx", "PERM_FY2023.xlsx",
        "PERM_Disclosure_Data_FY2024_Q4.xlsx", "PERM_Record_Layout_FY2020.pdf",
        "LCA_Disclosure_Data_FY2021.xlsx", "PERM_FY2007.xlsx"])
    got = [(n, fy) for n, _, fy in h.history_files(html, 2008, 2023)]
    check(f"discovery (got {got})", got == [
        ("PERM_FY2023.xlsx", 2023), ("PERM_Disclosure_Data_FY2018_EOY.xlsx", 2018),
        ("PERM_Disclosure_Data_FY17.xlsx", 2017), ("PERM_FY14_Q4.xlsx", 2014),
        ("PERM_FY2008.xlsx", 2008)])

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
