#!/usr/bin/env python3
"""Backtest the queue-pace predictor against cases whose outcome we already know.

    python3 scripts/backtest_pace.py [--target 0.90]

WHY THIS EXISTS. Every competitor in this space publishes a completion
estimate, and the whole field - us included - computes it as

    days_remaining = pending / recent_pace

Nobody publishes an error bar earned against outcomes. This does, using the
373,939 decided cases in `perm_cases`: for a filing cohort, take the point at
which it was 25% and 50% decided, predict forward from what was knowable THEN,
and compare against when the cohort actually reached the target.

WHAT THE FIRST RUN ESTABLISHED (2026-08-27, 40 pairs):

  * Pace-estimator choice barely matters. 7d-calendar (permtrack's shape),
    28d-working (ours), 56d, 90d, mean vs median - all land at median 6-9d,
    mean 26d, 85% within 30 days. A claim that one is meaningfully better
    than another is not supported.
  * The error is a TAIL, not a level. Mean 26d against median 6d. All six
    misses over 40 days UNDER-predict, and the worst have tiny pending counts
    (388 cases still taking 250 days).
  * The mechanism, measured over 18 matured cohorts: a cohort takes ~26 days
    to go from 10% to 90% decided, then another ~46 to reach 99%. The last
    few percent take longer than the entire bulk, because they are audits,
    RFIs and appeals - a different process with a different clock, not a slow
    version of the same one.

So `pending / pace` is structurally biased near completion, and the fix is a
two-regime estimate rather than a better average. That is a modelling change
this script exists to measure.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

MIN_COHORT = 500          # below this a cohort is a tail, not a population
OBSERVE_AT = (0.25, 0.50)


def rows(db: Turso, sql: str) -> list[list]:
    r = db.execute(sql)["response"]["result"]
    return [[None if c["type"] == "null" else c["value"] for c in x] for x in r["rows"]]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--target", type=float, default=0.90,
                    help="Completion fraction to predict to (default 0.90).")
    ap.add_argument("--from-month", default="2024-01")
    ap.add_argument("--to-month", default="2026-01")
    args = ap.parse_args()

    db = Turso()
    by_month: dict[str, list] = collections.defaultdict(list)
    for m, d, n in rows(db, """
            SELECT substr(received_date,1,7), substr(decision_date,1,10), count(*)
              FROM perm_cases
             WHERE received_date IS NOT NULL AND decision_date IS NOT NULL
               AND received_date <> '' AND decision_date <> ''
             GROUP BY 1, 2"""):
        by_month[m].append((d, int(n)))
    # One source, deliberately - see the note in backtest_models.py. The
    # unfiltered form summed `dol-disclosure` and the retired `permtrack`
    # series together on 88 overlapping dates, roughly doubling the measured
    # pace across Dec 2025 - Mar 2026, which is inside this backtest's window.
    daily = {d: int(n) for d, n in rows(db,
        "SELECT date, sum(total) FROM daily_decisions "
        "WHERE source = 'dol-disclosure' GROUP BY date")}
    print(f"cohorts {len(by_month)}   daily-decision days {len(daily):,}")

    day = dt.date.fromisoformat

    def pace(t: dt.date, window: int, nonzero: bool) -> float | None:
        lo = t - dt.timedelta(days=window)
        v = [x for d, x in daily.items() if lo < day(d) <= t and (x > 0 or not nonzero)]
        return sum(v) / len(v) if v else None

    variants = {
        "7d calendar (permtrack)": lambda t: pace(t, 7, False),
        "28d working (ours)":      lambda t: pace(t, 28, True),
        "56d working":             lambda t: pace(t, 56, True),
        "90d working":             lambda t: pace(t, 90, True),
    }
    errs: dict[str, list[float]] = collections.defaultdict(list)
    pairs = 0

    for m, series in sorted(by_month.items()):
        if not (args.from_month <= m <= args.to_month):
            continue
        series.sort()
        total = sum(n for _, n in series)
        if total < MIN_COHORT:
            continue
        cum, run = [], 0
        for d, n in series:
            run += n
            cum.append((day(d), run))
        hit = next((d for d, c in cum if c >= total * args.target), None)
        if not hit:
            continue
        for frac in OBSERVE_AT:
            obs = next((d for d, c in cum if c >= total * frac), None)
            if not obs or obs >= hit:
                continue
            pending = total - next(c for d, c in cum if d == obs)
            actual = (hit - obs).days
            pairs += 1
            for name, fn in variants.items():
                p = fn(obs)
                if p:
                    errs[name].append(abs(pending / p - actual))

    if pairs == 0:
        raise SystemExit("FATAL: no (cohort, observation) pairs. Refusing to report.")

    print(f"\n{pairs} pairs, target {args.target:.0%}\n")
    print(f"{'pace estimator':26s} {'median':>8s} {'mean':>7s} {'p90':>7s} {'<=30d':>7s}")
    for name, e in sorted(errs.items(), key=lambda kv: statistics.median(kv[1])):
        s = sorted(e)
        p90 = s[max(0, int(len(s) * 0.9) - 1)]
        print(f"{name:26s} {statistics.median(s):>7.0f}d {statistics.mean(s):>6.0f}d "
              f"{p90:>6.0f}d {sum(1 for x in s if x <= 30)/len(s)*100:>6.0f}%")

    # The decile curve is the finding that actually matters, so print it too.
    print("\ncohort decile timing (matured cohorts, from each cohort's own 10% point)")
    spans: dict[int, list[int]] = {p: [] for p in (25, 50, 75, 90, 95, 99)}
    for m, series in by_month.items():
        if not ("2024-01" <= m <= "2025-06"):
            continue
        total = sum(n for _, n in series)
        if total < 2000:
            continue
        cum, run = [], 0
        for d, n in sorted(series):
            run += n
            cum.append((day(d), run))
        base = next((d for d, c in cum if c >= total * 0.10), None)
        if not base:
            continue
        for p in spans:
            h = next((d for d, c in cum if c >= total * p / 100), None)
            if h:
                spans[p].append((h - base).days)
    prev = 0.0
    for p in (25, 50, 75, 90, 95, 99):
        if spans[p]:
            med = statistics.median(spans[p])
            print(f"  to {p:>2}% decided: {med:>5.0f}d  (+{med-prev:>4.0f})")
            prev = med
    print(f"  n = {len(spans[50])} cohorts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
