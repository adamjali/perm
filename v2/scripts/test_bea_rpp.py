#!/usr/bin/env python3
"""ingest_bea_rpp: lines found by name, values parsed, no key means no run.

Run: python3 scripts/test_bea_rpp.py
"""
from __future__ import annotations

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_bea_rpp as bea  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


# BEA's own descriptions, read from GetParameterValuesFiltered on Oct 5 2026 (SARPP and
# MARPP print the same five). Housing is "Services: Rents"; a guessed "Housing" passed this
# test while the live loader refused every run.
VALUES = [{"Key": "1", "Desc": "[MARPP] RPPs: All items"}, {"Key": "2", "Desc": "[MARPP] RPPs: Goods"},
          {"Key": "3", "Desc": "[MARPP] RPPs: Services: Rents"},
          {"Key": "4", "Desc": "[MARPP] RPPs: Services: Utilities"},
          {"Key": "5", "Desc": "[MARPP] RPPs: Services: Other"},
          {"Key": "6", "Desc": "[MARPP] Implicit regional price deflator"}]


def main() -> int:
    check("each line by its description", bea.pick_lines(VALUES),
          {"all": "1", "goods": "2", "housing": "3", "utilities": "4", "other": "5"})
    try:
        bea.pick_lines([v for v in VALUES if v["Key"] != "3"])
        refused = False
    except bea.Refusal:
        refused = True
    check("a missing line is refused, not guessed", refused, True)
    data = [{"GeoFips": "41940", "GeoName": "San Jose-Sunnyvale-Santa Clara, CA (Metropolitan Statistical Area)",
             "TimePeriod": "2024", "DataValue": "118.512"},
            {"GeoFips": "00000", "GeoName": "United States", "TimePeriod": "2024", "DataValue": "100"},
            {"GeoFips": "41940", "GeoName": "x", "TimePeriod": "2023", "DataValue": "(NA)"}]
    rows = bea.rows_of(data, "msa", "all")
    check("the national row is dropped; values parsed", [(r[0], r[1], r[5]) for r in rows],
          [("41940", 2024, 118.512), ("41940", 2023, None)])
    saved = os.environ.pop("BEA_API_KEY", None)
    sys.argv = ["ingest_bea_rpp.py"]
    try:
        check("no key: a clean exit that writes nothing", bea.main(), 0)
    finally:
        if saved is not None:
            os.environ["BEA_API_KEY"] = saved
    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
