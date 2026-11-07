# Estimates, backtests and the scorecard

How every estimate on the site dates a case (the decision pace, the passed-queue rate, the RFI clock, wage requests, H-2A, H-2B and CW-1, the bulletin pace), how each is tested, and the private scorecard against rivals.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## The employer's initial: real, small, and SHOWN not sold (2026-08-29)

DOL works each filing month alphabetically by employer, so the initial is a
genuine ordering term and every rival estimator uses it. What none of them
publishes is its SIZE, and the size is the whole question.

**Measured over 339,518 decided cases** (`scripts/build_alphabet.py` ->
`perm_docs.alphabet`, surfaced on `/perm-queue`):

| | |
|---|---|
| A, the fastest letter | **11.4 days under** the corpus mean |
| Z, the slowest | **15.7 days over** |
| the whole alphabet, end to end | **about 27 days** |
| per-month A-I vs S-Z gap | median **+8.2d**, range **-7 to +36** |
| months where the order REVERSED | **6 of 30** |

the rival dashboard prints this same term as **-80 to +80 days** and its FAQ calls the
initial roughly 80% of the outcome - the same effect inflated about sixfold.

`estimateQueueDecision` accepts `letterDeltaDays` and shifts every model by it,
because the ordering acts within a filing month and every model is anchored to
one. Three rules keep it honest, and they are the whole design:

1. **It is never invented.** The caller passes the measured delta from
   `perm_docs.alphabet` or passes nothing. There is no fallback constant.
2. **It is printed with its own number and its own size** ("Employers starting
   with Z: +16 days... the whole alphabet spans about four weeks, and in a
   sixth of filing months the order ran backwards"). Folding it into the date
   is the difference between using an input and appearing to - and stating the
   magnitude is what stops this becoming the thing it guards against.
3. **It is applied BEFORE the elapsed filter and cannot rescue a past date.**
   An overdue case still gets no date; a fortnight does not drag a
   months-elapsed model into the future.

**Keep it in proportion when tempted to weight it harder: our own measured
median error is ~50 days and this term moves a date by at most 16.** It is
inside the noise floor. It earns its place as a specific, personalised output
the reader can see was used - not as a lever.

On `/perm-case-status` it costs the reader no input at all: DOL names the
employer, so the initial comes from a fact already on the page.

## An estimate whose date has passed is not an estimate (2026-08-28)

A Nov 2024 filing rendered "likely decision window November 2025 to March
2026" in August 2026: for a month the frontier has passed, every
filing-anchored model's date has already elapsed. `estimateQueueDecision`
now WITHHOLDS elapsed models centrally (every composing surface inherits
it); the timeline page renders the overdue truth instead (queue passed
your month by N; a case still pending is usually in an audit/RFI/hold ->
CTA into the per-case lookup), and the case page returns the no-date
refusal with the measured age. Presentation rule from the same review:
lead with the strongest model's own date ("Most likely: around X") with
the full window right under it - an anchor plus honest spread, never a
bare range and never a blended number. Predictions worth scoring go in
`../.planning/prediction-ledger.md` BEFORE the outcome.

## The estimator rework: one answer, an actual day, and stage data that updates itself (2026-09-10)

Adam approved four phases: one main answer with the rest secondary, an actual
day rather than a month, live-pending combined with the DOL quarterly files,
and something that keeps itself current. The foundation turned out to be the
third one, and it was broken in a way nothing could have surfaced by reading.

**`totalReceived` was designed, typed, tested and never supplied.**
`CohortStat.totalReceived` is documented as "including ones still pending...
DOL's disclosure files cannot supply it". The calculator reads it. Tests
exercise it. **No production caller ever set it**, and the read-layer `Cohort`
had no such field at all - so `completionFraction` was always null, the call
site passed `1.0`, and the survivorship gate could never fire. The code says so
itself: *"the frontier gate is the one that fires in practice, because DOL's
files carry no pending rows for the fraction gate to work from."*

The denominator existed the whole time. `live_census` is written daily and
already read on these pages; summing its matrix per month gives cases received
INCLUDING pending, at no extra query. Validated before wiring, disclosure-decided
over live-total:

| | |
|---|---|
| mature months | 2024-10 **0.99**, 2025-01 **1.00**, 2025-04 **1.00**, 2025-05 0.96 |
| recent months | 2025-12 **0.029**, 2026-03 0.028, 2026-06 **0.024** |

The two sources describe the same population once a month is worked through,
and the recent figures are the warning the estimator was blind to: a 2026-06
percentile is computed over the fastest 2.4% of that month. Totals are floored
at `decided` (a few mature months read 1.03 and 1.08 because the sweep has not
found every case the files hold), and a month with no live coverage gets null.

**Fixing the denominator exposed a cliff.** `reportablePercentiles` used
`completionFraction * 0.9`, which admits p90 only at EXACTLY 1.0 - harmless
while the fraction was always 1, and with real fractions of 0.96 to 0.9996 it
would have silently dropped p90 from **13 of the 28** settled cohorts, at 99.3%
decided where it is genuinely observed. A fixed cushion says the intended thing:
report a percentile once you have observed PAST it, less a few points of noisy
tail. Every prior assertion holds; production goes 15/13 to 24/4.

**One answer.** The calculator rendered every model side by side at `text-4xl`,
so a reader met up to four equally loud and different dates. The models now sit
behind a "How this was worked out" disclosure at secondary size, with the lead
marked "the one above". The window still spans every model.

**An actual day, and the initial is what earns it.** The engine already computed
a full ISO date and the UI threw it away with `formatMonth(d.slice(0, 7))`. But
DOL publishes at MONTH resolution, so the input that places a case INSIDE its
month is the employer initial, not the filing date: 27 days end to end, A -11.4
to Z +15.7, over 339,518 decided cases. Optional selector, blank by default,
absent entirely when the measurement is missing.

**Coverage, not cadence.** `datasetCoverage.ts` states what each of the 29
datasets CONTAINS, rendered inline by `DataProvenance`. "Quarterly" never said
"decided only" and "daily" never said "pending included, no wage", and that gap
is where both recurring errors live. Two gates, because the ids are registered
two different ways: vitest holds the sentences' shape, and
`check_ingest_health.py` has the live registry and fails on a new dataset that
ships unstated.

**Stage ages are measured now.** `queueForecast`'s `observedAgeDays` had been
typed once and never revisited; against the live table every value had drifted:

    ANALYST REVIEW  170->162   ON HOLD 223->229   RFI 375->362
    NORD 697->684   BALCA 714->716   RECONSIDERATION 624->539
    REQUEST FOR REVIEW  absent from the table entirely, 506 days

`stage_stats` is written by the daily sweep and preferred over the table, which
survives as the fallback. **The percentile does NOT move**: that says what a
stage MEANS (an RFI sits in the slow tail; an appeal is a separate proceeding
no percentile describes) and is editorial judgement, not a nightly aggregate.

**And the useful thing nobody was telling the stuck cases.** Of the RFI exits
observed, **91% (327/359) return to ANALYST REVIEW**, not to a decision - an RFI
is a detour back into the ordinary queue, where DOL's published position applies
again. That renders on the refusal panel.

**Stage duration is BUILT and switches itself on.** `stage_stats.durations`
carries a survival curve per stage: for each candidate day `d`, how many
entrants were old enough to reach it and how many of those had left. The reader
takes the median as the first `d` where at least half of the eligible had gone.
Nothing is extrapolated, no flag exists, and a stage answers the day its own
data crosses the line.

**Its first version was wrong and its answer looked fine.** Taking the median of
observed exits once "enough" had exited made ANALYST REVIEW reportable at 345
entered, 236 exited, **median 3 days**. Every entrant we can see arrived within
the last 15 days, so a long stay CANNOT have been observed: the exits are the
fast ones by construction, and the completion share was measuring the age of the
window rather than the stage. Conditioning on time fixes it - a day nobody has
been observed long enough to reach has no point on the curve, so no median
longer than the window can be produced.

**And the corrected curve exposed a labelling trap.** It made ANALYST REVIEW
genuinely reportable at **4 days**, which is a real number for the wrong
sentence: those are RE-entries, mostly cases returning from an RFI, while the
mean age of a pending analyst-review case is **162 days**. A reader would set
"about 4 days" against their own months of waiting and either disbelieve the
site or believe it. `NOT_A_DIVERSION` withholds the stages a case never visibly
ARRIVES at - a duration is meaningful for a stage you are diverted into, not for
the one you sit in from filing.

**`changed_at` is a millisecond epoch, and `julianday()` on an integer returns
NULL.** The first duration query ran, returned a row per stage, and produced
zero durations - 236 observed exits with a null median. Found by reading the
output, never by the exit code.

**What is still NOT measurable, and why.** "An RFI takes N days" needs
entrants followed past the median: of
**422** watched entering an RFI, **3** have been seen leaving. The 327 exits
above are left-truncated - already in RFI when the log opened on 2026-08-26, so
their start is unknown. The curve therefore reports nothing for RFI today and
will report it without anyone touching the code; `exitMixFor` meanwhile gives
DESTINATIONS only and says the timing is unknown. It also refuses a stage with
one surviving destination, because the writer drops destinations below n=3 and
a lone survivor's "100%" is that cutoff talking.

**A type-only import 404'd a whole route.** `import type { Alphabet }` from
`@/lib/db/alphabet` into a `"use client"` component: the type is erased at
compile, but Next resolves the module graph first and that module carries
`import "server-only"`. Clean 404, nothing in the dev log, reads exactly like a
missing page. Found by stashing - clean HEAD 200, mine 404. Declare the shape
in the client file instead.

## The queue-advance model leads now, and the coverage objection did not survive (2026-09-10)

Adam compared a December 2025 filing against the rival dashboard: theirs said late
September to early October, ours said September to December, most likely
November. Both were right, and the whole difference was WHICH MODEL LED.

| model | arithmetic | answer |
|---|---|---|
| DOL's published average (led until today) | filed + 336 days | **16 Nov 2026** |
| Queue advance (the rival dashboard's shape) | frontier at 2025-11, one month back, ~1 mo/mo | **10 Oct 2026** |
| queue advance at the fastest observed rate | 2 mo/mo | 25 Sep 2026 |

`caseEstimate.ts` and `PermTimelineEstimator` both anchor on `models[0]`, and
DOL's average was pushed first.

**It was the wrong anchor, and the site's own page proves it.** That 336-day
figure is a mean over cases DECIDED in August 2026, so it carries the audit and
RFI tail: 336 days before August 2026 is roughly September 2025, while DOL says
it is adjudicating **November 2025**. Those two DOL numbers, printed on the same
page, differ by about two months, and the difference IS the tail. Pricing a
clean case one month from the frontier with the tail's average makes every
normal case read later than it is.

**The objection to always leading with queue advance was measured, not
argued.** I expected it to be unusable for a large share of pending cases, since
it requires `monthsBehind > 0`. Measured against production, against the
November 2025 frontier, over **95,993 pending cases**:

| position | share | queue advance |
|---|---|---|
| filed after the frontier | **86.0%** | runs |
| filed at the frontier | 9.5% | - |
| filed before the frontier | **4.6%** | omitted |

All three buckets matter and each already has the right answer, verified by
running the estimator at each position (frontier 2025-11, today 2026-09-10):

| position | lead | date | why it is right |
|---|---|---|---|
| ahead, 86.0% | `queue-advance` | 2026-10-10 | counts down to the frontier arriving |
| **at, 9.5%** | `dol-average` | 2026-10-17 | queue-advance needs `monthsBehind > 0`, so it is absent here - and the average is COHERENT at this position, because a case at the frontier has already waited about ten months and the average says eleven |
| behind, 4.6% | **none** | - | `overdue` returns no date at all; the absence is the answer, and the caveat says the queue passed you and a still-pending case is usually in audit or RFI |

**The 9.5% was the bucket worth checking and I had skipped it in the first
write-up.** It looked like the worst case for a backward-looking average - a
case DOL is adjudicating this month being told "November" - and measuring it
showed the opposite: filed + 336 days lands three weeks out, which is what
"being worked now" should say. Nothing to fix there.

So the rule is simply: **queue advance leads whenever the model exists.** No
"near the frontier" condition is needed, because the model's own precondition
already encodes it, and when no rate has been measured it is omitted rather than
run on an assumed constant, leaving DOL's average to lead as the citable
fallback.

**The window does not move, only the anchor.** Both consumers build the envelope
across every model, so the honest spread is unchanged; what changes is which
date the headline names. DOL's average is still returned and still cited.

`queueEstimate.test.ts` pins the ordering, the fallback when no rate exists, and
that the lead now anchors EARLIER than the backward-looking average, which was
the defect. Probed by restoring the old order.

## The decision-pace estimator is WIRED, and it leads (2026-09-13)

`convex/lib/perm/calculators/decisionPace.ts` is the model the estimator
investigation settled on, and it is now the lead model on both surfaces that
date a case:

    day  = today + casesAhead / 28-day calendar pace
    band = casesAhead / {p90, p10} weekday pace, floored at 55% of the
           horizon and grown late-heavy

**Zero fitted parameters.** The +111-day "bias" that started this turned out to
be DOL's acceleration wearing a calibration costume; deleting the whole
correction cost nothing at the horizons that exist (86% of the live queue is
under four months) and covered slightly more.

### The substitution, and why it is defensible now

The backtest fed the model DOL's own `decision_date` from the quarterly files.
Production cannot: those end 2026-06-30. The only daily-resolution source is
`daily_decisions` under `sweep-observed`, which the sweep already writes from
`perm_case_events` and which is dated by when **our sweep saw** a case become
final. Those two ranges do not overlap by a single day, so the substitution
cannot be validated against our own history at all.

**It is validated against an independent third party instead.** the rival dashboard
publishes `GET /api/data/daily-volume`, 30 days of counts. Measured 2026-09-13
over the 16 days both series cover: **our mean 574.6/day against their 566.4,
+1.4%**. Individual days diverge by more, because a day boundary falls in a
different place for each of us - but the model divides by a 28-day MEAN, and
the mean is the quantity that agrees.

One consequence stated rather than discovered later: our day-boundary noise
inflates the weekday spread the BAND is built from, so the band is wider than
DOL's true daily variation would give. That errs toward claiming less.

### What it changed, measured against the rival the same day

| filed | the rival dashboard | ours | gap |
|---|---|---|---|
| 2025-12-15 | 2026-10-06 | 2026-10-12 | +6d |
| 2026-02-15 | 2026-11-08 | 2026-11-16 | +8d |
| 2026-05-15 | 2026-12-09 | 2026-12-17 | +8d |
| 2026-08-15 | 2027-01-14 | 2027-01-30 | +16d |

**We track them within 6 to 16 days across the whole live range.** Before this
the same July-2026 input had them at December and us at 27 January, and the
difference was never about the queue: we led with DOL's published average, a
backward-looking mean dragged up by the audit tail.

The residual gap is the divisor, and ours is the defensible one: they divide by
a hardcoded **650/day**, we measure **625**. Their own published feed averages
**566**, so their constant disagrees with their own data by 15%.

### Three things that had to be right, each of which was wrong first

1. **`casesAhead` must prorate the filing month.** The census counts pending by
   MONTH and "filed before yours" is a question about a day. Counting only
   strictly-earlier months drops several thousand cases - one to two weeks of
   the answer at 625/day. `casesAheadOfDay` prorates by day-of-month, states
   the uniform-filing assumption, and uses the calendar length of the month
   rather than 30.44. It returns **null**, never 0, for a month the series does
   not hold: 0 reads as "nothing ahead of you".
2. **The band is not a confidence interval and must not read as one.** The UI
   said *"Most likely between"*, a probability claim, over a band whose
   measured coverage is 57-58% overall and **41% at the near horizon** - under
   half, so it was false for exactly the cases most people look up. Each model
   now labels its own band (`est.modelId`), and the coverage figure is a
   caveat on the page. A rival ships `confidence_level: 0.8` as a constant
   against real coverage of 8-15%.
3. **`through` was read off the SQL ordering.** It gates the staleness guard,
   so taking it from `rows[0]` made that guard silently depend on an ORDER BY
   three lines away. It is the maximum now. Found only because a probe showed
   the test asserting it was blind - and investigating THAT showed the comment
   justifying `days.reverse()` was also wrong: `measurePace` is order-invariant
   and the test now pins that with an explicit shuffle.

### What is still NOT claimed

The model is checkable against our own history when DOL publishes FY2026 Q4
(July-September), the first quarter the event log covers. Until then the
validation is the third-party cross-check above, and the band's coverage is
quoted from the backtest rather than from live outcomes.

## The Sep 26 2026 batch: the estimate's count, a scorecard, and the gaps a rival sweep found

One build, one deploy. The checklist, with every item and what was found on the way, is
[`../.planning/batch-2026-09-26.md`](../.planning/batch-2026-09-26.md); the estimator backtest is
[`../.planning/estimator-backtest-2026-09-26.md`](../.planning/estimator-backtest-2026-09-26.md).

**Only analyst review counts as "ahead".** `inLine()` in `src/lib/queueAhead.ts`. Counting every
pending case (holds, RFIs, appeals) made every date about a week late: the standing backtest
(`scripts/backtest_queue.py`, T0 2026-09-13 to END 09-25, 7,135 real decisions in its stored run; the first investigation scored 7,112) measured a 3-day typical miss
for the new count against 9 for the old, on the same cases. The employer-initial shift is gone
from every date (it moved a date by at most 16 days against a noise floor several times that).
The range caveat quotes the re-measured coverage (about 4 in 10 near the front), never the old one.

**The scorecard records before the outcome.** `/api/cron/scorecard` (Vercel cron, noon UTC)
samples cases daily, stores our prediction in Turso `estimate_predictions` (id
`<day>:<source>:<case>`, INSERT OR IGNORE), grades what has settled (30 days), and writes
`perm_docs['scorecard_summary']` (ours only, public) and `['scorecard_rivals']` (admin only, the
rivals as A, B, C). Rival endpoints come from `RIVAL_A_API` / `RIVAL_B_API` on Vercel; nothing in
the repo names them. The backtest writes `perm_docs['estimator_backtest']` weekly (Mondays).

**Watched cases are checked every 5 minutes (since Oct 7 2026; hourly before).** See "Oct 7 2026:
alerts within minutes". It reads case NUMBERS only, asks DOL, and writes with conditional
statements (`UPDATE ... WHERE current_status = <what I read>`, then the event only
`WHERE changes() > 0`), so a sweep running at the same time can't produce a double event.

**New public pages** (each in the sitemap, rail or tools nav, palette, llms.txt, known-routes, and
with its own social card): `/tools/green-card-line`, `/tools/eb2-vs-eb3`,
`/tools/which-green-card`, `/visa-bulletin/categories` (+45 line pages), `/h1b-lottery-odds`,
`/nvc-waiting-list`, `/green-card-timelines`, `/zh` `/es` `/pt-br` `/ko` `/vi`, and 19 embeds
at `/embed/<slug>` (noindex, framing allowed there only). Case pages gained "cases filed next to
yours"; employer pages a wait section and similar sponsors.

**The embedded lookup asks DOL live under three caps**: 50 per site per UTC day, 5,000 across
all sites, then the site-wide discovery budget, one `perm_docs['embed_live_<day>']` row. A live
answer for a case we already hold is never written (the sweep must see the change to send the
alert). Firewall rules 1 and 4 carry an `/embed/case-status?case=` group since Sep 26 (config
version 21); `/embed/*` stays out of the challenge, because a challenge can't finish inside a
third-party iframe.

**Community timelines never take the PERM half from the reader**: `communityTimelines.verifyCase`
reads it from DOL's record. No free text anywhere, a sha256 of a browser-held key instead of an
account, and the public board opens at 25 shared timelines (medians need 5).

**The bulletin and State's yearly PDFs are automatic again.** The State Department serves the
same pages from its own second host, `adoption.state.gov`: a plain request gets 200 for the
bulletin index, every month page, the statistics pages and their PDFs, it has no robots.txt
rule, and nothing is challenged (travel.state.gov answered the same minute's requests 403).
`processing-times-ingest.yml` runs `ingest_visa_bulletin.py --direct` (State's index, then any
month not held from a primary source, two a run, same parser and checks as a saved page, rank 3)
and `ingest_visa_limits.py --discover` (the newest limits sheet and Table V, followed from State's
own links, loaded only for a fiscal year not yet held). Both warn and exit 0 on a refusal: the
freshness budgets are the alarm and `--from-file` / `--limits` stay the fallback. **Validation
runs before any database connection** in both routes; the refactor that added `--direct` briefly
connected first, and only a test run WITHOUT credentials showed it.

**USCIS's processing-times figures are the one source nothing can script.** Their age check moved
from the vitest suite (which would have failed every deploy eight months after a refresh) to
`check_hand_read_figures` in the health check: a warning past 120 days, a failure past 270.

**The bulletin archive reaches October 2014** (144 bulletins after the backfill write). The
dates-for-filing chart began with October 2015, so earlier month pages say so instead of drawing
an empty table. Copy says "every bulletin since October 2014", never a count typed by hand.

**USCIS stopped publishing per-center and per-office times.** Read in a real browser on Sep 26:
every I-140 class and the employment I-485 list one office, Service Center Operations (plus "All
Field Offices" for the I-485), and the page prints one figure, 80% of cases decided over the
past six months. `src/lib/processing-times/i140ProcessingTimes.ts` holds the eight 80% figures
(`months80`) and `PROCESSING_TIMES_AS_OF`, whose test fails when they age. `egov.uscis.gov`
answers every script with a Cloudflare challenge, so the refresh is a browser read by hand.

**State published no NVC waiting list after November 2023** (its statistics page no longer links
the report; the 2024 and 2025 names 404). `scripts/ingest_nvc_waiting_list.py --archive` loads
the seven reports from the Internet Archive; its freshness budget is 1,200 days, with the reason
in the script.

**Never `fetchQuery` from `convex/nextjs` on a public page.** It pins `cache: "no-store"`, and one
no-store fetch makes the whole route dynamic whatever `revalidate` it exports: every visit a server
render and its database reads. It had quietly made `/tools/i140-calculator` and
`/tools/green-card-timeline` dynamic in production, and did the same to `/perm-processing-times`
the moment a Convex read was added. Use `queryStatic(query, args, revalidate)` from
`src/lib/convexStatic.ts`; `public-convex-reads.test.ts` fails on the old import. Check the
build's route table (`○` vs `ƒ`) for any page that gains a data read.

**Instruments that lied this time.** Impeccable's `detect` cannot open a path containing `(site)`
(it globs), so a scan of the app tree silently skipped 101 of 153 files: copy them to flat names
first. `git diff --name-only` prints repo-root paths from inside `v2/`; add `--relative`. And no
workflow runs eslint, which is how a `Date.now()` in render reached `main`.

## Oct 7 2026 (afternoon): the scorecard in plain words, sign-up times, and rapid clicks

**The scorecard reads as sentences now** (`src/lib/scorecard/verdict.ts`). The owner read the admin
table's "8" and "4" as Rival A beating us and couldn't tell a lead from luck. `readRival` turns a
head-to-head into a headline ("Rival A leads so far, not clearly yet"), the split, the typical miss
on both sides, a two-sided sign test said in words ("could still be luck: fair coin flips split at
least that unevenly about 4 times in 10"; clear only under 1 in 20), and the late-and-waiting count
on the same cases (`oursLateWaiting` / `rivalLateWaiting` on `HeadToHead`), because grading only the
decided cases flatters whoever dates cases sooner. `readOurs` leads with the weekly backtest, says
when both checks lean the same way, flags a range that held under half the time, and says when the
fair test (`SETTLE_DAYS`) begins. `readMethods` splits "ours" by the method that dated each case.
`letterFor` grades A to F on a printed scale. `writeScorecardDocs` stores the sentences in
`scorecard_rivals.readings`, so the morning report quotes them instead of re-deriving them; the
admin panel opens with them and a square per judged case, and folds every figure under "Every
figure"; `/estimate-scorecard` opens with "The short answer" (ours only). `GET
/api/cron/scorecard?docs=1` rewrites the two summaries and records, asks and grades nothing.

**What the split by method showed (Oct 7):** of our 33 graded PERM dates, 11 came from the main
method (typically 4 days off, matching the backtest's 4 over 11,473 decisions), 19 from DOL's
published average and 3 from the behind-the-queue rate. DOL's average leads for an in-line case whose
filing month DOL's queue has already passed (since Sep 22 DOL works December 2025, so November 2025
filings) while filed + 336 days is still ahead: `estimateByPace` refuses `overdue`, and the
stragglers model answers only once every filing-anchored date has elapsed. Those 19 ran 3 to 34 days
late, 7 of them more than two weeks. Not changed: the owner decides.

**The record keeps each method apart.** Every prediction stores its model name (`decision-pace`,
`dol-average`, `stragglers`, PWD's `pwd-queue` and the relabelled `pwd-queue-request-month`); the
analyst-review-only count shipped with the scorecard on Sep 26, so no PERM row was recorded under the
old count. A change to how a method dates cases needs a new model name, or the grades mix two methods.

**Admin lists say when each person signed up.** "Latest alerts" has a Signed up column (joined from
the outbox row's `ref`, `<kind>:<row id>`, null once the row is gone), with how long before the send
and how long the person took to confirm; every subscription row reads "Signed up X · confirmed N
minutes later · alerted Y, N days after signing up · last seen CERTIFIED · from the PERM case page".

**Rapid clicks, 7 days of PostHog (scraper labels left out):** paging buttons under a long list
(/pwd-cases "Older", 18 people, 49 clicks) changed rows above the screen, so `Pager` takes `scrollTo`
and brings the list's top back into view; the /perm-employers top-ten names were plain text and are
links now; the homepage's example case number is drawn dashed so it doesn't read as buttons. Most of
the rest were text boxes clicked several times (selecting a case number to replace or copy; every
one of the 67 case-page sessions went on to look a case up) and phones tapping chart bars to read
each day's figures: not defects.

**sharp 0.35.5** (GHSA-wq5f-xc86-pv6w, librsvg) went in that evening: `pnpm add` re-resolves the tree
and the `trustPolicy: no-downgrade` gate refused semver@6.3.1 (already in the lockfile, under
eslint-config-next), so `pnpm-workspace.yaml` excludes exactly that version from the trust check, with
the owner's yes.

## Oct 7 2026 (evening): every estimate graded or tested, and three silent data defects

Ledger: `../.planning/estimators-checklist.md` (every estimate and the ten things each gets).

**A case DOL's queue has passed is dated by the measured rate** (`straggler` branch in
`src/lib/caseEstimate.ts`): DOL's published average had dated those, and the backtest
(`scripts/backtest_queue.py`, "passed" section, five origins) found it 29 days late typically on
Sep 22 against 6 for the rate DOL actually finishes them. The calculator gives such a month no
filing-month date and states the split and the rate. **Range coverage is read from the backtest**
(`perm_docs['estimator_backtest'].rangeCoverage`, `src/lib/rangeCoverage.ts`), never typed.

**NOR ISSUED is final, and "settled by file" is a rule of the sweep.** DOL defines NOR nowhere; its
H-2B and CW-1 files record all 547 NOR cases they hold (filed Oct 2024 to May 2026) as
"DETERMINATION ISSUED - REJECTED". And DOL's live service leaves some decided applications on IN
PROCESS: 1,725 of the 1,726 H-2B applications filed Oct 2024 to Mar 2026 still reading IN PROCESS
had a decision in DOL's file (1,621 "CERTIFICATION (RETURNED)"). `PROGRAMS["seasonal"]["settled_by_file"]`
in `ingest_pwd_status_direct.py` marks such a row finished; `is_final(status, program, published)`
is used by the sweep's change and heal branches alike, so it is the one writer of the flag and
nothing flip-flops. DOL's status word is never rewritten. Wage requests and LCAs were checked and
have only real re-openings (redeterminations, director reviews). The case page
(`decidedInFileOnly`, `SETTLED_BY_FILE_STATUSES` in `src/lib/seasonalDetails.ts`, pinned to the
Python) reports the file's decision and drops the timing panel and the alert form. 3,155 rows were
healed on the server the same evening with the sweep's own functions.

**The case search dropped filters on three programs.** `readFlagPublished` applied only the decided
range on a firm, state or occupation lead, while the form enabled every filter and the route passed
them through ("this firm, in Wyoming" listed the firm's filings from every state); the employer path
ignored the law-firm filter. `flagRowNarrowing` applies them all, inside the newest `SLICE_CAP` rows
of the lead, and `windowed` says when that window was full. **Industry and city** left
`PERM_ONLY_FILTERS` (now the worker's old-form fields only) for `PLACE_FILTERS`: every published file
prints them, and the published rows now select and return `naics` and `worksite_city`. They had been
loaded for LCA FY2020 to FY2022 Q3 and FY2026 only and for no wage request; `--backfill-place` was
dispatched one file at a time (13 LCA quarters, 3 PW files) on GitHub's runners.

**Seasonal timing, measured.** `scripts/backtest_seasonal.py` (weekly) rebuilds the panel's numbers
at each quarter's start and tests them on that quarter's certifications, both clocks and three
history windows, using a quarter once at most 5% of it is undecided anywhere. H-2A pooled from the
first day of work: 51% inside the middle half, 8 days typical. CW-1 pooled from filing: 58%, 10 days.
H-2B pooled held 21%; the same receipt quarter a year earlier did best (43%, 12 days), so
`build_seasonal_timing.py` writes `seasons` per receipt quarter with `useSeason` on H-2B and the panel
names the season and prints the measured share (`perm_docs['seasonal_backtest']`). Every method
missed January 2026's cap season by 28 to 40 days.

**The bulletin's "months until current", measured.** `scripts/backtest_bulletin.py` (weekly) replays
`monthsToReach` on every bulletin since Oct 2016 for readers 3, 6, 12 and 24 months past the cutoff:
a year out it was typically 7.7 months off and within a quarter of the real wait 23% of the time
(India 10 months). Trailing windows of 1 to 5 years were no better on the same readers, so the
method stays and the green card line and the I-485 tool print the measured sentence beside it
(`src/lib/bulletinCheck.ts`).

**The scorecard covers every estimate.** H-2A, H-2B and CW-1 applications are recorded once each,
in their first week (`predictSeasonal`), graded on certifications only (`isGradedOutcome(outcome,
program)`), with a decision DOL's file holds as the outcome when the live word never moved.
`scorecard/alarms.ts` writes the alarms (recording stopped, grades stopped while dates were due,
the recent miss doubled, a weekly backtest stale) into the admin doc; the admin page leads with them
and the morning email prints each and turns amber. `scorecard/otherEstimates.ts` is the one table of
the other estimates for the public page and the admin page. The wage-request sample takes PERM
wage requests only, the ones the page dates.

**Parity, both ways** (from a mapped matrix of every feature by program): wage-request, LCA and
seasonal results offer browser push and an alert on a number not found yet (`WatchThisNumber`);
law firm pages show H-2A, H-2B and CW-1 work; CW-1 is in the glossary; llms.txt and every page's
structured data name the H-2A, H-2B and CW-1 prefixes, gated by
`three-programs-in-machine-copy.test.ts`. The change feed and the decided-day half read H-2A, H-2B
and CW-1 too (`CHANGE_PROGRAMS`), with their own certification-expired pairs left out like PERM's
(`EXPIRY_PAIRS` in `turso/changes.ts`); city and industry are optional narrows on every program there.

**The bulletin release day is recorded and graded** (`predictBulletinRelease`, program `bulletin` in
`estimate_predictions`): the day by which half the past bulletins were captured, with the quarter and
three-quarter days as its range, recorded no later than the range's first day, and graded on the day
this site first held the bulletin (`bulletin_first_seen`, written once by `write_month` in
`ingest_visa_bulletin.py` for a month new to the site). The first is the November 2026 bulletin.

**Next 16.3.8** (Oct 7): six advisories, among them SSRF in the image optimizer (high) and cache
poisoning of SSG and ISR pages on self-hosted sites, which this site is. It cleared the 7-day release
floor the same day; `^16.3.6` allowed it. Next 16.4.0 is out and not taken.

**Alert timing copy** said "every hour" and "the daily sweep" in three places; watched cases are
checked every 5 minutes on weekdays and every half hour otherwise since the morning of Oct 7.

**Every employer page carries DOL's debarment and layoff notices now** (`853986ae`), the live-only and
no-PERM pages included, and `/seasonal-cases` has its own card. WARN notices that name no PERM sponsor
fall back to a unique live-only or no-PERM page by program key, never a bare one-word brand
(`page_matcher` in `ingest_warn.py`); the stored notices were relinked the same night, 276 to 485 of
3,168. LCA rows carry industry and worksite city for every year loaded (2019 to 2026, 100%).

**The local `pnpm test:run` runs vitest only; CI also runs all 70 `scripts/test_*.py`, and some read
TypeScript.** Replacing `EXPIRY_FROM` / `EXPIRY_TO` in `changes.ts` with a list of pairs passed 8,960 local
tests and turned CI red twice, because `test_observed_decisions.py` holds those two constants to the
Python sweep's. Before pushing a change to a file a Python test reads, run the loop CI runs:
`for t in scripts/test_*.py scripts/oracle/test_*.py; do python3 "$t" || echo "FAIL $t"; done`.

Still open, in the ledger: the green card line's years, which needs a year more of USCIS's counts
before it can be graded, and the PERM range (below).

## Oct 7 2026 (night): a decision isn't the end, and what the range test showed

**A case alert keeps watching for a year after DOL decides** (owner's call). A decision had retired
the subscription, but final statuses move: in the month to Sep 25, 2,541 denied PERM cases went to
reconsideration appeals and 105 withdrawn ones came back certified, and the watcher heard none of it.
`recordAlert` sets `decidedAt` on a final status and clears it on a move back out; the sweep retires a
row (`caseClosedAt`) once `WATCH_AFTER_DECISION_MS` (365 days) pass with nothing moved, and starts the
clock quietly for a row first seen already decided. **A certification lapsing on its own clock**
(`isLapse`: X to "X - EXPIRED") is recorded with no email: it isn't DOL acting, and "expired" would
alarm someone whose I-140 went in months ago. `caseAlerts:reopenRetired` put the 41 rows retired
under the old rule back on watch from their decision date. Growth stays bounded: the sweep's index
reads live rows only, and every decided case leaves a year later.

**Every status DOL uses is classified, and the health check warns on one that isn't.** ARCHIVED (725
H-2A job orders filed 2022 to 2024, every known work period over), the Board's decisions (affirmed,
overturned, dismissed) and a modified wage review had fallen to pending; RFI, redetermination and
review statuses are pending by name now. 741 rows healed with the sweep's own `is_final`.
`check_unclassified_statuses` prints a warning (never a failure: pending is the safe default) naming
any status in neither set, and `statusDictionary.test.ts` requires a definition for every classified
status unless it's named as never seen.

**The green card line printed no years figure from Sep 26 to Oct 7**: the stored FY2024 Table V year
predated the per-country parser, and `--discover` only fetched years it didn't hold. A held year
missing a current field (`TABLE_V_FIELDS`) is read again now; re-run on the server and the four line
pages purged at Cloudflare.

**Priority dates, our pace against dividing by yearly visas** (`supplyDivision` in
`bulletin_backtest`). The rival that forecasts this way closes its API in robots.txt and its inputs
can't be rebuilt (its India EB-2 supply is 7,235; Table V says 3,916), so the approach is re-run on
USCIS's inventory and Table V, on the same dates as our pace. On the 9 inventory reports held (Dec
2025 to Aug 2026): dates 3 months past the cutoff that came current, the pace was closer on 66 and
the division on 8; 6 months, 42 and 3. Not settled: the window favours lines that moved, and the
division has fewer dates already overdue (17 against 43 at 3 months). Readings on the admin page and
in the morning email.

**What the PERM range test shows** (`estimator_backtest`, 8,023 dates judged): the printed range held
29% because it's about a week wide and drawn mostly after the date, while DOL usually decides a few
days before it; 48% of decisions came before the range began. The same dates held 60% within 5 days
either side of the date and 77% within 7. The date itself is typically 4 days off. Widening and
centring the range is the owner's decision.

**H-2A, H-2B and CW-1 decisions per day** come from DOL's seasonal files (`dol-disclosure-h2a`, `-h2b`,
`-cw1` in `daily_decisions`, `build_daily_decisions.py --only seasonal`, after each seasonal load) and
are drawn on `/seasonal-cases` with each visa's outcomes as a bar. The chart says the October 2025
drop is the shutdown. Two guides (`h2a-case-status-and-timing`, `h2b-and-cw1-case-status-and-timing`)
carry the eCFR rules and the measured timing.

**Smaller:** the case browsers' pickers pushed the page 12 to 22px past a 320 screen (fixed in
`FlagCaseBrowser`); `shoot.mjs` hides floating controls before a clipped capture, after scrolling,
or the back-to-top button fades into the corner; Serwist's own `register()` throwing on a browser that
returns no registration is filtered as noise (`src/lib/exceptionNoise.ts`), and PostHog's grouping
rule takes Safari's wording of the webpack crash (`].call')`). The wage-request backtest
(`pwd_backtest`) had never been written; run once by hand, its weekly run is Mondays.


## Oct 8 2026: the range the backtest measures, a day for wage requests, subscribers' dates

**The PERM range is measured, by distance, every night** (`scripts/backtest_queue.py`, `rangeModel` and
`servedRange` in `perm_docs['estimator_backtest']`). The script reads the status table and the event log once
(`Record`), tests every weekly start day back to `MAX_START_DAYS`, and per distance bucket
(`HORIZON_BUCKETS`) takes the middle 80% of how far decided cases landed from our date, pooling the newest
four start days that judged that bucket. A bucket needs 300 decided cases (`RANGE_MIN_DECIDED`).
- **Judge a date at two weeks** (`RANGE_JUDGE_DAYS = 14`). At one week the late edge came out at exactly
  +7: nothing decided later than a week could be seen, so the quantile was the censoring point. At two
  weeks it is +13.
- `estimateByPace` takes `measuredRange` and uses a row whose distance covers the case
  (`rangeFrom: "measured"`), else the pace rule (`"pace"`). `rangeCaveat(c, paced)` says which: the
  out-of-sample test once it has `SERVED_MIN_JUDGED` (1,000) cases, the in-sample share until then, and
  for an unmeasured distance that it can't be tested yet. The model carries its own `rangeNote`, so the
  timeline tool filters the caveat it already printed instead of rebuilding it.
- **No range is wider than 60 days** (`MAX_BAND_DAYS`, `boundRange`; owner's call): wider is cut to a
  third before the date and two thirds after, measured or not, PERM and wage requests alike, and the
  backtest's `bound_range` mirrors it so it tests what the page prints. Before it, a case filed this week
  got about 76 days.
- **No fallback on age** (owner's call): the newest measurement is always used. The test is kept running
  instead: GitHub's full pass every night, then the server's `permtracker-uscis@backtests` at 7:05 AM ET
  (one retry each, a failure row after two), the health check failing `estimator_backtest` past 3 days,
  and the scorecard alarm on a nightly clock (`everyDays: 1` on `BacktestAge`). `printedRangeCheck` is
  what the scorecard tile and sentences quote.
- First measured run (Oct 8): near the front, 6 days early to 13 late on 3,786 decided; the fixed rule
  held 27% at two weeks. The case page reads "Going by how far recent decisions landed from their dates,
  between ...".

**Wage requests get a day** (`estimatePwdDay` in `convex/lib/perm/calculators/pwdQueue.ts`): PERM wage
requests in process filed earlier (same day counted half) over DOL's measured exits a calendar day,
counted from the sweep's day. `perm_docs['pwd_day_queue']` is written after every PWD pass
(`write_pwd_day_queue`, in `finish_docs`): in-process counts by filing day and 28 complete days of exits,
each case once, today left out. `src/lib/pwdDay.ts` parses it with the backtest's measured range
(`perm_docs['pwd_backtest'].day`, now nightly); `PwdStatusResult` prints the day for an IN PROCESS
request, the month stays the fallback. First test (Sep 23 start): 2,728 decided, typically 2 days off,
99.5% within a week; the month method was 15 days from mid-month. The sample records it as
`PWD_DAY_MODEL` (`pwd-day`).

**Each subscriber's date is recorded once** (`predictWatched`, source `watched`): the scorecard reads
`perm_docs['watched_cases']`, case numbers only, which `check_watched_cases.py` keeps from Convex's
watched set and rewrites only when the set changes. Never put to a rival, excluded from `headToHead`,
and the public doc carries counts and errors only (`ScorecardDoc.watched`).

**An RFI case is dated from its own RFI day** (`estimateRfiCase`, `convex/lib/perm/calculators/rfiClock.ts`;
model `rfi-clock`). Of 1,021 RFIs our sweep followed from their first day, nearly all moved on day 31 of our
record (the 30-day response window, seen a day late), most went back to analyst review, and DOL decided those a
median 4 days later (middle half 2 to 7). So the date is the RFI day + 35, the range runs to the 30 days plus the
slow end, and the slow end is the record's own 90th percentile once measurable, an immigration attorney's two
weeks until then. `backtest_queue.py` measures it nightly (`rfiClock`, with `watchedFrom`, the log's first day:
an RFI begun on or before it has no known start and keeps the old answer) and tests it out of sample once the
record is 49 days long. The case page, the API, the daily sample (`RFI_PER_DAY`) and subscribers read
`rfiEnteredOn` (the newest entry into RFI ISSUED). An RFI past its window says so instead of a date.
AILA Doc. 24101705 (an OFLC panel, Sep 27 2024): "employers have 30 days to respond to PERM RFIs"; no DOL text
says so, and DOL's 2018 webinars gave "usually fifteen (15) days" for the old system's reconsideration RFIs.

**NORD is never expanded.** A badge said "notice of intent to deny" and a stage note "notice of results
of documentation"; DOL publishes no expansion (FLAG's 05/28/2025 release notes name the field only).

**The filing chart was tested as an early signal and lost** (`filing_chart_test` in
`backtest_bulletin.py`, weekly): for 4,152 readers between the two charts on 27 lines, the pace was
typically 2.7 months off, the filing chart's learned lag 3.0, their average 2.9.

**H-2B applications in DOL's assignment groups are dated by their group.** DOL randomizes the first three
days' H-2B applications into groups and works them in order (84 FR 7399, Mar 4 2019), and lists each case's
group on OFLC's news page (`FY26_JanPeak_PublicFacingReport.xlsx` and its siblings, discovered, never built).
`scripts/ingest_h2b_groups.py` (server, `permtracker-uscis@h2b-groups`, 8:45 AM ET daily) stores the case,
season, group and dates only (the lists name attorneys; that column is never read) in `h2b_groups`, and writes
`perm_docs['h2b_group_timing']`: each season's groups (percentiles over the group's whole line, read only once
that share is decided) and, for a season still being decided, `group_estimate`: last same-month season's
groups spaced by this season's applications, anchored on this season's own group A once half of it is
decided, each percentile switching to the group's own once measurable. `timingView({ group })` and the panel
use it; the sample records it as `H-2B-group` and waits for the list on a case filed in a season's first three
days. Tested on January 2026 (8,198 cases, from January 2025's groups): typically 5 days off, against 25 for
the page's season method; the middle half held 43%. `backtest_seasonal.py` scores each finished season.

## Oct 8 2026 (night): the scorecard reads waiting cases, a crash narrowed, four page changes

**The head-to-head counted a waiting case only once both dates had passed**, so a rival that answers
"today" for cases DOL's queue has passed kept every early win while its waiting misses went
uncounted. `settledWinner` in `src/lib/scorecard/score.ts` counts a waiting case for the later date as
soon as today is past the midpoint of the two (DOL can only decide today or later, so the earlier date
can no longer win; on the midpoint itself a decision today would tie). Each side gets a floor
(`oursAtLeastDays`, `rivalAtLeastDays`) over decided cases plus cases waiting past at least one date,
and `byKind` splits the comparison by our method: `working` (decision-pace), `passed` (stragglers,
dol-average), `rfi`. A floor of 0 is never printed: it only means dates not yet due. Retired methods
(`RETIRED_METHODS`) say so in every reading. The backtest's passed section scores `today` beside the
rate; `readOurs` prints both. Readings on Oct 9: in DOL's line we beat Rival A 3 to 2 (4 days against
13), B and C likewise; Rival A leads 10 to 2 on passed cases.

**"Cannot read properties of undefined (reading 'call')"**: about 2.5 to 3% of real desktop Chrome 154
and Edge 154 sessions, 0.06% of Mobile Safari, 0 of 24,000 headless scraper sessions. It fires 0.3 to
0.7 s after a full load inside a prefetched route's chunk (the (auth) error chunk via the header's Sign
in link, the case page via case-number forms), steadily on each build inside its own live window.
Ruled out, by measurement: release and `shared/` chunks differ (0 of 366), Rocket Loader, an incomplete
chunk graph (every dependency is in the chunks each entry's `e.O` list waits for and in the RSC row's
list), the standby slot (no traffic), Ahrefs. Webpack's JSONP callback skips a push whose chunk ids are
all installed and marks every pushed id installed, and every Next build shares `webpackChunk_N_E`, so a
foreign push (likely an extension injecting a Next-built bundle) is the one mechanism with nothing
failing. `chunkDiagnostics()` in `src/components/error/recovery.ts` records duplicate chunk ids,
non-build scripts (extensions by origin) and the deployment ids on every missing-module event, caught
or uncaught (`before_send`). If duplicates show, set `output.chunkLoadingGlobal` for the client build,
after a full build and test.

**Static chunk analysis that worked**: map module ids to files on the server (`[,{](\d+):` followed by
`function(` or `(params)=>`; single-parameter arrows `e=>{` exist too, so a module "defined nowhere"
needs a grep before it's believed), then walk a module's requires against the chunks its entry's
`e.O(0,[...])` list waits for. PostHog's frames come out with
`JSONExtractArrayRaw(ifNull(JSONExtractRaw(ifNull(toString(properties.$exception_list),'[]'),1,'stacktrace','frames'),'[]'))`.

**Pages.** `/perm-employers/under-review` leads with DOL's newest employer-wide move (`movesByDay`,
`dayHoldSentence`, `heldRanking` in `src/lib/employerStages.ts`), then who is on hold as bars, then the
moves by day; the stage table, rankings and full list fold. The case page draws the line ahead by filing
month (`lineAheadByMonth`, whose rows add up to `casesAheadOfDay`). Data pages carry `WatchBanner`
(off the lookup, preference and USCIS lookup pages). A filing month leads with its share decided
(`monthMakeup`), one bar, three tiles, the month's end dated by `monthEndDate` (the case page's own
`estimateByPace`, no date when it refuses), and `perm_docs['month_detail']`: `write_month_detail` in
the sweep, after `observed_decisions` whose publishable days it reuses; 0.8 s and 18 KB on production;
watched by the health check (3 days).

**A server-side file importing `@phosphor-icons/react` fails CI's gate even when only a client
component renders it**: use `/ssr`. `pnpm check` can't see source-scanning gates that don't name the
changed file; run `pnpm exec vitest run src/app/__tests__` (58 files, about 2 min) before a push that
adds files.

**The MCP door**: about 1,700 to 1,900 requests a day since the Registry listing (Oct 3), almost all
directories, uptime checkers and capability watchers (SentinelOracle every 3 minutes, mcpbeat, rokmcp,
BrickBlue, ProofBench, MCPWatch); 3 to 30 real tool calls a day, plus Claude-User from Anthropic's
addresses. No load worth acting on.

**The lookup challenge, measured** (Cloudflare samples, 5 hours): the scraper label 1 of 2,148
addresses through; other addresses 250 of 831 (iPhones 86 of 137). PostHog: 50 of 54 sessions that
submitted a case number reached the answer, median 4.1 s against about 0.7 s for the page. Loosening it
is the owner's call.

## Oct 15 2026: the estimates, measured again

Branch `calm/middle`, not live. Every change below was tested on data before it was made; two
proposals the data turned down are recorded so nobody builds them on the same hunch.

**Our sweep dates DOL's decisions a day late, and the wage-request day now says so.** FLAG shows a new
status the day DOL decides it; the PWD sweep reads it the next morning (Sep 10 to Oct 15: 20,803 of
22,425 wage-request decisions first seen between 5 and 6 AM Eastern, nearly all the rest by 10 AM; the
5-minute check of watched cases saw a handful in the afternoon). So:

- `scripts/lib_holidays.py`: `decided_on(seen_ms)` is the day before when seen before noon Eastern, that
  day otherwise; the site's federal holidays ported (`federal_holidays`, `is_dol_workday`, `add_workdays`,
  `workdays_between`). `decidedOnFromSeen` in `src/lib/scorecard/score.ts` is the TypeScript twin.
  `scripts/fixtures/federal_holidays.json` holds both holiday lists; `scripts/test_holidays.py` and
  `src/lib/__tests__/dol-workdays-parity.test.ts` hold each side to it, and the parity test also holds
  the backtest's constants to the site's.
- `perm_docs['pwd_day_queue']` dates each exit by DOL's day (`clock: "dol"`). The parser moves an older
  count's days back one, so a doc written by the old sweep still reads right.
- `estimatePwdDay` walks DOL's working days (the central `addBusinessDays`: weekends and federal holidays)
  from the day the count covers, at DOL's pace a working day (`measureWorkdayPace`: every exit, weekend and
  holiday ones included, over the working days in 28 days; a run of three dead working days is a shutdown and
  left out). A date that has come is the next day DOL works: any day now.
- **DOL's Fridays run at about half its other days** (277 to 484 against 688 to 988, Sep 16 to Oct 13), and it
  decided 89 on Columbus Day. So the range past the measured distances is DOL's fastest and slowest stretch of
  five working days (669 and 775 a day against 734), never its slowest single day, which would stretch a far
  range to months.
- Backtest (`scripts/backtest_pwd.py`, day section, `unit: "workday"`): the queue as the start day's morning
  sweep left it, outcomes on DOL's day. Sep 23 and Sep 30: typically 0 days off, bias 0; the calendar walk on
  the sweep's clock read about 2 days late on the same days. The range one working day either side, measured
  on Sep 23, held 91% on Sep 30. Only distances up to 20 working days can be judged yet.
- Scorecard: model `pwd-workday`; `pwd-day` is in `RETIRED_METHODS` (and `daily_monitor.py`'s copy) from
  Oct 15. `DOL_DAY_MODELS` are graded on DOL's day; every other method stays on the sweep's day it was built
  on (`gradeClock.test.ts`).
- **The PERM estimates still run on the sweep's clock**, where the sweep runs three times a day. Its main
  method shows no lean there, so it wasn't moved; the date a reader sees is the sweep's day.

**H-2A, H-2B and CW-1: recent windows lose, two H-2A cases change.** Each application dated on its own filing
day from DOL's certifications decided before it, January 2025 to March 2026 filings:

| | full history | last 365 days | last 56 days | last 28 days |
|---|---|---|---|---|
| H-2A, first-day clock | 8 days off | 8 | 9 | 9 |
| H-2B, from filing (the page uses the season a year back, 12) | 29 | 28 | 40 | 35 |
| CW-1, from filing | 11 | 10 | 11 | 10 (middle half held 39%) |

So no visa moved to a recent window. H-2A's first-day clock stays, except (`timingView`, `filedBecause`):
a first day more than 75 days after filing (2.3%, mostly range livestock herders, SOC 45-2093) was 25 to 75
days off by the first day and 16 to 17 from filing; a first day so close that the usual lead lands before
filing was 31 days off and 9 from filing. Both are counted from filing now, and the panel says why.
`backtest_seasonal.py` tests the page's mixed clock (`pooled/page`): middle half 52.8% against 51.0%.
A typical day that has passed reads "any day now" and is recorded as today (`viewEstimate`).

**The passed-queue rate keeps its 14-day window.** Four start days (Sep 9 to 30): the 14-day rate was
typically 2 to 7 days off with a lean of 0 to 3 days late; 28 days read 4 to 15 days late; a shift learned from
the week before overshot on the last start day.

**A `.pyc` kept a probe's mutation again**: a one-digit swap restored in the same second left the mutated
bytecode, and two later probes went red for the wrong reason. Clear `scripts/__pycache__` before and after
every Python probe.
