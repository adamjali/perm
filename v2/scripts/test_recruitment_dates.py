"""The quiet-period rule in Python, held to the TypeScript one through a shared fixture.

The fixture's cases run here through last_recruitment_date and in
src/lib/__tests__/last-recruitment-parity.test.ts through getLastRecruitmentDate, so the two
can't drift; QUIET_PERIOD_DAYS is read against FILING_WINDOW_WAIT_DAYS in the TypeScript
constants. Plain asserts, run by CI with the other script tests.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import lib_recruitment as lr  # noqa: E402

failures = 0


def check(name: str, ok: bool) -> None:
    global failures
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    failures += 0 if ok else 1


fixture = json.loads((ROOT / "fixtures" / "last_recruitment.json").read_text())
check("the fixture holds cases", len(fixture["cases"]) >= 6)
for c in fixture["cases"]:
    got = lr.last_recruitment_date(c["input"], c["professional"])
    check(f"{c['why']}: {got}", got == c["expect"])

ts = (ROOT.parent / "convex" / "lib" / "perm" / "constants.ts").read_text()
m = re.search(r"export const FILING_WINDOW_WAIT_DAYS = (\d+);", ts)
check("the quiet period matches FILING_WINDOW_WAIT_DAYS", bool(m) and int(m.group(1)) == lr.QUIET_PERIOD_DAYS)

# DOL's columns, read as the rule reads them: steps make a case professional.
row = {
    "ad1": "2025-06-15", "ad2": "2025-06-22", "job_order_end": "2025-06-23",
    "recr_steps": json.dumps({"employer_website": ["2025-05-26", "2025-06-26"], "job_search_website": ["2025-06-12", "2025-06-18"],
                              "local_newspaper": ["2025-06-20", "2025-07-10"]}),
}
dates, professional = lr.case_recruitment_dates(row)
check("a case with additional steps is professional", professional)
check("the second ad is the Sunday ad", dates["sundayAdSecondDate"] == "2025-06-22")
check("the quiet period ends 30 days after the last step", lr.quiet_period_end(row) == "2025-07-26")
check("a case with one ad reads that ad", lr.case_recruitment_dates({"ad1": "2025-06-15"})[0]["sundayAdSecondDate"] == "2025-06-15")
check("a case with nothing has no quiet period", lr.quiet_period_end({}) is None)

print(f"\n  {failures} failure(s)")
sys.exit(1 if failures else 0)
