#!/usr/bin/env python3
"""Tests for build_soc_crosswalk.py, on a workbook shaped like BLS's (title rows, then the four-column header)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_soc_crosswalk as bx  # noqa: E402
from lib_test_xlsx import xlsx_bytes  # noqa: E402

N = 0
FAILS: list[str] = []


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def book(extra: int = 900) -> bytes:
    rows = [["U.S. Bureau of Labor Statistics"], [], ["November 2017"], [], bx.HEADER,
            ["15-1132", "Software Developers, Applications (#)", "15-1252", "Software Developers"],
            ["15-1132", "Software Developers, Applications (#)", "15-1253", "Software Quality Assurance Analysts and Testers (##)"],
            ["15-1133", "Software Developers, Systems Software (#)", "15-1252", "Software Developers"],
            ["15-1133", "Software Developers, Systems Software (#)", "15-1253", "Software Quality Assurance Analysts and Testers (##)"],
            ["11-1011", "Chief Executives", "11-1011", "Chief Executives"]]
    # Filler pairs that map to themselves, so the file reaches BLS's size.
    rows += [[f"99-{i:04d}", "Filler", f"99-{i:04d}", "Filler"] for i in range(extra)]
    return xlsx_bytes({"Sorted by 2010": rows})


def main() -> int:
    codes = bx.build(book())
    check("a 2018 code lists each 2010 code it came from", [p["code"] for p in codes["15-1252"]], ["15-1132", "15-1133"])
    check("BLS's footnote signs are dropped from a title", codes["15-1252"][0]["title"], "Software Developers, Applications")
    check("each predecessor names the other 2018 jobs it also became",
          codes["15-1252"][0]["alsoTo"], [{"code": "15-1253", "title": "Software Quality Assurance Analysts and Testers"}])
    check("a code that maps only to itself is left out", "11-1011" in codes, False)
    try:
        bx.build(book(extra=10))
        refused = False
    except SystemExit:
        refused = True
    check("a file far short of BLS's crosswalk is refused", refused, True)
    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
