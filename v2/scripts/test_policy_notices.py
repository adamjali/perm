#!/usr/bin/env python3
"""Contract tests for the Federal Register feed's selection rules.

    python3 scripts/test_policy_notices.py

The API is not called. What is tested is the one place a wrong answer is
silent: `keep()`, which decides whether a matched document is listed. A
Treasury clean-energy notice matching "prevailing wage" listed beside a DOL
rule would be a plausible wrong page, and nothing would error.
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pn", HERE / "ingest_policy_notices.py")
pn = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(pn)

failures: list[str] = []


def check(label: str, cond: bool) -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}")
    if not cond:
        failures.append(label)


def doc(title: str, agencies: list[str], abstract: str = "") -> dict:
    return {"title": title, "agencies": agencies, "abstract": abstract}


def main() -> int:
    check("a DHS proposed rule is kept",
          pn.keep(doc("Fee for Certain H-1B Petitions", ["Homeland Security Department"])))
    check("an ETA rule is kept",
          pn.keep(doc("Wagner-Peyser Act Employment Service Staffing", ["Labor Department", "Employment and Training Administration"])))
    check("Treasury's clean-energy prevailing wage notice is dropped by agency",
          not pn.keep(doc("Publication of Inflation Adjustment Factor and Applicable Amounts for Clean Electricity", ["Internal Revenue Service", "Treasury Department"])))
    check("the immigration courts' fee notice is dropped by agency",
          not pn.keep(doc("Inflation Adjustment for EOIR OBBBA Fees; Fiscal Year 2027", ["Executive Office for Immigration Review", "Justice Department"])))
    check("the Unified Agenda is dropped",
          not pn.keep(doc("Unified Agenda of Federal Regulatory and Deregulatory Actions", ["Homeland Security Department"])))
    check("a semiannual agenda of regulations is dropped",
          not pn.keep(doc("Agenda of Regulations", ["Labor Department"])))
    check("a paperwork notice naming I-140 is kept",
          pn.keep(doc("Agency Information Collection Activities; Revision of a Currently Approved Collection: Immigrant Petition for Alien Workers, Form I-140", ["U.S. Citizenship and Immigration Services"])))
    check("a paperwork notice naming no form of interest is dropped",
          not pn.keep(doc("Agency Information Collection Activities; Extension, Without Change: Application for Naturalization", ["U.S. Citizenship and Immigration Services"])))
    check("a document with no agency is dropped",
          not pn.keep(doc("Some title", [])))
    # Agency housekeeping (the real title that sat on the page for six days).
    check("a Performance Review Board appointment notice is dropped",
          not pn.keep(doc("Senior Executive Service; Appointment of Members to the Performance Review Board", ["Labor Department"])))
    check("an advisory committee meeting notice is dropped",
          not pn.keep(doc("Advisory Committee on Apprenticeship; Notice of Meeting", ["Labor Department"])))
    check("a rule whose title merely contains 'board' is kept",
          pn.keep(doc("Immigration Bonds; Technical Amendment", ["Homeland Security Department"])))

    # shape(): the API's document becomes the row, dates and correction included.
    api_doc = {
        "document_number": "C1-2026-17324", "title": "Fee for Certain H-1B Petitions", "type": "Proposed Rule",
        "abstract": "", "html_url": "https://www.federalregister.gov/d/C1-2026-17324",
        "publication_date": "2026-09-10", "agencies": [{"name": "Homeland Security Department"}],
        "effective_on": None, "comments_close_on": "", "comment_url": None, "citation": "91 FR 57516",
        "action": None, "dates": "  ", "correction_of": "https://www.federalregister.gov/api/v1/documents/2026-17324",
        "pdf_url": "https://www.govinfo.gov/content/pkg/FR-2026-09-10/pdf/C1-2026-17324.pdf",
    }
    row = pn.shape(api_doc)
    check("shape keeps the parent's NUMBER out of the correction_of URL", row["correction_of"] == "2026-17324")
    check("shape turns empty and blank strings into NULL", row["comments_close_on"] is None and row["dates"] is None)
    check("shape carries the citation and pdf", row["citation"] == "91 FR 57516" and row["pdf_url"].endswith("C1-2026-17324.pdf"))
    check("shape without a correction_of gives None", pn.shape({"document_number": "x"})["correction_of"] is None)

    # add_missing_columns() adds only what the live table lacks; write()
    # compares on the new fields too, so a changed effective date is a write.
    class FakeDb:
        def __init__(self, cols):
            self.cols = list(cols); self.sql = []; self.rows = []
        def script(self, stmts): self.sql += list(stmts)
        def execute(self, sql, args=None):
            self.sql.append(sql)
            if sql.startswith("PRAGMA table_info"):
                return {"response": {"result": {"rows": [[{"type": "integer", "value": i}, {"type": "text", "value": c}] for i, c in enumerate(self.cols)]}}}
            if sql.startswith("ALTER TABLE"):
                self.cols.append(sql.split()[-2]); return {}
            if sql.startswith("SELECT"):
                return {"response": {"result": {"rows": self.rows}}}
            return {}
    base = ["document_number", "publication_date", "type", "title", "abstract", "html_url", "agencies", "topics", "fetched_at"]
    db = FakeDb(base)
    from lib_db import add_missing_columns
    added = add_missing_columns(db, "policy_notices", pn.EXTRA_COLUMNS)
    check("every extra column is added to a nine-column table", added == pn.EXTRA_NAMES)
    check("nothing is added the second time", add_missing_columns(db, "policy_notices", pn.EXTRA_COLUMNS) == [])
    # write() goes through the shared writer (lib_policy_feed), on real SQLite.
    sys.path.insert(0, str(HERE))
    from lib_sqlite_shim import SqliteTurso
    sq = SqliteTurso()
    stored = {"document_number": "2026-16231", "publication_date": "2026-08-10", "type": "Rule", "title": "T",
              "abstract": "A", "html_url": "u", "agencies": [], "topics": ["H-1B"], "effective_on": "2026-09-09",
              "status": "published"}
    check("write() writes a new row", pn.write(sq, [dict(stored)]) == 1)
    check("write() skips a row whose signature, dates included, is unchanged", pn.write(sq, [dict(stored)]) == 0)
    check("write() writes a row whose effective date moved", pn.write(sq, [dict(stored, effective_on="2026-10-01")]) == 1)

    # The President and the Labor Department as a whole need an immigration subject.
    check("the H-1B proclamation is kept",
          pn.keep(doc("Restriction on Entry of Certain Nonimmigrant Workers", ["Executive Office of the President"])))
    check("a holiday proclamation is dropped",
          not pn.keep(doc("Labor Day, 2026", ["Executive Office of the President"])))
    check("an employee-benefits rule that says 'prevailing wage' is dropped",
          not pn.keep(doc("Transparency in Coverage", ["Employee Benefits Security Administration", "Labor Department"])))
    check("a Wage and Hour H-1B rule is kept",
          pn.keep(doc("H-1B Enforcement; Civil Money Penalty Adjustments", ["Wage and Hour Division", "Labor Department"])))

    # Public inspection: kept by title, a withdrawn placement skipped.
    listing = {"results": [
        {"document_number": "2026-22001", "type": "Rule", "title": "Temporary Increase in H-2B Nonimmigrant Visas",
         "agencies": [{"name": "Homeland Security Department"}], "filed_at": "2026-10-27T08:45:00.000-04:00",
         "publication_date": "2026-10-28", "html_url": "https://www.federalregister.gov/public-inspection/2026-22001",
         "pdf_url": "https://public-inspection.federalregister.gov/2026-22001.pdf"},
        {"document_number": "2026-22002", "type": "Notice", "title": "Culturally Significant Objects Being Imported for Exhibition",
         "agencies": [{"name": "State Department"}], "filed_at": "2026-10-27T08:45:00.000-04:00", "publication_date": "2026-10-28"},
        {"document_number": "2026-22003", "type": "Notice", "title": "Some USCIS Notice",
         "agencies": [{"name": "U.S. Citizenship and Immigration Services"}], "filed_at": None, "publication_date": "2026-10-28"},
        {"document_number": "2026-22004", "type": "Presidential Document", "title": "Suspension of Entry of Certain Aliens",
         "agencies": [{"name": "Executive Office of the President"}], "filed_at": "2026-10-27T16:15:00.000-04:00",
         "publication_date": "2026-10-30"},
    ]}
    got = {r["document_number"]: r for r in pn.inspection_rows(listing)}
    check("an H-2B rule on public inspection is kept, dated by its filing",
          "2026-22001" in got and got["2026-22001"]["pi_filed"] == "2026-10-27" and got["2026-22001"]["publication_date"] == "2026-10-28")
    check("State's museum notice on public inspection is dropped", "2026-22002" not in got)
    check("a placement withdrawn (no filing time) is skipped", "2026-22003" not in got)
    check("a proclamation on entry of aliens is kept", "2026-22004" in got and got["2026-22004"]["status"] == "public-inspection")
    check("its topics come from the title", got["2026-22001"]["topics"] == ["H-2B"])

    # Following a filed document: published, or withdrawn after three days.
    import io
    import urllib.error
    pn.write_notices(sq, [dict(got["2026-22001"], publication_date="2026-10-28"),
                          dict(got["2026-22004"], publication_date="2026-10-20")], source="public-inspection")
    published_doc = {"document_number": "2026-22001", "type": "Rule", "title": "Temporary Increase in H-2B Nonimmigrant Visas",
                     "abstract": "DHS and DOL increase the cap.", "html_url": "https://www.federalregister.gov/d/2026-22001",
                     "publication_date": "2026-10-28", "agencies": [{"name": "Homeland Security Department"}],
                     "citation": "91 FR 99999"}

    def fake_open(req, timeout=60):
        url = req.full_url
        if "/2026-22001.json" in url:
            return io.BytesIO(json.dumps(published_doc).encode())
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)
    real = pn.urllib.request.urlopen
    pn.urllib.request.urlopen = fake_open
    pn.time.sleep = lambda *_: None
    try:
        pub, wd, problems = pn.follow_filed(sq, "2026-10-28")
    finally:
        pn.urllib.request.urlopen = real
    rows = {r[0]: r for r in sq.conn.execute("SELECT document_number, status, pi_filed, citation, abstract FROM policy_notices")}
    check("a filed document the Register published becomes the published one", pub == 1 and rows["2026-22001"][1] == "published")
    check("it keeps the day it was filed", rows["2026-22001"][2] == "2026-10-27")
    check("it carries the Register's citation and abstract", rows["2026-22001"][3] == "91 FR 99999" and rows["2026-22001"][4])
    check("a filed document the Register never published, days later, is withdrawn", wd == 1 and rows["2026-22004"][1] == "withdrawn")
    check("nothing went wrong reading them", problems == [])
    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
