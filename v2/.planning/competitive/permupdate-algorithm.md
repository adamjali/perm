# permupdate's estimator, decoded (13 Sep 2026)

Their prediction is not client-side. The page chunk only renders; the maths is a
POST to their own backend, which the bundle names in clear:

    POST https://perm-backend-production.up.railway.app/api/predictions/from-date
    {"submit_date":"2026-07-15","employer_first_letter":"C"}

The response carries every intermediate, so the algorithm is fully readable.

## The algorithm, verified against their own numbers

```
raw_queue_position  = cases ahead, from THEIR pending census, by submit date + letter
daily_processing_rate = 650            (weekly_processing_rate 4,552 / 7)
remaining_days      = raw_queue_position / 650
estimated_completion = today + remaining_days
upper_bound_days    = remaining_days * 1.15        <- the documented "15% buffer"
upper_bound_date    = today + upper_bound_days
confidence_level    = 0.8                          <- a CONSTANT in the payload
```

Checks: A 71,880/650 = 110.6 -> `remaining_days` 110, estimate 1 Jan 2027.
Z 79,046/650 = 121.6 -> 121, estimate 12 Jan. C: 111 remaining, upper bound 127
(111 x 1.15), giving 2 Jan and 18 Jan.

**There is no lower bound.** The band is one-sided and upward only: 16 days for
a case four months out.

**`confidence_level: 0.8` is a hardcoded field, not a computed coverage.** Our
backtest of their own documented construction puts its real coverage at 8-15%.

## The letter is decorative in the payload and small in the code

Same date, letter varied:

| letter | queue position | estimate | `employer_letter_impact` shown |
|---|---|---|---|
| A | 71,880 | 1 Jan 2027 | **-80.0** |
| C | 72,453 | 2 Jan | -67.0 |
| F | 73,313 | 3 Jan | -48.0 |
| M | 75,319 | 6 Jan | -3.0 |
| S | 77,039 | 9 Jan | +35.0 |
| W | 78,186 | 11 Jan | +61.0 |
| Z | 79,046 | 12 Jan | **+80.0** |

The date moves **11 days** across the whole alphabet. The field labelled
`employer_letter_impact` spans **160 days** and does not enter the calculation -
`estimated_days` is exactly `days_already_in_queue + remaining_days`, with no
letter term. Their "Employer's Name Initial (80% Influence)" copy matches the
decorative field, not the code. The code agrees with our own measurement that the
letter is a small positional term.

## The overdue floor

    submit_date 2023-06-05  ->  raw_queue_position 0, remaining_days 0,
                                estimated_completion_date = TODAY

Queue position floors at zero, so every case past the frontier is told its
estimated completion is today. That is why a case in BALCA appeals since June
2023 and a case certified last Thursday get the same date.

## What there is to copy: nothing

Their method is a strict subset of ours.

| step | permupdate | ours |
|---|---|---|
| queue position | yes | yes, analyst-review only |
| daily rate | 3-week average, 650 | 28-day measured, weekday/weekend split, 688 |
| bias correction | none | measured, +1d at this horizon |
| band | +15% one-sided | two-sided from the observed pace spread |
| coverage claim | `0.8` hardcoded | 56%, measured |
| refusals | none | overdue, side-queue, stale sweep, unmeasurable pace |

The one number worth reconciling is the rate: they read 650/day from weekly
volumes (their `weekly_volumes` run 4,598 and 4,296, i.e. 657 and 614 per day),
we read 688 from our own 28-day event log. We may be reading slightly high, and
that is worth a cross-check - it is the only place their answer is better
grounded than ours.

---

## After wiring our own decision-pace model (13 Sep 2026, both queried the same day)

Same filing dates, letter M, today 2026-09-13:

| filed | permupdate | permtracker (decision-pace) | gap |
|---|---|---|---|
| 2025-12-15 | 2026-10-06 | 2026-10-12 | +6d |
| 2026-02-15 | 2026-11-08 | 2026-11-16 | +8d |
| 2026-05-15 | 2026-12-09 | 2026-12-17 | +8d |
| 2026-07-15 | 2027-01-06 | (between the rows above and below) | - |
| 2026-08-15 | 2027-01-14 | 2027-01-30 | +16d |

**We now track them within 6 to 16 days across the whole live range.** Before
this the same July-2026 input had them at December and us at 27 January, and
the difference was never a disagreement about the queue - it was that we led
with DOL's published average, a backward-looking mean dragged up by the audit
tail, while they divide cases-ahead by a daily rate.

The residual gap is almost entirely the divisor, and ours is the defensible one:

| | divisor | where it comes from |
|---|---|---|
| permupdate | **650/day** | `weekly_processing_rate 4,552 / 7`, a constant in the payload |
| permtracker | **625/day** | `measurePace` over our own last 28 observed days |

650/625 = 1.04, so a 130-day horizon differs by about five days, which is most
of the gap. The rest is that our cases-ahead prorates the filing month by the
day rather than counting whole months.

**Their own published feed disagrees with their own divisor by 15%.**
`GET /api/data/daily-volume` returns 30 days of counts averaging **566/day**
over the 16 days it overlaps our series, while the estimator divides by 650.
Ours sits between the two at 625 and is measured from our own data, then
cross-checked against theirs: our mean 574.6 against their 566.4, **+1.4%**.

**The band is where we are straightforwardly better, and it is not close.**

| | shape | claim |
|---|---|---|
| permupdate | one-sided, `remaining x 1.15` | `confidence_level: 0.8`, a hardcoded constant; measured coverage 8-15% |
| permtracker | two-sided, from the p10/p90 of the rate itself | stated as a pace scenario; measured coverage 57-58%, 41% near-horizon, printed on the page |

A case cannot only ever be late, and 15% of the remaining days is not a
confidence interval. Ours is narrower in the middle and honest about what it
is, which is the opposite trade from theirs.


## Correction, same day: permtrack's real predictor

The table above compares us against permupdate only. A first attempt to add
permtrack used `/api/estimate`, which is their RISK model (a grade plus
percentiles over decided cases) and reported them five to nine months late.
Their decision predictor is `/api/watchlist/predict`, and it is the same shape
as ours - cases ahead over a measured weekday/weekend pace.

All three, same day, same filing dates:

| filed | permtrack | permupdate | permtracker |
|---|---|---|---|
| 2025-11-20 | 2026-09-19 | 2026-09-20 | 2026-09-27 |
| 2026-01-15 | 2026-10-17 | 2026-10-26 | 2026-11-02 |
| 2026-03-16 | 2026-11-06 | 2026-11-17 | 2026-11-25 |
| 2026-06-15 | 2026-12-09 | 2026-12-23 | 2027-01-01 |

**We are consistently the latest**, by 8 to 23 days against permtrack. The
pace is not the reason - all three measure DOL within a few percent of each
other (permtrack 644/day, us 625, permupdate's own feed 566 against their
hardcoded 650). The reason is the queue count, and that is the open question.
