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
    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
