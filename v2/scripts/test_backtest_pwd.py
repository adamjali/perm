#!/usr/bin/env python3
"""Gates for the wage-request backtest. No network: pure functions only.

The month arithmetic is a port of estimatePwdQueue (pwdQueue.ts), so it is held
to that file's own worked examples: a port that drifts would grade a number no
reader was shown."""
from __future__ import annotations
import pathlib, sys
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from backtest_pwd import clearance, estimated_month, score_months

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

BACKLOG = [{"receiptMonth": m, "remainingRequests": n} for m, n in
           [("2025-12", 11), ("2026-01", 63), ("2026-02", 106), ("2026-03", 627),
            ("2026-04", 14_386), ("2026-05", 18_310), ("2026-06", 16_797)]]
check(estimated_month("2026-05", BACKLOG, "2026-06-30", 8_000) == "2026-10",
      "pwdQueue.test: 24,348 effective at 8,000 a month from June 30 is October")

LIVE = [{"receiptMonth": m, "remainingRequests": n} for m, n in
        [("2026-04", 8), ("2026-05", 36), ("2026-06", 3_532), ("2026-07", 15_959),
         ("2026-08", 14_980), ("2026-09", 14_519)]]
for req, want in [("2026-06", "2026-10"), ("2026-07", "2026-10"), ("2026-08", "2026-11"), ("2026-09", "2026-12")]:
    check(estimated_month(req, LIVE, "2026-09-30", 15_306) == want, f"pwdQueue.test: {req} names {want}")
one = [{"receiptMonth": "2026-06", "remainingRequests": 2_000}]
check(estimated_month("2026-06", one, "2026-09-15", 2_500) == "2026-09", "a mid-month as-of: 0.4 months is September")
check(estimated_month("2026-06", one, "2026-09-15", 1_666) == "2026-10", "0.6 months is October")

# measurePwdClearance: same months only, a fall per month; new intake ignored.
e = {"asOf": "2026-06-30", "backlog": [{"receiptMonth": "2026-05", "remainingRequests": 18_000},
                                         {"receiptMonth": "2026-06", "remainingRequests": 16_000}]}
l = {"asOf": "2026-08-31", "backlog": [{"receiptMonth": "2026-05", "remainingRequests": 2_000},
                                         {"receiptMonth": "2026-06", "remainingRequests": 6_000},
                                         {"receiptMonth": "2026-08", "remainingRequests": 15_000}]}
check(clearance(e, l) == 13_000, "26,000 cleared over two months; August's intake isn't clearance")
check(clearance(e, {**e}) is None, "the same as-of date measures nothing")

# Graded against the month: inside it, days from its middle; a request still
# waiting is a miss once its month has ended.
s = score_months({"a": "2026-09", "b": "2026-09", "c": "2026-10"},
                 {"a": date(2026, 9, 20), "b": None, "c": None}, date(2026, 10, 6))
check(s["decided"] == 1 and s["typicalMissDays"] == 5, "a: decided Sep 20, five days after the middle")
check(s["judged"] == 0, "September ended Sep 30, under a week before Oct 6: not judged yet")
s = score_months({"a": "2026-09", "b": "2026-09"}, {"a": date(2026, 9, 20), "b": None}, date(2026, 10, 12))
check(s["judged"] == 2 and s["insideMonthShare"] == 0.5, "judged a week after the month: a inside, b still waiting")
check(s["missAtLeastDays"] == 8.5, "b is at least 12 days past September's end; a is 5: median 8.5")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
