# Every estimate, and the ten things each one gets

Started Oct 7 2026 at the owner's request: every estimate the site makes gets the
same treatment PERM's decision date has. A box is ticked only when it is built,
tested and checked live. Rivals are letters; nothing here names one.

The ten things:

1. **One source**: every surface that shows it (page, calculator, API, assistant,
   embed, email) calls the same function.
2. **Written down before the outcome**, then graded.
3. **Tested on the past**, on a schedule, against real decisions.
4. **No hidden misses**: a case still waiting past its date counts against us.
5. **The range is checked**: printed ranges are measured, and the words quote the
   measurement, never a typed figure.
6. **Split by method**, each method named, so a change or a weak spot shows.
7. **Rivals compared** where a rival publishes the same kind of number.
8. **Shown**: public scorecard, admin page, morning email.
9. **An alarm**: the morning email warns when grades stop or a miss worsens.
10. **Alerts**: an email wherever someone can usefully be told it moved.

| estimate | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| PERM decision date | yes | yes (and each subscriber's date, once, from Oct 8) | yes (nightly from Oct 8) | yes | yes (measured by distance, nightly; quoted out of sample once 1,000 tested) | yes | yes (3) | yes | yes (nightly clock) | yes (case alerts) |
| PERM date for a case DOL's queue has passed | yes | yes | yes | yes | with PERM | yes | with PERM | with PERM | with PERM | yes |
| Wage-request day (from Oct 8; the month is the fallback) | yes | yes (`pwd-day`, and subscribers') | yes (nightly, day section) | yes | yes (measured near the front; pace spread farther out, said so) | yes | none publishes one | yes | yes (nightly clock) | yes (case alerts) |
| H-2A, H-2B, CW-1 "when DOL usually decides" | yes | yes (from Oct 8) | yes (weekly) | yes | yes (quoted on the panel) | yes | none found | yes | yes | yes (case alerts) |
| Green card line, months until current | yes | from the next bulletin | yes (weekly, since 2016) | yes | n/a: a single figure, its accuracy printed | yes (5 windows) | rival's API closed by robots.txt; its approach re-run on USCIS data, same dates (Oct 7) | printed on the tool | yes (stale test) | yes (bulletin alerts) |
| Priority date estimate | same arithmetic as above | as above | as above | as above | as above | as above | as above | printed on the I-485 tool | as above | yes (bulletin alerts) |
| Green card line, years at last year's pace | yes | not yet: needs quarters of USCIS's counts | not testable yet (one year of counts) | n/a | n/a | n/a | to check | no | no | no (USCIS side) |
| Bulletin release day | yes | yes (from the November 2026 bulletin) | n/a (archive floors are the measure) | yes | yes (middle half) | n/a | none found | yes | yes | yes (bulletin alerts) |
| Stage durations (RFI, hold) | yes | n/a until measurable | no | yes | no | n/a | none | no | no | yes (case alerts) |
| Filing chart as an early signal (bulletin) | n/a: tested, not used | n/a | yes (weekly, beside the pace) | yes | n/a | yes | n/a | no | no | n/a |
| H-1B lottery odds | n/a: DHS's own estimate, quoted | | | | | | | | | |

## Findings so far

- **Oct 8: the PERM range, measured.** The backtest now tests every weekly start
  day each night and measures a range per distance (the middle 80% of decided
  errors from the start days before). Near the front: the date 6 days early to 13
  late, judged at two weeks (at one week the late edge sat at exactly +7, the
  censoring point). Out of sample on Sep 23: 60.8% inside with 20.3% still
  waiting, against 43 to 50% for the fixed rule on the same days. The case page
  and the calculator print it; farther out the pace rule stays and says it can't
  be tested yet. Rival C's method re-run on every decided case: typically 11 to
  12 days off and early, within a week 28 to 30%; ours 3 to 4 and 71 to 79%.
- **Oct 8: wage-request day.** Requests in process filed earlier (same day half)
  over DOL's measured exits: on Sep 23, 2,728 decided, typically 2 days off,
  99.5% within a week; the month method was 15 days off from mid-month. Shipped
  on the lookup, recorded as `pwd-day`. One start day so far: the test grows nightly.
- **Oct 8: subscribers.** 12 decided subscriber cases replayed: typically 3 days
  off, 11 of 12 within a week. From Oct 8 each subscriber's date is recorded once
  (`watched`), never sent to a rival, counts only on the public page.
- **Oct 8: RFI.** The stage curve crossed its median: of 324 RFIs watched 30 days,
  276 had left on day 30 (AILA's summary of an OFLC panel says 30 days to respond;
  no DOL text found). DOL's 2018 webinars said "usually fifteen days" for the old
  system's reconsideration RFIs. Recommended: date an RFI case from its RFI day + 30.
- **Oct 8: H-2B assignment groups** (84 FR 7399, Mar 4 2019; DOL's per-case group
  files). January 2026: group A decided a median 41 days after filing, H 125, each
  group's middle half about two weeks. January 2025's groups predict January 2026's
  within 0 to 14 days (2 to 8 scaled by the 15% more applications). One pair of
  years: a lead to build before Jan 5 2027, when DOL lists the next groups.
- **Oct 8: filing chart.** For 4,152 readers between the two charts (27 lines), the
  pace was typically 2.7 months off, the filing chart's learned lag 3.0 (running
  late), their average 2.9. The pace stays; the comparison stays in the backtest.

- **Oct 7 (night): the PERM range.** Held 29% of 8,023 because it's about a week
  wide and drawn mostly after the date, while DOL decides a few days before it
  (48% of decisions came before the range began). The same dates: 60% within 5
  days either side, 77% within 7. Waiting on the owner to widen and centre it.
- **Oct 7 (night): priority dates.** Our pace against dividing the I-485s ahead by
  Table V's yearly visas, on the 9 USCIS reports held: 66 to 8 closer at 3 months,
  42 to 3 at 6; not settled (short window, and the division has fewer dates overdue).
- **Oct 7 (night): seasonal.** First daily sample records Oct 8 at 8 AM EDT (36 a day
  in the dry run). Decisions per day and two guides shipped.

- **Oct 7:** our 33 graded PERM dates came from three methods. The main method was
  typically 4 days off. DOL's published average, the fallback for in-line cases
  whose filing month DOL had passed, was 6 days off typically and 20 to 34 days off
  on 7 of 19. A backtest from five origins (Sep 10 to Sep 29, graded to Oct 6) put
  the measured left-behind rate level or best on every origin. On Sep 22, across
  3,194 cases, it was typically 6 days off and the average 29. The switch: the
  case page and the calculator date those cases by the measured rate.
- **Oct 7:** the printed range's coverage was typed by hand ("about 57%", "about 4
  in 10") while the weekly backtest measured 29% of 8,023 cases. The words will
  read the backtest's own figure.
- **Oct 7:** the seasonal backtest (both clocks, three history windows, five
  quarters, a quarter used once 95% of it is decided) kept H-2A pooled from the
  first day of work (51% in the middle half, 8 days) and CW-1 pooled from
  filing (58%, 10 days), and moved H-2B to the same quarter a year earlier
  (43%, 12 days; pooled held 21%). Every method missed January 2026's cap
  season by 28 to 40 days. The H-2B panel prints the measured 43%.
- **Oct 7:** 1,414 NOR ISSUED cases (rejections, 547 of 547 in DOL's file) and
  1,741 H-2B applications DOL's file had decided were reading as pending. Healed
  on the server with the sweep's new rule; the sweep keeps them so.
- **Oct 7:** the case search applied only the decided range to wage-request, LCA
  and seasonal files on a firm, state or occupation search. Fixed.
- **Oct 7:** the bulletin's "months until current" replayed on every bulletin since
  Oct 2016: a year past the cutoff, typically 7.7 months off and within a quarter
  of the real wait 23% of the time (India 10 months). Trailing windows of 1 to 5
  years were no better on the same 1,410 readers, so the method stays and the tools
  print the measured sentence.
- **Not testable yet, and why:** the green card line's "years at last year's pace"
  divides USCIS's count of the line by one fiscal year's green cards. Grading it
  needs the line measured again a year or more later; USCIS's quarterly counts go
  back about a year here. It is recorded as a target, not claimed.
- **Oct 7, parity:** layoff notices linked to an employer page went from 276 of 3,168
  to 485: an unmatched notice may now reach a live-only or no-PERM employer's page
  by exact name key, never a bare one-word brand ("Kaiser" had reached a small
  "Kaiser PLLC"). Debarments and layoff notices show on those pages too. The
  H-2A, H-2B and CW-1 search has its own social card.

