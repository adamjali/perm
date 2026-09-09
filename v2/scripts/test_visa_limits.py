#!/usr/bin/env python3
"""The two parsers against the Department's real PDFs (fixtures, fetched 2026-09-09)."""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ingest_visa_limits import EMPLOYMENT_BASE, FAMILY_BASE, parse_limits, parse_table_v  # noqa: E402


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(f"  {'ok  ' if cond else 'FAIL'} {msg}")
    if not cond:
        failures.append(msg)


def main() -> int:
    f: list[str] = []
    lim = parse_limits(open(os.path.join(HERE, "fixtures", "visa-limits-FY2026.pdf"), "rb").read())
    check(lim["fiscal_year"] == 2026 and lim["estimated"] is True, "FY2026 sheet, marked estimated", f)
    check(lim["employment"]["Total"]["worldwide"] == 186_000, "employment worldwide total 186,000", f)
    check(lim["family"]["Total"]["worldwide"] == 226_000 == FAMILY_BASE, "family worldwide total 226,000", f)
    check(lim["spillover_to_employment"] == 46_000 and EMPLOYMENT_BASE == 140_000, "spillover is 186,000 minus 140,000 = 46,000", f)
    check(lim["employment"]["E1"]["worldwide"] == 53_196 and lim["employment"]["E5"]["worldwide"] == 13_206, "E1 53,196 and E5 13,206", f)
    check(lim["per_country_employment"] == 13_020 and lim["family"]["Total"]["foreign_state"] == 15_820, "per-country totals 13,020 and 15,820", f)
    check(lim["family"]["FX"]["foreign_state"] is None and lim["family"]["FX"]["worldwide"] == 65_950, "FX has no per-country figure and 65,950 worldwide", f)
    check(any("Estimated" in n for n in lim["notes"]), "the estimate footnote is kept", f)
    tv = parse_table_v(open(os.path.join(HERE, "fixtures", "visa-table-v-FY2024.pdf"), "rb").read())
    check(tv["fiscal_year"] == 2024, "Table V is FY2024", f)
    check(tv["family"]["total"] == 215_959 and tv["family"]["1st"] == 23_294 and tv["family"]["4th"] == 66_326, "family grand totals as printed", f)
    check(tv["family_unused"] == 226_000 - 215_959 == 10_041, "unused family numbers are 10,041", f)
    check(tv["employment"]["1st"] == 47_462 and tv["employment"]["3rd_total"] == 47_290 and tv["employment"]["4th_total"] == 11_672, "employment part 2 totals as printed", f)
    check(tv["employment"]["5th_total"] == 14_924, "fifth preference total 14,924", f)
    check(tv["employment"]["total"] == 167_394 and tv["grand_total"] == 383_353, "employment total and grand total as printed", f)
    check(tv["family"]["total"] + tv["employment"]["total"] == tv["grand_total"], "the parts add up to the grand total", f)
    try:
        parse_limits(b"%PDF-1.4 nothing here")
        check(False, "a sheet with no fiscal year is refused", f)
    except Exception:
        check(True, "a sheet with no fiscal year is refused", f)
    print("\nALL PASS" if not f else f"\n{len(f)} FAILED")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
