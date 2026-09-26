# The estimate scorecard: what went wrong, measured (Sat Sep 26 2026)

Applied in the Sep 26 2026 build: the estimator now counts analyst-review cases only and no longer
applies the employer-letter shift. The standing version of this test is `scripts/backtest_queue.py`.

## The five recorded predictions

| Recorded | Case (filed) | Model | Our anchor, window | Rivals | Decided | Our miss |
|---|---|---|---|---|---|---|
| Aug 28 | G-100-25324-425560 (Nov 20 2025), employer initial T | queue advance (old lead) | "Around November 2026", Sep 1-Nov 30 | not recorded | Sep 17 | 71 d late, inside its 3-month window |
| Sep 13 | G-300-25324-425356 (Nov 20 2025), initial U | decision pace (current lead) | Oct 2, Sep 30-Oct 8 | Sep 19, Sep 20 | Sep 17 | **15 d late, outside the window**; rivals 2-3 d late |
| Sep 13 | G-200-26015-564165 (Jan 15 2026) | decision pace | Nov 10, Oct 31-Nov 28 | Oct 17, Oct 26 | pending | |
| Sep 13 | G-200-26075-707139 (Mar 16 2026) | decision pace | Nov 15, Nov 2-Dec 12 | Nov 6, Nov 17 | pending | |
| Sep 13 | G-300-26166-017385 (Jun 15 2026) | decision pace | Dec 21, Nov 30-Jan 30 | Dec 9, Dec 23 | pending | |

The page's "median miss 43 days" is the median of those two misses from two different models, so
it describes neither.

## The test: 7,112 real outcomes instead of 2

The queue as it stood on Sep 13 was rebuilt from the case table and the event log (96,916
pending). Every November-December 2025 case in analyst review that day (21,431) was predicted
four ways, at the model's own 625 decisions a day; DOL actually decided 621 a day over Sep 13-25.

| Way of counting "ahead of you" | Median error (decided) | Typical miss | Right about "decided by Sep 25" |
|---|---|---|---|
| A. ours: every pending case, spread by filing day | +9 d late | 9.5 d | 73% |
| **B. ours, counting only the normal analyst-review queue** | **+3 d** | **3.9 d** | **86%** |
| C. DOL's order, month then employer A-Z (what rivals use) | +9 d | 9.7 d | 76% |
| D. DOL's order, analyst review only | +3 d | 5.6 d | 86% |

**Why we were late:** the model counts every pending case filed before yours as ahead of you,
including about 5,700 sitting on hold, at RFI, on appeal or at NORD. Those are not in the line, and
counting them adds roughly a week. Taking them out cuts the typical miss by 60%. The pace (625 vs
621) was right. The A-Z order did not help at the frontier: both scorecard cases belonged to "T" and
"U" employers and were decided early.

This settles the open question in `v2/CLAUDE.md` ("the ledger is the instrument that settles it:
if they land late, the count is too big and the side-queue should come out"): they landed late,
and the side queue should come out.

## Retraction, and the letter shift (second run, `backtest2.py`)

The first version of this file said the rebuilt Sep 13 queue was "~3,000 cases smaller" than what the
model saw. **That was wrong.** The live model adds a letter shift from the historical A-Z table on top
of the count (`queueEstimate.ts` ~line 740; "U" = +5.2 d). With it, the rebuild predicts **Oct 3** for
the missed case, matching the recorded **Oct 2**. The count alone said Sep 27; the letter did the rest.

| Method (same 21,431 cases, 7,112 decided) | Late by | Typical miss | Right on "decided by Sep 25" |
|---|---|---|---|
| ours today: all pending + letter shift | +9 d | 10.1 d | 74% |
| ours, count only | +9 d | 9.5 d | 73% |
| **fix: normal queue only, no letter shift** | **+3 d** | **3.9 d** | **86%** |
| fix + letter shift | +3 d | 6.5 d | 73% |
| rival A's method (all pending x 0.897, 644/day) | +7 d | 7.4 d | 80% |
| rival B's method (all pending, 650/day) | +9 d | 8.8 d | 73% |
| rival C's method (month then A-Z, 616/day) | +9 d | 10.1 d | 75% |

The competitor rows imitate each site's published method on our data; they are not their real
outputs. The one real comparison: the missed case, where the fix says Sep 21 and the rivals said Sep
19 and 20 (decided Sep 17).

**DOL is not working the frontier A to Z.** Of November 2025's normal-queue cases on Sep 13, about
80% were decided by Sep 25 whatever the employer's initial (U 89%, Z 93%). The two low letters are
single employers: G is Grayco Management (190 still in analyst review), J is JPMorgan Chase (41 at RFI).

## Caveats

- Only 12 days of outcomes, and only the frontier months. Farther horizons are not tested here.
- Error on the decided set favours early decisions; the "decided by Sep 25" column is the
  survivorship-free check, and it agrees.
- The band was not re-tested; its measured coverage near the frontier was already 41%.

## What was applied (Sep 26 2026 build)

1. Count only analyst-review cases as ahead (census rows already carry the status).
2. Keep the filing-day spread, and drop the letter shift from dates (it adds error: 3.9 -> 6.5 d).
3. Show the scorecard's miss per model, not one blended median.
4. Keep this backtest as a standing test: rebuild the queue at a past date and score thousands
   of real outcomes, instead of waiting on five hand-picked cases.
