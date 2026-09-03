#!/usr/bin/env python3
"""Head-to-head backtest: every PERM completion model, ours and the field's.

    python3 scripts/backtest_models.py

WHAT THIS ANSWERS. Every tool in this space publishes a "when will my case be
decided" number and none publishes an error bar. This measures all of them
against outcomes we already hold, on identical inputs.

METHOD, and the parts that matter:

  * Ground truth is `perm_cases`: for a filing cohort, the date it actually
    reached its own median decision.
  * Predictions are made from what was knowable at an OBSERVATION POINT
    (25%/35%/50%/65% of the cohort decided) - never from the future.
  * The shape-corrected model is validated LEAVE-ONE-OUT: the cohort being
    predicted is excluded from the cohorts its shape is learned from. An
    earlier in-sample run reported a 4x improvement that shrank to ~1 day
    once the leakage was removed, which is the whole reason this is here.

THE HARD LIMIT: the disclosure corpus spans 2023-10 to 2026-06, and a cohort
must be matured to have a knowable median. That caps the sample near TWENTY
cohorts no matter how many variants are tried. Differences under a day or two
between models are not resolvable at that n, and this script says so rather
than ranking noise.
"""
from __future__ import annotations

import collections
import datetime as dt
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

MIN_COHORT = 500

# A COHORT WHOSE MEDIAN IS ABSURDLY SHORT HAS NOT MATURED, IT HAS BEEN
# WITHDRAWN INTO. The 2025-09 and 2025-11 cohorts reach "50% decided" at 59
# and 17 days from filing, which is not a processing time - it is instant
# withdrawals clearing while the October 2025 OFLC shutdown stopped
# adjudication. Scoring a completion model against those numbers measures
# nothing about the model, and including them made every model look worse by
# the same ~50 days while adding no information.
#
# DOL has never decided a real PERM cohort's median inside 200 days in this
# corpus; the fastest genuine one is 375.
MIN_PLAUSIBLE_MEDIAN_DAYS = 200
OBSERVE_AT = (0.25, 0.35, 0.50, 0.65)
day = dt.date.fromisoformat


def load(db: Turso):
    r = db.execute("""SELECT substr(received_date,1,7), substr(decision_date,1,10), count(*)
                        FROM perm_cases
                       WHERE received_date IS NOT NULL AND decision_date IS NOT NULL
                         AND received_date <> '' AND decision_date <> ''
                       GROUP BY 1,2""")["response"]["result"]["rows"]
    bym = collections.defaultdict(list)
    for x in r:
        v = [None if c["type"] == "null" else c["value"] for c in x]
        bym[v[0]].append((v[1], int(v[2])))
    # PINNED TO ONE SOURCE. `daily_decisions` is keyed (date, source) and the
    # sources are not interchangeable: `dol-disclosure` is dated by DOL's own
    # decision date, `sweep-observed` by when our sweep saw the change. An
    # unfiltered `sum(total) GROUP BY date` adds whichever ones overlap - and
    # it already did: the retired `permtrack` series covered 88 of these dates
    # and injected 42,056 phantom decisions into this backtest's pace curve
    # (measured 2026-09-03, before those rows were deleted). This model is
    # backtested against DOL's own dating, so that is the series it reads.
    d = db.execute("SELECT date, sum(total) FROM daily_decisions "
                   "WHERE source = 'dol-disclosure' "
                   "GROUP BY date")["response"]["result"]["rows"]
    daily = {x[0]["value"]: int(x[1]["value"]) for x in d}
    return {m: sorted(v) for m, v in bym.items()}, daily


def curve(series):
    """(cumulative decisions by date, total)."""
    total = sum(n for _, n in series)
    cum, run = [], 0
    for dd, n in series:
        run += n
        cum.append((day(dd), run))
    return cum, total


def pctile_day(cum, total, p):
    return next((dd for dd, c in cum if c >= total * p / 100), None)


def shape_from(cohorts, bym):
    """Percentile -> factor of that cohort's own median. Learned, not assumed."""
    acc = collections.defaultdict(list)
    for m in cohorts:
        cum, total = curve(bym[m])
        filed = dt.date(int(m[:4]), int(m[5:7]), 15)
        med = pctile_day(cum, total, 50)
        if not med:
            continue
        mdays = (med - filed).days
        if mdays < MIN_PLAUSIBLE_MEDIAN_DAYS:
            continue
        for p in (5, 10, 15, 20, 25, 30, 35, 40, 45, 50):
            h = pctile_day(cum, total, p)
            if h:
                acc[p].append((h - filed).days / mdays)
    return {p: statistics.median(v) for p, v in acc.items() if len(v) >= 5}


def main() -> int:
    db = Turso()
    bym, daily = load(db)
    pool = [m for m in sorted(bym)
            if "2023-11" <= m <= "2025-12" and sum(n for _, n in bym[m]) >= MIN_COHORT]
    print(f"cohorts {len(pool)}  ({pool[0]}..{pool[-1]})   daily-decision days {len(daily):,}")
    print(f"observation points {[f'{o:.0%}' for o in OBSERVE_AT]}\n")

    def pace(t, window, nonzero):
        lo = t - dt.timedelta(days=window)
        v = [x for dd, x in daily.items() if lo < day(dd) <= t and (x > 0 or not nonzero)]
        return sum(v) / len(v) if v else None

    results = collections.defaultdict(list)
    for m in pool:
        cum, total = curve(bym[m])
        filed = dt.date(int(m[:4]), int(m[5:7]), 15)
        truth_day = pctile_day(cum, total, 50)
        if not truth_day:
            continue
        truth = (truth_day - filed).days
        if truth < MIN_PLAUSIBLE_MEDIAN_DAYS:
            continue
        # LEAVE-ONE-OUT: this cohort is never in its own training set.
        shape = shape_from([x for x in pool if x != m], bym)

        for frac in OBSERVE_AT:
            obs = pctile_day(cum, total, frac * 100)
            if not obs or obs >= truth_day:
                continue
            decided_n = next(c for dd, c in cum if dd == obs)
            pending = total - decided_n
            exp = []
            for dd, n in bym[m]:
                if dd <= obs.isoformat():
                    exp += [(day(dd) - filed).days] * n
            if len(exp) < 50:
                continue
            raw_med = statistics.median(exp)

            preds: dict[str, float | None] = {}
            # --- the field: pending / pace, in each of its shipped windows ---
            for lbl, w, nz in (("permtrack 7d cal", 7, False),
                               ("permupdate 21d", 21, True),
                               ("permqueue 28d", 28, True),
                               ("56d working", 56, True)):
                p = pace(obs, w, nz)
                preds[lbl] = ((obs - filed).days + pending / p) if p else None
            # --- ours ---
            preds["ours: raw cohort median"] = raw_med
            k = max(5, min(50, frac * 100 / 2))
            kk = min(shape, key=lambda z: abs(z - k)) if shape else None
            preds["ours: shape-corrected"] = (raw_med / shape[kk]) if kk and frac >= 0.25 else None
            # --- a naive control: whatever the last matured cohort took ---
            prev = [x for x in pool if x < m]
            if prev:
                pc, pt = curve(bym[prev[-1]])
                pf = dt.date(int(prev[-1][:4]), int(prev[-1][5:7]), 15)
                pd_ = pctile_day(pc, pt, 50)
                preds["control: last cohort's median"] = (pd_ - pf).days if pd_ else None

            for lbl, v in preds.items():
                if v is not None:
                    results[(lbl, frac)].append(abs(v - truth))

    print(f"{'model':30s} {'obs@':>5s} {'n':>3s} {'median':>7s} {'mean':>6s} {'p90':>6s} {'<=14d':>6s}")
    print("-" * 72)
    order = ["ours: shape-corrected", "ours: raw cohort median", "56d working",
             "permqueue 28d", "permupdate 21d", "permtrack 7d cal",
             "control: last cohort's median"]
    for frac in OBSERVE_AT:
        for lbl in order:
            e = results.get((lbl, frac))
            if not e:
                continue
            s = sorted(e)
            p90 = s[max(0, int(len(s) * 0.9) - 1)]
            print(f"{lbl:30s} {frac:>4.0%} {len(s):>3} {statistics.median(s):>6.1f}d "
                  f"{statistics.mean(s):>5.1f}d {p90:>5.1f}d "
                  f"{sum(1 for x in s if x <= 14)/len(s)*100:>5.0f}%")
        print()

    n = len(results.get(("ours: shape-corrected", 0.25), []))
    print(f"SAMPLE: at most {len(pool)} cohorts; {n} at the 25% point. Differences under")
    print("a day or two are not resolvable at this n and should not be ranked.\n")

    # ------------------------------------------------------------------
    # WALK-FORWARD: the only validation that matches production
    # ------------------------------------------------------------------
    # Leave-one-out lets a cohort learn its shape from cohorts that came
    # AFTER it. In production you only ever have the past, so LOO flatters
    # the model. This walks time forward: predict each cohort using a shape
    # fitted only on months that had already matured when it was observed.
    # It is the honest number, and it weights recent cohorts naturally
    # because they are the ones with the most history behind them.
    print("=" * 72)
    print("WALK-FORWARD (shape fitted only on PRIOR cohorts) — production-realistic")
    print("=" * 72)
    wf = collections.defaultdict(list)
    per_cohort = []
    for i, m in enumerate(pool):
        prior = pool[:i]
        if len(prior) < 6:          # need a shape worth having
            continue
        shape = shape_from(prior, bym)
        if not shape:
            continue
        cum, total = curve(bym[m])
        filed = dt.date(int(m[:4]), int(m[5:7]), 15)
        td = pctile_day(cum, total, 50)
        if not td:
            continue
        truth = (td - filed).days
        if truth < MIN_PLAUSIBLE_MEDIAN_DAYS:
            continue
        obs = pctile_day(cum, total, 25)
        if not obs or obs >= td:
            continue
        pending = total - next(c for dd, c in cum if dd == obs)
        exp = []
        for dd, n in bym[m]:
            if dd <= obs.isoformat():
                exp += [(day(dd) - filed).days] * n
        if len(exp) < 50:
            continue
        raw_med = statistics.median(exp)
        kk = min(shape, key=lambda z: abs(z - 12.5))
        ours = raw_med / shape[kk]
        p28 = pace(obs, 28, True)
        theirs = ((obs - filed).days + pending / p28) if p28 else None
        wf["ours: shape-corrected"].append(abs(ours - truth))
        wf["ours: raw"].append(abs(raw_med - truth))
        if theirs:
            wf["field: pending/pace"].append(abs(theirs - truth))
        per_cohort.append((m, len(prior), truth, ours, raw_med, theirs))

    print(f"\n{'cohort':9s} {'trained on':>11s} {'ACTUAL':>7s} {'ours':>7s} {'err':>6s} "
          f"{'field':>7s} {'err':>6s}")
    for m, ntr, truth, ours, raw, theirs in per_cohort:
        te = f"{theirs-truth:+.0f}d" if theirs else "   —"
        tv = f"{theirs:.0f}d" if theirs else "  —"
        print(f"{m:9s} {ntr:>9} mo {truth:>6}d {ours:>6.0f}d {ours-truth:>+5.0f}d {tv:>7s} {te:>6s}")
    print()
    for lbl in ("ours: shape-corrected", "ours: raw", "field: pending/pace"):
        e = wf.get(lbl)
        if not e:
            continue
        s = sorted(e)
        print(f"  {lbl:24s} n={len(s):<3} median {statistics.median(s):>5.1f}d   "
              f"mean {statistics.mean(s):>5.1f}d   worst {max(s):>5.1f}d   "
              f"<=14d {sum(1 for x in s if x<=14)/len(s)*100:>3.0f}%")

    # DOES IT STILL HOLD ON RECENT MONTHS? The question that matters, because a
    # model fitted on an old regime can look fine in aggregate while having
    # stopped working. Reported as median AND worst: an average hides exactly
    # the failure a user would notice.
    print("\n" + "=" * 72)
    print("RECENT-WINDOW CHECK")
    print("=" * 72)
    for label, sub in (("oldest half", per_cohort[: len(per_cohort) // 2]),
                       ("MOST RECENT half", per_cohort[len(per_cohort) // 2:]),
                       ("last 5 cohorts", per_cohort[-5:])):
        if not sub:
            continue
        eo = [abs(o - t) for _, _, t, o, _, _ in sub]
        ef = [abs(f - t) for _, _, t, _, _, f in sub if f]
        print(f"\n  {label}  (n={len(sub)}, {sub[0][0]}..{sub[-1][0]})")
        print(f"      ours   median {statistics.median(eo):>5.1f}d   mean {statistics.mean(eo):>5.1f}d   "
              f"worst {max(eo):>5.1f}d")
        if ef:
            print(f"      field  median {statistics.median(ef):>5.1f}d   mean {statistics.mean(ef):>5.1f}d   "
                  f"worst {max(ef):>5.1f}d")
    return 0


if __name__ == "__main__":
    sys.exit(main())
