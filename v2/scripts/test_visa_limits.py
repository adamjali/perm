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
    # Per-country rows of Part 2 for the four chargeabilities the bulletin names,
    # and the rest of the world as the grand total less those four (2026-09-26).
    by = tv["employment_by_chargeability"]
    check(by["india"]["2nd"] == 3_916 and by["india"]["3rd"] == 3_643 and by["india"]["3rd_other_workers"] == 12, "India EB-2 3,916, EB-3 3,643, other workers 12, as printed", f)
    check(by["china"]["2nd"] == 6_556 and by["china"]["3rd_other_workers"] == 177, "China (mainland born) EB-2 6,556, other workers 177", f)
    check(by["mexico"]["3rd_other_workers"] == 2_207 and by["philippines"]["3rd"] == 9_111, "Mexico other workers 2,207, Philippines EB-3 9,111", f)
    check(by["row"]["2nd"] == 46_314 - 6_556 - 3_916 - 379 - 1_314, "rest of world EB-2 is the grand total less the four", f)
    check(all(sum(by[k][c] for k in ("china", "india", "mexico", "philippines", "row")) == tv["employment"][c]
              for c in ("1st", "2nd", "3rd", "3rd_other_workers", "3rd_total", "4th", "4th_religious", "4th_total")),
          "the five chargeabilities add up to the grand totals in every column", f)
    check("Taiwan" not in str(by) and "China - mainland born" == tv["chargeability_labels"]["china"], "China is the mainland-born row only; Taiwan and Hong Kong are rest of world", f)
    try:
        parse_limits(b"%PDF-1.4 nothing here")
        check(False, "a sheet with no fiscal year is refused", f)
    except Exception:
        check(True, "a sheet with no fiscal year is refused", f)
    # --- discovery on State's own host (link finders only; offline) -------
    import ingest_visa_limits as v
    stats = ('<a href="/content/dam/visas/Statistics/Immigrant-Statistics/Annual%20%20Numerical%20%20Limits%20-%20FY2025.pdf">25</a>'
             '<a href="/content/dam/visas/Statistics/Immigrant-Statistics/Annual%20%20Numerical%20%20Limits%20-%20FY2026.pdf">26</a>'
             '<a href="/content/dam/visas/Immigrant_Numerical_Control_System_Accessible_July2025.pdf">other</a>')
    lim = v.newest_limits_link(stats)
    check(lim is not None and lim[0] == 2026 and lim[1].startswith("https://adoption.state.gov/") and lim[1].endswith("FY2026.pdf"),
          "the newest limits sheet linked is taken, on State's host", f)
    reports = ''.join(f'<a href="/content/travel/en/legal/visa-law0/visa-statistics/annual-reports/report-of-the-visa-office-{y}.html">{y}</a>'
                      for y in (2022, 2024, 2023))
    rep = v.newest_report_link(reports)
    check(rep is not None and rep[0] == 2024, "the newest Report of the Visa Office is found whatever the order", f)
    report = ('<a href="/content/dam/visas/Statistics/AnnualReports/FY2024AnnualReport/Table%20V_PartI.pdf">I</a>'
              '<a href="/content/dam/visas/Statistics/AnnualReports/FY2024AnnualReport/Table%20V.pdf">V</a>'
              '<a href="/content/dam/visas/Statistics/AnnualReports/FY2024AnnualReport/Table%20VI.pdf">VI</a>')
    tv = v.table_v_link(report)
    check(tv is not None and tv.endswith("/Table%20V.pdf"), "the whole Table V is taken, not its parts or Table VI", f)
    check(v.newest_limits_link("<p>nothing</p>") is None and v.table_v_link("") is None,
          "a page with no link finds nothing rather than guessing", f)

    print("\nALL PASS" if not f else f"\n{len(f)} FAILED")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
