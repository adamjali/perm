#!/usr/bin/env python3
"""Gates for the standing estimator backtest. No network: pure functions only."""
from __future__ import annotations
import pathlib, sys
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from datetime import datetime, timedelta
from backtest_queue import (ET, HORIZON_BUCKETS, MAX_BAND_DAYS, ATTORNEY_SLOW_DAYS, bound_range, rfi_clock, rfi_dates, survival_pct, RANGE_MIN_DECIDED, RANGE_ORIGINS_KEPT, Record, band, coverage,
                            days_in_month, is_final_status, near_set, passed_section, predict, range_model,
                            range_samples, rival_c, score, score_floor, served_coverage, served_range,
                            straggler_rate)

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
check(p["today"]["cases"] == 4 and p["today"]["missAtLeastDays"] == 7.5,
      "answering 'today' is scored on the same cases, the waiting one at its days late")
check(p["rate"]["missAtLeastDays"] < p["today"]["missAtLeastDays"], "the rate beats 'today' here")

# ---- the record read once, rebuilt for any start day (Oct 8 2026) ----------
def ms(d: date, hour: int = 12) -> int:
    return int(datetime(d.year, d.month, d.day, hour, tzinfo=ET).timestamp() * 1000)

T0 = date(2026, 9, 16)
status = [
    ("cert", "2025-11-03", "CERTIFIED", 1, "AC"),        # decided after T0
    ("exp", "2024-01-05", "CERTIFIED - EXPIRED", 1, "BE"),  # certified before T0, lapsed after it
    ("new", "2026-09-20", "ANALYST REVIEW", 0, "CO"),    # filed after T0
    ("rfi", "2025-10-01", "RFI ISSUED", 0, "DE"),        # moved to RFI before T0, still there
    ("back", "2025-10-02", "ANALYST REVIEW", 0, "\"EF"),  # in RFI on T0, back in line after it
    ("wd", "2025-11-04", "WITHDRAWN", 1, "ZZ"),          # withdrawn after T0
    ("old", "2014-06-01", "ANALYST REVIEW", 0, "AA"),    # before the record's floor
]
events = [
    ("cert", "ANALYST REVIEW", "CERTIFIED", 1, ms(date(2026, 9, 25))),
    ("exp", "CERTIFIED", "CERTIFIED - EXPIRED", 1, ms(date(2026, 9, 20))),
    ("rfi", "ANALYST REVIEW", "RFI ISSUED", 0, ms(date(2026, 9, 10))),
    ("back", "RFI ISSUED", "ANALYST REVIEW", 0, ms(date(2026, 9, 22))),
    ("wd", "ANALYST REVIEW", "WITHDRAWN", 1, ms(date(2026, 9, 30))),
]
rec = Record(status, list(reversed(events)))  # arrival order must not matter
got, dec, how = rec.at(T0)
by = {x["cn"]: x for x in got}
check(set(by) == {"cert", "rfi", "back", "wd"}, "pending on T0: not the lapsed one, the later filing or pre-2015")
check(by["cert"]["st0"] == "ANALYST REVIEW" and by["back"]["st0"] == "RFI ISSUED",
      "the status on T0 is the first move after T0's FROM, else the current status")
check(by["rfi"]["st0"] == "RFI ISSUED", "a move before T0 leaves the current status as the T0 status")
check(dec == {"cert": date(2026, 9, 25), "wd": date(2026, 9, 30)}, "decided: first final move from a pending status")
check(how == {"cert": "CERTIFIED", "wd": "WITHDRAWN"}, "and what it went to")
check(by["back"]["l"] == "E", "the employer's initial skips a leading quote")
got2, dec2, _ = rec.at(date(2026, 9, 26))
check("cert" not in {x["cn"] for x in got2} and "cert" not in dec2, "a case decided before a later T0 is not pending then")

# ---- the measured range ----------------------------------------------------
END = date(2026, 10, 7)
pred = {"a": date(2026, 9, 20), "b": date(2026, 9, 21), "w": date(2026, 9, 22),
        "s": date(2026, 9, 23), "far": date(2026, 11, 30), "fresh": date(2026, 10, 3)}
decided = {"a": date(2026, 9, 18), "b": date(2026, 9, 27), "w": date(2026, 9, 22)}
how = {"a": "CERTIFIED", "b": "DENIED", "w": "WITHDRAWN"}
smp = range_samples(pred, decided, how, T0, END)
near = smp[0]
check(near["judged"] == 3 and sorted(near["errors"]) == [-2, 6] and near["stuck"] == 1,
      "near bucket: a and b decided, s still waiting, the withdrawal and the fresh date not judged")
check(sum(b["judged"] for b in smp[1:]) == 0, "a date too recent to judge is in no bucket")

def fake(errs, judged=None, stuck=0, bucket=0):
    out = [{"errors": [], "stuck": 0, "judged": 0} for _ in HORIZON_BUCKETS]
    out[bucket] = {"errors": errs, "stuck": stuck, "judged": judged if judged is not None else len(errs) + stuck}
    return out

thin = range_model([fake([0] * (RANGE_MIN_DECIDED - 1))])
check(not thin[0]["measured"] and "earlyDays" not in thin[0], "under the minimum, no measured range")
errs = list(range(-10, 11)) * 20  # 420 errors, -10..+10
m = range_model([fake(errs, stuck=60)])
check(m[0]["measured"] and m[0]["earlyDays"] == -8 and m[0]["lateDays"] == 8, "the middle 80% of decided errors")
check(m[0]["stuckShare"] == round(60 / 480, 3), "the share still waiting is kept beside it")
check(m[0]["insideShare"] == round(17 * 20 / 480, 3), "inside share on its own cases: decided inside over all judged")
early = range_model([fake([3] * 400)])
check(early[0]["earlyDays"] == 0 and early[0]["lateDays"] == 3, "the range always contains the date")
old_runs = [fake([-50] * 400) for _ in range(3)]
newer = [fake([1] * 400) for _ in range(RANGE_ORIGINS_KEPT)]
skip = [fake([], bucket=3)] * RANGE_ORIGINS_KEPT  # judged nothing near: must not push the newer runs out
mm = range_model(old_runs + newer + skip)
check(mm[0]["earlyDays"] == 0 and mm[0]["lateDays"] == 1,
      "each bucket reads the newest start days that judged it, not every start day")

p = date(2026, 9, 18)
lo, hi = served_range(T0, p, 2000, 600.0, (550.0, 650.0), m)
check(lo == date(2026, 9, 17) and hi == date(2026, 9, 26), "measured: date +8, early clipped to the day after T0")
fb = served_range(T0, p, 2000, 600.0, (550.0, 650.0), thin)
check(fb == band(T0, 2000, 600.0, 550.0, 650.0), "unmeasured: the fixed rule")
check(served_range(T0, p, 2000, 600.0, None, thin) is None, "no spread and no measurement: no range")

cov = served_coverage({"a": (date(2026, 9, 17), date(2026, 9, 22)), "b": (date(2026, 9, 18), date(2026, 9, 24)),
                       "s": (date(2026, 9, 20), date(2026, 9, 25)), "w": (date(2026, 9, 20), date(2026, 9, 24))},
                      pred, decided, how, END)
check(cov == {"judged": 3, "insideShare": round(1 / 3, 3), "stuckShare": round(1 / 3, 3)},
      "served coverage: a inside, b outside, s waiting, the withdrawal left out")

# ---- rival C: month order, then A to Z, every pending case, 616 a day -------
rc_cases = ([{"cn": f"o{i}", "m": "2025-10", "l": "M"} for i in range(1232)]
            + [{"cn": "nA", "m": "2025-11", "l": "A"}, {"cn": "nZ", "m": "2025-11", "l": "Z"}])
rc = rival_c(rc_cases, T0, {"nA", "nZ", "o0"})
check(set(rc) == {"nA", "nZ", "o0"}, "rival C dates only the chosen cases")
check(rc["nA"] == T0 + timedelta(days=2) and rc["nZ"] == T0 + timedelta(days=2),
      "1,232 ahead at 616 a day is two days, under either initial")
check(rc["o0"] == T0 + timedelta(days=1), "inside a month, half of its own letter is ahead")

# ---- no range is wider than MAX_BAND_DAYS (Oct 8 2026) -----------------------
check(bound_range(138, 100, 214, 1) == (118, 178), "a 114-day range is cut to 60: 20 before the date, 40 after")
check(bound_range(10, 4, 23, 1) == (4, 23), "a range under the cap is left alone")
check(bound_range(5, -3, 70, 1) == (1, 61), "the early end never opens before the day after T0, and the cap still holds")
far = band(T0, 138 * 600, 600.0, 700.0, 450.0)
check((far[1] - far[0]).days <= MAX_BAND_DAYS, "the pace rule's far range is bounded like the site's")

# ---- the RFI clock (Oct 8 2026) ------------------------------------------------
asof = date(2026, 10, 8)
start = date(2026, 8, 28)
follow = []
for i in range(300):
    ent = start + timedelta(days=i % 3)
    left = ent + timedelta(days=31) if ent + timedelta(days=31) <= asof else None
    dec = left + timedelta(days=4 + (i % 3)) if left and left + timedelta(days=4 + (i % 3)) <= asof else None
    follow.append({"cn": f"r{i}", "entered": ent, "left": left, "leftTo": "ANALYST REVIEW" if left else None,
                   "decided": dec, "decidedTo": "CERTIFIED" if dec else None})
check(survival_pct([(start, start + timedelta(days=5))] * 60, asof, 50) == 5, "the day half the watched starts had ended")
check(survival_pct([(start, None)] * 10, asof, 50) is None, "too few watched: no reading")
clk = rfi_clock(follow, asof)
check(clk and clk["leaveDays"]["p50"] == 31, "cases leave RFI on day 31 of our record")
check(clk and clk["afterLeaveDays"]["p50"] in (4, 5), "decided a few days after leaving")
check(clk and clk["slowEndFrom"] == "measured" and clk["slowEndDays"] == clk["afterLeaveDays"]["p90"],
      "with enough watched long enough, the slow end is the record's own 90th percentile")
thin = dict(clk, afterLeaveDays=dict(clk["afterLeaveDays"], p90=None), slowEndDays=ATTORNEY_SLOW_DAYS)
lo, day, hi = rfi_dates(date(2026, 10, 1), clk)
check(lo <= day <= hi and (day - date(2026, 10, 1)).days == 31 + clk["afterLeaveDays"]["p50"], "the date is RFI day + the two medians")
lo2, _, hi2 = rfi_dates(date(2026, 10, 1), thin)
check((hi2 - date(2026, 10, 1)).days == 31 + ATTORNEY_SLOW_DAYS, "unmeasured, the late end is the 30 days plus the attorney's two weeks")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
