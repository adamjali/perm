#!/usr/bin/env python3
"""Tests for ingest_iv_scheduling.py: the parser, on State's own pages, and every refusal.

Fixtures: the table copied in a browser on Nov 3 2026 (State's update of Oct 7 2026, which
carried a row named "null") and an Internet Archive capture of State's update of Apr 28 2025,
trimmed to its table, which wrote months with two-digit years.

Run: python3 scripts/test_iv_scheduling.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_iv_scheduling as iv  # noqa: E402

FIX = pathlib.Path(__file__).resolve().parent / "__fixtures__"
COPY = (FIX / "iv-tool-2026-10-07.txt").read_text()
OLD = (FIX / "iv-tool-2025-04-28.html").read_text()
FAILED: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        FAILED.append(name)


def refused(text: str) -> str | None:
    try:
        iv.parse(text)
    except iv.Refused as exc:
        return str(exc)
    return None


def cell(parsed: dict, key: str, category: str) -> tuple:
    return next(r for r in parsed["rows"] if r[1] == key and r[2] == category)


def main() -> int:
    new = iv.parse(COPY)
    check("the copy's date is State's", new["as_of"] == "2026-10-07", new["as_of"])
    check("every post but the null row", new["posts"] == 142 and new["skipped"] == ["null"], f"{new['posts']} {new['skipped']}")
    check("three categories a post", len(new["rows"]) == 142 * 3)
    check("Manila's employment month", cell(new, "manila", "employment")[5] == "2023-03")
    check("Manila's family month", cell(new, "manila", "family")[5] == "2021-06")
    check("Mumbai (Bombay) keys as mumbai", cell(new, "mumbai", "employment")[3] == "Mumbai (Bombay)")
    check("Taipei keys as State's issuance key", any(r[1] == "ait taipei" for r in new["rows"]))
    check("Kuwait keys as kuwait city", any(r[1] == "kuwait city" for r in new["rows"]))
    check("Port Au Prince keys as the issuance key", any(r[1] == "port - au - prince" for r in new["rows"]))
    kabul = cell(new, "kabul", "employment")
    check("N/A is printed and has no month", kabul[4] == "N/A" and kabul[5] is None, str(kabul))
    oct_emp = sum(1 for r in new["rows"] if r[2] == "employment" and r[5] == "2026-10")
    check("105 named posts read Oct-2026 for employment", oct_emp == 105, str(oct_emp))

    old = iv.parse(OLD)
    check("a saved page parses", old["as_of"] == "2025-04-28" and old["posts"] == 142, f"{old['as_of']} {old['posts']}")
    check("two-digit years read as 20YY", cell(old, "abu dhabi", "employment")[5] == "2023-02")

    # Every refusal: the page that isn't the whole table writes nothing.
    lines = COPY.splitlines()
    no_date = "\n".join(lines[1:])
    check("no date is refused", "Last Updated" in (refused(no_date) or ""))
    wrong_cols = "\n".join([lines[0], "Post|Employment Visa|Preference Visa|Something Else", *lines[2:]])
    check("wrong columns are refused", "columns" in (refused(wrong_cols) or ""))
    twice = "\n".join([*lines, lines[2]])
    check("a post twice is refused", "twice" in (refused(twice) or ""))
    future = COPY.replace("Abu Dhabi|Oct-2023", "Abu Dhabi|Dec-2026")
    check("a month after the page's date is refused", "after the page's own date" in (refused(future) or ""))
    few = "\n".join(lines[:40])
    check("too few posts are refused", "only" in (refused(few) or ""))
    garbled = "\n".join(lines[:2] + [l.replace("-2026", "?") for l in lines[2:]])
    check("unreadable cells are refused", "unreadable" in (refused(garbled) or ""))
    short = COPY.replace("Accra|Nov-2023|Nov-2023|Mar-2024", "Accra|Nov-2023|Nov-2023")
    check("a short row is refused", "cells" in (refused(short) or ""))

    # The post key rule matches State's issuance tables' group_key on plain names.
    from ingest_visa_issuances import group_key
    for name in ("Ho Chi Minh City", "Rio De Janeiro", "Dar Es Salaam", "Ciudad Juarez"):
        check(f"{name} keys like the issuance tables", iv.post_key(name, {}) == group_key(name))

    print(f"\n{len(FAILED)} failed" if FAILED else "\nall passed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
