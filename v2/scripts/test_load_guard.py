#!/usr/bin/env python3
"""The pure guard between a DOL workbook and the table it lands in.

Every check is a probe with a deliberately broken input, and the clean
control runs first so a guard that refuses everything cannot pass.

    python3 scripts/test_load_guard.py
"""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_load_guard import (  # noqa: E402
    Fingerprint, drift_findings, row_issues, sanity_findings,
)

FAILURES: list[str] = []
CHECKS = 0
TODAY = datetime.date(2026, 9, 7)


def check(name: str, got, want) -> None:
    global CHECKS
    CHECKS += 1
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


def row(**kw) -> dict:
    base = {
        "case_status": "DETERMINATION ISSUED", "received_date": "2026-03-01",
        "decision_date": "2026-06-15", "employer_name": "ACME INC",
        "job_title": "Engineer", "soc_code": "15-1252", "soc_title": "Software Developers",
        "wage": 145_600.0, "wage_unit": "YEAR", "worksite_state": "CA",
        "visa_class": "H-1B", "attorney_name": "FRAGOMEN",
    }
    base.update(kw)
    return base


def fingerprint(rows: list[dict], resolved=("case", "status", "wage")) -> dict:
    fp = Fingerprint(today=TODAY)
    for r in rows:
        fp.see(r)
    fp.resolved = list(resolved)
    return fp.to_doc()


def main() -> int:
    print("load guard")

    print("row sanity")
    check("a plausible row has no issues", row_issues(row(), TODAY), [])
    check("a blank wage is not an issue", row_issues(row(wage=None, wage_unit=None), TODAY), [])
    check("yearly wage of $5,000 flagged", row_issues(row(wage=5_000.0), TODAY), ["wage_year_range"])
    check("yearly wage of $3M flagged", row_issues(row(wage=3_000_000.0), TODAY), ["wage_year_range"])
    check("hourly wage of $2 flagged",
          row_issues(row(wage=2.0, wage_unit="HOUR"), TODAY), ["wage_hour_range"])
    check("hourly $60 under HOURLY spelling is fine",
          row_issues(row(wage=60.0, wage_unit="HOURLY"), TODAY), [])
    check("BI-WEEKLY is a known unit, and its range is not judged",
          row_issues(row(wage=3_000.0, wage_unit="BI-WEEKLY"), TODAY), [])
    check("an unknown unit flagged", row_issues(row(wage_unit="FORTNIGHT"), TODAY), ["wage_unit_unknown"])
    check("a 2014 receipt flagged", row_issues(row(received_date="2014-12-31"), TODAY), ["received_date_range"])
    check("a decision dated next week flagged",
          row_issues(row(decision_date="2026-09-14"), TODAY), ["decision_date_range"])
    check("a decision dated tomorrow is allowed (time zones)",
          row_issues(row(decision_date="2026-09-08"), TODAY), [])
    check("decided before received flagged",
          row_issues(row(received_date="2026-06-20", decision_date="2026-06-15"), TODAY),
          ["decided_before_received"])

    print("fingerprint")
    doc = fingerprint([row(), row(wage=None, wage_unit=None), row(attorney_name=None)])
    check("rows counted", doc["rows"], 3)
    check("blank share per column", (doc["blankShare"]["wage"], doc["blankShare"]["attorney_name"]),
          (round(1 / 3, 4), round(1 / 3, 4)))
    check("median needs 100 rows (2 is noise)", doc["wageMedian"], {})
    big = fingerprint([row(wage=100_000.0 + i) for i in range(150)])
    check("median over 150 rows", big["wageMedian"], {"YEAR": 100_074.5})
    check("resolved columns recorded sorted", big["resolved"], ["case", "status", "wage"])

    print("sanity findings")
    check("clean load: none", sanity_findings(big), [])
    check("no rows: refused", sanity_findings({"rows": 0}), ["no rows parsed"])
    dirty = fingerprint([row()] * 97 + [row(wage=1.0)] * 3)
    check("3% impossible wages: refused", len(sanity_findings(dirty)), 1)
    check("the finding names the reason", "wage_year_range=3" in sanity_findings(dirty)[0], True)
    ok = fingerprint([row()] * 995 + [row(wage=1.0)] * 5)
    check("0.5% impossible wages: allowed (measured worst is 0.06%)", sanity_findings(ok), [])

    print("drift findings")
    prior = fingerprint([row(wage=100_000.0 + i) for i in range(150)])
    same = fingerprint([row(wage=100_000.0 + i) for i in range(150)])
    check("control: identical loads, no drift", drift_findings(prior, same), [])
    check("no baseline: no drift (bootstrap)", drift_findings(None, same), [])
    check("empty baseline dict: no drift", drift_findings({}, same), [])
    lost = fingerprint([row(wage=100_000.0 + i) for i in range(150)], resolved=("case", "status"))
    check("a column that resolved last time and not now",
          drift_findings(prior, lost), ["columns resolved last load and not now: ['wage']"])
    gained = fingerprint([row(wage=100_000.0 + i) for i in range(150)],
                         resolved=("case", "status", "wage", "attorney"))
    check("a NEW column is not drift", drift_findings(prior, gained), [])
    blank = fingerprint([row(wage=None, wage_unit=None)] * 60 + [row(wage=100_000.0)] * 40)
    got = drift_findings(prior, blank)
    check("wage AND its unit blank 0% -> 60%: two findings, one per column", len(got), 2)
    check("the finding names the column and both shares", got[0], "wage: blank share 0.0% -> 60.0%")
    check("the second names the unit", got[1], "wage_unit: blank share 0.0% -> 60.0%")
    mild = fingerprint([row(wage=None, wage_unit=None)] * 20 + [row(wage=100_000.0 + i) for i in range(130)])
    check("a 13% blank share against 0% is within the 25-point margin",
          [f for f in drift_findings(prior, mild) if "blank" in f], [])
    cents = fingerprint([row(wage=10_000_000.0 + i) for i in range(150)])
    got = drift_findings(prior, cents)
    check("median wage x100 (a cents column): refused", len(got), 1)
    check("the finding shows both medians", got[0].startswith("median YEAR wage 100,074 -> 10,000,074"), True)
    halved = fingerprint([row(wage=60_000.0 + i) for i in range(150)])
    check("a 40% move is within the 50% margin", drift_findings(prior, halved), [])
    newunit = fingerprint([row(wage=60.0, wage_unit="HOUR")] * 150)
    check("a unit the baseline never had is not drift", drift_findings(prior, newunit), [])

    print()
    print(f"{CHECKS} checks")
    if CHECKS < 30:
        print(f"FATAL: only {CHECKS} checks ran; the suite is truncated")
        return 1
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
