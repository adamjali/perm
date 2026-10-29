#!/usr/bin/env python3
"""Tests for build_quarter_report.py: quarters, outcomes, the ranked lists and new employers."""
from __future__ import annotations

import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_quarter_report as b  # noqa: E402

FAILED = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global FAILED
    print(("PASS " if cond else "FAIL ") + name + (f" - {detail}" if detail and not cond else ""))
    if not cond:
        FAILED += 1


def main() -> int:
    check("FY2026 Q1 is October to December 2025", b.quarter_span(2026, 1) == ("2025-10-01", "2025-12-31"), str(b.quarter_span(2026, 1)))
    check("FY2026 Q2 is January to March 2026", b.quarter_span(2026, 2) == ("2026-01-01", "2026-03-31"))
    check("FY2026 Q3 is April to June 2026", b.quarter_span(2026, 3) == ("2026-04-01", "2026-06-30"))
    check("FY2026 Q4 is July to September 2026", b.quarter_span(2026, 4) == ("2026-07-01", "2026-09-30"))
    check("a day's quarter", [b.quarter_of(d) for d in ("2025-10-01", "2026-03-31", "2026-06-30", "2026-07-01")]
          == [(2026, 1), (2026, 2), (2026, 3), (2026, 4)])
    check("a quarter back crosses the fiscal year", b.shift(2026, 1, -1) == (2025, 4))
    check("a year back is the same quarter", b.shift(2026, 3, -4) == (2025, 3))

    o = b.outcome_figures([("certified", 90), ("denied", 10), ("withdrawn", 50)])
    check("the certified share leaves withdrawals out", o["certifiedShare"] == 0.9 and o["total"] == 150, str(o))
    check("no decided cases, no share", b.outcome_figures([("withdrawn", 3)])["certifiedShare"] is None)

    r = b.ranked(Counter({"a": 5, "b": 9, "c": 5}), Counter({"a": 2}), Counter({"b": 1}), {"a": "Alpha"}, {"a"}, top=2)
    check("the busiest first, a tie by key, each with its counts before",
          r == [{"key": "b", "name": "b", "linked": False, "n": 9, "prior": 0, "yearAgo": 1},
                {"key": "a", "name": "Alpha", "linked": True, "n": 5, "prior": 2, "yearAgo": 0}], str(r))

    def q(emp: dict) -> dict:
        return {"counts": {"employers": Counter(emp), "firms": Counter(), "jobs": Counter({"15-1252": 3}), "states": Counter()},
                "jobTitles": {"15-1252": "Software Developers"}}

    first = {"old": "2020-01-05", "fresh": "2026-04-10", "late": "2026-07-01"}
    doc = b.plan(q({"old": 4, "fresh": 2}), q({"old": 1}), q({}), first, "2026-04-01", "2026-06-30", {"old": "Old Co"}, {})
    check("an employer whose first decided case came this quarter is new",
          doc["newEmployers"]["count"] == 1 and doc["newEmployers"]["top"][0]["key"] == "fresh", str(doc["newEmployers"]))
    check("its cases are counted", doc["newEmployers"]["cases"] == 2)
    check("a job carries its title", doc["jobs"][0]["name"] == "Software Developers")
    check("the percentile interpolates", b.percentile([1, 2, 3, 4], 0.5) == 2.5 and b.percentile([], 0.5) is None)

    print(f"\n{FAILED} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
