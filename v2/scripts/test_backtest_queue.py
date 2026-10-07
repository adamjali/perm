#!/usr/bin/env python3
"""Gates for the standing estimator backtest. No network: pure functions only."""
from __future__ import annotations
import pathlib, sys
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from backtest_queue import (coverage, days_in_month, is_final_status, near_set, passed_section, predict,
                            score, score_floor, straggler_rate)

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

# ---- what "pending on T0" means --------------------------------------------
# A certified case whose certification expired after T0 logs a final event
# after T0; the first run counted 6,500 of those as pending. Its status on T0
# was CERTIFIED, which is final.
check(is_final_status("CERTIFIED"), "CERTIFIED is final")
check(is_final_status("CERTIFIED - EXPIRED"), "CERTIFIED - EXPIRED is final")
check(is_final_status("DENIED - BALCA DISMISSED"), "a DENIED variant is final")
check(is_final_status("WITHDRAWN"), "WITHDRAWN is final")
check(not is_final_status("ANALYST REVIEW"), "ANALYST REVIEW is pending")
check(not is_final_status("RFI ISSUED"), "RFI ISSUED is pending")

check(days_in_month(2026, 2) == 28 and days_in_month(2024, 2) == 29, "February from the calendar")
check(days_in_month(2025, 12) == 31, "December rolls the year")

# ---- predict: in line only, prorated by day ------------------------------
T0 = date(2026, 9, 13)
cases = (
    [{"cn": f"a{i}", "fd": "2025-10-10", "m": "2025-10", "st0": "ANALYST REVIEW"} for i in range(620)]
    + [{"cn": f"h{i}", "fd": "2025-10-10", "m": "2025-10", "st0": "APPLICATION ON HOLD"} for i in range(310)]
    + [{"cn": "me", "fd": "2025-11-01", "m": "2025-11", "st0": "ANALYST REVIEW"}]
)
cur = predict(cases, T0, 100.0, True)
old = predict(cases, T0, 100.0, False)
check("h0" not in cur and "h0" not in old, "only in-line cases get a date, under either rule")
# 620 in line ahead at 100 a day = 6.2 days; with the 310 on hold, 9.3.
check(cur["me"] == date(2026, 9, 19), "the current rule counts the 620 in line: 6 days")
check(old["me"] == date(2026, 9, 22), "the old rule also counts the 310 on hold: 9 days")
# Filed on the 1st, so none of November is ahead of it; filed on the 10th of
# a 31-day month, 9/31 of its month's 620 in-line cases are.
check((cur["a0"] - T0).days == int(round(620 * 9 / 31) / 100),
      "a mid-month filing has its month's earlier days ahead of it, prorated")

# ---- score: both rules on ONE set of cases -------------------------------
pred = {"x": date(2026, 9, 20), "y": date(2026, 9, 22), "z": date(2026, 10, 30)}
decided = {"x": date(2026, 9, 18), "y": date(2026, 9, 25)}
chosen = near_set(pred, date(2026, 9, 25), 12)
check(chosen == {"x", "y"}, "the near set is what the current rule dates within the window")
s = score(pred, decided, date(2026, 9, 25), chosen)
check(s["decided"] == 2 and s["typicalMissDays"] == 2.5, "typical miss is the median absolute error")
check(s["biasDays"] == 0.5, "bias is signed: decided minus predicted")
check(s["decidedByEndRight"] == 1.0, "both were predicted by END and both were decided by END")
late = score({"x": date(2026, 9, 20)}, {}, date(2026, 9, 25), {"x"})
check(late["decided"] == 0 and late["decidedByEndRight"] == 0.0,
      "a case predicted by END and still pending counts against the rule")

# ---- range coverage: judged by the prediction, pending counts as a miss ---
pred = {"a": date(2026, 9, 15), "b": date(2026, 9, 16), "c": date(2026, 9, 24)}
bands = {"a": (date(2026, 9, 14), date(2026, 9, 18)), "b": (date(2026, 9, 15), date(2026, 9, 20)),
         "c": (date(2026, 9, 22), date(2026, 9, 28))}
cov = coverage(bands, {"a": date(2026, 9, 17)}, date(2026, 9, 25), pred)
check(cov["judged"] == 2, "only cases dated a week before END are judged (c is too recent)")
check(cov["insideShare"] == 0.5, "a decided inside, b still pending: one of two")

# ---- the left-behind section (Oct 7 2026) ---------------------------------
# A waiting case counts against a date that has passed; a decided one by its error.
f = score_floor({"d": date(2026, 9, 20), "w": date(2026, 9, 21), "x": date(2026, 10, 9)},
                {"d": date(2026, 9, 23), "w": None, "x": None}, date(2026, 10, 6))
check(f["decided"] == 1 and f["typicalMissDays"] == 3, "a decided case scores its own error")
check(f["missAtLeastDays"] == 3, "floors: d 3, w at least 15, x not yet due 0: median 3")
check(f["within7Share"] == round(2 / 3, 3), "d and x are within a week; w is not")

# The rate: decided over days at risk, a withdrawal not counted as DOL deciding.
lo, hi = date(2026, 9, 1), date(2026, 9, 15)
cases_lo = [{"cn": n, "fd": "2025-10-05", "m": "2025-10", "st0": "ANALYST REVIEW"} for n in ("a", "b", "c", "w")]
cases_lo.append({"cn": "late", "fd": "2025-12-01", "m": "2025-12", "st0": "ANALYST REVIEW"})
moves_lo = {"a": (date(2026, 9, 3), "CERTIFIED", True), "w": (date(2026, 9, 5), "WITHDRAWN", True),
            "late": (date(2026, 9, 2), "CERTIFIED", True)}
r = straggler_rate(cases_lo, moves_lo, lo, hi, "2025-11")
# a: 2.5 days, decided; w: 4.5 days, not counted; b, c: 14 each; late is ahead of the frontier.
check(abs(r - 1 / 35) < 1e-9, "one decision over 35 days at risk; the withdrawal and the later month left out")

# Three ways of dating the same left-behind cases, scored on one set.
t0, end = date(2026, 9, 22), date(2026, 10, 6)
cases = ([{"cn": f"n{i}", "fd": "2025-11-20", "m": "2025-11", "st0": "ANALYST REVIEW"} for i in range(4)]
         + [{"cn": "rfi", "fd": "2025-11-10", "m": "2025-11", "st0": "ANALYST REVIEW"},
            {"cn": "dec", "fd": "2025-12-03", "m": "2025-12", "st0": "ANALYST REVIEW"}])
moves = {"n0": (date(2026, 9, 25), "CERTIFIED", True), "n1": (date(2026, 9, 30), "DENIED", True),
         "n2": (date(2026, 9, 29), "CERTIFIED", True), "rfi": (date(2026, 9, 24), "RFI ISSUED", False)}
p = passed_section(cases, moves, t0, end, "2025-12", 336, 0.0866, 600.0)
check(p is not None and p["rate"]["cases"] == 4, "the RFI and the December case are not on this clock")
check(p["medianDays"] == round(0.6931471805599453 / 0.0866, 1), "the rate's median is ln 2 over the daily rate")
check(p["dolAverage"]["biasDays"] < -20, "DOL's average dates these November cases weeks late")
check(p["rate"]["missAtLeastDays"] < p["dolAverage"]["missAtLeastDays"], "the rate beats the average here")
check(passed_section(cases, moves, t0, end, "2025-12", 336, None, 600.0) is None, "no rate, no section")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
