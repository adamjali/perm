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

    # ensure_columns() adds only what the live table lacks; write() compares
    # on the new fields too, so a changed effective date is a write.
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
    added = pn.ensure_columns(db)
    check("ensure_columns adds every extra column to a nine-column table", added == pn.EXTRA_NAMES)
    check("ensure_columns adds nothing the second time", pn.ensure_columns(db) == [])
    stored = {"document_number": "2026-16231", "publication_date": "2026-08-10", "type": "Rule", "title": "T",
              "abstract": "A", "html_url": "u", "agencies": [], "topics": ["H-1B"], "effective_on": "2026-09-09",
              "comments_close_on": None, "comment_url": None, "citation": None, "action": None, "dates": None,
              "correction_of": None, "pdf_url": None}
    def cell(v):
        return {"type": "null", "value": None} if v is None else {"type": "text", "value": v}
    db.rows = [[cell("2026-16231"), cell("T"), cell("A"), cell(json.dumps(["H-1B"]))] + [cell(stored[n]) for n in pn.EXTRA_NAMES]]
    check("write() skips a row whose signature, dates included, is unchanged", pn.write(db, [dict(stored)]) == 0)
    moved = dict(stored, effective_on="2026-10-01")
    check("write() writes a row whose effective date moved", pn.write(db, [moved]) == 1)
    ins = [q for q in db.sql if q.startswith("INSERT")]
    check("the insert names every column, extras included", ins and all(n in ins[-1] for n in pn.EXTRA_NAMES))
    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
