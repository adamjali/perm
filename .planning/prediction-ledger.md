# Prediction ledger

Estimates the product made for real cases, written down BEFORE the outcome so
they can be scored honestly afterwards. Score each entry when DOL decides the
case: actual decision date, error in days against the anchor, and whether the
window contained it. Public facts only (case numbers are public federal
records; never a subscriber's email).

| recorded | case number | filed | status at prediction | anchor | window | actual decision | error |
|---|---|---|---|---|---|---|---|
| 2026-08-28 | G-100-25324-425560 | 2025-11-20 (decoded) | pending | Around November 2026 | September 2026 to November 2026 | — | — |

Notes:
- G-100-25324-425560: the product's first real alert subscriber's case. The
  estimate above is what /perm-case-status showed on 2026-08-28 (anchor =
  lead model's date, window = the model envelope). The case-status alert on
  this case will tell us the decision the day it lands; score this row then.

### Amendment 2026-08-29 — the model changed after this prediction was recorded

The prediction of record for **G-100-25324-425560** stands unchanged: *"Around
November 2026 / likely decision window September to November 2026"*, recorded
2026-08-28.

What changed the next day is the model behind it, and that is logged here so
the eventual score is not quietly contaminated by a mid-flight edit:

- `estimateQueueDecision` now applies a measured employer-initial shift. This
  case's employer begins with T, worth **+2 days**. The live page reads
  *"Around November 29, 2026"*.
- The case page now leads with the anchor rather than the range.

**+2 days does not move this prediction out of its recorded window**, so the
original entry is still the thing to score. If a future amendment ever WOULD
move a prediction across its own stated bounds, the honest move is a new dated
entry, not an edit to the old one - a ledger that rewrites its own predictions
scores nothing.

## 13 September 2026 - the decision-pace model's first four

The model became the lead on this date: cases ahead from the live census
divided by DOL's measured pace (625 a calendar day over the last 28 observed
days), band from that rate's own p10/p90 spread. Recorded across four filing
months on purpose, because a model only ever scored near the frontier is never
tested at the horizon where it can be most wrong.

| case | filed | anchor | window |
|---|---|---|---|
| G-300-25324-425356 | 2025-11-20 | 27 Sep 2026 | 25 Sep - 3 Oct 2026 |
| G-200-26015-564165 | 2026-01-15 | 2 Nov 2026 | 23 Oct - 20 Nov 2026 |
| G-200-26075-707139 | 2026-03-16 | 25 Nov 2026 | 12 Nov - 22 Dec 2026 |
| G-300-26166-017385 | 2026-06-15 | 1 Jan 2027 | 11 Dec 2026 - 10 Feb 2027 |

permupdate, queried the same day for the same filing dates, sat 6 to 16 days
earlier throughout. The residual is almost entirely their divisor: they use a
hardcoded 650/day, our measured figure is 625, and their own published
`daily-volume` feed averages 566.

**What a miss would mean.** The band is a pace scenario with measured coverage
of 57-58%, so roughly two of these four landing outside their window is the
EXPECTED outcome, not a failure. What would be a real signal is a consistent
direction - all four late, or all four early - because that is the divisor or
the cases-ahead count being wrong rather than the pace varying.
