#!/usr/bin/env python3
"""Gates for the standing estimator backtest. No network: pure functions only."""
from __future__ import annotations
import pathlib, sys
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from backtest_queue import coverage, days_in_month, is_final_status, near_set, predict, score

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

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
