#!/usr/bin/env python3
"""Tests for build_firm_ranks.py: ranking, places, medians, last year's rank and the diffed write."""
from __future__ import annotations

import sys
from collections import Counter, defaultdict

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
import build_firm_ranks as b  # noqa: E402

FAILED = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global FAILED
    print(("PASS " if cond else "FAIL ") + name + (f" - {detail}" if detail and not cond else ""))
    if not cond:
        FAILED += 1


def agg_of(entries: list[tuple[str, str, int, int, int]]) -> dict:
    """(page, state, filings, certified, denied) -> the builder's aggregate, country and state alike."""
    agg: dict = defaultdict(b.blank)
    for page, st, filings, cert, den in entries:
        def add(a, filings=filings, cert=cert, den=den, page=page):
            a["filings"] += filings
            a["certified"] += cert
            a["denied"] += den
            a["employers"].add(f"{page}-client")
            a["spell"][page.upper()] += filings
        b.fold(agg, page, st, add)
    return agg


def main() -> int:
    agg = agg_of([
        ("alpha", "CA", 30, 28, 2),
        ("alpha", "TX", 10, 9, 1),
        ("beta", "CA", 40, 39, 1),
        ("gamma", "TX", 40, 40, 0),
        ("delta", "XX", 5, 5, 0),  # a placeholder state counts for the country only
    ])
    rows, totals = b.plan_year("perm", 2025, agg, {("beta", "US"): 1}, {"alpha": "Alpha LLP"}, {"alpha"}, Counter({"US": 7}))
    us = sorted((r for r in rows if r[2] == "US"), key=lambda r: r[6])
    check("the country adds every state's filings", [r[3] for r in us] == ["alpha", "beta", "gamma", "delta"]
          and us[0][8] == 40, str([(r[3], r[8]) for r in us]))
    check("a tie is broken by slug, so the order never flickers", [r[3] for r in us][1:3] == ["beta", "gamma"])
    check("a placeholder state counts for the country and makes no place of its own", "XX" not in {r[2] for r in rows})
    ca = {r[3]: r for r in rows if r[2] == "CA"}
    check("a state ranks only the filings at its worksites", ca["beta"][6] == 1 and ca["alpha"][6] == 2)
    check("last year's rank rides beside this year's, and is empty for a firm not ranked then",
          {r[3]: r[7] for r in us} == {"alpha": None, "beta": 1, "gamma": None, "delta": None})
    check("a firm with a page is linked and named as its page names it",
          us[0][4] == 1 and us[0][5] == "Alpha LLP" and next(r for r in us if r[3] == "beta")[4] == 0)
    check("a firm without a page keeps DOL's commonest spelling", next(r for r in us if r[3] == "beta")[5] == "BETA")
    check("the totals hold the filings, the firms, the top ten and those naming no firm",
          totals["US"] == {"filings": 125, "firms": 4, "top10": 125, "unnamed": 7}, str(totals["US"]))

    # Only the busiest TOP firms are ranked.
    many = agg_of([(f"f{i:03d}", "NY", 200 - i, 200 - i, 0) for i in range(b.TOP + 20)])
    r2, _ = b.plan_year("lca", 2025, many, {}, {}, set(), Counter())
    check("each place keeps its busiest TOP firms", len([r for r in r2 if r[2] == "US"]) == b.TOP)

    check("a median needs MIN_DAYS certifications", b.median(Counter({100: b.MIN_DAYS - 1})) is None)
    check("a median is interpolated between the two middle cases",
          b.median(Counter({100: 5, 200: 5}), floor=1) == 150.0, str(b.median(Counter({100: 5, 200: 5}), floor=1)))

    planned = ["perm", 2025, "US", "alpha", 1, "Alpha LLP", 1, None, 40, 37, 3, 0, 0, 2, 120.0]
    stored = ["perm", "2025", "US", "alpha", "1", "Alpha LLP", "1", None, "40", "37", "3", "0", "0", "2", "120.0"]
    check("a stored row reads the same as the planned one, so an unchanged rebuild writes nothing",
          b.norm(planned) == b.norm(stored))
    check("a moved figure reads as changed", b.norm(planned) != b.norm(stored[:8] + ["41"] + stored[9:]))

    print(f"\n{FAILED} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
