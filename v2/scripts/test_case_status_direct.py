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

    # --- discovery: the serial-major walk -------------------------------
    # A fake DOL answers from a "universe" of issued case numbers, and a fake
    # Turso records every insert and doc write. No network, no sleeps.
    csd.PACE_S = 0

    class WalkDB:
        def __init__(self, rows_by_prefix=None):
            self.docs, self.perm, self.other, self.rows_by_prefix = {}, {}, [], rows_by_prefix or {}
        @staticmethod
        def _res(rows=(), affected=0):
            return {"response": {"result": {"rows": list(rows), "affected_row_count": affected}}}
        def execute(self, sql, args=None):
            args = args or []
            if sql.startswith("SELECT json FROM perm_docs"):
                j = self.docs.get(args[0])
                return self._res([[{"type": "text", "value": j}]] if j else [])
            if "INSERT OR REPLACE INTO perm_docs" in sql:
                self.docs[args[0]] = args[1]; return self._res(affected=1)
            if sql.startswith("SELECT case_number FROM perm_case_status"):
                lo, hi = args[0], args[1]
                hits = sorted((cn for cn in self.rows_by_prefix.get(lo[:6], []) if lo <= cn < hi), reverse=True)
                return self._res([[{"type": "text", "value": cn}] for cn in hits[:50]])
            if "INSERT OR IGNORE INTO perm_case_status" in sql:
                new = args[0] not in self.perm; self.perm[args[0]] = args
                return self._res(affected=1 if new else 0)
            raise AssertionError("unexpected sql: " + sql[:70])
        def pipeline(self, reqs, **kw):
            stmts = [r for r in reqs if r.get("type") == "execute"]
            for r in stmts:
                self.other.append(r["stmt"]["args"][0]["value"])
            return {"results": [{"response": {"result": {"affected_row_count": 1}}} for _ in stmts]}

    def fake_dol(universe):
        asked_log = []
        def lookup(nums):
            asked_log.append(list(nums))
            return [dict(universe[n], caseNumber=n) for n in nums if n in universe]
        lookup.asked = asked_log
        return lookup

    def perm(cn, status="ANALYST REVIEW"):
        return cn, {"caseStatus": status, "employerName": "Acme", "jobTitle": "Eng", "submittedDate": "2026-08-28"}
    def lca(cn):
        return cn, {"caseStatus": "CERTIFIED", "employerName": "Hooli", "jobTitle": "DS", "visaType": "LCA"}

    T = _dt.date(2026, 8, 30)          # "today" for the walk: day code 26242

    # 1. A day boundary mid-walk is crossed by evidence, and the cursor carries it.
    u = dict([perm(f"G-100-26240-{s:06d}") for s in range(101, 106)]
             + [lca(f"I-200-26240-{s:06d}") for s in range(106, 116)]
             + [perm(f"G-200-26241-{s:06d}") for s in range(116, 126)])
    db = WalkDB(); look = fake_dol(u)
    r = csd.run_discovery(db, lookup=look, today=T, frontier_override=("26240", 100))
    check("walk follows a serial run into the next day code",
          r["frontier_after"][0] == "26241" and r["frontier_after"][1] == 125, str(r["frontier_after"]))
    check("walk records both PERM office codes",
          r["inserted"] == 15 and any(k.startswith("G-200-") for k in db.perm), f"{r['inserted']} {list(db.perm)[:2]}")
    check("walk hands LCA hits to the PWD/LCA inserter",
          r["inserted_other"] == 10 and len(db.other) == 10, f"{r['inserted_other']} {len(db.other)}")
    check("walk reaches the edge and reports ok", r["status"] == "ok", r["status"])
    check("every asked serial is six digits wide",
          all(len(n.rsplit("-", 1)[1]) == 6 for batch in look.asked for n in batch), look.asked[0][:3])

    # 2. A 200-serial stretch that is all LCA/PWD (an overnight lull) does NOT stop it.
    u = dict([lca(f"I-200-26240-{s:06d}") for s in range(101, 301)] + [perm("G-100-26240-000301")])
    db = WalkDB(); look = fake_dol(u)
    r = csd.run_discovery(db, lookup=look, today=T, frontier_override=("26240", 100))
    check("an overnight lull of other programs is walked through",
          r["inserted"] == 1 and "G-100-26240-000301" in db.perm and r["frontier_after"][1] == 301,
          f"{r['inserted']} {r['frontier_after']}")

    # 3. Past the edge, two unclaimed spans stop the walk and the frontier stays put.
    u = dict([perm(f"G-100-26240-{s:06d}") for s in range(101, 151)])
    db = WalkDB(); look = fake_dol(u)
    r = csd.run_discovery(db, lookup=look, today=T, frontier_override=("26240", 100))
    check("frontier never advances past serials nobody has issued",
          r["frontier_after"] == ("26240", 150) and r["status"] == "ok", str(r["frontier_after"]))
    import json as _json
    check("frontier doc persisted with the final cursor",
          _json.loads(db.docs[csd.FRONTIER_DOC])["serial"] == 150, db.docs.get(csd.FRONTIER_DOC))

    # 4. The counter wraps at 1,000,000 inside one day; the walk asks 000000 next.
    u = dict([perm(f"G-100-26161-{s:06d}") for s in (999996, 999997, 999998, 999999, 0, 1, 2, 3)])
    db = WalkDB(); look = fake_dol(u)
    r = csd.run_discovery(db, lookup=look, today=_dt.date(2026, 6, 12), frontier_override=("26161", 999995))
    check("walk wraps at the modulus and picks the furthest serial on the ring",
          r["frontier_after"] == ("26161", 3) and "G-100-26161-000000" in db.perm, str(r["frontier_after"]))

    # 5. With no doc, the frontier initialises from the newest prober/sweep row,
    #    across office codes, so a newer G-200 row wins over the newest G-100.
    db = WalkDB(rows_by_prefix={"G-100-": ["G-100-26240-200246"], "G-200-": ["G-200-26241-200300"]})
    look = fake_dol({})
    r = csd.run_discovery(db, lookup=look, today=T)
    check("frontier initialises from the newest row across office codes",
          r["frontier_before"] == ("26241", 200300), str(r["frontier_before"]))

    # 6. The request cap stops the walk with more to do, and says so.
    u = dict([perm(f"G-100-26240-{s:06d}") for s in range(101, 400)])
    db = WalkDB(); look = fake_dol(u)
    r = csd.run_discovery(db, lookup=look, today=T, cap=3, frontier_override=("26240", 100))
    check("request cap yields partial, not ok", r["status"] == "partial" and r["requests"] == 3, f"{r['status']} {r['requests']}")

    # 7. DOL going away mid-walk is a failure, never an ok.
    def dying(nums):
        raise RuntimeError("DOL 503")
    db = WalkDB()
    r = csd.run_discovery(db, lookup=dying, today=T, frontier_override=("26240", 100))
    check("a DOL failure reports failed", r["status"] == "failed" and "503" in r["note"], r["status"])

    # 8. --frontier parsing.
    check("parse_frontier accepts YYDDD:SERIAL", csd.parse_frontier("26240:200246") == ("26240", 200246),
          str(csd.parse_frontier("26240:200246")))
    try:
        csd.parse_frontier("nope"); check("parse_frontier rejects junk", False, "accepted")
    except ValueError:
        check("parse_frontier rejects junk", True)

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
