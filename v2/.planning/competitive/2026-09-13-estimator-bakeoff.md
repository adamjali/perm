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

## Data: all three use BOTH halves. We are not distinctive here.

Corrects an impression earlier notes gave.

| | quarterly disclosure | live FLAG per-case | live PENDING census |
|---|---|---|---|
| ours | to 2026-06-30 | twice daily | 94,967 PERM + PWD + LCA |
| permtrack | `oflc_through 2026-06-30` | `flag_checked` nightly | yes - `/api/watchlist/predict` returns `month_queue` with `{total, pending, decided_pct}` per month back to 2023-10 |
| permupdate | yes | "Last Sync 9/12/2026 8:23 PM EDT" | yes - "Monthly Backlog" by month with "To Be Processed", and a per-letter "Certified / Under Review" split |

Everyone holds the decided file and everyone scans DOL's live lookup nightly.
"We use live data and they only use the quarterly file" is not true and must not
be said.

Two places our data IS different, one good and one not:

- **Good:** we carry the live pending census for PWD and LCA as well. Neither of
  them touches those programs at all.
- **Not good:** on PERM completeness we are currently BEHIND permtrack. July 2026
  pending reads 8,927 for us against their 9,032 - we are 1.2% short. That
  independently corroborates the serial-space gap found on 12 Sep and places it
  at the low end of the 2-5% estimate. The gap sweep closes it.

## What this means for us

We are not more accurate because our formula is cleverer - the formulas are the
same and the inputs agree to within 5%. The differences worth having are:

1. a range derived from measured error rather than from a scenario or a label,
2. refusal where the evidence runs out (special statuses, overdue cases),
3. coverage of PWD and LCA, which neither of them touches,
4. published accuracy, once prospective scoring has run long enough to publish.

Claiming a large accuracy edge over these two would not survive contact with
these numbers.


---

# Three-way, seven real cases, 13 Sep 2026

Each case driven through all three live surfaces. permtrack via its
`/api/watchlist/predict`; permupdate through its own case-number predictor in a
browser (their prediction is client-side, no API).

| filed | letter | OURS | band | permtrack | permupdate |
|---|---|---|---|---|---|
| 2025-11-02 | S | 24 Sep 2026 | 20–27 Sep | 17 Oct 2026 | 20 Sep 2026 |
| 2026-01-01 | S | 28 Oct 2026 | 18 Oct – 11 Nov | 13 Oct 2026 | 27 Oct 2026 |
| 2026-03-01 | A | 8 Nov 2026 | 27 Oct – 26 Nov | 3 Nov 2026 | 11 Nov 2026 |
| 2026-05-01 | T | 4 Dec 2026 | 21 Nov – 6 Jan | 21 Nov 2026 | 10 Dec 2026 |
| 2026-07-01 | F | 24 Dec 2026 | 8 Dec – 3 Feb | 18 Dec 2026 | 1 Jan 2027 |
| 2026-09-01 | G | 24 Jan 2027 | 27 Dec – 6 Mar | 15 Jan 2027 | 13 Jan 2027 |
| **2025-06-03** | I | **REFUSED (overdue)** | — | 9 Oct 2026 | **12 Sep 2026** |

    mean |ours - permupdate|   5.5 days
    mean |ours - permtrack|   11.8 days
    queue counts, ours vs permupdate: mean gap 2,103 of ~50,000

**We are closest to permupdate** (5.5 days mean) and permtrack runs earliest of
the three, consistent with the optimistic pace lean visible in its own API.

## The overdue case is the only real separation

`G-100-25154-044786`, filed 3 Jun 2025, still in ANALYST REVIEW five months past
DOL's published frontier. Something is unusual about it by definition.

- **ours** refuses: the queue has passed this month, so a filing-order date
  cannot describe it.
- **permtrack** prints 9 Oct 2026 with a band.
- **permupdate** prints **12 Sep 2026 - yesterday.** "Remaining: 0 days."

A date in the past is worse than no date. That single row is the clearest
argument for the refusal branch: the arithmetic still produces a number for a
case the model does not describe, and only an explicit refusal stops it
reaching a reader.


---

# permupdate's overdue "accuracy" is a constant, not a method (13 Sep 2026)

The three-case outcome test made permupdate look best: +6 days on a frontier
case and +2 days on a 476-day overdue case where we refused. Before copying
anything, the overdue win was checked.

    G-100-25142-006665   filed 22 May 2025, CERTIFIED 10 Sep 2026
      permupdate  ->  12 Sep 2026   (+2 days, looks excellent)

    G-100-25154-044786   filed  3 Jun 2025, STILL PENDING
      permupdate  ->  12 Sep 2026   (already wrong)

    G-100-23156-079587   filed  4 Jun 2023, BALCA APPEALS,
                         pending three years and three months
      permupdate  ->  12 Sep 2026   ("Estimated PERM completion date")

**The same date for all three.** It is a floor: anything at or past the front of
the queue is told "yesterday". The +2 was a case decided to match the constant,
not a model that knew anything about it.

**4,271 live cases sit past DOL's frontier and are still pending**, and
permupdate tells every one of them their case completed on or before today:

    RECONSIDERATION APPEALS   2,401   56.2%
    RFI ISSUED                  688   16.1%
    ANALYST REVIEW              657   15.4%
    BALCA APPEALS               372    8.7%
    NORD ISSUED                 129    3.0%

84.6% of them are in a side proceeding. Some were filed in June 2023.

## What this does and does not change

- **Do not copy the overdue behaviour.** Our refusal is the better answer and
  this is the evidence for it. A date in the past, given to someone whose case
  has been in appeals for three years, is the worst output of the three sites.
- **Their frontier-case edge stands, and is small.** +6 against our +9 on one
  case. That is one draw, not a ranking, and nothing here says our method is
  better on ordinary cases - only that it is not worse.
- **Our own "queue-clear" branch was fixed by the same investigation**: it used
  to imply immediacy for a clear queue, and the measured median wait in that
  position is 34 days with a p90 of 149.
