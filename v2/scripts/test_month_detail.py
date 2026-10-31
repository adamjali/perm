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

    rows = [
        ("2025-12", "AMAZON DEV CENTER U.S., INC.", "amazon-dev-center-u-s-inc", 600, 100),
        ("2025-12", "Amazon Dev Center U.S., Inc.", "amazon-dev-center-u-s-inc", 163, 20),
        ("2025-12", "amazon dev center u.s., inc.", None, 4, 0),      # discovered since the rebuild
        ("2025-12", "Cognizant Technology Solutions US Corp", "cognizant", 500, 500),
        ("2025-12", "Small Shop LLC", None, 2, 1),
        ("2025-12", csd.TEST_FIXTURE_EMPLOYER, None, 9, 0),             # DOL's own test record
        ("2025-11", "Cognizant Technology Solutions US Corp", "cognizant", 7, 7),
    ]
    emp = csd.fold_month_employers(rows, months, top=2)
    dec_e = emp["2025-12"]
    check("one row per employer, a slug-less spelling folded into its slug row",
          dec_e["top"][0] == {"name": "AMAZON DEV CENTER U.S., INC.", "slug": "amazon-dev-center-u-s-inc",
                               "filed": 767, "decided": 120}, str(dec_e["top"][0]))
    check("ranked by filings, cut at the top, every employer counted",
          [r["slug"] for r in dec_e["top"]] == ["amazon-dev-center-u-s-inc", "cognizant"] and dec_e["employers"] == 3,
          str(dec_e))
    check("each month on its own", emp["2025-11"]["top"][0]["filed"] == 7 and emp["2025-11"]["employers"] == 1)
    print(f"\n  {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
