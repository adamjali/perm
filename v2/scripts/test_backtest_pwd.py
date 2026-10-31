#!/usr/bin/env python3
"""Gates for the wage-request backtest. No network: pure functions only.

The month arithmetic is a port of estimatePwdQueue (pwdQueue.ts), so it is held
to that file's own worked examples: a port that drifts would grade a number no
reader was shown."""
from __future__ import annotations
import pathlib, sys
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from backtest_pwd import (clearance, day_bucket, day_predictions, day_range_model, day_score, estimated_month,
                         score_months, DAY_RANGE_MIN)

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

# ---- the day method (Oct 8 2026; DOL's working days since Oct 15) ----------
from datetime import timedelta
import datetime as _dt
from backtest_pwd import js_round, workday_pace
from ingest_pwd_status_direct import day_queue_doc, DAY_QUEUE_PACE_DAYS
from lib_db import ET as _ET

check(js_round(2.5) == 3 and js_round(3.5) == 4 and js_round(2.4) == 2, "Math.round, not Python's round to even")
t0 = date(2026, 9, 23)  # a Wednesday; the count covers Tuesday the 22nd
line = [("a", "2026-07-01"), ("b", "2026-07-01"), ("c", "2026-07-02"), ("d", "2026-07-03")]
pr = day_predictions(line, t0, 1.0)
check(pr["a"] == (date(2026, 9, 23), 1) and pr["b"] == pr["a"], "two filed the same day: each has half the day ahead, the first day DOL works")
check(pr["c"] == (date(2026, 9, 25), 3), "2.5 ahead at one a day is the third working day, Friday")
check(pr["d"] == (date(2026, 9, 28), 4), "3.5 is the fourth: Monday, past the weekend")
hol = day_predictions([("x", "2026-07-01"), ("y", "2026-07-01")], date(2026, 10, 10), 1.0)
check(hol["x"] == (date(2026, 10, 13), 1), "counted on Saturday the 10th: the next day DOL works is Tuesday, past Columbus Day")
end = date(2026, 10, 7)
pred = {"x": (date(2026, 9, 25), 2), "y": (date(2026, 9, 28), 5), "z": (date(2026, 10, 3), 10), "s": (date(2026, 9, 26), 3)}
out = {"x": date(2026, 9, 24), "y": date(2026, 10, 2), "z": date(2026, 10, 3), "s": None}
sc = day_score(pred, out, end, {0: (-3, 0)})
check(sc["judged"] == 3 and sc["decided"] == 2 and sc["stuckShare"] == round(1 / 3, 3),
      "judged once a week old: x and y decided, s still waiting, z too recent")
check(sc["typicalMissDays"] == 2.5 and sc["insideShare"] == round(1 / 3, 3), "x is inside -3..0 working days, y is 4 late")
check(sc["typicalMissWorkdays"] == 2.5 and sc["biasWorkdays"] == 1.5, "the same misses in working days")
check(day_bucket(10) == 0 and day_bucket(11) == 1 and day_bucket(500) == 4, "distance buckets, in working days")
thin = day_range_model([{0: [0] * (DAY_RANGE_MIN - 1)}])
check(thin == {}, "under the minimum, no range")
check(day_range_model([{0: list(range(-5, 6)) * 20}, {0: list(range(-5, 6)) * 20}]) == {0: (-4, 4)},
      "the middle 80% of decided errors, over two start days")
check(day_range_model([{0: list(range(-5, 6)) * 40}]) == {}, "one start day alone measures no range")

# The pace a working day: the same days and figures as dol-workdays-parity.test.ts.
counts = [800, 820, 780, 810, 400, 5, 0, 830, 860, 790, 840, 420, 3, 0, 90, 900, 880, 850, 450]
wp = workday_pace([(date(2026, 9, 28) + timedelta(days=i), n) for i, n in enumerate(counts)])
check(wp is not None and wp["workdaysUsed"] == 14 and wp["perWorkday"] == 10_528 / 14,
      "every exit, the holiday's and the weekends' too, over the 14 working days")
check(wp is not None and abs(wp["fast"] - 773.1973154362416) < 1e-9 and abs(wp["slow"] - 706.5771812080537) < 1e-9,
      "the fastest and slowest five-working-day stretches, as the site measures them")
check(workday_pace([(date(2026, 9, 28) + timedelta(days=i), 800) for i in range(9)]) is None,
      "under ten working days, no pace")
from lib_holidays import is_dol_workday as _work
shut = [(d, 800 if _work(d) and not (date(2026, 10, 5) <= d <= date(2026, 10, 9)) else 0)
        for d in (date(2026, 9, 28) + timedelta(days=i) for i in range(28))]
sp = workday_pace(shut)
check(sp is not None and sp["perWorkday"] == 800 and sp["workdaysUsed"] == 14,
      "a week of dead working days (a shutdown) is left out, not averaged in")

today = date(2026, 10, 8)
ms = lambda d, h=6: int(_dt.datetime(d.year, d.month, d.day, h, tzinfo=_ET).timestamp() * 1000)
exits = [("e1", ms(date(2026, 10, 7))), ("e1", ms(date(2026, 10, 7), 9)), ("e2", ms(date(2026, 10, 6))),
         ("e3", ms(today)), ("e4", ms(date(2026, 9, 1))), ("e5", ms(today, 14))]
doc = day_queue_doc([("2026-07-01", 3), ("2026-07-02", "2"), (None, 9)], exits, today)
filed_doc = day_queue_doc([("2026-07-01", 3)], exits, today, [("2026-07-02", "5"), ("2026-07-01", 4), (None, 2)])
check(filed_doc["filedByDay"] == [["2026-07-01", 4], ["2026-07-02", 5]],
      "filedByDay: every day's filings, sorted, numbers not strings, no undated row")
check(day_queue_doc([("2026-07-01", 3)], exits, today)["filedByDay"] == [], "filedByDay: empty when not asked")
check(doc["byDay"] == [["2026-07-01", 3], ["2026-07-02", 2]] and doc["inProcess"] == 5, "in process by filing day, a missing day dropped")
check(doc["clock"] == "dol", "the doc says its days are DOL's")
dd = {x["date"]: x["n"] for x in doc["days"]}
check(dd.get("2026-10-06") == 1, "a case that left twice counts once, on the day before the morning it was seen")
check(dd.get("2026-10-05") == 1 and dd.get("2026-10-07") == 1, "each morning's reading is the day before's")
check("2026-10-08" not in dd, "today, seen in the afternoon and still filling in, is left out")
check(len(doc["days"]) <= DAY_QUEUE_PACE_DAYS and min(dd) >= "2026-09-10", "only the 28 complete days before today")
# What DOL did each day, the RFIs it asked, and the status mix (Oct 31 2026).
kexits = [("k1", ms(date(2026, 10, 7)), "DETERMINATION ISSUED"), ("k2", ms(date(2026, 10, 7)), "WITHDRAWN"),
          ("k3", ms(date(2026, 10, 7)), "RETURNED UNPROCESSED"), ("k1", ms(date(2026, 10, 7), 9), "WITHDRAWN")]
kdoc = day_queue_doc([("2026-07-01", 3)], kexits, today,
                     rfi_rows=[("r1", ms(date(2026, 10, 7))), ("r1", ms(date(2026, 10, 7), 9)), ("r2", ms(date(2026, 10, 7)))],
                     mix_rows=[("IN PROCESS", "7"), ("DETERMINATION ISSUED", 12), ("withdrawn", 1), (None, 3)])
kd = {x["date"]: x for x in kdoc["days"]}["2026-10-06"]
check(kd["n"] == 3 and kd["issued"] == 1 and kd["withdrawn"] == 1 and kd["other"] == 1,
      "each day's exits split by what DOL did, a case counted once on its first exit")
check(kd["rfi"] == 2, "RFIs a day: each request once")
check(kdoc["mix"]["byStatus"] == {"DETERMINATION ISSUED": 12, "IN PROCESS": 7, "WITHDRAWN": 1},
      "the status mix: upper-case words, numbers, biggest first, no blank status")
check("mix" not in doc and all(x.get("issued", 0) == 0 or x["n"] for x in doc["days"]),
      "two-value exit rows still work, and no mix without its rows")
check(dd.get("2026-09-15") == 0, "a day with no exits is a zero, not a gap")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
