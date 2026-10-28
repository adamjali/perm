# Catch up with H1BPerm, and pass it (owner's call, Tue Oct 27 2026, 4:56 PM EDT)

Adam: "for all the stuff they have that we dont, i wanna do all ... even the language ... remember visual first ...
good summaries, what ppl care about, insights, all right there, not missing, well organized, expandable ... the full
cycle stuff like all in one place full position". Teardown: `~/.claude/explanations/20261027_perm_vs_landscape/`
(DETAILED-h1bperm.md, h1bperm-shots/). Every item ships with screenshots to Adam before it goes live.

Rules for every item: visual first; every figure dated and sourced; folds for detail; phone, dark, glued-text, axe and
phone-sweep checks; tests that can fail; no copying their words or design, only the idea; nothing they get wrong copied
("In DOL queue now 0" beside holds, pace from a partial day, hard-coded seasonal models).

## Phase 1: what they get right that we get wrong (about a day)
- [x] 1.1 I-485 inventory read daily, not the 6th to 10th (we show Aug 5; USCIS posted Oct 5 on Oct 26). Fetch now.
- [x] 1.2 Cases ahead counted by exact filing day for PERM (like pwd_day_queue), not the month spread evenly.
      Backtest: typical miss 3 days to 2 on three start days (31,000 decided). January 2026, the month DOL is
      working, is the big one: a Jan 20 filer had 2,097 too many ahead (about 3.6 days).
- [x] 1.3 PERM filing month from DOL's submitted date, not the case-number decode (~380 cases misplaced); guarded backfill.
- [x] 1.4 The overnight batch dated to the day DOL worked (Saturdays read 111 to 146 now).
- [x] 1.5 A daytime wage-request pass over the active months, so today's determinations show today.
- [x] 1.6 DOL's FLAG maintenance notice: read flag.dol.gov's own banner, show it dated on the board, case pages and
      data pages, name the pause in our health checks.
- [x] 1.7 /compare: H1BPerm's H-2B wage requests (P-400) are "partly"; employer pages reached by links beyond the 500.
- [x] Also Oct 27 evening: Sentry 59 (an LCA search for "Am" ran 40 s): `lca_cases_recv` index on production and a
      broad name read newest-first (0.5 s).

## Phase 2: the board, everything in one place (2 to 3 days)
Adam, 5:26 PM EDT: "keep individual and add the everything pages ... what if only interested in that ... but
everything makes it simple too, ours pieces dont make much sense ... rework it all ... good and perfect for everyone".
So: every page stays (people come for one thing, and they're what search finds); one board gathers the answer to each
question in sections that fold open and link to the full page; and the pieces are regrouped by the step of the
process they belong to (wage request, recruitment, PERM, I-140, green card line), with employers and wages as their
own, instead of "Wait times" and "Approvals and denials". The rail, the board's sections and the data overview
(/tools) use one map, so a page sits in one obvious place everywhere.
Design (Oct 27 2026, evening):
- **Where:** a new page, `/today` ("Where every step stands today"), in the sitemap, the rail's top, the header's Data
  menu and the palette. Every existing page stays where it is and keeps its address.
- **The map, one list:** the rail groups become the steps of the process, in order: Wage request, Recruitment, PERM,
  I-140, Green card line (bulletin, I-485, NVC, visas issued), then Employers and firms, Wages, Other visas (H-1B LCAs,
  H-2A, H-2B, CW-1, lottery, OPT). The board's sections, the rail and `/tools` all read that one list (siteMap.ts), so a
  page sits in one place everywhere. Every group's height checked against the rail's budget.
- **The board's top:** one row per step (wage request, PERM, I-140, final action, dates for filing): the day or month
  being worked, the wait now, decided on DOL's last working day, filed and decided over 30 days and so growing or
  shrinking, each with its date. The I-485 rows switch category and country.
- **Then one section per step**, each: three or four figures, one chart, the step's pages as links, and a fold for the
  detail. PERM's section carries the status table (today's and the week's change, from the event log), the line by
  filing month, and decisions over 30, 90 and 180 days.
- **Data:** a `perm_docs['board']` doc written by the sweep (flows from filings and `daily_decisions`; status moves from
  `perm_case_events`), so the page is one read. Missing parts are said, never zero.
- **Width:** one column, every block fills it or shares a row (the Oct 27 spacing fix).
The homepage's answer and a full board on /perm-queue (or a new /board), visual first:
- [ ] 2.1 One row per stage: wage request, PERM, I-485 final action, I-485 dates for filing. The exact day DOL is on,
      the wait now in days, the pace (days of filings cleared per calendar day), growing or shrinking, the 30-day change,
      decided today with its time. Category and country switches on the I-485 rows; retrogressed or advanced.
- [x] 2.2 "Is the wait growing" in one line per queue (on /today: filed against decided over 30 days, PERM and wage requests).
- [ ] 2.3 Status table: every status, in progress and closed, with its change today and over 7 days, by period.
- [ ] 2.4 Queue by filing month with today's change per month; open a month: by status, by filing day, by employer
      letter, each tappable to its case list.
- [ ] 2.5 Time travel: the queue on any past day (event log from Aug 26 2026).
- [ ] 2.6 Daily decisions 30, 90, 180 days, by day or week; analyst review over time; filed and decided per month.
- [ ] 2.7 Live refresh of an open page when the sweep moves (a cached version stamp; measure the server cost first).
Built Tue Oct 27 2026, evening (live with the next night deploy): `/today` reads straight from the tables
(`src/lib/db/board.ts`), not a `perm_docs['board']` doc yet. One station per step on a numbered track (wage request,
PERM, I-140, the EB-2 rest-of-world cutoff), each with its wait drawn on one shared scale and its move since the
week before or the quarter before in colour and arrow; the two balance panels (2.2); DOL's last working day as a
decided bar and the waiting statuses with their week's change (2.3, part); the 30-day pulse charts (2.6, part); the
bulletin grid with every cell's move coloured. Still open in Phase 2: the I-485 switches, the rail regrouped by step,
the month drill-down (2.4), time travel (2.5), live refresh (2.7), and the sweep-written doc.
Later the same night, from Sabrina's look at H1BPerm (texts, 8:38 to 9:43 PM EDT): each step on /today carries one
line of state, its figures folded (backlog shrinking or growing, getting quicker or slower, advancing, holding or
retrogressed), a "Pick a
step" picker sits under the track (3.1's "where you are" begins there), withdrawn is purple everywhere, and the
EB-2 vs EB-3 guide is retitled "EB-2 or EB-3: what's the difference?".

Overnight plan, Tue Oct 27 2026, 11:05 PM EDT (owner asleep, wants it right by morning): finish the last share
cards (API, the deadline, timeline, EB-2 vs EB-3 and green card line calculators, wage levels, employer compare, the
A-to-Z grids) and check all 91 at full size; phone and glued-text checks on /today, /about, /compare, /methodology,
/perm-queue; `pnpm check`; push before 1:30 AM for the 2 AM night run only if every check passes; read the live pages
and served cards after; a morning report with screenshots. Later: blue as a light second accent, the rest of Phase 2,
the planner (Phase 3, building on "Pick a step"), Sabrina's weekend roll-forward answer.

## Phase 3: one planner, every step to the green card (2 to 3 days)
- [ ] 3.1 Where you are now (about to file the wage request, wage request filed, PERM filed, I-140 filed or approved),
      filing date, category, country of birth, premium processing. Each step's date range from our measured methods:
      wage request (pwd day), recruitment, PERM (decision pace), I-140 (USCIS medians, premium 15 business days), the
      visa bulletin wait (our pace method, its backtest accuracy printed), I-485 (USCIS medians).
- [ ] 3.2 Every assumption shown and editable (visas a year, people per petition, I-140 approval, dropout, premium).
- [ ] 3.3 Your position at each stage: cases ahead, people ahead in your line, where DOL and the bulletin are.
- [ ] 3.4 The planner is the one place the case page, the queue pages and the tools link to.

## Phase 4: the record, deeper (3 to 4 days)
- [ ] 4.1 Load JOB_OPP_PWD_NUMBER from DOL's PERM files; link each PERM to its wage request (exact), employer and
      title (inferred, labelled). Fix the comment in convex/lib/pipelineMatch.ts.
- [ ] 4.2 Days from wage request to PERM on employer, firm and job pages; did a PERM follow each wage request.
- [ ] 4.3 EB-2 and EB-3 split of the queue from the linked wage request's education and experience (needs the wage
      file's education columns), labelled as an estimate.
- [ ] 4.4 A decided case's page: the dated timeline (wage request, job order, each ad and paper, quiet period, filing,
      decision, wage validity), employer size and year founded (EMP_NUM_PAYROLL, EMP_YEAR_COMMENCED), linked wage request.
- [ ] 4.5 A page per filing day listing every PERM and wage request filed that day, live status, paged and filtered;
      per employer letter inside a month. Kept out of the sitemap and behind a robots rule for crawl cost.
- [ ] 4.6 Law-firm filing speed: days from the end of the quiet period to filing, share within 14 days, clients;
      statistics, never a rating.
- [ ] 4.7 I-485 inventory history back to February 2022.
- [ ] 4.8 Lighter pages: visa bulletin 956 KB and employer pages 602 KB of HTML against their 343 and 335.

## Phase 5: the site in the readers' languages (weeks)
- [ ] 5.1 Bring the five guides up to the Oct 26 English guide now.
- [ ] 5.2 The language switcher keeps the reader on the same page, or the translated homepage when a page has no
      translation, never a guide they didn't ask for.
- [ ] 5.3 Translate the pages people use most, in order: homepage, case status, the board, the planner, processing
      times, wage requests, employer page shell, FAQ, status meanings. Data values stay DOL's and State's own words,
      glossed. hreflang both ways. Languages: our five (Chinese, Spanish, Brazilian Portuguese, Korean, Vietnamese),
      chosen by who reads the site; French, Russian and Hindi once the readership numbers say so.
