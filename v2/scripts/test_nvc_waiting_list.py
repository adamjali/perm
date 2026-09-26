#!/usr/bin/env python3
"""Tests for ingest_nvc_waiting_list.py, on the text of three real reports. Offline."""
from __future__ import annotations

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_nvc_waiting_list as nv  # noqa: E402

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{': ' + detail if detail and not cond else ''}")
    if not cond:
        failures.append(label)


def fixture(year: int) -> str:
    return (HERE / "__fixtures__" / f"nvc-waiting-list-{year}.txt").read_text()


def refuses(label: str, text: str, expect: str) -> None:
    try:
        nv.parse_report(text)
        check(label, False, "parsed anyway")
    except nv.Refusal as exc:
        check(label, expect in str(exc), str(exc)[:80])


def main() -> int:
    r23 = nv.parse_report(fixture(2023))
    check("2023: the report's own date", r23["asOf"] == "2023-11-01" and r23["prevAsOf"] == "2022-11-01")
    check("2023: employment categories as printed",
          [r23["now"][k] for k in ("E1", "E2", "E3", "E3S", "EW", "E4", "E5", "E")]
          == [20_582, 75_567, 122_677, 78_207, 44_470, 1_951, 39_883, 260_660], str(r23["now"]))
    check("2023: family and grand totals",
          r23["now"]["F"] == 3_773_401 and r23["now"]["ALL"] == 4_034_061)
    check("2023: last year's column too", r23["prev"]["EW"] == 26_729 and r23["prev"]["E"] == 168_148)
    check("2023: employment countries, summing to the employment total",
          r23["employmentByCountry"][0] == {"country": "China (mainland born)", "applicants": 65_338}
          and sum(c["applicants"] for c in r23["employmentByCountry"]) == 260_660)

    # The two layouts that broke a naive parser, from the real files.
    r17 = nv.parse_report(fixture(2017))
    check("2017: '2B- Adult Sons' with a space after the hyphen", r17["now"]["F2B"] == 364_353, str(r17["now"].get("F2B")))
    r21 = nv.parse_report(fixture(2021))
    check("2021: 'EMPLOYMENT FOURTH' and 'TOTAL' on two lines", r21["now"]["E4"] == 1_045, str(r21["now"].get("E4")))

    # --- a report that doesn't add up is refused ----------------------------
    refuses("a changed employment cell breaks the employment total",
            fixture(2023).replace("75,567", "75,576", 1), "employment total")
    refuses("a missing row is refused, not read as zero",
            fixture(2023).replace("EMPLOYMENT SECOND", "EMPLOYMENT 2ND"), "EMPLOYMENT SECOND")
    refuses("a report with no date is refused",
            fixture(2023).replace("as of November 1, 2023", "as of late 2023"), "as of")

    # --- a country list that doesn't add up is dropped, not shown ----------
    bad = fixture(2023).replace("India \n48,536", "India \n48,563", 1)
    rb = nv.parse_report(bad)
    check("a country list off by one digit is dropped; the totals stand",
          rb["employmentByCountry"] == [] and rb["now"]["E"] == 260_660, str(rb["employmentByCountry"])[:60])

    # --- across reports -----------------------------------------------------
    doc = nv.build_doc([r23, r21, nv.parse_report(fixture(2017))], {})
    check("one series by date, oldest first, both columns of each report",
          [s["asOf"] for s in doc["series"]] == ["2016-11-01", "2017-11-01", "2020-11-01", "2021-11-01", "2022-11-01", "2023-11-01"],
          str([s["asOf"] for s in doc["series"]]))
    check("the newest report names the date and the countries", doc["newest"] == "2023-11-01" and len(doc["employmentByCountry"]) == 6)
    check("no restatement when a report's prior year matches the previous report", doc["revisions"] == [])
    restated = dict(r23, prev=dict(r23["prev"], EW=26_000))
    # A 2022 report whose own figures are the 2023 report's prior-year column,
    # then a 2023 report restating one cell of that year.
    r22 = dict(r23, asOf="2022-11-01", prevAsOf="2021-11-01", now=dict(r23["prev"]), prev=dict(r21["now"]))
    rv = nv.build_doc([r22, restated], {})["revisions"]
    check("a later report restating a year is recorded, and its figure wins",
          len(rv) == 1 and rv[0]["changes"] == {"EW": [26_729, 26_000]}, str(rv))

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
