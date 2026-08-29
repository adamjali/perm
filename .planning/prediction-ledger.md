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
