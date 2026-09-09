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
from ingest_warn import parse_california  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "ca_warn_2026-09-08.xlsx")


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
    check(all(r["source_url"].startswith("https://edd.ca.gov/") for r in rows), "every row cites EDD", f)
    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
