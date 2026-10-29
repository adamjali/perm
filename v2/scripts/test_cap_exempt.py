#!/usr/bin/env python3
"""Tests for build_cap_exempt.py: who is listed, their kind, the months, the states and the list."""
from __future__ import annotations

import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_cap_exempt as b  # noqa: E402

FAILED = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global FAILED
    print(("PASS " if cond else "FAIL ") + name + (f" - {detail}" if detail and not cond else ""))
    if not cond:
        FAILED += 1


def acwia(answered: int, yes: int, kinds: dict, states: dict, name: str) -> dict:
    return {"answered": answered, "yes": yes, "kinds": Counter(kinds), "states": Counter(states), "spell": Counter({name: answered})}


def lca(lcas: int, positions: int, months: dict) -> dict:
    return {"lcas": lcas, "positions": positions, "months": Counter(months)}


def main() -> int:
    check("listed when most answered requests say ACWIA covers it", b.qualifies(3, 5))
    check("not listed at exactly half", not b.qualifies(2, 4))
    check("not listed with no yes", not b.qualifies(0, 0))
    check("one request saying yes is DOL's record, and lists a small college", b.qualifies(1, 1))

    check("the kind named most wins", b.kind_of(Counter({"research": 4, "higher-ed": 1})) == "research")
    check("a tie goes to the form's order", b.kind_of(Counter({"affiliated": 2, "higher-ed": 2})) == "higher-ed")
    check("no kind named, no kind", b.kind_of(Counter()) is None)

    m = b.fy_months(2025)
    check("a fiscal year runs October to September", m[0] == "2024-10" and m[-1] == "2025-09" and len(m) == 12, str(m))

    pages = {
        "state-u": acwia(10, 9, {"higher-ed": 9}, {"MI": 9}, "STATE UNIVERSITY"),
        "med-center": acwia(6, 4, {"affiliated": 4}, {"MA": 4}, "MED CENTER INC"),
        "half-and-half": acwia(4, 2, {"research": 2}, {"CA": 2}, "HALF CO"),
        "tech-co": acwia(20, 0, {}, {"WA": 0}, "TECH CO"),
    }
    lcas = {
        "state-u": lca(30, 31, {"2024-10": 3, "2025-03": 2, "2025-09": 25}),
        "med-center": lca(50, 50, {"2025-03": 50}),
        "tech-co": lca(900, 950, {"2025-03": 600, "2025-04": 300}),
    }
    doc = b.plan(pages, lcas, Counter({"2025-03": 10}), {"state-u": (12, 40)}, {"state-u": "State University"}, 2025)
    check("only qualifying employers are listed", doc["employers"] == 2, str(doc["employers"]))
    check("the busiest by LCAs comes first", [r["slug"] for r in doc["top"]] == ["med-center", "state-u"])
    top = {r["slug"]: r for r in doc["top"]}
    check("an employer with a page is linked and named as its page names it",
          top["state-u"]["linked"] and top["state-u"]["name"] == "State University")
    check("one without a page keeps DOL's commonest spelling and isn't linked",
          not top["med-center"]["linked"] and top["med-center"]["name"] == "MED CENTER INC")
    check("each row carries its kind, state, requests and USCIS's approvals",
          top["state-u"]["kind"] == "higher-ed" and top["state-u"]["state"] == "MI" and top["state-u"]["requests"] == 9
          and top["state-u"]["uscisNew"] == 12 and top["state-u"]["uscisAppr"] == 40)
    check("the kinds count employers and LCAs",
          doc["kinds"]["higher-ed"] == {"employers": 1, "lcas": 30} and doc["kinds"]["affiliated"] == {"employers": 1, "lcas": 50}
          and doc["kinds"]["research"] == {"employers": 0, "lcas": 0}, str(doc["kinds"]))
    march = next(x for x in doc["months"] if x["month"] == "2025-03")
    check("a month splits the listed employers from everyone else, LCAs naming no employer included",
          march == {"month": "2025-03", "exempt": 52, "others": 610}, str(march))
    check("the months add up to every LCA", sum(x["exempt"] + x["others"] for x in doc["months"]) == doc["allLcas"]
          and doc["allLcas"] == 990, str(doc["allLcas"]))
    check("every fiscal-year month is present, an empty one as zero", len(doc["months"]) == 12
          and next(x for x in doc["months"] if x["month"] == "2025-01") == {"month": "2025-01", "exempt": 0, "others": 0})
    check("the listed employers' LCAs", doc["lcas"] == 80 and doc["withLcas"] == 2)
    check("states rank by the listed employers' LCAs", [s["state"] for s in doc["states"]] == ["MA", "MI"]
          and doc["statesTotal"] == 2)

    rows = b.listed_rows(pages)
    check("the table holds every listed employer, by slug, with its kind and counts",
          rows == [["med-center", "affiliated", 4, 6], ["state-u", "higher-ed", 9, 10]], str(rows))
    check("a stored row reads the same as the planned one", b.norm(["state-u", "higher-ed", "9", "10"]) == b.norm(rows[1]))

    print(f"\n{FAILED} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
