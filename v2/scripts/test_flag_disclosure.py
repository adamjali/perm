#!/usr/bin/env python3
"""The parser between DOL's PW/LCA disclosure workbooks and `pwd_cases`/`lca_cases`.

Every check here guards a PLAUSIBLE WRONG ANSWER rather than an error, which
is the class of defect that ships:

* **XLSX omits empty cells.** A blank JOB_TITLE in the middle of a row, read
  positionally, puts the SOC code under the job title and the SOC title under
  the SOC code, and every row after the blank is silently shifted. The fixture
  carries exactly that blank, the test asserts the sheet XML really omits the
  cell (so the probe is a probe and not a fixture that happens to pass), and
  then asserts the columns after it landed where they belong.
* **The LCA file has two wage columns.** `WAGE_RATE_OF_PAY_FROM` is what the
  employer offers; `PREVAILING_WAGE` is the floor it attested to. Reading the
  wrong one publishes a lower number under the right name.
* **The wrong `--program` on a file must FAIL**, not degrade to NULLs.
* **Discovery must survive the live page as it actually is**: the LCA link
  text is misspelled, its href carries a double slash, and the same page
  lists Appendix A, worksite and older-form files that must not be chosen.

Builds its fixtures with openpyxl when it is installed (this machine's
miniconda has it) and with a stdlib writer otherwise (CI installs no
packages), and runs the parser over BOTH when it can, because the two
writers emit different XML for the same cells.

    python3 scripts/test_flag_disclosure.py
    FLAG_TEST_WRITER=stdlib python3 scripts/test_flag_disclosure.py
"""
from __future__ import annotations

import datetime
import html
import importlib.util
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from ingest_flag_disclosure import (  # noqa: E402
    HOST,
    PROGRAMS,
    ParseStats,
    clean_text,
    file_sort_key,
    iter_cases,
    normalise_url,
    parse_state,
    parse_wage,
    load_record_key,
    names_for_year,
    pick_latest,
)
from lib_gov_data import discover_links  # noqa: E402

SCRIPT = pathlib.Path(__file__).resolve().parent / "ingest_flag_disclosure.py"
FAILURES: list[str] = []
CHECKS = 0


def check(name: str, got, want) -> None:
    global CHECKS
    CHECKS += 1
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


# ---------------------------------------------------------------------------
# Fixture writers
# ---------------------------------------------------------------------------

EXCEL_EPOCH = datetime.datetime(1899, 12, 30)


def col_letter(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA."""
    letters = ""
    n = index + 1
    while n:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def write_xlsx_openpyxl(path: str, rows: list[list]) -> None:
    import openpyxl  # noqa: PLC0415 - optional, resolved at call time

    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    wb.save(path)


def write_xlsx_stdlib(path: str, rows: list[list]) -> None:
    """A minimal workbook by hand: inline strings, numbers, date serials.

    A `None` cell is OMITTED from the XML, which is what Excel and openpyxl
    both do and the whole reason the parser resolves cells by reference.
    """
    def cell(r: int, c: int, value) -> str:
        ref = f"{col_letter(c)}{r}"
        if value is None:
            return ""
        if isinstance(value, datetime.datetime):
            return f'<c r="{ref}"><v>{(value - EXCEL_EPOCH).days}</v></c>'
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return f'<c r="{ref}"><v>{value}</v></c>'
        text = html.escape(str(value), quote=True)
        return f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'

    body = "".join(
        f'<row r="{i}">' + "".join(cell(i, j, v) for j, v in enumerate(row)) + "</row>"
        for i, row in enumerate(rows, start=1)
    )
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rel_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    parts = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ),
        "xl/workbook.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<workbook xmlns="{ns}" xmlns:r="{rel_ns}"><sheets>'
            '<sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>"
        ),
        "xl/worksheets/sheet1.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<worksheet xmlns="{ns}"><sheetData>{body}</sheetData></worksheet>'
        ),
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, xml in parts.items():
            z.writestr(name, xml)


def available_writers() -> list[tuple[str, object]]:
    forced = os.environ.get("FLAG_TEST_WRITER")
    if forced == "stdlib":
        return [("stdlib", write_xlsx_stdlib)]
    writers: list[tuple[str, object]] = []
    if importlib.util.find_spec("openpyxl") is not None:
        writers.append(("openpyxl", write_xlsx_openpyxl))
    else:
        print("  (openpyxl not installed; stdlib writer only)")
    writers.append(("stdlib", write_xlsx_stdlib))
    return writers


# ---------------------------------------------------------------------------
# Fixtures, with column names verbatim from the FY2026 Q3 record layouts
# ---------------------------------------------------------------------------

PW_FILE = "PW_Disclosure_Data_FY2026_Q3.xlsx"
PW_HEADER = [
    "CASE_NUMBER", "CASE_STATUS", "RECEIVED_DATE", "DETERMINATION_DATE",
    "REDETERMINATION_DATE", "WITHDRAWAL_DATE", "VISA_CLASS",
    "EMPLOYER_LEGAL_BUSINESS_NAME", "EMPLOYER_POC_EMAIL", "JOB_TITLE",
    "PRIMARY_WORKSITE_STATE", "PWD_SOC_CODE", "PWD_SOC_TITLE",
    "PWD_WAGE_RATE", "PWD_UNIT_OF_PAY",
]
# Column J (index 9) on sheet row 3 is the empty-cell probe.
PROBE_COL = PW_HEADER.index("JOB_TITLE")
PROBE_ROW = 3
D = datetime.datetime
PW_ROWS = [
    PW_HEADER,
    ["P-100-25300-123456", "Determination Issued", D(2025, 10, 27), D(2026, 3, 2), None, None,
     "PERM", "Acme Robotics, Inc.", "poc@example.com", "Software Engineer", "CA",
     "15-1252", "Software Developers", 145600, "Year"],
    # THE PROBE: job title blank, so its cell is absent from the XML.
    ["P-100-25301-000002", "Determination Issued", "2025-11-03", "2026-04-15", None, None,
     "H-1B", "Globex Corporation", "poc@example.com", None, "California",
     "13-2011", "Accountants and Auditors", "$38.50", "Hour"],
    # Withdrawn before determination: the date is in WITHDRAWAL_DATE only.
    ["P-100-25302-000003", "Withdrawn", D(2025, 12, 1), None, None, D(2026, 1, 20),
     "PERM", "  Initech   LLC ", "", "Analyst", "New York",
     "13-1111", "Management Analysts", "", ""],
    # A duplicate case number: first occurrence wins, this one is counted.
    ["P-100-25300-123456", "Redetermination Affirmed", D(2025, 10, 27), D(2026, 6, 1), D(2026, 6, 1), None,
     "PERM", "Acme Robotics, Inc.", "poc@example.com", "Software Engineer", "CA",
     "15-1252", "Software Developers", 145600, "Year"],
    # No case number: skipped and counted.
    ["", "Determination Issued", D(2025, 10, 1), D(2026, 1, 1), None, None,
     "PERM", "Nobody Corp", "", "Clerk", "TX", "43-9061", "Office Clerks", 40000, "Year"],
    # A redetermination later than the determination; a foreign worksite;
    # an unparseable wage; an unmapped unit.
    ["P-100-25303-000006", "Redetermination Modified", D(2025, 12, 15), D(2026, 2, 1), D(2026, 5, 5), None,
     "H-2B", "Wayne Enterprises", "", "Welder", "Ontario",
     "51-4121", "Welders, Cutters, Solderers, and Brazers", "n/a", "Fortnight"],
]

PW_EXPECTED = [
    {"case_number": "P-100-25300-123456", "case_status": "DETERMINATION ISSUED",
     "received_date": "2025-10-27", "decision_date": "2026-03-02",
     "employer_name": "Acme Robotics, Inc.", "employer_slug": "acme-robotics-inc",
     "job_title": "Software Engineer", "soc_code": "15-1252", "soc_title": "Software Developers",
     "wage": 145600.0, "wage_unit": "YEAR", "worksite_state": "CA", "visa_class": "PERM",
     "source_file": PW_FILE, "fiscal_year": 2026},
    {"case_number": "P-100-25301-000002", "case_status": "DETERMINATION ISSUED",
     "received_date": "2025-11-03", "decision_date": "2026-04-15",
     "employer_name": "Globex Corporation", "employer_slug": "globex-corporation",
     "job_title": None, "soc_code": "13-2011", "soc_title": "Accountants and Auditors",
     "wage": 38.5, "wage_unit": "HOUR", "worksite_state": "CA", "visa_class": "H-1B",
     "source_file": PW_FILE, "fiscal_year": 2026},
    {"case_number": "P-100-25302-000003", "case_status": "WITHDRAWN",
     "received_date": "2025-12-01", "decision_date": "2026-01-20",
     "employer_name": "Initech LLC", "employer_slug": "initech-llc",
     "job_title": "Analyst", "soc_code": "13-1111", "soc_title": "Management Analysts",
     "wage": None, "wage_unit": None, "worksite_state": "NY", "visa_class": "PERM",
     "source_file": PW_FILE, "fiscal_year": 2026},
    {"case_number": "P-100-25303-000006", "case_status": "REDETERMINATION MODIFIED",
     "received_date": "2025-12-15", "decision_date": "2026-05-05",
     "employer_name": "Wayne Enterprises", "employer_slug": "wayne-enterprises",
     "job_title": "Welder", "soc_code": "51-4121",
     "soc_title": "Welders, Cutters, Solderers, and Brazers",
     "wage": None, "wage_unit": "FORTNIGHT", "worksite_state": None, "visa_class": "H-2B",
     "source_file": PW_FILE, "fiscal_year": 2026},
]

LCA_FILE = "LCA_Disclosure_Data_FY2026_Q3.xlsx"
LCA_HEADER = [
    "CASE_NUMBER", "CASE_STATUS", "RECEIVED_DATE", "DECISION_DATE", "VISA_CLASS",
    "JOB_TITLE", "SOC_CODE", "SOC_TITLE", "EMPLOYER_NAME", "WORKSITE_STATE",
    "WAGE_RATE_OF_PAY_FROM", "WAGE_RATE_OF_PAY_TO", "WAGE_UNIT_OF_PAY",
    "PREVAILING_WAGE", "PW_UNIT_OF_PAY",
]
LCA_ROWS = [
    LCA_HEADER,
    # The offered wage (150000) and the prevailing wage (128000) differ on
    # purpose: reading the wrong column must be visible.
    ["I-200-26010-111111", "Certified", D(2026, 1, 10), D(2026, 1, 17), "H-1B",
     "Data Scientist", "15-2051", "Data Scientists", "Hooli, Inc.", "TX",
     150000, 180000, "Year", 128000, "Year"],
    ["I-203-26011-222222", "Certified - Withdrawn", "2026-01-11", "2026-02-20", "E-3 Australian",
     "Nurse", "29-1141", "Registered Nurses", "Pied Piper LLC", "Washington",
     "48.00", "", "Hour", "45.10", "Hour"],
]
LCA_EXPECTED = [
    {"case_number": "I-200-26010-111111", "case_status": "CERTIFIED",
     "received_date": "2026-01-10", "decision_date": "2026-01-17",
     "employer_name": "Hooli, Inc.", "employer_slug": "hooli-inc",
     "job_title": "Data Scientist", "soc_code": "15-2051", "soc_title": "Data Scientists",
     "wage": 150000.0, "wage_unit": "YEAR", "worksite_state": "TX", "visa_class": "H-1B",
     "source_file": LCA_FILE, "fiscal_year": 2026},
    {"case_number": "I-203-26011-222222", "case_status": "CERTIFIED - WITHDRAWN",
     "received_date": "2026-01-11", "decision_date": "2026-02-20",
     "employer_name": "Pied Piper LLC", "employer_slug": "pied-piper-llc",
     "job_title": "Nurse", "soc_code": "29-1141", "soc_title": "Registered Nurses",
     "wage": 48.0, "wage_unit": "HOUR", "worksite_state": "WA", "visa_class": "E-3 Australian",
     "source_file": LCA_FILE, "fiscal_year": 2026},
]

# The performance page as it was on 2026-09-02, hrefs verbatim: the misspelled
# link text, the double slash, the companion tables, the old/revised pair and
# the FY2018 PWD name that must all be handled or ignored correctly.
PAGE_HTML = """
<a href="https://www.dol.gov//media/LCA_Disclosure_Data_FY2026_Q3.xlsx">LCA_Dislclosure_Data_FY2026_Q3.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/FY26Q3/LCA_Record_Layout_FY2026_Q3.pdf">LCA_Record_Layout_FY2026_Q3.pdf</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/FY26Q3/LCA_Appendix_A_FY2026_Q3.xlsx">LCA_Appendix_A_FY2026_Q3.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2025_Q4.xlsx">LCA_Disclosure_Data_FY2025_Q4.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/LCA_Worksites_FY2025_Q4.xlsx">LCA_Worksites_FY2025_Q4.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2020_Q1.xlsx">LCA_FY2020_Q1.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/H-1B_Disclosure_Data_FY2019.xlsx">H-1B FY2019.xlsx</a>
<a href="https://www.dol.gov/media/PW_Disclosure_Data_FY2026_Q3.xlsx">PW_Disclosure_Data_FY2026_Q3.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/FY26Q3/PW_Worksites_FY2026_Q3.xlsx">PW_Worksites_FY2026_Q3.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/PW_Disclosure_Data_FY2025_Q4.xlsx">PW_Disclosure_Data_FY2025.xlsx</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/PW_Disclosure_Data_FY2023_Q4_old_form.xlsx">old</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/PW_Disclosure_Data_FY2023_Q4_revised_form.xlsx">revised</a>
<a href="/sites/dolgov/files/ETA/oflc/pdfs/PWD_Disclosure_Data_FY2018_EOY.xlsx">PW Case Data FY2018.xlsx</a>
"""


# ---------------------------------------------------------------------------

def parse(path: str, program: str) -> tuple[list[dict], ParseStats]:
    stats = ParseStats()
    rows = list(iter_cases(path, PROGRAMS[program], stats))
    return rows, stats


def sheet_refs(path: str, row: int) -> set[str]:
    """Every `r="X<row>"` reference the sheet XML carries for one row."""
    with zipfile.ZipFile(path) as z:
        xml = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    return set(re.findall(rf'r="([A-Z]+{row})"', xml))


def run_cli(*argv: str, cwd: str) -> subprocess.CompletedProcess:
    # No Turso credentials anywhere the script could find them: `--dry-run`
    # must never need any, and a stray `Turso()` would exit non-zero here.
    env = {k: v for k, v in os.environ.items() if not k.startswith("TURSO_")}
    return subprocess.run([sys.executable, str(SCRIPT), *argv], cwd=cwd, env=env,
                          capture_output=True, text=True, timeout=120)


def check_fixture(tmp: str, writer_name: str, write) -> None:
    pw_path = os.path.join(tmp, PW_FILE)
    lca_path = os.path.join(tmp, LCA_FILE)
    write(pw_path, PW_ROWS)
    write(lca_path, LCA_ROWS)

    # The probe is a probe: the blank cell is genuinely absent from the XML,
    # while its neighbours on the same row are present.
    refs = sheet_refs(pw_path, PROBE_ROW)
    probe = f"{col_letter(PROBE_COL)}{PROBE_ROW}"
    left = f"{col_letter(PROBE_COL - 1)}{PROBE_ROW}"
    right = f"{col_letter(PROBE_COL + 1)}{PROBE_ROW}"
    check(f"[{writer_name}] the blank cell {probe} is omitted from the sheet XML", probe in refs, False)
    check(f"[{writer_name}] its neighbours {left} and {right} are present", {left, right} <= refs, True)

    rows, stats = parse(pw_path, "pw")
    check(f"[{writer_name}] PW: four unique cases parsed", len(rows), 4)
    check(f"[{writer_name}] PW: sheet rows counted", stats.sheet_rows, 6)
    check(f"[{writer_name}] PW: the duplicate case is counted, not kept", stats.duplicates, 1)
    check(f"[{writer_name}] PW: the blank case number is skipped", stats.blank_case, 1)
    for want in PW_EXPECTED:
        got = next((r for r in rows if r["case_number"] == want["case_number"]), None)
        check(f"[{writer_name}] PW row {want['case_number']}", got, want)
    # The columns AFTER the blank landed where they belong. Read positionally
    # they would have been Globex's state under job_title and its SOC code
    # under state.
    probe_row = rows[1]
    check(f"[{writer_name}] PW: after the blank, SOC code is still the SOC code",
          (probe_row["soc_code"], probe_row["worksite_state"]), ("13-2011", "CA"))
    check(f"[{writer_name}] PW: decided range is the latest event date",
          (stats.first_decided, stats.last_decided), ("2026-01-20", "2026-05-05"))
    check(f"[{writer_name}] PW: contact column is never resolved",
          "EMPLOYER_POC_EMAIL" in stats.resolved or "email" in stats.resolved, False)

    rows, stats = parse(lca_path, "lca")
    check(f"[{writer_name}] LCA: two cases parsed", len(rows), 2)
    for want in LCA_EXPECTED:
        got = next((r for r in rows if r["case_number"] == want["case_number"]), None)
        check(f"[{writer_name}] LCA row {want['case_number']}", got, want)
    check(f"[{writer_name}] LCA: wage is the OFFERED rate, not PREVAILING_WAGE",
          rows[0]["wage"], 150000.0)

    # A file with no fiscal year in its name falls back to the decision date.
    probe_path = os.path.join(tmp, "probe.xlsx")
    shutil.copyfile(pw_path, probe_path)
    rows, _ = parse(probe_path, "pw")
    # A set, not a sorted list: a None in here must read as a FAIL with the
    # value shown, not as a TypeError that kills the run (found by probing).
    check(f"[{writer_name}] fiscal year falls back to the decision date's",
          {r["fiscal_year"] for r in rows}, {2026})
    check(f"[{writer_name}] source_file is the basename",
          {r["source_file"] for r in rows}, {"probe.xlsx"})

    # The CLI, in --dry-run, with no credentials in reach: same rows, no write.
    proc = run_cli("--program", "pw", "--dry-run", "--file", pw_path, "--dump-rows", "10", cwd=tmp)
    check(f"[{writer_name}] --dry-run exits 0", proc.returncode, 0)
    dumped = [json.loads(line[4:]) for line in proc.stdout.splitlines() if line.startswith("ROW ")]
    check(f"[{writer_name}] --dry-run dumps the same four rows the parser yields",
          dumped, PW_EXPECTED)
    check(f"[{writer_name}] --dry-run reports its counts", "cases parsed      4" in proc.stdout, True)
    check(f"[{writer_name}] --dry-run says it wrote nothing", "DRY RUN: nothing written" in proc.stdout, True)

    # The wrong program on a file is a mapping failure and must FAIL.
    proc = run_cli("--program", "lca", "--dry-run", "--file", pw_path, cwd=tmp)
    check(f"[{writer_name}] wrong --program exits non-zero", proc.returncode != 0, True)
    check(f"[{writer_name}] wrong --program names the unresolved fields",
          "resolves none of" in proc.stderr, True)

    # --dump-header lists the raw names and stops before parsing a row.
    proc = run_cli("--program", "pw", "--dump-header", "--file", pw_path, cwd=tmp)
    check(f"[{writer_name}] --dump-header exits 0", proc.returncode, 0)
    check(f"[{writer_name}] --dump-header prints every header name",
          all(name in proc.stdout for name in PW_HEADER), True)


def check_discovery() -> None:
    lca = discover_links(PAGE_HTML, PROGRAMS["lca"]["file_pattern"], HOST)
    check("LCA: exactly the disclosure files match, not Appendix A or worksites",
          sorted(lca), ["LCA_Disclosure_Data_FY2020_Q1.xlsx",
                        "LCA_Disclosure_Data_FY2025_Q4.xlsx",
                        "LCA_Disclosure_Data_FY2026_Q3.xlsx"])
    newest = pick_latest(lca)
    check("LCA: the newest file is FY2026 Q3", newest, "LCA_Disclosure_Data_FY2026_Q3.xlsx")
    check("LCA: the double-slash href is normalised",
          normalise_url(lca[newest]), "https://www.dol.gov/media/LCA_Disclosure_Data_FY2026_Q3.xlsx")

    pw = discover_links(PAGE_HTML, PROGRAMS["pw"]["file_pattern"], HOST)
    check("PW: disclosure files only, never worksites or the FY2018 PWD name",
          sorted(pw), ["PW_Disclosure_Data_FY2023_Q4_old_form.xlsx",
                       "PW_Disclosure_Data_FY2023_Q4_revised_form.xlsx",
                       "PW_Disclosure_Data_FY2025_Q4.xlsx",
                       "PW_Disclosure_Data_FY2026_Q3.xlsx"])
    check("PW: the newest file is FY2026 Q3", pick_latest(pw), "PW_Disclosure_Data_FY2026_Q3.xlsx")
    check("PW: a relative href gets the host",
          pw["PW_Disclosure_Data_FY2025_Q4.xlsx"],
          "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/PW_Disclosure_Data_FY2025_Q4.xlsx")
    check("PW: within a year, the revised form outranks the old form",
          file_sort_key("PW_Disclosure_Data_FY2023_Q4_revised_form.xlsx")
          > file_sort_key("PW_Disclosure_Data_FY2023_Q4_old_form.xlsx"), True)
    check("a whole-year file sorts after that year's Q4",
          file_sort_key("PW_Disclosure_Data_FY2021_revised_form.xlsx")
          > file_sort_key("PW_Disclosure_Data_FY2021_Q4.xlsx"), True)
    check("a newer quarter outranks an older form generation",
          pick_latest(["PW_Disclosure_Data_FY2026_Q2_revised_form.xlsx",
                       "PW_Disclosure_Data_FY2026_Q3.xlsx"]),
          "PW_Disclosure_Data_FY2026_Q3.xlsx")
    check("normalise_url leaves the scheme alone",
          normalise_url("https://www.dol.gov///media/x.xlsx"), "https://www.dol.gov/media/x.xlsx")
    # --fy: one year's files, and the newest of them; a year DOL does not list is empty
    check("--fy keeps only that fiscal year's files",
          sorted(names_for_year(pw, 2023)),
          ["PW_Disclosure_Data_FY2023_Q4_old_form.xlsx", "PW_Disclosure_Data_FY2023_Q4_revised_form.xlsx"])
    check("--fy then picks the revised form for that year",
          pick_latest(names_for_year(pw, 2023)), "PW_Disclosure_Data_FY2023_Q4_revised_form.xlsx")
    check("--fy 2025 is the Q4 file", pick_latest(names_for_year(pw, 2025)), "PW_Disclosure_Data_FY2025_Q4.xlsx")
    check("--fy for an unlisted year is empty, never a neighbour", names_for_year(pw, 2019), [])
    check("load records are per file", load_record_key("pw", "PW_Disclosure_Data_FY2025_Q4.xlsx"),
          "flag_disclosure_pw:PW_Disclosure_Data_FY2025_Q4.xlsx")
    check("the legacy per-program key is unchanged", load_record_key("pw"), "flag_disclosure_pw")


def check_units() -> None:
    check("wage: dollars and commas stripped", parse_wage("$145,600.00"), 145600.0)
    check("wage: a plain number", parse_wage("38.5"), 38.5)
    check("wage: blank is None, never 0", parse_wage(""), None)
    check("wage: n/a is None", parse_wage("n/a"), None)
    check("wage: a negative is refused", parse_wage("-5"), None)
    check("state: a code passes through", parse_state(" ca "), "CA")
    check("state: a full name maps", parse_state("New York"), "NY")
    check("state: an unknown place is None, never a prefix guess", parse_state("Ontario"), None)
    check("text: whitespace collapses and empties become NULL",
          (clean_text("  Initech   LLC ", 80), clean_text("   ", 80)), ("Initech LLC", None))
    check("text: truncation honours the limit", clean_text("x" * 100, 80), "x" * 80)


def main() -> int:
    print("flag disclosure parser contract")
    check_units()
    check_discovery()
    with tempfile.TemporaryDirectory() as tmp:
        for writer_name, write in available_writers():
            check_fixture(tmp, writer_name, write)

    print()
    # Counts before the verdict: a suite that asserted nothing must be loud.
    print(f"{CHECKS} checks")
    if CHECKS < 40:
        print(f"FATAL: only {CHECKS} checks ran; the suite is truncated")
        return 1
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
