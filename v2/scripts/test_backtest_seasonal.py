#!/usr/bin/env python3
"""The seasonal backtest's arithmetic, on rows built by hand.

    python3 scripts/test_backtest_seasonal.py
"""
from __future__ import annotations

import pathlib
import sys
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import backtest_seasonal as bt  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def row(received: date, waited: int, lead: int | None) -> dict:
    decided = received + timedelta(days=waited)
    return {"received": received, "decided": decided, "waited": waited, "lead": lead}


def main() -> int:
    check("nearest rank, as the timing builder computes it", bt.pctl(list(range(1, 101)), 25), 25)
    check("a fit under the floor answers nothing", bt.fit([5] * (bt.MIN_N - 1)), None)
    check("quarters start on the quarter", bt.quarter_starts(date(2025, 2, 10), date(2025, 9, 1)),
          [date(2025, 1, 1), date(2025, 4, 1), date(2025, 7, 1)])
    check("months add across a year", bt.add_months(date(2025, 11, 1), 3), date(2026, 2, 1))

    # Training: only what was decided before the origin, and same-season only
    # the three calendar months a year before it.
    rows = [row(date(2024, 1, 5), 30, 40), row(date(2024, 5, 5), 30, 40), row(date(2025, 1, 5), 30, 40)]
    origin = date(2025, 4, 1)
    check("pooled takes everything decided before the origin", len(bt.training(rows, origin, "pooled", "filed")), 3)
    check("same-season takes the quarter a year earlier only",
          len(bt.training(rows, origin, "same-season", "filed")), 1)
    check("nothing decided on or after the origin is used",
          len(bt.training([row(date(2025, 3, 20), 30, 40)], origin, "pooled", "filed")), 0)

    # Scoring, both clocks, with the sign of the miss stated once: positive
    # means DOL decided later than the predicted day.
    fit = {"n": 100, "p10": 10, "p25": 20, "p50": 30, "p75": 40, "p90": 50}
    late = [row(date(2025, 4, 1), 40, 10)]   # waited 40 against 30: 10 days late
    check("filed clock: a longer wait is a late miss", bt.score(late, fit, "filed")["biasDays"], 10)
    check("start clock: a shorter lead is a late miss", bt.score(late, fit, "start")["biasDays"], 20)
    inside = [row(date(2025, 4, 1), d, None) for d in (15, 25, 35, 45)]
    check("the middle half holds what falls between p25 and p75",
          bt.score(inside, fit, "filed")["middleHalfShare"], 0.5)

    # A whole visa: a season that takes 70 days, then one that takes 30. Same
    # season beats pooled on the later quarters, and a quarter too new to have
    # finished is left out.
    rows = []
    for y in (2024, 2025):
        for i in range(60):
            rows.append(row(date(y, 1, 2), 70 + i % 3, 20))
            rows.append(row(date(y, 7, 1), 30 + i % 3, 20))
    out = bt.backtest_visa(rows, "H-2B", lambda lo, hi: 0)
    check("the page method for H-2B is the same season, from filing", out["pageMethod"], "same-season/filed")
    q = {x["from"]: x for x in out["quarters"]}
    check("a quarter ending within MIN_DAYS of the newest decision is skipped", "2025-07-01" in q, False)
    busy = bt.backtest_visa(rows, "H-2B", lambda lo, hi: 1000 if lo == date(2025, 1, 1) else 0)
    check("a quarter with too many applications still undecided is skipped",
          "2025-01-01" in {x["from"] for x in busy["quarters"]}, False)
    jan = q.get("2025-01-01", {}).get("methods", {})
    check("same season reads last January's 70 days", jan.get("same-season/filed", {}).get("typicalMissDays"), 1)
    check("pooled is pulled toward the summer's 30", jan.get("pooled/filed", {}).get("typicalMissDays", 0) > 10, True)
    check("the page's own totals are carried at the top", out["page"] is not None, True)

    print(f"\n{len(FAILED)} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
