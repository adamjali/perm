#!/usr/bin/env python3
"""build_h1b_ranks: the median, the place filter, and one year's rows and
totals from fixtures. The reads are thin SQL over tables other tests cover;
what can go wrong here is the folding, so that's what is tested."""
from __future__ import annotations

import pathlib
import sys
from collections import Counter, defaultdict

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_h1b_ranks as b  # noqa: E402

FAILURES: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if cond else 'FAIL'} {label}{(': ' + detail) if detail and not cond else ''}")
    if not cond:
        FAILURES.append(label)


def agg_of(**fields) -> dict:
    a = b.blank()
    for k, v in fields.items():
        a[k] = v
    return a


def main() -> int:
    # The median interpolates at (n - 1) / 2 and is withheld under five filings.
    check("odd count takes the middle", b.median(Counter({100.0: 2, 200.0: 1, 300.0: 2})) == 200.0)
    check("even count interpolates", b.median(Counter({100.0: 3, 300.0: 3})) == 200.0,
          str(b.median(Counter({100.0: 3, 300.0: 3}))))
    check("under five filings is withheld", b.median(Counter({100.0: 4})) is None)
    check("place keeps a real code", b.place(" tx ") == "TX")
    check("place drops blanks and the XX placeholder", b.place("") is None and b.place("XX") is None and b.place("Texas") is None)

    # Three employers in Texas and Washington; one has no page.
    agg = defaultdict(b.blank)
    agg[("big", "US")] = agg_of(lcas=50, positions=80, uscis_appr=10, uscis_new=4, wages=Counter({150000.0: 50}))
    agg[("big", "TX")] = agg_of(lcas=30, positions=40, wages=Counter({140000.0: 30}))
    agg[("big", "WA")] = agg_of(lcas=20, positions=40, uscis_appr=10, uscis_new=4, wages=Counter({160000.0: 20}))
    agg[("mid", "US")] = agg_of(lcas=20, uscis_appr=40, uscis_new=9, wages=Counter({90000.0: 3}))
    agg[("mid", "TX")] = agg_of(lcas=20, uscis_appr=40, uscis_new=9)
    agg[("nopage", "US")] = agg_of(uscis_appr=5, uscis_den=1)
    agg[("nopage", "TX")] = agg_of(uscis_appr=5, uscis_den=1)
    spell = {"big": Counter({"BIG CO": 3}), "mid": Counter({"Mid Co": 1}), "nopage": Counter({"NO PAGE LLC": 1})}
    names = {"big": "Big Company Inc.", "mid": "Mid Company"}
    current = defaultdict(lambda: {"on_hold": 0, "warn_2y": 0, "debarred": 0})
    current["big"] = {"on_hold": 7, "warn_2y": 2, "debarred": 0}
    rows, totals = b.plan_year(2025, agg, spell, names, set(names), {"big": 1}, Counter({"mid": 1}), current)
    by = {(r[1], r[2]): dict(zip(b.COLS, r)) for r in rows}

    us_big, us_mid, us_np = by[("US", "big")], by[("US", "mid")], by[("US", "nopage")]
    check("ranked by LCAs nationally", (us_big["rank_lca"], us_mid["rank_lca"]) == (1, 2))
    check("an employer with no LCAs has no LCA rank", us_np["rank_lca"] is None)
    check("ranked by USCIS approvals nationally", (us_mid["rank_uscis"], us_big["rank_uscis"], us_np["rank_uscis"]) == (1, 2, 3))
    check("a page shows its own name", us_big["name"] == "Big Company Inc." and us_big["linked"] == 1)
    check("no page keeps the source's spelling, unlinked", us_np["name"] == "NO PAGE LLC" and us_np["linked"] == 0)
    check("median comes from the place's own wages", by[("TX", "big")]["wage_median"] == 140000.0)
    check("a thin median is withheld", us_mid["wage_median"] is None)
    check("today's facts ride on every row", us_big["on_hold"] == 7 and by[("TX", "big")]["warn_2y"] == 2)
    check("dependent and willful carried per employer", us_big["dependent"] == 1 and us_mid["willful"] == 1
          and us_mid["dependent"] is None)
    check("Washington ranks only who was there", ("WA", "mid") not in by and by[("WA", "big")]["rank_lca"] == 1)

    t = totals["US"]
    check("totals add every employer", (t["lcas"], t["uscisAppr"], t["lcaEmployers"], t["uscisEmployers"]) == (70, 55, 2, 3),
          str(t))
    check("top ten sums the busiest", t["lcaTop10"] == 70 and t["uscisTop10"] == 55)
    check("one row per page per place", len(rows) == len({(r[1], r[2]) for r in rows}))

    # Only the TOP pages per place are ranked, ties broken by slug.
    many = defaultdict(b.blank)
    for i in range(b.TOP + 5):
        many[(f"e{i:03d}", "US")] = agg_of(lcas=1000 - i)
    many[("aaa", "US")] = agg_of(lcas=1000)  # ties with e000; slug order decides
    ranked = b.ranked(many, "lcas")["US"]
    check(f"no more than {b.TOP} ranked", len(ranked) == b.TOP)
    check("a tie goes to the earlier slug", ranked[0] == ("aaa", 1) and ranked[1] == ("e000", 2), str(ranked[:2]))

    print(f"{'FAILED' if FAILURES else 'passed'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
