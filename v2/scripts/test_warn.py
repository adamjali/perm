#!/usr/bin/env python3
"""The California WARN parser, against the report as published on Sep 8 2026.

    python3 scripts/test_warn.py

Columns are resolved by header name, so the check that matters is the count
and the fields of a known row: a column the state renames would otherwise
land as None and read as a quiet Tuesday.
"""
from __future__ import annotations

import os
import sys
import warnings

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_warn import parse_california, parse_new_york, parse_texas, parse_washington_page  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "ca_warn_2026-09-08.xlsx")
TX_FIXTURE = os.path.join(HERE, "fixtures", "tx_warn_2026-09-09.xlsx")
NY_FIXTURE = os.path.join(HERE, "fixtures", "ny_warn_2026-09-09.csv")
WA_FIXTURE = os.path.join(HERE, "fixtures", "wa_warn_page_2026-09-09.html")


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def main() -> int:
    f: list[str] = []
    warnings.simplefilter("ignore")
    rows = parse_california(open(FIXTURE, "rb").read())
    check(len(rows) == 192, f"192 notices in the Sep 8 2026 report (got {len(rows)})", f)
    dates = sorted(r["notice_date"] for r in rows)
    check(dates[0] == "2026-06-26" and dates[-1] == "2026-09-02", f"notice dates run 2026-06-26 to 2026-09-02 (got {dates[0]} to {dates[-1]})", f)
    mc = next((r for r in rows if r["company"].startswith("McDonald")), None)
    check(mc is not None, "the McDonald's row is present", f)
    if mc:
        check(mc["notice_date"] == "2026-06-30" and mc["effective_date"] == "2026-09-01", "its notice and effective dates parse as ISO", f)
        check(mc["employees"] == 2 and mc["kind"] == "Closure Permanent" and mc["county"] == "Los Angeles County", "its count, kind and county are read by header name", f)
        check(mc["industry"].startswith("72"), "its industry carries the NAICS prefix", f)
    check(all(isinstance(r["employees"], int) or r["employees"] is None for r in rows), "employee counts are integers or absent", f)
    ids = [r["id"] for r in rows]
    check(len(set(ids)) == len(ids), "ids are unique", f)
    check(ids == [r["id"] for r in parse_california(open(FIXTURE, "rb").read())], "ids are stable across parses", f)

    # Texas: the yearly spreadsheet, columns by name, no layoff/closure kind.
    tx = parse_texas(open(TX_FIXTURE, "rb").read())
    check(len(tx) == 96, f"Texas fixture parses 96 notices, got {len(tx)}", f)
    check(tx[0]["company"] == "Keystone Tower Systems" and tx[0]["notice_date"] == "2026-09-04" and tx[0]["effective_date"] == "2026-11-02", "Texas first row: company and both dates", f)
    check(tx[0]["employees"] == 79 and tx[0]["county"] == "Gray" and tx[0]["kind"] is None and tx[0]["state"] == "TX", "Texas first row: count, county, no kind", f)
    check(len({r["id"] for r in tx}) == len(tx), "Texas ids are unique", f)
    check([r["id"] for r in tx] == [r["id"] for r in parse_texas(open(TX_FIXTURE, "rb").read())], "Texas ids are stable across parses", f)
    try:
        parse_texas(b"<html>challenge</html>")
        check(False, "Texas refuses a challenge page", f)
    except ValueError as e:
        check("challenge" in str(e), "Texas names the challenge page in its refusal", f)
    # New York: the Tableau CSV, headers with stray spaces.
    ny = parse_new_york(open(NY_FIXTURE, "rb").read())
    check(len(ny) == 8, f"New York fixture parses 8 notices, got {len(ny)}", f)
    check(ny[0]["company"] == "420 Park FB LLC" and ny[0]["notice_date"] == "2026-04-06" and ny[0]["effective_date"] == "2026-07-06", "New York first row: company, notice date, start date", f)
    check(ny[0]["kind"] == "Closure, Permanent" and ny[0]["employees"] == 42 and ny[0]["county"] == "New York", "New York first row: kind, count, county", f)
    check(len({r["id"] for r in ny}) == len(ny), "New York ids are unique", f)
    # Washington: one grid page, received date as the notice date, PDF link as the source.
    wa = parse_washington_page(open(WA_FIXTURE, encoding="utf8").read())
    check(len(wa) == 15, f"Washington page parses 15 notices, got {len(wa)}", f)
    check(wa[0]["company"] == "Gilbert Orchards, Inc." and wa[0]["notice_date"] == "2026-09-03" and wa[0]["effective_date"] == "2026-11-22", "Washington first row: company, received and start dates in ISO", f)
    check(wa[0]["employees"] == 518 and wa[0]["kind"] == "Layoff, Permanent" and wa[0]["county"] == "Yakima, Franklin and Grant Counties", "Washington first row: count, kind, location", f)
    check(wa[0]["source_url"].startswith("https://fortress.wa.gov/esd/file/WARN/Public/DownloadFile.aspx"), "Washington row links its notice PDF", f)
    check(all(r["notice_date"] <= wa[0]["notice_date"] for r in wa), "Washington page is newest-first", f)
    check(all(r["state"] in ("TX", "NY", "WA") for r in tx + ny + wa), "every new-state row carries its state", f)
    check(all(r["source_url"].startswith("https://edd.ca.gov/") for r in rows), "every row cites EDD", f)
    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
