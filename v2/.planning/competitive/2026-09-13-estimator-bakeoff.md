# Estimator bake-off, measured 13 Sep 2026

All three run on a July 15 2026 PERM filing, read from each site's own live surface.

| | estimate | range shown | pace used | cases ahead |
|---|---|---|---|---|
| **permtrack** | **24 Dec 2026** | 16 Dec 2026 – 20 Feb 2027 | 644/day overall (804 weekday / 243 weekend) | 75,548 raw, 73,920 "effective" |
| **permupdate**, letter A | 31 Dec 2026 | **none** | 650/day | 71,880 |
| **permupdate**, letter M | 5 Jan 2027 | **none** | 650/day | 75,319 |
| **ours** (14-day window) | 2 Jan 2027 | 4 Dec 2026 – 17 Mar 2027 | 652/day | 72,012 |

**Everyone agrees on the inputs.** Pace 644 / 650 / 652 per day. Queue 71,880 to
75,548. The three answers sit inside **nine days** of one another. There is no
"they say December and we say January" gap: permtrack's Dec 24 and our Jan 2 are
the same arithmetic with a slightly different queue and walk.

Independent cross-check worth keeping: permtrack reports the frontier as
`2025-10, 92% decided`. Our live census says Oct 2025 is 92.3% decided and Nov
2025 is 48.2%. Two separately-built pending censuses agreeing to a tenth of a
point is the strongest validation our queue measurement has.

## Where we actually differ: the range

- **permupdate shows no range at all.** One date, with a bare label
  "Confidence level: 80%" beside it. Nothing is quantified, so the claim cannot
  be checked by a reader.
- **permtrack shows a scenario band**, not a calibrated one: `early_basis:
  "best_sustained_pace"`, `best_weekday_pace: 891`, `pace_headroom_pct: 8`. The
  early edge is "if DOL runs at its best observed pace". That is a defensible
  construction and it is NOT an error distribution: -8 / +58 days around the
  estimate, 66 days wide.
- **Ours is the only one derived from measured forecast error**: -29 / +74 days,
  103 wide, asymmetric because delays happen and early decisions do not.

Backtested, a +/-15% band around a 21-day-pace estimate - permupdate's own
documented construction - contains the truth **8-15%** of the time, against the
80% they advertise. Even read maximally generously as a symmetric +/-15% it is
20-35%.

## Two claims of theirs that their own tools contradict

**permupdate's "Employer's Name Initial (80% Influence)".** Their own estimator,
same date, only the letter changed:

    letter A  -> queue 71,880 -> 31 Dec 2026
    letter M  -> queue 75,319 ->  5 Jan 2027

**Five days.** Their implementation treats the initial as a small positional
term, which is what we measured too (r^2 = 0.159 on the live in-progress month,
worth about 2 days in queue terms). Only their marketing copy says 80%.

**And a correction to our own earlier note.** A previous session recorded
permupdate printing the alphabet term as "-80 to +80 days". Their live tool does
not: it is 5 days across A to M. That note is wrong and is retracted here.

## What this means for us

We are not more accurate because our formula is cleverer - the formulas are the
same and the inputs agree to within 5%. The differences worth having are:

1. a range derived from measured error rather than from a scenario or a label,
2. refusal where the evidence runs out (special statuses, overdue cases),
3. coverage of PWD and LCA, which neither of them touches,
4. published accuracy, once prospective scoring has run long enough to publish.

Claiming a large accuracy edge over these two would not survive contact with
these numbers.
