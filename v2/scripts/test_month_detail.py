#!/usr/bin/env python3
"""fold_month_detail: the filing-month page's per-day decisions, where DOL is
inside the month, and the employer-initial grid. Pure, so tested on fixtures."""
from __future__ import annotations

import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("csd", HERE / "ingest_case_status_direct.py")
csd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(csd)  # type: ignore[union-attr]

FAILURES: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if cond else 'FAIL'} {label}{(': ' + detail) if detail and not cond else ''}")
    if not cond:
        FAILURES.append(label)


def main() -> int:
    months = ["2025-12", "2025-11"]
    publishable = {"2026-10-05", "2026-10-06", "2026-10-07"}
    decisions = (
        [("2025-12", "2026-10-07", 15, "CERTIFIED")] * 20
        + [("2025-12", "2026-10-07", 3, "DENIED")]
        + [("2025-12", "2026-10-07", 30, "WITHDRAWN")] * 9            # the employer's: not where DOL is
        + [("2025-12", "2026-10-08", 28, "CERTIFIED")] * 50           # today, withheld: not counted
        + [("2025-11", "2026-10-06", 2, "CERTIFIED")] * 5
        + [("2024-01", "2026-10-06", 2, "CERTIFIED")]                 # a month not carried
    )
    letters = [("2025-12", "A", 100, 60), ("2025-12", "Z", 80, 10), ("2025-12", "1", 3, 1), ("2025-12", "", 2, 0)]
    out = csd.fold_month_detail(decisions, letters, publishable, months)
    dec = out["2025-12"]
    check("one row per publishable day, the withheld day left out",
          [d["date"] for d in dec["days"]] == ["2026-10-07"], str(dec["days"]))
    check("decisions split by who decided",
          dec["days"][0] == {"date": "2026-10-07", "certified": 20, "denied": 1, "withdrawn": 9}, str(dec["days"][0]))
    check("the front day is the median filing day of DOL's own decisions",
          dec["frontDay"] == 15 and dec["frontFrom"] == 21, f"{dec['frontDay']} from {dec['frontFrom']}")
    check("too few decisions give no front day",
          out["2025-11"]["frontDay"] is None and out["2025-11"]["frontFrom"] == 5, str(out["2025-11"]))
    check("initials are letters, anything else is '#'",
          dec["letters"] == {"A": [100, 60], "Z": [80, 10], "#": [5, 1]}, str(dec["letters"]))
    check("a month not carried is ignored", "2024-01" not in out)
    print(f"\n  {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
