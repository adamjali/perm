#!/usr/bin/env python3
"""Probes for ingest_uscis_quarterly.py: discovery, footnote glue, every
reconciliation, storage counted back, drift, and the factsheet text.

    python3 scripts/test_uscis_quarterly.py                 # run the probes
    python3 scripts/test_uscis_quarterly.py --make-fixtures # regenerate scripts/fixtures/uscis/*

The fixtures are small workbooks in the exact shape USCIS publishes (title
rows, a date-range row, the header row, category rows with nothing but a
label, footnote markers glued to form numbers, `N/A`, `-` and `D` cells),
built once with openpyxl and checked in so the probes need no library the
ingest itself does not. Every total in them is computed by the builder, so
the reconciliation probes hold on the fixture and are broken by mutating a
parsed value, never by editing the file.
"""
from __future__ import annotations

import os
import pathlib
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest_uscis_quarterly as q  # noqa: E402

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures" / "uscis"
FAILURES: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + detail) if detail else ''}")
    if not cond:
        FAILURES.append(name)


def refuses(name: str, fn, needle: str = "") -> None:
    try:
        fn()
        check(name, False, "it was accepted")
    except q.Refusal as exc:
        check(name, needle in str(exc), str(exc)[:90])


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_fixtures() -> None:
    import openpyxl  # only the builder needs it

    FIXTURES.mkdir(parents=True, exist_ok=True)

    # 1. all_forms, under a re-issued `_v2` name. Footnote glue on I-600,
    #    I-924, Legalization, DS-230; letter suffixes kept; N/A and - cells.
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "FY26Q3_All_Forms"
    ws.append(["Number of Service-wide Forms"])
    ws.append(["By Quarter, Form Status, and Processing Time "])
    ws.append(["April 1, 2026 - June 30, 2026"])
    ws.append([None, None, "3rd Quarter", None, None, None, None, None, "Fiscal Year - To Date"])
    ws.append(["Category and Form Number", "Form Title", "Forms Received1", "Approved2", "Denied3",
               "Total Completions4", "Pending5", "Processing Time6",
               "Forms Received", "Approved", "Denied", "Total Completions", "Pending"])
    forms: list[tuple[str, str, list]] = []
    forms.append(("Family Based", None, []))
    forms.append(("I-129F", "Petition for Alien Fiancé(e)", [9737, 6966, 2307, 9273, 35871, 9]))
    forms.append(("I-6007", "Petition to Classify Orphan as an Immediate Relative", [103, 101, 66, 167, 556, 12.2]))
    forms.append(("I-601A", "Application for Provisional Unlawful Presence Waiver", [9993, 3556, 576, 4132, 77755, 25.4]))
    forms.append(("Employment Based", None, []))
    forms.append(("I-129", "Petition for a Nonimmigrant Worker", [220566, 143748, 39560, 183308, 192712, 9.5]))
    forms.append(("I-140", "Immigrant Petition for Alien Workers", [62932, 37975, 7069, 45044, 203204, 3.9]))
    forms.append(("I-92410", "Application For Regional Center Designation", [0, 0, 2, 2, 2, 189.4]))
    forms.append(("I-956G", "Regional Center Annual Statement", [6, 0, 0, 0, 0, "-"]))
    forms.append(("I-765", "Application for Employment Authorization (Asylum)", [125663, 117965, 10986, 128951, 108565, 0.8]))
    forms.append(("I-765", "Application for Employment Authorization (Adjustment Of Status)", [153039, 46405, 35767, 82172, 671362, 6.4]))
    forms.append(("I-765", "Application for Employment Authorization (DACA)", [81835, 76053, 482, 76535, 231872, 4.1]))
    forms.append(("I-765", "Application for Employment Authorization (All Other)", [212410, 125656, 19787, 145443, 1098913, 3.3]))
    forms.append(("Humanitarian", None, []))
    forms.append(("Legalization13", "Legalization/SAW", [4, 0, 10, 10, 150, 0]))
    forms.append(("I-730", "Refugee/Asylee Relative Petition", [2401, 151, 89, 240, 23562, "N/A"]))
    forms.append(("Lawful Permanent Residence", None, []))
    for basis, vals in (("Family", [95175, 54678, 12240, 66918, 611067, 7]),
                        ("Employment", [97501, 42076, 3160, 45236, 268408, 6]),
                        ("Asylum", [15141, 2350, 292, 2642, 126267, 25.6]),
                        ("Refugee", [16819, 103, 45, 148, 149470, 17.6]),
                        ("Cuban", [6279, 139, 447, 586, 342360, 16.3]),
                        ("Other", [12074, 2222, 614, 2836, 62718, 21])):
        forms.append(("I-485", f"Application to Register Permanent Residence or Adjust Status ({basis})", vals))
    forms.append(("Citizenship and Nationality", None, []))
    forms.append(("N-400", "Application for Naturalization (Military)", [5693, 2723, 251, 2974, 14767, 2.6]))
    forms.append(("N-400", "Application for Naturalization", [140179, 54974, 12591, 67565, 727371, 9.5]))
    forms.append(("N-60019", "Application for Certificate of Citizenship", [12660, 9199, 831, 10030, 58165, 6.9]))
    forms.append(("N-648", "Medical Certification for Disability Exceptions", [13001, "N/A", "N/A", 5427, 9302, 0]))
    forms.append(("Other", None, []))
    forms.append(("I-131", "Application for Travel Documents, Parole Documents, and Arrival/Departure Records", [21904, 13551, 1255, 14806, 120768, 14.4]))
    forms.append(("I-13120", "Application for Initial Parole Document for Aliens Outside the United States", [644, 102, 469, 630, 32373, 0]))
    # Pad to the 60-row floor with synthetic but well-formed forms.
    for i in range(40):
        forms.append((f"I-{700 + i}", f"Synthetic Form {i}", [100 + i, 50, 10, 60, 1000 + i, 4.5]))
    forms.append(("Supplemental Processing", None, []))
    forms.append(("DS-23022", "Application for Immigrant Visa and Alien Registration (IV)", [78997, "N/A", "N/A", 91482, 25445, "N/A"]))
    total = [sum(v[i] for _, _, v in forms if v and isinstance(v[i], int)) for i in range(5)]
    ws.append(["TOTAL", None, *total, "N/A", *[t * 3 for t in total]])
    for label, title, vals in forms:
        if not vals:
            ws.append([label])
        else:
            ws.append([label, title, *vals, *[v * 3 if isinstance(v, int) else v for v in vals[:5]]])
    ws.append(["Table Key:"])
    ws.append(["N/A  Not available"])
    ws.append(["7 Includes I-600A, Application for Advance Processing of an Orphan Petition."])
    wb.save(FIXTURES / "quarterly_all_forms_fy2026_q3_v2.xlsx")

    # 2. I-485 by office: 50 states x 2 offices plus 6 service centers, one
    #    D cell and one - cell; the Total row counts the D cell as 4.
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "I485_by_State"
    ws.append(["Number of I-485 Applications to Register Permanent Residence or Adjust Status"])
    ws.append(["By Category, Case Status, and USCIS Field Office or Service Center Location"])
    ws.append(["April 1, 2026 - June 30, 2026"])
    ws.append(["USCIS Field Office or Service Center Location", None, "Applications by Category of Admission and Case Status"])
    ws.append([None, None, "Family-based1", None, None, None, "Employment-based received at service center2", None, None, None,
               "Humanitarian-based3", None, None, None, "Others4"])
    ws.append(["Field Office by State9", "Field Office Code", *(["Applications Received5", "Approved6", "Denied7", "Pending8"] * 5)])
    offices: list[tuple[str, str, str, list]] = []
    n = 0
    for s in range(50):
        state = f"State {s:02d}"
        for o in range(2):
            n += 1
            base = [n * 7 + k for k in range(16)]
            allc = [base[k] + base[4 + k] + base[8 + k] + base[12 + k] for k in range(4)]
            offices.append((state, f"Office {n}", f"O{n:03d}", base + allc))
    for name, code in (("California", "WSC"), ("National Benefits Center", "NBC"), ("Nebraska", "NSC"),
                       ("Potomac", "YSC"), ("Texas", "SSC"), ("Vermont", "ESC")):
        n += 1
        base = [n * 3 + k for k in range(16)]
        allc = [base[k] + base[4 + k] + base[8 + k] + base[12 + k] for k in range(4)]
        offices.append(("Service Center", name, code, base + allc))
    totals = [sum(v[k] for _, _, _, v in offices) for k in range(20)]
    # Office 1's emp_pending (column index 7) becomes D, worth 4 in the total;
    # office 2's hum_denied (index 10) becomes "-", worth 0.
    offices[0][3][7] = "D"
    totals[7] = totals[7] - (1 * 7 + 7) + 4
    totals[10] -= offices[1][3][10]
    offices[1][3][10] = "-"
    ws.append(["Total", None, *totals])
    last_state = None
    for state, office, code, vals in offices:
        if state != last_state:
            ws.append([state])
            last_state = state
        ws.append([office + " ", code, *vals])
    ws.append(["Table Key:"])
    ws.append(["D Disclosure standards not met"])
    ws.append(["- Represents zero or rounds to 0.0"])
    wb.save(FIXTURES / "i485_performance_data_fy2026_q3_v1.xlsx")

    # 3. Awaiting a visa, FY2025 Q4 under the `performance_data` spelling.
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "I140_I360_I526_app_wait_vis"
    ws.append(["Number of Form I-140, I-360, I-526/E Approved Employment-Based Petitions Awaiting Visa Availability"])
    ws.append(["By Preference Category and Country of Birth"])
    ws.append(["As of September 2025"])
    ws.append(["Country", "1st (Priority)", "2nd (Advanced Degree Professional)", "3rd (Professional and Skilled)",
               "3rd (Other)", "4th (Certain Special Immigrants)", "4th \n(Certain Religious Workers)",
               "5th\n(Investor Unreserved)", "5th\n (Investor \nSet Aside)", "TOTAL"])
    rows = {
        "China": [14101, 34936, 11070, 916, 1093, 114, 9549, 0],
        "India": [17861, 356360, 106214, 228, 10870, 236, 4, 0],
        "Mexico": [0, 0, 757, 7283, 15959, 131, 0, 0],
        "Philippines": [0, 0, 19147, 5627, 189, 63, 0, 0],
        "Rest of the World": [0, 0, 10304, 43689, 188567, 1394, 0, 0],
    }
    total = [sum(v[k] for v in rows.values()) for k in range(8)]
    ws.append(["TOTAL", *[str(t) for t in total], str(sum(total))])
    for country, vals in rows.items():
        ws.append([country, *[str(v) for v in vals], str(sum(vals))])
    ws.append(["Table Key:"])
    wb.save(FIXTURES / "eb_i140_i360_i526_performance_data_fy2025_q4_v1.xlsx")

    # 4. Class by country: two sheets, three years, consistent totals, one
    #    blank class cell and the (E21)2 glue.
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    years = [2024, 2025, 2026]
    for sheet, scale in (("All Countries FY26", 10), ("India FY26", 4)):
        ws = wb.create_sheet(sheet)
        ws.append([f"Number of Form I-140 ... for {sheet.split(' FY')[0]}"])
        ws.append(["By Fiscal Year Received and Current Status"])
        ws.append(["Fiscal Years 2014 to 2026 (Q3)"])
        ws.append(["Petitions by Employment Preference", *years, "TOTAL"])
        classes = {
            "EB1": {"E11": [5, 6, 7], "E12": [0, 4, 3], "E13": [9, 8, 2]},
            "EB2": {"E21": [30, 31, 20], "NIW": [10, 12, 4]},
            "EB3": {"E31": [3, 2, 1], "E32": [8, 7, 6], "EW3": [1, 1, 1]},
        }
        denied = {"EB1": [2, 3, 4], "EB2": [3, 2, 1], "EB3": [1, 1, 2], "OTHER": [0, 1, 0]}
        pending = {"EB1": [1, 1, 2], "EB2": [2, 5, 9], "EB3": [1, 4, 6], "OTHER": [0, 0, 1]}
        approved = {p: [sum(c[y] for c in cl.values()) * scale for y in range(3)] for p, cl in classes.items()}
        approved["OTHER"] = [0, 0, 0]
        for p in denied:
            denied[p] = [v * scale for v in denied[p]]
            pending[p] = [v * scale for v in pending[p]]
        totals = {p: [approved[p][y] + denied[p][y] + pending[p][y] for y in range(3)]
                  for p in ("EB1", "EB2", "EB3", "OTHER")}
        alltot = [sum(totals[p][y] for p in totals) for y in range(3)]
        allapp = [sum(approved[p][y] for p in totals) for y in range(3)]
        allden = [sum(denied[p][y] for p in totals) for y in range(3)]
        allpen = [sum(pending[p][y] for p in totals) for y in range(3)]
        row = lambda label, v: ws.append([label, *v, sum(v)])  # noqa: E731
        row("TOTAL", alltot)
        row("Approved", allapp)
        row("Denied", allden)
        row("  Pending, Other1", allpen)
        labels = {"EB1": "First Preference (EB1)", "EB2": "Second Preference (EB2)", "EB3": "Third Preference (EB3)"}
        names = {"E11": "Aliens with Extraordinary Ability (E11)", "E12": "Outstanding Professors or Researchers (E12)",
                 "E13": "Multinational Executives or Managers (E13)", "E21": "Professionals with Advanced Degrees (E21)2",
                 "NIW": "National Interest Waiver (NIW)", "E31": "Skilled Workers (E31)",
                 "E32": "Professionals with Baccalaureate Degrees (E32)", "EW3": "Unskilled Workers (EW3)"}
        for p in ("EB1", "EB2", "EB3"):
            ws.append([labels[p]])
            row("Total Petitions", totals[p])
            row("Approved", approved[p])
            row("Denied", denied[p])
            row("Pending, Other1", pending[p])
            ws.append(["Approvals by Category"])
            for code, vals in classes[p].items():
                scaled = [v * scale for v in vals]
                cells = [None if v == 0 else v for v in scaled]   # a zero is left BLANK, as USCIS does
                ws.append([names[code], *cells, sum(scaled)])
        row("Other and Unknown3", totals["OTHER"])
        row("Approved", approved["OTHER"])
        row("Denied", denied["OTHER"])
        row("Pending, Other1", pending["OTHER"])
        ws.append(["Table Key:"])
    wb.save(FIXTURES / "i140_rec_by_class_country_fy2026_q3_v1.xlsx")
    print(f"fixtures written to {FIXTURES}")


# ---------------------------------------------------------------------------
# A Turso stand-in over sqlite, answering in the HTTP pipeline's row shape.
# ---------------------------------------------------------------------------

class FakeDb:
    def __init__(self, drop_one_row: bool = False) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.drop_one_row = drop_one_row
        self.statements: list[str] = []

    def execute(self, sql: str, args: list | None = None, **_kw) -> dict:
        self.statements.append(sql)
        cur = self.conn.execute(sql, args or [])
        rows = [[{"type": "text", "value": v} for v in r] for r in cur.fetchall()]
        if self.drop_one_row and sql.lstrip().upper().startswith("INSERT"):
            table = sql.split("INTO", 1)[1].split()[0]
            self.conn.execute(f"DELETE FROM {table} WHERE rowid = (SELECT max(rowid) FROM {table})")
        return {"response": {"result": {"rows": rows}}}

    def scalar(self, sql: str, args: list | None = None):
        cur = self.conn.execute(sql, args or [])
        r = cur.fetchone()
        return None if r is None else r[0]


def parse_fixture(name: str) -> q.Parsed:
    ident = q.identify(name)
    assert ident, name
    kind, fy, qq = ident
    listed = q.Listed(kind, fy, qq, name, str(FIXTURES / name))
    return q.parse_blob(listed, (FIXTURES / name).read_bytes())


# ---------------------------------------------------------------------------
# Probes
# ---------------------------------------------------------------------------

def main() -> int:
    if "--make-fixtures" in sys.argv:
        make_fixtures()
        return 0
    print("ingest_uscis_quarterly probes\n")

    # -- discovery ---------------------------------------------------------
    html = """
      <a href="/sites/default/files/document/data/quarterly_all_forms_fy2026_q3_v1.xlsx">x</a>
      <a href="https://www.uscis.gov/sites/default/files/document/data/quarterly_all_forms_fy2026_q3_v1.xlsx">dup</a>
      <a href="/sites/default/files/document/reports/quarterly_all_forms_fy2026_q1_v1.xlsx">q1</a>
      <a href="/sites/default/files/document/data/eb_i140_i360_i526_performance_data_fy2025_q4_v1.xlsx">old spelling</a>
      <a href="/sites/default/files/document/data/eb_i140_i360_i526_performancedata_fy2026_q2_v1.xlsx">new spelling</a>
      <a href="/sites/default/files/document/data/i485_performance_data_fy2026_q2_v2.xlsx">reissue</a>
      <a href="/sites/default/files/document/data/eb_inventory_august_2026_v1.0.xlsx">not ours</a>
      <a href="/sites/default/files/document/data/i140_fy2026_q3_v1.xlsx">not ours either</a>
    """
    found = q.discover(html)
    names = [f.name for f in found]
    check("discovery de-duplicates the absolute and relative forms of one file",
          names.count("quarterly_all_forms_fy2026_q3_v1.xlsx") == 1)
    check("discovery finds the /reports/ path and sorts oldest first",
          names[:2] == ["quarterly_all_forms_fy2026_q1_v1.xlsx", "quarterly_all_forms_fy2026_q3_v1.xlsx"], str(names))
    check("both spellings of the awaiting-visa file are recognised",
          sum(1 for f in found if f.kind == "eb_awaiting") == 2)
    check("a _v2 re-issue is listed under its own name",
          any(f.name.endswith("_q2_v2.xlsx") and f.kind == "i485_offices" for f in found))
    check("files this ingest does not own are ignored",
          not any("eb_inventory" in n or n.startswith("i140_fy") for n in names))
    check("every discovered url is absolute", all(f.url.startswith("https://www.uscis.gov/") for f in found))
    check("a bare listing yields nothing rather than a guessed file", q.discover("<p>no files</p>") == [])

    # -- footnote glue and cells -------------------------------------------
    for raw, want in (("I-6007", "I-600"), ("I-92410", "I-924"), ("N-60019", "N-600"), ("DS-23022", "DS-230"),
                      ("I-13120", "I-131"), ("I-129F", "I-129F"), ("I-601A", "I-601A"), ("I-956K", "I-956K"),
                      ("G-325A", "G-325A"), ("Legalization13", "Legalization"), ("Waivers21", "Waivers"),
                      ("EOIR Adjustment22", "EOIR Adjustment"), ("Advance Parole Document3", "Advance Parole Document"),
                      ("Professionals with Advanced Degrees (E21)2", "Professionals with Advanced Degrees (E21)"),
                      ("Travel Documents", "Travel Documents")):
        check(f"strip_footnote({raw!r}) -> {want!r}", q.strip_footnote(raw) == want, q.strip_footnote(raw))
    for raw, want in (("N/A", None), ("D", None), ("-", 0), ("", None), (None, None), ("62932", 62932),
                      ("1,234", 1234), ("3.0", 3), (" 7 ", 7)):
        check(f"cell_int({raw!r}) -> {want!r}", q.cell_int(raw) == want)
    refuses("cell_int refuses a fraction where a count belongs", lambda: q.cell_int("3.9"), "whole number")
    check("cell_float reads a median and N/A", q.cell_float("3.9") == 3.9 and q.cell_float("N/A") is None)
    check("quarter_bounds parses USCIS's date range",
          q.quarter_bounds("April 1, 2026 - June 30, 2026") == ("2026-04-01", "2026-06-30"))
    check("sheet_country strips FY26 and a bare year",
          (q.sheet_country("India FY26"), q.sheet_country("Vietnam 2026"), q.sheet_country("All Countries FY26"))
          == ("India", "Vietnam", "All Countries"))

    if not FIXTURES.is_dir():
        check("fixtures exist (run --make-fixtures)", False)
        return report()

    # -- all_forms ---------------------------------------------------------
    af = parse_fixture("quarterly_all_forms_fy2026_q3_v2.xlsx")
    check("all_forms: the _v2 filename identifies FY2026 Q3", (af.fy, af.quarter) == (2026, 3))
    check("all_forms: quarter bounds read from the sheet", (af.quarter_start, af.quarter_end) == ("2026-04-01", "2026-06-30"))
    forms = {r["form"] for r in af.rows}
    check("all_forms: glued footnotes are stripped from form numbers",
          {"I-600", "I-924", "N-600", "DS-230", "Legalization"} <= forms and "I-6007" not in forms)
    check("all_forms: letter suffixes survive", {"I-129F", "I-601A", "I-956G"} <= forms)
    i140 = next(r for r in af.rows if r["form"] == "I-140")
    check("all_forms: I-140 median 3.9 and pending 203,204", (i140["median_months"], i140["pending"]) == (3.9, 203204))
    check("all_forms: category carried from the label row", i140["category"] == "Employment Based")
    n648 = next(r for r in af.rows if r["form"] == "N-648")
    check("all_forms: N/A approvals are None, not zero", n648["approved"] is None and n648["completed"] == 5427)
    i956 = next(r for r in af.rows if r["form"] == "I-956G")
    check("all_forms: a '-' median is None", i956["median_months"] is None)
    i730 = next(r for r in af.rows if r["form"] == "I-730")
    check("all_forms: an N/A median is None", i730["median_months"] is None)
    check("all_forms: six I-485 rows keyed by title", sum(1 for r in af.rows if r["form"] == "I-485") == 6)
    check("all_forms: the TOTAL row is kept", any(r["form"] == "TOTAL" for r in af.rows))
    check("all_forms: I-131 with glue joins its three siblings", sum(1 for r in af.rows if r["form"] == "I-131") == 2)
    check("all_forms: YTD columns read", i140["ytd_received"] == 62932 * 3)

    def shifted():
        bad = q.Parsed(af.kind, af.fy, af.quarter, af.name, af.quarter_start, af.quarter_end,
                       rows=[dict(r) for r in af.rows])
        for r in bad.rows:
            if r["form"] == "I-485":
                r["pending"] = 10
        q.reconcile_all_forms(bad)
    refuses("all_forms: a shifted pending column is refused", shifted, "column has shifted")

    def dup():
        bad = q.Parsed(af.kind, af.fy, af.quarter, af.name, af.quarter_start, af.quarter_end,
                       rows=[dict(r) for r in af.rows] + [dict(i140)])
        q.reconcile_all_forms(bad)
    refuses("all_forms: a duplicate form/title key is refused", dup, "duplicate")

    def missing():
        bad = q.Parsed(af.kind, af.fy, af.quarter, af.name, af.quarter_start, af.quarter_end,
                       rows=[dict(r) for r in af.rows if r["form"] != "I-140"])
        q.reconcile_all_forms(bad)
    refuses("all_forms: a sheet without the I-140 is refused", missing, "I-140 missing")

    # -- i485_offices --------------------------------------------------------
    of = parse_fixture("i485_performance_data_fy2026_q3_v1.xlsx")
    check("offices: 106 office rows plus the Total", len(of.rows) == 107)
    total = next(r for r in of.rows if r["code"] == "ALL")
    check("offices: the Total row carries every measure", total["emp_pending"] is not None and total["all_pending"] > 0)
    o1 = next(r for r in of.rows if r["code"] == "O001")
    check("offices: a D cell is None and counted as suppressed",
          o1["emp_pending"] is None and o1["suppressed"] == 1)
    o2 = next(r for r in of.rows if r["code"] == "O002")
    check("offices: a '-' cell is zero", o2["hum_denied"] == 0 and o2["suppressed"] == 0)
    check("offices: office names lose their trailing space and keep their state",
          o1["office"] == "Office 1" and o1["state"] == "State 00")
    check("offices: service centers sit under 'Service Center'",
          {r["state"] for r in of.rows if r["code"] in ("WSC", "NBC", "NSC", "YSC", "SSC", "ESC")} == {"Service Center"})

    def off_shift():
        bad = q.Parsed(of.kind, of.fy, of.quarter, of.name, rows=[dict(r) for r in of.rows])
        next(r for r in bad.rows if r["code"] == "O005")["fam_received"] += 1
        q.reconcile_offices(bad)
    refuses("offices: a column that no longer sums to the published Total is refused", off_shift, "against a published")

    def off_suppressed_floor():
        bad = q.Parsed(of.kind, of.fy, of.quarter, of.name, rows=[dict(r) for r in of.rows])
        # The suppressed column's parts must sit within 9 per D of the total.
        next(r for r in bad.rows if r["code"] == "ALL")["emp_pending"] += 100
        q.reconcile_offices(bad)
    refuses("offices: a suppressed column outside its floor is refused", off_suppressed_floor, "suppressed")

    # -- eb_awaiting ---------------------------------------------------------
    aw = parse_fixture("eb_i140_i360_i526_performance_data_fy2025_q4_v1.xlsx")
    check("awaiting: the older spelling identifies FY2025 Q4", (aw.fy, aw.quarter) == (2025, 4))
    check("awaiting: as-of read from the sheet", aw.as_of == "2025-09")
    check("awaiting: 6 countries x 9 categories", len(aw.rows) == 54)
    by = {(r["country"], r["category"]): r["count"] for r in aw.rows}
    check("awaiting: multi-line headings map to codes", by[("India", "EB2")] == 356360 and by[("China", "EB5U")] == 9549)
    check("awaiting: the two 4th and two 5th columns are told apart",
          by[("Mexico", "EB4")] == 15959 and by[("Mexico", "EB4R")] == 131 and by[("TOTAL", "EB5S")] == 0)

    def aw_bad():
        bad = q.Parsed(aw.kind, aw.fy, aw.quarter, aw.name, as_of=aw.as_of, rows=[dict(r) for r in aw.rows])
        next(r for r in bad.rows if r["country"] == "India" and r["category"] == "EB2")["count"] += 1
        q.reconcile_awaiting(bad)
    refuses("awaiting: a country that no longer sums to the TOTAL row is refused", aw_bad, "TOTAL")

    # -- i140_class_country --------------------------------------------------
    cc = parse_fixture("i140_rec_by_class_country_fy2026_q3_v1.xlsx")
    check("class/country: as-of is the file's quarter", cc.as_of == "2026-Q3")
    check("class/country: two sheets, three years, every measure",
          {r["country"] for r in cc.rows} == {"All Countries", "India"} and len(cc.rows) == 2 * 3 * (4 + 4 * 4 + 8))
    byc = {(r["country"], r["preference"], r["measure"], r["fy"]): r["count"] for r in cc.rows}
    check("class/country: (E21)2 glue still yields the E21 class", ("All Countries", "EB2", "approved_E21", 2024) in byc)
    check("class/country: a blank class cell reads as zero and is noted",
          byc[("All Countries", "EB1", "approved_E12", 2024)] == 0 and any("E12 2024 blank" in n for n in cc.notes))
    check("class/country: Other and Unknown carries its total on its own row",
          byc[("India", "OTHER", "total", 2025)] == 4 and byc[("All Countries", "OTHER", "total", 2025)] == 10)

    def cc_bad():
        bad = q.Parsed(cc.kind, cc.fy, cc.quarter, cc.name, as_of=cc.as_of, rows=[dict(r) for r in cc.rows])
        next(r for r in bad.rows if r["country"] == "India" and r["preference"] == "EB3"
             and r["measure"] == "approved_E31" and r["fy"] == 2026)["count"] += 1
        q.reconcile_class_country(bad)
    refuses("class/country: classes that no longer sum to approved are refused", cc_bad, "classes sum")

    # -- storage counted back ------------------------------------------------
    db = FakeDb()
    q.ensure_tables(db)
    for p in (af, of, aw, cc):
        n = q.store(db, p)
        check(f"store {p.kind}: parsed == stored ({n})", n == len(p.rows))
    n2 = q.store(db, af)
    check("store is idempotent per quarter (a reload replaces, never doubles)",
          n2 == len(af.rows) and db.scalar("SELECT count(*) FROM uscis_form_quarters") == len(af.rows))
    check("store keeps a NULL for a suppressed office cell",
          db.scalar("SELECT emp_pending FROM uscis_i485_offices WHERE code = 'O001'") is None
          and db.scalar("SELECT suppressed FROM uscis_i485_offices WHERE code = 'O001'") == 1)
    lossy = FakeDb(drop_one_row=True)
    q.ensure_tables(lossy)
    refuses("store refuses when the count read back is short", lambda: q.store(lossy, aw), "REFUSING")

    # -- drift -----------------------------------------------------------------
    check("drift: no baseline, no findings", q.drift_findings(None, af) == [])
    check("drift: same keys, no findings",
          q.drift_findings({f"{r['form']}|{r['title']}" for r in af.rows}, af) == [])
    lost = q.drift_findings({f"{r['form']}|{r['title']}" for r in af.rows} | {"I-999|Gone Form"}, af)
    check("drift: a key held last quarter and not now is a finding", len(lost) == 1 and "I-999|Gone Form" in lost[0])
    check("drift: previous_keys reads the newest EARLIER quarter",
          q.previous_keys(db, q.Parsed("all_forms", 2026, 4, "next.xlsx")) == {f"{r['form']}|{r['title']}" for r in af.rows}
          and q.previous_keys(db, af) is None)

    # -- the whole run over local files, against the fake --------------------
    q.Turso = lambda: db  # type: ignore[assignment]
    rc = q.main(["--local", str(FIXTURES), "--skip-factsheet"])
    loads = q.read_loads(db)
    check("main: exits 0 and records every file by name",
          rc == 0 and set(loads) == {p.name for p in (af, of, aw, cc)})
    fresh = {r[0]["value"]: r[1]["value"] for r in
             db.execute("SELECT dataset, as_of FROM data_freshness")["response"]["result"]["rows"]}
    check("main: stamps all four datasets with the quarter's end or as-of",
          fresh.get("uscis-form-quarters") == "2026-06-30" and fresh.get("uscis-eb-awaiting-visa") == "2025-09-30"
          and fresh.get("uscis-i140-class-country") == "2026-06-30" and fresh.get("uscis-i485-offices") == "2026-06-30")
    check("quarter_end: Q1 ends in the prior calendar year",
          (q.quarter_end(2026, 1), q.quarter_end(2026, 4)) == ("2025-12-31", "2026-09-30"))
    runs = db.execute("SELECT status, note FROM ingest_runs ORDER BY rowid DESC LIMIT 1")["response"]["result"]["rows"]
    check("main: records an ok run naming the files", runs and runs[0][0]["value"] == "ok" and "loaded" in runs[0][1]["value"])
    before = len(db.statements)
    rc = q.main(["--local", str(FIXTURES), "--skip-factsheet"])
    inserts = [s for s in db.statements[before:] if s.lstrip().upper().startswith("INSERT OR REPLACE INTO uscis_")]
    check("main: a second run skips every file already loaded (no table inserts)", rc == 0 and inserts == [])
    runs = db.execute("SELECT note FROM ingest_runs ORDER BY rowid DESC LIMIT 1")["response"]["result"]["rows"]
    check("main: the quiet run says so", "nothing new" in runs[0][0]["value"])

    # -- the factsheet text ----------------------------------------------------
    text = """Historical Processing Times Trends
Data Source: USCIS. Data as of 03/05/2024
Table 1. FY 2016 - FY 2024 Median Processing Times (months)
Form Classification or Basis for Filing 2016 2017 2018 2019 2020 2021 2022 2023 20242
I-765 Based on a pending asylum application 2 1.7 0.9 2 2.5 3.2 9.2 1.6 0.6
I-765 Based on a pending I-485 adjustment application 2.5 3 4.1 5.1 4.8 7.1 6.7 5.5 3.6
I-765 Based on parole 2.6 2.9 3.5 6.1 4.7 0.6 1.1 1.3 0.9
I-765 All other applications for employment authorization 2.2 2.5 2.9 3.3 2.4 3 4.7 3.2 2.9
I-821 To request or reregister for TPS 1.9 3.4 2.9 6.4 2.2 4.1 10.2 11.8 8.7
I-485 Based on grant of asylum more than 1 year ago 4.4 5.5 6.2 6.7 6.9 12.9 22.6 22.9 13.9
I-485 Based on refugee admission more than 1 year ago 5.5 4.6 6.4 9.4 9.3 7.1 14.1 21.6 13.3
I-485 Employment-based adjustment applications 5.5 7 10.6 10 8.8 9.9 11 8.6 7.2
I-485 Family-based adjustment applications 6.1 7.9 10.2 10.9 9.3 12.9 10.6 11.4 9.4
I-130 Immediate Relative 4.9 6.5 7.6 8.6 8.3 10.2 10.3 11.8 11
N-400 Application for Naturalization 5.2 7.9 9.7 10 9.1 11.5 10.5 6.1 5.2
I-131 Advance Parole Document3 2.3 3 3.6 4.5 4.6 7.7 7.3 5.8 4.4
I-90 Initial issuance, replacement or renewal 6.4 6.8 8 7.8 8.3 5.2 1.2 9.16 3.3
Table 2. Change in Median Processing Time from Prior Year (percent difference)
I-765 Based on a pending asylum application - -15% -47% 122% 25% 28% 188% --83% --63%
I-485 Employment-based adjustment applications - 27% 51% -6% -12% 13% 11% -22% -16%
"""
    doc = q.parse_factsheet_text(text)
    check("factsheet: as-of and nine years", doc["asOf"] == "2024-03-05" and doc["years"] == list(range(2016, 2025)))
    check("factsheet: Table 2's percent rows are not counted as medians", len(doc["rows"]) == 13)
    i90 = next(r for r in doc["rows"] if r["form"] == "I-90")
    check("factsheet: a two-digit form number is read", i90["months"][0] == 6.4)
    check("factsheet: 9.16 is 9.1 with a glued footnote, and says so",
          i90["months"][7] == 9.1 and any("9.16" in g for g in doc["glued"]))
    ap = next(r for r in doc["rows"] if r["form"] == "I-131")
    check("factsheet: a glued basis footnote is stripped", ap["basis"] == "Advance Parole Document")
    refuses("factsheet: a text without the employment I-485 row is refused",
            lambda: q.parse_factsheet_text(text.replace("I-485 Employment-based adjustment applications 5.5", "I-485 Nothing 5.5")),
            "employment-based")
    return report()


def report() -> int:
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED: {FAILURES}")
        return 1
    print("all probes passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
