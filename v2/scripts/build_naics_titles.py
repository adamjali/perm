#!/usr/bin/env python3
"""Write scripts/data/naics_titles.json from the Census Bureau's own code lists.

DOL's PERM disclosure file carries the employer's industry as a bare NAICS code
(`EMP_NAICS`, Form 9089 Section A, Item 13) and no title. The title comes from
the primary source, the Census Bureau's "2-6 digit" code lists:

    https://www.census.gov/naics/2022NAICS/2-6%20digit_2022_Codes.xlsx
    https://www.census.gov/naics/2017NAICS/2-6%20digit_2017_Codes.xlsx

2022 wins where both define a code. A code that 2022 retired keeps its 2017
title, marked with its vintage, because employers still type the code they have
always used. Sector ranges ("31-33") are expanded to each two-digit code.

Usage:
    python3 scripts/build_naics_titles.py <2022.xlsx> <2017.xlsx>
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

import openpyxl

OUT = pathlib.Path(__file__).resolve().parent / "data" / "naics_titles.json"


def read_codes(path: str) -> dict[str, str]:
    """Code -> title from one Census list. Ranges like "31-33" become each code."""
    wb = openpyxl.load_workbook(path, read_only=True)
    out: dict[str, str] = {}
    for row in wb.active.iter_rows(values_only=True):
        if not row or row[1] is None or row[2] is None:
            continue
        raw, title = str(row[1]).strip(), " ".join(str(row[2]).split())
        m = re.fullmatch(r"(\d{2})-(\d{2})", raw)
        if m:
            for c in range(int(m.group(1)), int(m.group(2)) + 1):
                out[str(c)] = title
        elif re.fullmatch(r"\d{2,6}", raw):
            out[raw] = title
    return out


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    y2022, y2017 = read_codes(sys.argv[1]), read_codes(sys.argv[2])
    if len(y2022) < 2000 or len(y2017) < 2000:
        sys.exit(f"FATAL: only {len(y2022)} / {len(y2017)} codes read; not a Census code list")
    table = {code: [title, 2022] for code, title in y2022.items()}
    for code, title in y2017.items():
        table.setdefault(code, [title, 2017])
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(dict(sorted(table.items())), separators=(",", ":")) + "\n")
    retired = sum(1 for v in table.values() if v[1] == 2017)
    print(f"wrote {OUT.name}: {len(table):,} codes ({retired:,} kept from 2017 only)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
