#!/usr/bin/env python3
"""The bulletin backtest's arithmetic, on a hand-built archive.

    python3 scripts/test_backtest_bulletin.py
"""
from __future__ import annotations

import pathlib
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import backtest_bulletin as bt  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def month(i: int) -> str:
    y, m = 2014 + (9 + i) // 12, (9 + i) % 12 + 1
    return f"{y:04d}-{m:02d}"


def main() -> int:
    check("a DOL date cell", bt.parse_cutoff("01NOV13"), ("date", date(2013, 11, 1)))
    check("current", bt.parse_cutoff("C"), ("current", None))
    check("unavailable", bt.parse_cutoff(" u "), ("unavailable", None))
    check("a blank cell is no reading", bt.parse_cutoff(""), None)
    check("junk is no reading", bt.parse_cutoff("01XYZ13"), None)
    check("months between", bt.months_between("2016-10", "2017-12"), 14)

    # A cutoff that moves exactly 30 days a month from Oct 2014: the site's
    # pace is 30 days a month at every bulletin, and a date 90 days ahead is
    # reached exactly three bulletins later, so the estimate is exact.
    steady = [(month(i), ("date", date.fromordinal(date(2010, 1, 1).toordinal() + 30 * i))) for i in range(60)]
    check("the pace is days moved over months since October 2014", bt.per_month(steady, 30), 30.0)
    check("a trailing window reads only its own months", bt.per_month(steady, 30, 12), 30.0)
    i = 30
    target = date.fromordinal(steady[i][1][1].toordinal() + 90)
    check("a date 90 days ahead is reached three bulletins later", bt.months_to_reach(steady, i, target), (3, True))
    check("never reached: the months to the newest bulletin, flagged",
          bt.months_to_reach(steady, i, date(2099, 1, 1)), (29, False))
    went_current = steady[:35] + [(month(35), ("current", None))]
    check("going current reaches every date", bt.months_to_reach(went_current, 30, date(2099, 1, 1)), (5, True))

    s = bt.score([(3.0, 3, True), (6.0, 12, True), (4.0, 10, False), (20.0, 10, False)])
    check("typical miss over the reached readers", s["typicalMissMonths"], 3.0)
    check("a reader still waiting past the estimate is a floor", s["stillWaitingPastEstimate"], 1)
    check("within a quarter (or three months) of the real wait", s["withinQuarterShare"], 0.5)

    archive = [(m, {"EB2": {"india": c[0] == "date" and c[1].strftime("%d%b%y").upper() or "C"}}) for m, c in steady]
    out = bt.backtest(archive)
    one_year = out["byGap"]["365"]
    # Bulletins are monthly: 365 days at 30 a month is 12.2 months of
    # arithmetic, and the date is reached on the 13th bulletin.
    check("a steady cutoff is estimated within a bulletin a year out", one_year["typicalMissMonths"] < 1, True)
    check("every window is scored on the same readers",
          len({w["365"]["readers"] for w in out["byWindow"].values()}), 1)
    check("the site's own window is named", out["siteWindow"], "since-2014")

    # The supply-division comparison. Proration: a date on the 16th of a
    # 30-day month counts the earlier months whole and half of its own.
    cells = [(0, 10), (2025 * 12 + 0, 30), (2025 * 12 + 5, 60)]   # prior years, Jan 2025, Jun 2025
    check("everyone ahead of a mid-June date", bt.ahead_of(cells, date(2025, 6, 16)), 10 + 30 + 60 * 15 / 30)
    check("nobody in the date's own month counts on its 1st", bt.ahead_of(cells, date(2025, 6, 1)), 40)
    # A steady cutoff, 30 days a month, and an inventory whose count ahead of
    # the 90-day reader takes exactly three months at 120 visas a year: both
    # methods say three months, the cutoff takes three, and they tie.
    steady = [(month(i), {"EB2": {"india": (date(2010, 1, 1).fromordinal(date(2010, 1, 1).toordinal() + 30 * i)).strftime("%d%b%y").upper()}})
              for i in range(40)]
    as_of = month(30) + "-05"
    cutoff = date(2010, 1, 1).fromordinal(date(2010, 1, 1).toordinal() + 30 * 30)
    target = date.fromordinal(cutoff.toordinal() + 90)
    inventory = {as_of: {("EB2", "india"): [(target.year * 12 + target.month - 2, 30)]}}
    sd = bt.supply_division(steady, inventory, {"fiscal_year": 2024, "employment_by_chargeability": {"india": {"2nd": 120}}})
    g90 = sd["byGap"]["90"]
    check("both methods are scored on the same readers", (g90["pace"]["readers"], g90["supply"]["readers"]), (1, 1))
    check("the division is people ahead over a month's visas", g90["supply"]["typicalMissMonths"], 0.0)
    check("a dead heat is a tie, not a win", g90["closerWhenReached"], {"pace": 0, "supply": 0, "tie": 1})
    check("no Table V year, no comparison", bt.supply_division(steady, inventory, None), None)
    check("no inventory, no comparison", bt.supply_division(steady, {}, {"employment_by_chargeability": {}}), None)

    # The filing chart, three months ahead of final action on a steady line:
    # final action reaches each filing-chart date three bulletins later, so the
    # learned lag is 3 and both methods are exact for a reader between them.
    fmt = lambda d: d.strftime("%d%b%y").upper()
    steady = [(month(i), ("date", date.fromordinal(date(2010, 1, 1).toordinal() + 30 * i))) for i in range(60)]
    fa_arch = [(m, {"EB2": {"india": fmt(c[1])}}) for m, c in steady]
    dff_arch = {m: {"EB2": {"india": fmt(date.fromordinal(c[1].toordinal() + 90))}} for m, c in steady}
    fa_series = [(m, bt.parse_cutoff(fmt(c[1]))) for m, c in steady]
    dff_series = {m: bt.parse_cutoff(fmt(date.fromordinal(c[1].toordinal() + 90))) for m, c in steady}
    check("the filing chart's lag is learned from what had resolved", bt.learned_lag(fa_series, dff_series, 40), 3.0)
    check("too little history gives no lag", bt.learned_lag(fa_series, dff_series, 3), None)
    fc = bt.filing_chart_test(fa_arch, dff_arch)
    # The pace is in fractions of a month and the wait in whole bulletins, so it
    # is off by under half a month; the lag counts whole bulletins and is exact.
    check("the lag is exact on a steady line, the pace within half a month",
          (fc["filingLag"]["typicalMissMonths"], fc["pace"]["typicalMissMonths"] <= 0.5), (0.0, True))
    check("the same readers for both", fc["pace"]["readers"], fc["filingLag"]["readers"])

    print(f"\n{len(FAILED)} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
