#!/usr/bin/env python3
"""Contract tests for the direct DOL case-status ingest.

    python3 scripts/test_case_status_direct.py

No network. Every test that would call DOL substitutes a fake `lookup`, so
this is safe to run in CI and cannot add load to a government host.

Each case here is a defect that actually happened or would have shipped
silently, which is the bar for a test in this file.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("csd", HERE / "ingest_case_status_direct.py")
csd = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(csd)

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        failures.append(label)


def main() -> int:
    # --- the batch ceiling ------------------------------------------------
    # 50 is not a style choice. Asking for 100 or 200 returns 200 OK with
    # exactly 50 records and NO error, so a larger BATCH silently drops three
    # quarters of every request and the run reports success.
    check("BATCH is the measured ceiling of 50", csd.BATCH == 50, str(csd.BATCH))

    # --- finality ---------------------------------------------------------
    # is_final is derived here rather than taken from anyone else. If
    # CERTIFIED - EXPIRED were missing from the set, an expired certification
    # would be re-swept forever as if still pending.
    for st in ("CERTIFIED", "CERTIFIED - EXPIRED", "DENIED", "WITHDRAWN"):
        check(f"{st!r} counts as final", st in csd.FINAL_STATUSES)
    for st in ("ANALYST REVIEW", "RFI ISSUED", "APPLICATION ON HOLD",
               "RECONSIDERATION APPEALS", "BALCA APPEALS"):
        check(f"{st!r} does NOT count as final", st not in csd.FINAL_STATUSES)

    # --- politeness -------------------------------------------------------
    check("paces requests", csd.PACE_S >= 0.2, str(csd.PACE_S))
    check("provenance names DOL, not a mirror",
          "flag.dol.gov" in csd.SOURCE and "permtrack" not in csd.SOURCE.lower())

    # --- retry ------------------------------------------------------------
    # A single transient failure silently skips FIFTY cases, and the caller
    # only counts CONSECUTIVE failures, so one blip mid-sweep would leave a
    # 50-case hole nothing reports.
    calls = {"n": 0}
    real = csd.lookup

    def flaky(nums):
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("HTTP 503")
        return [{"caseNumber": n, "caseStatus": "CERTIFIED"} for n in nums]

    csd.lookup = flaky
    csd.time.sleep = lambda *_: None          # do not actually back off in a test
    try:
        got = csd.lookup_with_retry(["G-1"], attempts=4)
        check("retries a failing batch and succeeds", len(got) == 1 and calls["n"] == 3,
              f"calls={calls['n']}")
    except Exception as exc:  # noqa: BLE001
        check("retries a failing batch and succeeds", False, str(exc))

    calls["n"] = 0

    def always_fails(_nums):
        calls["n"] += 1
        raise RuntimeError("HTTP 503")

    csd.lookup = always_fails
    try:
        csd.lookup_with_retry(["G-1"], attempts=3)
        check("gives up after the last attempt", False, "did not raise")
    except RuntimeError:
        check("gives up after the last attempt", calls["n"] == 3, f"calls={calls['n']}")
    csd.lookup = real

    # --- the flush counter -------------------------------------------------
    # flush() is called mid-run, so it must CLEAR what it wrote or the next
    # flush re-sends everything and the totals double.
    class FakeDB:
        def __init__(self): self.batches = 0
        def pipeline(self, reqs, **kw): self.batches += 1; return {}
    db = FakeDB()
    csd.written["u"] = csd.written["e"] = 0
    ups = [[f"S{i}", 0, "E", "J", "src", 1, f"G-{i}"] for i in range(5)]
    evs = [[f"G-{i}", 1, "A", "B", 0, "src"] for i in range(3)]
    csd.flush(db, ups, evs)
    check("flush clears its input", ups == [] and evs == [], f"{len(ups)},{len(evs)}")
    check("flush counts what it wrote", csd.written["u"] == 5 and csd.written["e"] == 3,
          str(csd.written))
    csd.flush(db, ups, evs)
    check("a second flush of empty lists adds nothing",
          csd.written["u"] == 5 and csd.written["e"] == 3, str(csd.written))

    # --- discovery: the pure pieces --------------------------------------
    import datetime as _dt

    check("decode_filing_date reads the YYDDD segment",
          csd.decode_filing_date("G-100-26125-868956") == "2026-05-05",
          str(csd.decode_filing_date("G-100-26125-868956")))
    check("decode_filing_date: day 239 of 2026 is Aug 27",
          csd.decode_filing_date("G-100-26239-197015") == "2026-08-27",
          str(csd.decode_filing_date("G-100-26239-197015")))
    check("decode_filing_date refuses an impossible day-of-year",
          csd.decode_filing_date("G-100-26400-000001") is None,
          str(csd.decode_filing_date("G-100-26400-000001")))
    check("decode_filing_date refuses day 366 of a non-leap year",
          csd.decode_filing_date("G-100-26366-000001") is None,
          str(csd.decode_filing_date("G-100-26366-000001")))
    check("decode_filing_date refuses junk",
          csd.decode_filing_date("banana") is None, "matched junk")

    codes = csd.recent_day_codes(_dt.date(2027, 1, 2), 4)
    check("recent_day_codes crosses the year boundary with real dates",
          codes == ["27002", "27001", "26365", "26364"], str(codes))

    batches = list(csd.discovery_batches(197000, ["26240", "26239"], 120, batch=50))
    check("discovery batches are day-major and capped at the batch ceiling",
          len(batches) == 6 and all(len(c) <= 50 for _, c in batches)
          and batches[0][0] == "26240" and batches[3][0] == "26239",
          f"{len(batches)} batches")
    check("discovery candidates start one past the frontier",
          batches[0][1][0] == "G-100-26240-197001", batches[0][1][0])
    check("discovery serials stay inside the span",
          batches[2][1][-1] == "G-100-26240-197120", batches[2][1][-1])

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
