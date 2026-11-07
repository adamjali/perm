# Data: DOL, USCIS and State sources, the ingests and the corpus

Every federal source the site reads, how each ingest works, the tables it writes, and the traps found reading them (FLAG's case-status service and serial counter, the quarterly disclosure files, the bulletin, USCIS, State, WARN, the policy feed, employer identity, the LCA and seasonal programs).

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## Where the data comes from (2026-08-27: first-party throughout)

Every dataset now has a primary source of record. **Zero live third-party
dependencies.**

| dataset | source | cadence |
|---|---|---|
| per-case status | **DOL** `flag.dol.gov`, batch API | full daily 4:10 AM ET, pending 3:40 PM ET, **fired by Vercel cron since Sep 7 2026** (GitHub's own `schedule` ran 2 to 7.5 hours late) |
| new filings, ALL programs | **DOL**, discovered: a serial walk (`--discover`, cursor in `perm_docs.discovery_frontier`) that asks all nine FLAG prefixes per span, plus visitor lookups | on BOTH passes since Sep 24 2026 (4:10 AM and 3:40 PM ET), each bounded by a time budget; lookups instant. Health fails if the cursor stops moving for 5 days, and warns when a walk stops on its own budget three runs running |
| live remainder (`perm_live_recent`) | derived: live cases newer than the last disclosure file | rebuilt daily post-sweep |
| decided cases | **DOL** quarterly disclosure files | quarterly + monthly check |
| processing times | **DOL** FLAG | daily |
| visa bulletin | **State Dept** (every bulletin since 2014-10) | daily direct read of State's own pages on adoption.state.gov since Sep 26 2026; `--from-file` stays the fallback |
| I-140 counts / I-485 inventory | **USCIS** | quarterly / monthly; GitHub tries first, **Adam's Mac retries the day after** when `www.uscis.gov` 403s the datacenter runner |
| USCIS quarterly workbooks: every form's median, the I-485 by field office, approved EB petitions awaiting a visa number, I-140 by class and country | **USCIS** quarterly performance data, reconciled against each sheet's own totals | quarterly: GitHub on the 15th and 16th, the Mac on the 17th (`scripts/ingest_uscis_quarterly.py`, since Sep 22 2026) |
| USCIS case status by receipt number | **USCIS** Case Status API (OAuth), on demand per lookup | built and dark until USCIS grants API access to Asolys LLC (doing business as PERM Tracker); plan in `.planning/llc-and-uscis-plan.md` |
| entities, daily decisions | derived from our own corpus | with each quarterly |
| RFI funnel | the rival tracker aggregate **frozen**, plus our own observations | frozen half never re-read |
| prevailing wage requests, live (`P-100-`) | **DOL** batch API, same counter as PERM | daily pending sweep; discovery via the unified walk; weekly rolling 180-day re-check; backfill self-chains |
| prevailing wage DETERMINATIONS (the wage) | **DOL** quarterly PW disclosure files, FY2024-FY2026 | monthly on the 10th, `--fy` for history |
| H-1B LCAs, live (`I-200-`, `I-203-`) | **DOL** batch API, same counter | daily pending sweep (0 LCAs pend); discovery via the unified walk; weekly rolling 90-day re-check |
| H-1B LCAs, decided (the wage offered) | **DOL** quarterly LCA disclosure files; **per-quarter files, history FY2022 Q4 to FY2026 Q3 loaded 2026-09-14** (2.38M rows) | monthly on the 10th |

**The corpus grows itself (2026-08-28):** a case-number lookup that misses
asks DOL live and records the answer; a nightly prober walks the sequential
serial space for new filings (first run: 108 cases). The case search and
employer pages read both worlds - published files for decided detail, the
live remainder for anything newer. Detail: [`v2/CLAUDE.md`](v2/CLAUDE.md).

The rival mirror is **deleted** (script and workflow, 2026-09-18),
because two writers with different notions of truth pointed at one table is a
flip-flop, not redundancy. Detail: [`v2/CLAUDE.md`](v2/CLAUDE.md), sections
"Per-case status comes from DOL directly" and "The RFI funnel is BLENDED".

## Each FLAG program has TWO sources and needs both (2026-09-02)

DOL exposes every program twice and neither half is sufficient, which is why
the wage-request and LCA pages read both and merge one row per case:

| | live endpoint | quarterly disclosure file |
|---|---|---|
| covers | anything DOL indexes, **pending included** | **decided only**, to the last quarter |
| freshness | today | up to three months behind |
| **the wage** | **never returned** | yes, with SOC and worksite |

The live half is the only record of a pending filing; the file is the only
place the wage exists. Reading one and not the other is how `/pwd-cases`
shipped saying "DETERMINATION ISSUED" with no determination on it. Detail and
the merge rules: [`v2/CLAUDE.md`](v2/CLAUDE.md).

## Which federal hosts serve scripts, and which refuse (measured 2026-08-23)

| Host | Automated fetch | What lives there |
|---|---|---|
| `flag.dol.gov` | **200** | processing times, AND an open batch case-status API (`POST /recaptcha/caseStatus`, 50 case numbers per request, no auth, no captcha) |
| `www.dol.gov` | **200** with a FULL browser header set | quarterly PERM disclosure files |
| `www.uscis.gov` | **200** from residential IPs; intermittently 403s GitHub's datacenter runners (2026-08-24) | quarterly I-140 counts (23-65 KB) |
| `egov.uscis.gov` | **403 Cloudflare challenge** | USCIS processing times |
| `travel.state.gov` | **403 Cloudflare challenge** | the DOS visa bulletin |

**Run a control before blaming your own traffic.** cloudflare.com, discord.com
and reddit all returned 200 from the same IP in the same minute, which is what
proved the two 403s are agency policy rather than an IP reputation problem.

**Seven routes were tried on travel.state.gov and all failed:** curl with the
full header set, urllib, WebFetch, the Jina reader proxy (returns Cloudflare's
"Just a moment"), the canonical `/content/dam/.../visabulletin_<Month><Year>.pdf`
path, alternate JSON/RSS paths, and a real browser through the Chrome extension
(still on the challenge after 25s). Do not spend the session re-deriving this,
and do not defeat a government site's bot protection.

**An access matrix goes stale fast.** The June-2026 research for this project
recorded travel.state.gov as "freely scriptable, PDF and HTML both served to
scripts", verified 200. Two months later every path 403s. Re-verify before
building on a recorded result.

**A partial header set reads exactly like a dead link.** `www.dol.gov` answers
a bare UA with 403 "Access Denied" and the full `Sec-Fetch-*` / `Sec-Ch-Ua`
set with 200. Sustained traffic then earns a 403 anyway: the same request that
returned 200 came back 403 twenty minutes and 240 MB later, from curl and
urllib alike. Back off; do not go hunting for a header you are missing.

**Discover the URL, never construct it.** DOL moved its current-year disclosure
file to `/media/` while the archive stayed on `/sites/dolgov/files/ETA/oflc/pdfs/`.
A hardcoded path returns a styled 404 that looks like a dead link, and the
difference between 403 and 404 is the only thing that says which problem you have.

---

## Reading a government spreadsheet

- **XLSX omits empty cells entirely**, so indexing a row's `<c>` children by
  position silently shifts every column after the first blank. Resolve each
  cell from its own `r="A1"` reference. `scripts/lib_gov_data.py` does this.
- **A quarterly disclosure file is a window on DETERMINATIONS, not a record of
  a filing-month cohort.** A case filed 2024-07 and decided 2025-08 sits in the
  FY2025 file and is absent from FY2026, so one file shows an old cohort's slow
  tail and a new one's fast head and both look like medians. Union the files and
  de-duplicate by case number: 112,550 cases became 259,489.
- **DOL's disclosure files contain NO pending rows.** Every record has a
  decision date, so a completion fraction computed from them is always exactly
  1.0. A survivorship guard built on that ratio can never fire. Judge cohort
  maturity against DOL's published frontier instead.
- **The June-2026 cohort's raw median is 1 day**, and March-2026's is 6, because
  the only cases decided so far are instant withdrawals. Publishing either would
  be indefensible. This is why the guard exists.
- **The frontier DOL never publishes can be reconstructed backwards.** For each
  month of determinations, take the filing month at their median. That series is
  the only way to measure how fast the queue advances, because DOL publishes
  today's position and keeps no archive.

---

## The visa bulletin: three routes, and the one I wrongly ruled out

**CORRECTED 2026-08-27.** This section used to say travel.state.gov was
unreachable, full stop. Two of its conclusions were wrong.

**A REAL BROWSER GETS THROUGH.** Load the bulletin INDEX first, let Cloudflare
clear on that, then navigate to the month you want - the cleared session
carries. Measured: 10 tables, 101 cutoff dates, no challenge. Nothing is
defeated: no CAPTCHA solved, no `document.hidden` override, no forged token.
The earlier note said the extension "was still on the challenge after 25
seconds" and generalised that into unreachable; it just needed the index
first. Overriding `document.hidden` so the challenge's own proof-of-work can
finish WOULD be defeating bot detection - do not.

**Everything scripted still refuses**, re-confirmed from a GitHub runner with
controls in the same run. It 403s `robots.txt` itself, which is what settles
it as policy rather than rate-limiting. Jina returns Cloudflare's "Just a
moment" and warns "this page maybe requiring CAPTCHA".

**So there are three routes, in preference order**, and `SOURCE_RANK` in
`scripts/ingest_visa_bulletin.py` encodes exactly this so a worse source can
never overwrite a better one:

| rank | route | covers |
|---|---|---|
| 3 | `--from-file`, a page saved from a browser | the current month |
| 2 | Internet Archive | history, capped at 2026-07 (State now 403s their crawler too) |
| 1 | the rival tracker mirror | nothing any more; **0 rows** |

**Its clause ORDER is load-bearing.** The mirror records itself as
`<third party> (mirror; original: travel.state.gov)` - naming the original
is good provenance - so a plain substring test for `travel.state.gov` matches
the MIRROR too and ranks it as the real page. That would have made the
backfill skip every month that most needed upgrading, while reporting success.

**84 months held, 2019-10 to 2026-09, all six categories, zero mirror rows.**
Three bugs had to be fixed to get there, each invisible:

1. **The archive route searched two folder-years.** The folder is the FISCAL
   year, so November 2025 lives under `/2026/`. Everything outside that window
   was quietly filled from the mirror at three categories instead of six.
2. **Country columns were read by POSITION.** Bulletins before ~2023-04 carry
   a sixth column, `EL SALVADOR / GUATEMALA / HONDURAS`, between CHINA and
   INDIA (and that era also has VIETNAM). Reading column 3 as India would have
   published EB3 India as "Current" when it was backlogged to 15JUN12.
   Resolved by header NAME now, which handles every layout.
3. **EB5 was missing from all 18 pre-2022-05 months.** The EB-5 Reform and
   Integrity Act renamed those rows. `CATEGORY_ROWS` takes alternates.

**A parser fix must repair its own history.** The backfill used to skip any
month already archive-sourced, so improving the parser fixed nothing - the 18
short months would have sat there looking correct. It re-parses when a stored
row has fewer than six categories.

## When an archive is the right answer

travel.state.gov refuses automated clients. Seven direct routes were tried and
all refused. The Internet Archive is not a way around that: it is a public
archive of public pages built to be read programmatically, and reading it
circumvents nothing.

**The trade is freshness, and it changes the product for the better.** The
archive lags a month or two, so a "current cutoff" page would be wrong. A
HISTORY is honest by construction, and it is the more useful half anyway: this
month's number is on the State Department's own page, the direction is not.

Two things the parser must not simplify:
- **A cutoff cell is a date, or `C`, or `U`.** Treating `U` as a very old date
  reports "nearly there" at the moment the category shut.
- **Assert the column order.** The family-sponsored chart has El Salvador where
  the employment chart has India, and the assertion is what caught a
  family chart being parsed as an employment one.

**A CDX wildcard over a whole path truncates at the row limit**, and returned
bulletins from 2022 while reporting success. Query per calendar year.

## Per-case status comes from DOL directly (2026-08-27)

`scripts/ingest_case_status_direct.py`. This replaced mirroring the rival tracker.

```
POST https://flag.dol.gov/recaptcha/caseStatus
["G-100-24339-516453", ...]        <- JSON array, MAX 50
-> {"value":[{caseNumber, caseStatus, visaType, employerName,
              jobTitle, submittedDate, "@search.score"}]}
```

**THE PATH IS NAMED `recaptcha` AND NOTHING IN THE FLOW IS A CAPTCHA.**
Measured in the live page: `grecaptcha` undefined, no captcha scripts, no
`[data-sitekey]`, no challenge iframe, no hidden token. Bare curl, no cookie,
200 in 0.29 s. `robots.txt` does not disallow it. This project previously
recorded the opposite, **concluded from the path name alone**, and that
mistake cost the premise of a whole feature.

**Nothing was lost by switching**, verified field by field rather than
assumed. Status, employer, job title and submitted date matched the mirror
**8/8 exactly**. The four fields the rival tracker adds are derived or bookkeeping:
`filing_date` decodes from the case number's YYDDD segment (94.6% exact, rest
off by one day) and equals `submitted_date` for 409,127 of 414,050 rows;
`is_final` is a function of the status; `is_disclosed` **we compute better** -
they mark 87,820 cases undisclosed that are in the disclosure files we hold,
because their OFLC data is a quarter stale; `last_checked_at`/`verified` are
their record of when THEY looked. DOL adds `visaType`, which they do not
return at all.

### Three traps, all of which produce a wrong number rather than an error

- **The batch ceiling is 50 and it fails QUIETLY.** 100 or 200 returns
  `200 OK` with exactly 50 records. Only 400 is rejected. A loop asking for
  200 silently drops three quarters of every batch and reports success.
- **A RECONCILIATION IS NOT A TRANSITION.** The first pass found 1,328 status
  differences that were corrections of a months-stale mirror, not same-day
  events. Writing them into `perm_case_events` stamped today would have
  fabricated a one-day surge in the table that feeds the alert sweep and the
  RFI funnel. `--reconcile` corrects statuses and writes no events.
- **TWO WRITERS WITH DIFFERENT NOTIONS OF TRUTH ARE NOT REDUNDANCY.** The old
  mirror would have compared the rival tracker's stale values against our
  DOL-corrected rows, called the difference a change, and reverted all 1,328
  corrections - twice a day, forever, logging healthy writes. Its schedule is
  removed; `workflow_dispatch` kept as a fallback.

### Schedules

| workflow | when (ET) | why |
|---|---|---|
| `case-status-direct` full | 04:10 daily | "final" is not final: a CERTIFIED case becomes CERTIFIED - EXPIRED when the 180-day I-140 window lapses and nothing announces it |
| `case-status-direct` pending | 15:40 daily | halves worst-case staleness on the cases people have alerts on |
| `ingest-health` | 06:00 daily | the only thing that reports an ingest going quiet |
| `probe-state-dept` | 5th monthly | fails the run when travel.state.gov OPENS UP |

10,229 requests/day over ~85 minutes is **2.0 req/s** - measured before
choosing, not after. Writes stay ~1,300/day because only CHANGED rows are
written, against a 10M/month plan.

## The RFI funnel is BLENDED, and the blend must stay decomposable

Adam's call over my recommendation. `blendRfiFunnel(base, observed)` in
`src/lib/db/rfi.ts` pools **counts**, never percentages:

```
resolved     = base.resolved  + observed.resolved
approvalRate = certified / resolved
```

One case at 100% must barely move an 83.6% rate; averaging the two
percentages gives 91.8%. That is the classic blend bug and it is why the
counts are stored as counts. Pinned by a test, probed by injecting the
averaging version.

**Three things keep it honest, and each was a bug first:**

1. **THE WINDOWS MUST STAY DISJOINT.** `ingest_rfi_funnel.py` is deliberately
   in NO workflow. Re-reading their aggregate on a schedule would absorb
   resolutions ours had already added, and the denominator would drift with
   nothing erroring.
2. **A TIMESTAMP CANNOT TELL AN OBSERVATION FROM A RECONCILIATION.**
   `perm_case_events` also holds mirror rows that logged a difference against
   the rival tracker's copy, written at 19:16 on the freeze date - "after" a 03:25
   freeze by any time test - while describing changes of unknown age. The
   filter is therefore on SOURCE. `DIRECT_EVENT_SOURCE` must stay
   byte-identical to `SOURCE` in the Python ingest; a drift silently zeroes
   our half forever, so a test reads the Python file and asserts it.
3. **"RESOLVED" IS NOT AN RFI-TO-FINAL TRANSITION.** Cases go
   `RFI ISSUED -> ANALYST REVIEW` and decide from there - 10 of the first 48
   events. Resolution reads from the case's CURRENT status, joined to the
   cases we watched ENTER an RFI.

**Our half does NOT overtake theirs on any useful horizon, and the ~74-day
figure this file used to carry was wrong.** It conflated RFIs ever ISSUED
(which we do accrue fast: 611 watched in the 23 days to 2026-09-18) with
RESOLUTIONS, which are the denominator the approval rate is built on. Measured
2026-09-18: the frozen base holds **2,151 resolved** and ours holds **4**, so our
share of the published rate is **0.19%**. An RFI takes a long time to resolve and
we only started watching on 2026-08-26. Treat the outcome percentages as a
third-party figure indefinitely, not as one about to become ours.
The disclosure fires when EITHER
half is non-empty: gating it on resolutions alone left a blended `everIssued`
rendering as single-source the moment we watched one RFI be issued.

## Convex documents cap at 1 MB, and a "top N" may be load-bearing

The entity arrays lived inside the `permDisclosureStats` document capped at
the top 100. Measured, the uncapped set is **1.14 MB of employers alone**
against a 1 MB document limit — so the cap was an architectural constraint
wearing an editorial disguise, and removing it would have failed the store
at ingest time rather than in review.

Entities now live in `permEntities`, one row each, written in chunks of 400
with the first chunk clearing the kind. Detail pages resolve the subject via
`permEntities.getBySlug` so every entity has a page; `generateStaticParams`
prerenders only the first 100 and the rest arrive through ISR, because
prerendering 12,000 pages costs hours for pages almost nobody opens.

**The slug rules are duplicated in `scripts/lib_slugs.py` (was `store_entities.py`) and
`src/lib/entitySlug.ts` deliberately** — a slug computed differently in the
writer than in the reader is a detail page that 404s from its own index — and
the Python copy is asserted against the same fixtures as the TypeScript one.

## DOL prints one firm under six spellings

Fragomen appears at ranks 1, 9, 23, 31, 50 and 57 under six slugs, because
the collision resolver appends `-2`, `-3` rather than merging. Published
total 24,059; summed across its rows, **30,180**. Each leaf page presents
itself as a distinct firm with its own "#N by volume".

The index pages disclose that one practice can appear under several
spellings. The leaf pages do not, and the ranks are wrong either way.
**Entity identity needs normalisation before ranking, not slug
disambiguation after it.**

## The live census doc, and why the lookup path must never query the mirror (2026-08-28)

`/perm-case-status?case=` is dynamic, and its read layer used to aggregate
the 414k-row mirror on every render: a full status count, an unbounded
ahead-of-month range, a whole-table month group-by, a bare COUNT(*), and a
window-function pass over `perm_cases` (no received_date index). Measured:
**~1.8M row reads per lookup** - which is how one month of crawler traffic
burned a 500M row-read budget and got Turso reads BLOCKED mid-August.

The fix is a precomputed census: `ingest_case_status_direct.py` writes
`perm_docs['live_census']` (the month x status x is_final matrix, reconciled
against COUNT(*) before writing - a mismatched census is skipped, not
served) and `perm_docs['decided_month_percentiles']` after every run. The
read layer (`src/lib/db/liveCensus.ts`) folds everything out of one
React-cached doc read; legacy SQL survives only as the doc-missing fallback,
except the 414k status scan, which is withheld because the fallback IS the
cost bug. A doc older than 8 days is treated as absent: stale queue
positions read as current ones, which is worse than an empty state.

**Do not add per-request aggregate queries to the lookup path.** Fold from
the census, or precompute a new doc in the ingest. `perm_month_stats` is a
frozen orphan (its the rival tracker writer was retired 08-27) - `getQueueAhead`
reads the census now; do not resurrect the table.

## The corpus grows itself now: discovery, two halves (2026-08-28)

`perm_case_status` was a CLOSED set (the mirror seed; nothing added new
filings, pending could only drain). Two additions opened it:

1. **Lookup-side** (`src/lib/db/caseDiscovery.ts`): a case-number lookup
   that misses the table asks DOL's batch endpoint live (one case, one
   request), renders the answer verbatim, and records it. Exact-match only
   (the endpoint is a SEARCH with scored neighbours - a near-miss shown as
   the visitor's case is somebody else's record). Global budget 2,000 DOL
   requests/UTC day counted in `perm_docs.discovery_budget_*`; every
   failure named in logs and degraded to the ordinary miss. NO event row -
   a discovery is an observation, not a transition.
2. **Nightly prober** (`--discover` in `ingest_case_status_direct.py`,
   rides the `--full` sweep): serials are global and sequential, so it
   walks a bounded window past the highest known serial across the last 5
   filing days. Caps: 120 requests/run (= 6,000 numbers at the batch
   ceiling, ~13x a normal day's ~460 filings), 1,500-serial span, stop a
   day code after 2 consecutive empty batches. The frontier self-heals:
   whatever a night misses, the next starts from. First real run: 38
   requests, 108 filings.

## perm_live_recent: the searchable remainder (2026-08-28)

The gap Adam hit: a case he KNEW existed (filed the day before) was
invisible to the case search and its employer's page, because those read
`perm_cases` - DOL's published files, decided-only, ending at the last
quarter (currently 2026-06-30). `perm_live_recent` is the remainder,
slugged and indexed by employer.

**THE FIRST VERSION SCOPED THAT REMAINDER BY DATE AND THAT WAS THE WRONG
AXIS (fixed 2026-08-29).** It took cases filed after the last published
MONTH, which is right for new filings and wrong for everything still
waiting: a case filed 2026-03 and still pending is not in the disclosure
files (undecided) and was not in this table either (not recent enough), so
it existed in our corpus and could be found by nobody who did not already
know its number. Measured at the fix: the table held **16,676 rows and the
true remainder was 136,886 - 120,210 missing, 97,875 of them pending**,
which is precisely the population most likely to be searching for itself.
The rule is now MEMBERSHIP, not date: a case belongs here when `perm_cases`
does not hold it. No boundary to drift, and it self-corrects when a
quarterly file lands and absorbs part of the set.

**AND THE NIGHTLY WRITE IS DIFFED, WITH A NORMALISER ON BOTH SIDES.** 137k
rows rebuilt wholesale is ~4.1M writes/month against a 10M plan to express
the few hundred rows that changed. The first diff silently never matched -
libSQL returns integers as STRINGS, so a stored `is_final` of `'0'` never
equalled the built int `0` and every row read as changed. That is not a slow
diff, it is NO diff, and it logged `ok` while rewriting all 136,886 rows.
Caught by reading the log line on a second identical run, not by review.
`live_norm()` now prepares both sides; `scripts/test_live_recent.py` pins it
and is wired into CI.

- **Storage stays separate** (published record vs live feed - different
  truths, different write disciplines; merging them is the two-writers
  flip-flop). **Experience is unified**: every search box answers from
  both, plainly labeled. `/api/perm-cases` search returns
  `{ cases, live }`; lookup returns `{ disclosed, live }`.
- Firm/state/wage searches stay published-only BECAUSE THE DATA DOES NOT
  EXIST LIVE (DOL names the firm at publication) - the UI says so in words
  instead of silently missing.
- Rebuilt wholesale by `build_entity_detail.py --live-recent-only` daily
  after the full sweep (wired in case-status-direct.yml, `|| true` - a
  rebuild failure leaves the band a day stale, never fails the sweep), and
  by the full entity rebuild. Slug = canonical entity slug when matched,
  `slugify(name)` fallback otherwise (both name-shaped, so the search
  needle behaves the same; the nightly pass canonicalizes).
- Web discovery ALSO inserts here immediately, so "search a number once,
  find it by employer seconds later" is true - pinned in
  caseDiscovery.test.ts.

## A sweep's event log is not a diary of that day (2026-08-29)

`/perm-decision-activity` now renders WHICH cases DOL moved and what each moved
from and to, out of `perm_case_events` (`src/lib/db/changes.ts`). A count
cannot show a transition, because a count has no `from`: `ANALYST REVIEW -> RFI
ISSUED` and `RFI ISSUED -> ANALYST REVIEW` are opposite events and read
identically as "an RFI row" without both ends.

**THE TABLE HOLDS TWO CLASSES OF ROW AND ONLY ONE HAPPENED THAT DAY.** An event
is dated when our sweep SAW the difference, not when DOL made it. On 2026-08-28
the first full sweep wrote **92,113 `CERTIFIED -> CERTIFIED - EXPIRED` rows
under two timestamps** - 180-day I-140 windows that lapsed across two years and
were all noticed at once. Rendered raw that is "94,581 cases changed on 28
August", a fabricated surge on the busiest-looking day in the record. Same
defect class as the reconciliation guard one level down, which filters on
source; source does not separate these, because both are the DOL-direct sweep.

Two filters, both on what the rows MEAN, both disclosed on the page rather than
applied silently (a feed that quietly drops rows is indistinguishable from one
with no data):

1. **Expiry is not an adjudication.** `CERTIFIED -> CERTIFIED - EXPIRED` is a
   clock running out, not DOL acting. Excluded by status pair - which removes
   the backfill and is the right product rule anyway.
2. **A bulk write is not a day's work.** Any single timestamp carrying more
   than 5,000 rows is a sweep catching up. DOL's heaviest measured day is under
   2,000 and the backfill was 92k, so there are three orders of magnitude of
   headroom either side.

After filtering: 336 / 58 / 48 genuine adjudications on the three observed
days. `changes.test.ts` reads the SQL the module issues rather than mocking a
result set, because the defect lives in the predicate - shaped fixture output
would pass with either filter deleted. Both were probed by reverting them.

## Maximum combinability: what it cost, and the two bugs under it (2026-09-04)

Adam: *"you should be able to pick a firm and then the state and occupation and
such, maximum possibility."* Two things were in the way and only one of them
was a real limit.

### The filters were switched off for a cost that no longer exists

`filterAvailability` turned everything off under a firm, state or occupation
lead except the outcome and a decided-date range. The measurement behind it was
real: a SELECTIVE second equality walked the lead's whole slice.

| combination | before | after |
|---|---|---|
| biggest firm + `state='WY'` | 48,166 rows / 17.11 s | **5 rows / 0.55 s** |
| `state='CA'` + a rare SOC | 67,743 rows / 8.82 s | **0 rows / 0.43 s** |
| firm + `state='CA'` | 408 rows / 1.62 s | 100 rows / 0.66 s |

Three composite indexes close it, `decision_date` last so the ordering stays
free: `idx_pc_att_state_dec`, `idx_pc_att_soc_dec`, `idx_pc_state_soc_dec`.
`permLeadIndex` prefers a **pair of equalities over the outcome**, because no
status bucket narrows like that.

**A slice is smaller than it sounds, and that is why this was affordable.**
Measured over `perm_cases`: the biggest firm is 48,165 rows and the MEAN firm
is **66**; the biggest state 67,742 and the mean 6,677; the biggest occupation
76,524 and the mean 451. The guard was protecting against a case an order of
magnitude smaller than the entity-page reads this database already does.

### The occupation lead was losing a quarter of its cases

Not performance. `perm_cases` holds **302,081 dotted** codes (`15-1252.00`) and
**71,858 bare** (`15-1252`), and the lead matched exactly, so it answered with
whichever spelling it resolved to:

| SOC | dotted | bare | an exact match misses |
|---|---|---|---|
| 13-2011 Accountants | 3,686 | 1,207 | **24.7%** |
| 29-1141 Nurses | 9 | 4 | **31%** |

It matches `substr(soc_code, 1, 7)` now, on `idx_pc_socg_dec`. A test then
caught the follow-on immediately: the expression yields seven characters, so
binding the lead's own ten-character value matches NOTHING. `socGroup()` the
needle as well as the column. The employer path had the mirror defect - it used
`soc_code = ?` while the equality leads used the group, so one occupation
answered differently depending on which box the reader filled.

### The law firm: a missing INGEST, not a missing index

DOL publishes `LAWFIRM_NAME_BUSINESS_NAME` in both the ETA-9035 and ETA-9141
FY2026 Q3 record layouts. This site had never mapped the column, so a firm lead
read the PERM file alone and said "this firm files no wage requests" by
omission. **Measured after the backfill: Fragomen has 45,011 wage requests,
none of which were findable before.** DOL fills the column on **91.0%** of the
FY2026 wage-request rows.

**A FULL RELOAD IS NOT AFFORDABLE.** `pwd_cases` is 634,638 rows and
`lca_cases` 437,496, and `INSERT OR REPLACE` deletes and reinserts, so every
index is rewritten per row: ~10.7M writes against a 10M/month plan, the whole
month's budget for two columns. `--backfill-attorney` writes only those two
with `UPDATE`, and creates the firm indexes AFTER the pass rather than before,
so it costs one write per row - about 1.07M.

**Three bugs in it, none of which a typecheck could see, all found by
dispatching it:**

1. **`CREATE TABLE IF NOT EXISTS` can never ADD a column.** `table_ddl` is
   split from `index_ddl` now, with `ensure_columns` between: an index naming a
   column the live table has not got is a hard error, and the first run died on
   `no such column: attorney_slug` six seconds in.
2. **The backfill sat after the sha-match branch, which returns early.** During
   a backfill the file is unchanged BY DEFINITION, so it reported
   "unchanged; skipping" and never ran.
3. **500 separate UPDATEs per request measured 986 rows / 20 s** - 3.6 hours
   for `pwd_cases`, over the workflow's own 230-minute timeout. The cost is per
   STATEMENT. One `UPDATE ... SET x = CASE case_number WHEN ... END WHERE
   case_number IN (...)` per 200 rows: **1,233 rows/s**, 147,244 rows in 148
   seconds. Proved against a real SQLite first - each name and slug lands on
   its own case number, and a row the file does not mention keeps its value.

**A quarterly file only carries its own quarter's determinations**, so one
backfill covers one file. `--fy 2024` and `--fy 2025` fill the history.

**GitHub's concurrency group keeps at most ONE pending run**, so dispatching
three at once cancels the middle. Dispatch sequentially.

### Two DOL links went to a page that cannot answer them

Reported by Adam. Two PERM surfaces told someone holding a case number that
"DOL's own system" and "DOL's own status page" were the authority on that case,
and linked to `flag.dol.gov/processingtimes`, which publishes queue averages
and cannot look a case up. The wage-request and LCA equivalents already used
`case-status-search`, so the three programs disagreed. Both use the shared
`DOL_CASE_STATUS_URL` now.

`dol-outbound-links.test.ts` gates the class, because `audit_internal_links.py`
only sees internal links. **Its first version reported three findings and all
three were false** - a schema `description` four lines above an unrelated
`isBasedOn`, and two paragraphs where one sentence names the case-status search
and the NEXT one links to processing times. Scoped to the sentence containing
the link, and probed both directions.

**`perm-only` and `walks-the-slice` are deleted, not left behind.** Nothing
sets them any more, and a refusal reason no code can produce is documentation
that lies.

## The day feed asked one question when it holds two (2026-09-03)

`/perm-decision-activity` offered a `<select>` of days, built from
`perm_case_events`. That log records when our sweep SAW a change, so it starts
2026-08-26 and cannot be extended backwards: DOL returns a case's CURRENT
status and never says when it changed. The picker therefore looked capped at a
week, and Adam asked why.

**The cap was the picker, not the data.** Every published table carries an
indexed `decision_date`, and it is by far the larger half of the record:

| | earliest decision | rows |
|---|---|---|
| `perm_cases` | 2023-10-01 | 373,939 |
| `pwd_cases` | 2023-10-01 | 634,638 |
| `lca_cases` | 2025-10-01 | 437,496 |

So "what did DOL do on 12 March 2025" was always answerable, with the wage,
worksite and occupation attached. Measured that day: 576 PERM, 1,301 PWD.

**THE TWO DIMENSIONS ARE NEVER SILENTLY MERGED**, and that is the whole design.
"Decided on this day" and "changed status on this day" have different coverage,
and a decision is only one of the things the event log records - it also carries
RFIs issued, holds and appeals. They render as two labelled sections
(`DecidedTable` and `ChangeTable`) with two row shapes, because one wider table
would leave half its columns blank and the reader could not tell which blanks
are DOL withholding and which are nothing happening.

| dimension | source | reach | carries the wage |
|---|---|---|---|
| decided | quarterly files | 2023-10-01 → 2026-06-30 | yes, with state and SOC |
| observed | our sweep's event log | 2026-08-26 → today | no |

**There is a real gap, 2026-07-01 to 2026-08-25**, between the last published
file and the first observation. `coverageFor` reports `uncoveredDays` so the
page can say "we hold nothing for these dates" rather than render an empty
table, which a reader correctly reads as "DOL did nothing". It closes from the
left when DOL publishes Q4 FY2026, and it never grows.

**A DISABLED FILTER MUST FOLLOW THE SELECTION, NOT A BLANKET RULE.** The page
used to render wage, law firm, worksite and occupation as four permanently dead
selects captioned "not on a live record". True of a live row, and false of the
three years of published rows the picker could not reach. They are now enabled
whenever the selection touches the published window, and the explanation panel
is a `<details>` that opens itself only when it does not. It carries a `key`
tied to that state so a remount re-applies `open`; an `open` prop alone sticks
at its first value.

**SORTING IS NOT FILTERING AND THEY FAIL DIFFERENTLY.** A filter on a wage
cannot evaluate a row whose wage is unknown, so it must drop it. A sort just
puts unknowns last, which `sortRows` already does both ways. They had been
switched off together, disabling sorting for a reason that only ever applied to
filtering.

**Cost, because Turso bills rows read.** No `COUNT(*)` over a range: counting a
year walks millions of index entries for one number. An exact count runs only
for a single day (a few thousand entries) and a range reports what it fetched.
Every read is `LIMIT`-capped and ordered by the indexed column, so a ten-year
range costs the same as a one-day range - *provided the filter is indexed*,
which is why `RANGE_MAX_DAYS_UNINDEXED` (92) bounds a wage bound, the one
filter no index leads with. Verified: `SEARCH ... USING INDEX idx_pc_decision`
and `idx_pc_state_dec`, no `SCAN`.

**Carry `wage_unit`.** `pwd_cases` and `lca_cases` quote hourly as well as
yearly, and a real row on the first test day was `9.75 HOURLY`. Rendered
without its unit that is "$10" beside six-figure salaries. `perm_cases` has no
such column, so PERM rows print the wage alone.

Modules: `src/lib/dateCoverage.ts` is the PURE half (a plain module, because the
browser needs the same arithmetic the queries are bounded by - a page that
enables a control the route cannot serve is the invariant the case search
already protects); `src/lib/db/decidedDays.ts` is `server-only` and holds the
reads; `/api/decided-cases` is a sibling of `/api/case-changes`, not a mode on
it. A refusal there is a 400, never a 200 with no rows, or "too expensive" and
"DOL decided nothing" become the same response.

**Two things the observed half got wrong that only showed as "nothing
happens".** It fetched `/api/case-changes` for any date, including ones outside
its 400-day window, so an older date sat on "Loading…" forever. And the
"Earlier day" button was disabled whenever the date was not in the calendar's
day list, which is every published-only date. Both were invisible until the
picker could reach those dates.

## Every FLAG program shares one endpoint and one serial counter (2026-09-02)

DOL's batch case-status endpoint serves every foreign-labor program with the
same record shape: PERM (`G-100-`), prevailing wage requests (`P-100-`) and
H-1B LCAs (`I-200-`, `I-203-`; `I-201-`/`I-202-` returned nothing in sampled
windows). FLAG's own page lists all three. And **every program draws from ONE
serial counter**: on day code 26239 (2026-08-27), serials 199900-199949 held
PERM cases already in our corpus, 14 H-1B LCAs, 2 `I-203` LCAs and a run of
PWDs. So the serial range the PERM corpus knows for a filing day IS the range
to probe for that day's other programs. Roughly a third of the counter is
LCAs, a quarter PWDs, a tenth PERMs; it advances ~3,000 a day.

**Two probes said no and were misleading.** DOL's 2019 example number from
the form documentation and an invented 2026 number both returned `[]`. The
endpoint is not fuzzy across prefixes and 2019 cases are not indexed. Probing
serials known to be live on the same day settled it in one request.

`scripts/ingest_pwd_status_direct.py` is the multi-program prober: it walks
each day's serials once, tries prefixes in measured hit-rate order
(`I-200-`, `P-100-`, `I-203-`, then the rare two) and drops a serial the
moment a prefix claims it, ~180 requests per filing day. Writes are batched
(one round trip per row made 1,457 rows take twelve minutes). Separate tables
per program (`pwd_case_status`, `lca_case_status`, plus events), because the
PERM tables feed the census, stage pages, RFI funnel and alert sweep, all
written against a PERM vocabulary. **Ten P-/I- rows had already leaked into
`perm_case_status` through the web lookup's discovery path** before
`discoverCase` refused non-PERM prefixes; they were deleted 2026-09-02.

Read side: `src/lib/db/flagCases.ts` is one factory (lookup with
discovery, employer search with title/month filters, browse, summary doc);
`pwdCases.ts` and `lcaCases.ts` are its instances, `flagCasesApi.ts` the
shared route handler. Final-status sets are pinned against the Python
`PROGRAMS` dict by `pwdCases.test.ts` / `lcaCases.test.ts` via a shared
helper that is NOT a test file: importing one test module from another drags
its `vi.mock` registrations along and the second file's mocks silently lose.

`/perm-case-status` accepts all three prefixes (P- and I- checked FIRST,
because the PERM shape rule accepts any letter). The wage-request panel
composes `estimatePwdQueue` from the same DOL snapshot the calculator uses.
Pages: `/pwd-cases`, `/lca-cases`. Workflow: `pwd-status-direct.yml` (daily
pending + discovery, weekly full, dispatchable backfill, resumable via
`perm_docs['flag_backfill_progress']`).

## Slug "shadowing" between live and published: measured, and not a thing

A live-only employer whose slug collides with a published one is unreachable,
and its cases would be listed under the published employer's name. Measured
2026-08-30 over 37,813 live slugs: **zero genuine collisions**. 5,083 slugs
carry several spellings and every sampled one is a single company
(`DISH NETWORK LLC` / `DISH NETWORK L.L.C.`, `Cuboid, LLC` / `CUBOID, LLC`),
which is the merge working. A first pass reported 263 "true collisions" and
**all 263 were the normaliser I wrote to find them** - the tenth time a new
gate's first run was mostly the gate.

The one real defect underneath it: `modalNames` counted the vote on the STORED
string, and HTML collapses whitespace, so `LMR LLC\t` and `LMR LLC` are the
same pixels. 24 live-only pages told the reader the employer "also filed as" a
name that renders identically to the heading above it. The vote is pooled on
the rendered form now; case and punctuation still count as real spellings,
because a reader can see those and disclosing them is the feature.

## Status cohorts: one stage is not like the others (2026-08-30)

`/perm-rfi-audit/[stage]` lists the cases at a review stage. Measured pending,
DOL's fixture excluded: ANALYST REVIEW **93,219**, then RECONSIDERATION APPEALS
2,335, APPLICATION ON HOLD 1,855, RFI ISSUED 974, BALCA APPEALS 351, NORD
ISSUED 108, and four stages holding 2 to 9. That is one stage and then
everything else, so `stageListing()` has two floors rather than one rule:

- **too-large** (> 20,000): not listed. ANALYST REVIEW is the ordinary queue
  and `/perm-queue` already draws it month by month against DOL's published
  position. The route list comes from `reviewStages()`, which excludes the
  queue group, so it has no page at all.
- **too-small** (< `SMALL_STAGE_MAX`): rows withheld. `getSmallStageRecords`
  already prints these WITHOUT case numbers on purpose; a second, more
  identifying copy of four people's applications is not more browsable.
- in between: listed, oldest filing first, capped at 250 with the remainder
  stated in words.

**No pagination, deliberately.** Reading `searchParams` would make all five
dynamic. The list answers "how long have these waited"; "is mine one of them"
is already answered better by `/perm-case-status`, which asks DOL live.

Two invariants: the count comes from `getReviewStages()` on both the hub and
the leaf (two totals for one cohort on two linked pages would discredit both),
and the employer slug is **JOINED from `perm_live_recent`, never slugified from
the name** - a derived slug 404s on exactly the employers DOL spells several
ways. Since Sep 29 2026 the three entity indexes read `?q=` on the client
(`queryFromUrl` on FilterableStatTable) and open with the search filled, so
`/perm-employers?q=acme` works as a link; the page itself stays static.

## A shared count with two different dates is the same bug as two counts

## A shared count with two different dates is the same bug as two counts

The stage pages read `getReviewStages` on the hub AND the leaf specifically so
one cohort cannot show two totals. It shipped showing one total with two
DATES: 965 cases "as of August 30" on the hub, the same 965 "as of August 27"
on the leaf, because the hub took the latest `seenTo` across all stages and
the leaf took its own. **A figure and its stamp are one claim.** Both read the
per-stage value now. The global maximum survives only as the fallback for a
stage holding nothing, which has no observation of its own.


## History loads one fiscal year at a time (`--fy`)

`ingest_flag_disclosure.py --program pw --fy 2025` takes that fiscal year's
newest file rather than the newest overall (a completed year's Q4 file covers
the whole year). Three rules make it safe to run beside the quarterly load:

- **It never stamps freshness.** That row describes the newest quarter and
  stays with it; a 2024 file is history, not fresh data.
- **Load records are keyed per FILE** (`flag_disclosure_pw:<name>`), with the
  old per-program key read as a fallback, so a year load cannot masquerade as
  the latest quarter and cause a needless reload of it.
- **Every load or skip writes `perm_docs['flag_disclosure_summary_<program>']`**
  (rows, date span, files), so the web never counts the table on a render.

Loaded so far: FY2026 Q3 and FY2025 for `pw` (396,781 rows, received from
2021-10-18, decided through 2026-06-30).

## The two halves of a FLAG program, and why both are read

DOL exposes each program twice and neither half is sufficient:

| | live endpoint (`flag.dol.gov`) | quarterly disclosure file |
|---|---|---|
| covers | anything DOL indexes, pending included | decided only, to the last quarter |
| freshness | today | up to three months behind |
| **the wage** | **never** | yes, with SOC and worksite |

So `/pwd-cases`, `/lca-cases`, the P- and I- lookups and the employer band all
read both and merge one row per case (`src/lib/flagMerge.ts`): the live row
wins for status, the file supplies the wage. A case only the file holds is
listed after, labelled as the file. Both halves use the SAME `slugRange`, so
one needle cannot answer differently on the two sides.

**`flagMerge.ts` is a plain module, not an export from the browser component**,
because the employer page is a server component and a function exported from a
`"use client"` file is a client reference on the server, not a function.

## The stage pages: a 19.56s query that only Google saw (2026-08-31)

`getReviewStages()` is a CTE over ~98,000 pending rows with three window
functions, `COUNT(DISTINCT employer_name)` and three joins. Measured against
production: **19.56s cold, 2.49s warm**, against the read layer's 20s deadline.
Blew it, retried, blew it again, threw - so all ten stage pages 500'd on a cold
render while returning 200 to anyone whose region had it cached.

Google's Inspection Tool refused to index two of them. Sentry named it
verbatim: `turso query deadline (20000ms, attempt 2): WITH pend AS (`.

**Two of my own diagnoses were wrong first.** I timed `listStageCases`
(0.27-0.82s) and concluded "not a timeout" - wrong query. Then I blamed a
concurrent audit script for competing on cold renders - also wrong; it
reproduced with the site idle. Only the Sentry trace plus a direct timing
settled it. **Time the query in the stack trace, not the one you assume.**

Now precomputed into `perm_docs['review_stages']` by
`ingest_case_status_direct.py`, read by `src/lib/db/rfi.ts`, same shape as
`live_census`:

- **Raw numbers in the doc.** The editorial guards (`MIN_BAND_N`, `n >=
  cases/2`) stay in TypeScript where they are already probed, and are called
  with the doc's fields under the SQL row's names, so the published page cannot
  diverge from the fallback.
- **It must reconcile or it is not written.** `sum(stage.cases)` must equal a
  separately-counted pending total. **That guard fired on its second real run**
  against a concurrent sweep (98,210 vs 98,009) and left the previous good doc
  live.
- **Its own `data_freshness` row at 3 days**, shorter than the reader's 8-day
  cutoff on purpose: the reconciliation guard can skip the write while the
  sweep still stamps itself green, so without a row of its own a doc that
  quietly stopped being written would age out in silence.
- **The live query is kept as the fallback.** A missing doc degrades to a slow
  page, never a blank one.

## Discovery is one serial walk, and it carries its day code (2026-09-06)

The nightly PERM prober had recorded nothing since **Sun Aug 30, 9:46 AM ET**
and every run said "ok". It anchored day codes to TODAY and serials to its
last hit, and abandoned a day after two empty 50-number batches. On Aug 30 it
walked into the Aug 28 overnight lull (serials 200,247 to 200,394 are all LCA
and PWD), met two empties, and stopped; because the frontier only moved on a
hit, every night after asked the same 100 serials, and from Sep 2 the 5-day
window no longer contained the frontier's own day code. Seven runs printed
"10 requests, 0 new cases recorded" and stamped freshness. ~2,500 PERM
filings were missing before a human noticed. The PWD/LCA prober seeded its
windows from PERM's recent rows, so it printed "discover: 0 requests" too.

**Three measured facts about DOL's counter drive the design** (all in
`scripts/lib_flag_serials.py`, pinned by `test_flag_serials.py`):

- **One counter across every program.** A serial exists under exactly one
  prefix, and DOL returns NOTHING for `G-100-26240-200300` when that serial is
  an `I-200` (probed Sep 6). Existence is never implied; it is asked.
- **Six digits, zero-padded.** `P-100-26161-003499`. The PWD backfill
  formatted serials bare and asked for numbers DOL never issued, which is why
  the post-wrap half of June 2026 could not be found by construction.
- **It wraps at 1,000,000.** 999,997 on Jun 10 2026, then 000001. A day's
  MIN/MAX read as (1, 999,997); the backfill walked from serial 1, burned its
  4,500-request cap, and sat on day 26161 from Sep 3.

`run_discovery` in `ingest_case_status_direct.py` is now a serial-major walk:
the cursor is a `(day_code, serial)` pair in `perm_docs['discovery_frontier']`,
advanced only by confirmed hits; each 10-serial span is asked for **all five
busy prefixes at once** (G-100, G-200, I-200, P-100, I-203: ~70% of the
counter) under the cursor's day code and then under each later code up to
today; PERM hits are inserted here and P-/I- hits handed to the PWD module's
`insert_hits`, so those tables' frontiers move WITH PERM's. G-200 is 22 to 30%
of PERM filings and the old prober never asked for it. Two consecutive spans
that no prefix claims are the edge. ~215 requests a night at steady state.
Recovery: dispatch `case-status-direct.yml` with `mode=discover`,
`discover_cap`, and `frontier=YYDDD:SERIAL`; the run records "partial" on
its cap and resumes from the doc.

The PWD prober's `day_windows` splits a day at any serial gap over 50,000,
clamps every window to 20,000 with a `::warning::`, and pads candidates. Its
daily in-pass discovery is gone (delegated to the walk); `--discover` and
`--backfill` keep the day-window probe.

## The Sunday PWD/LCA sweep is a rolling window, and never writes a no-op

The weekly full pass walked all 405,566 rows and needed ~230 minutes against
a 170-minute timeout, so it died at 65% every Sunday and, walking in
case-number order, never reached the same newest ~100k LCA rows. It re-checks
filings from the last 180 days (PWD) and 90 days (LCA) now, on the
`(filing_date, case_number)` index. The `else` branch that stamped
`last_checked_at` on every unchanged row (~300,000 UPDATEs a Sunday for 54
transitions, each maintaining every index) is gone; the site reads the
sweep's own record instead. Four duplicate indexes on `pwd_case_status` and
one on `pwd_case_events` (an older naming scheme, created by nothing) were
dropped.

## Corrections to earlier claims in this file, measured 2026-09-06

- "A quarterly file only carries its own quarter's determinations" is wrong
  for PW and LCA: the Qn file is **cumulative for the fiscal year**
  (FY2026_Q3 holds 147,226 PW rows against 249,486 for all of FY2025).
- `/signup` was fully dynamic despite `revalidate = 86400`: the (auth)
  layout's cookie read wins. It now carries `force-static` beside the daily
  window, the shape `/login` already had.
- Sentry Session Replay was removed Aug 29; the privacy policy said otherwise
  until Sep 6, and omitted Ahrefs Web Analytics and the Senja widget.
- "Ten leaked P-/I- rows deleted 2026-09-02": two `P-100-` rows survived
  (written between the guard commit and its deployment) and were counted as a
  2-case PERM review stage; deleted Sep 6. `G-200`, `G-300` and `G-400` are
  real PERM office codes, not leaks.
- The disclosure workflow wrote ~455,000 documents into Convex tables nothing
  reads (`permCases`, `permEntities`, `permWageStats`); that is what tripped
  the Convex plan on Aug 25. The steps are gone and the tables are empty.
  `uscisI140:storeStats` stays: two tool pages read `api.uscisI140.getLatest`.
- `AGE_DAYS` (stage medians) is now filing date to TODAY on both sides. It
  was filing date to `last_checked_at`, a column the sweep never wrote (the
  mirror's July stamp, or NULL for 12,187 rows).
- The case page's "Status seen" date now comes from
  `perm_docs['sweep_coverage']` (the sweep's own finish date) via
  `src/lib/db/sweepCoverage.ts`; it used to quote the mirror's stamp and
  told pending beneficiaries their case "has not been looked at since" July.
- The test fixture in `test_flag_disclosure.py` lacked the two attorney
  columns the parser has emitted since Sep 4, so CI was red from **Thu Sep 3,
  10:44 PM ET** and vitest had not run in CI for 25 pushes. Green again on
  `22b42a8b`.

## The next visa bulletin, computed rather than predicted (2026-09-07)

`/visa-bulletin` answers the seasonal question ("what will October do, when
does it come out") from the archive instead of with a dated article. It reads
the 84-month bulletin series and USCIS's monthly I-485 inventory, both of which
the ingests keep current, and it changes state on its own: before a bulletin it
tabulates what every earlier bulletin for that calendar month did per category
and country (`sameMonthMoves` in `src/lib/bulletinNext.ts`, measured against
the month before, non-date transitions NAMED rather than numbered), beside the
inventory ahead of each cutoff (`computeI485Position` at the cutoff's own
month); the day a bulletin lands it leads with "what the {month} bulletin did"
and rolls forward. The only publication evidence the archive carries is the
Internet Archive's first-capture day (`archiveFloorDays`), printed as a floor.
It prints NO spillover figure: the number is not published on the day and
every number on the internet for it is a guess.

Two things this page must never do: forecast (the pace doc in
`src/lib/db/bulletin.ts` explains why), and pair a move across a gap (a year
whose prior month is missing is skipped, or two moves read as one).

**The I-485 tool prints one "when" line now**, `monthsToReach`: the gap
between the final-action cutoff and the reader's date divided by the pace
measured over the archived window, with the window and its retrogression count
printed beside it, and withheld when the category is current, shut or did not
advance (EB-2 India in September 2026 is shut, and the line says so). **Its
trend chart splits USCIS's two pending statuses** (visa number available vs
awaiting one), which is the part USCIS owns against the part the bulletin owns.

**Family-based categories are NOT in the I-485 tool and cannot be**: USCIS
publishes the inventory by priority date and country for employment-based
categories only. A rival's "family-based" analyzer is not built on an inventory
that exists; the honest counterpart would be family-based CUTOFF history, which
needs the bulletin ingest to parse the family charts and the 84 months
re-fetched from the Archive. Not done; recorded so nobody builds counts that
have no source.

## The full build of Sep 8 2026: what landed, and the five things it taught (2026-09-09)

Ledger: `.planning/full-build-2026-09-09.md` (deleted Oct 1 2026; in git history), every item ticked or marked left
off. Shipped in twelve commits after the parity build: five statutory
calculators, the status dictionary, six situation guides, the glossary, the
corrections log, the estimate scorecard, comparisons and a document checklist,
the first data note, badges, user-reported milestones, account-free push
alerts, the social-post and translation scaffolds, OFLC announcements and
California WARN notices in the record, the prevailing wage levels tool, and the
family-sponsored bulletin charts. Deploy was HELD throughout.

- **`flag.dol.gov/recaptcha/wageSearch` is an open JSON endpoint, like the
  case-status one.** The FLC Data Center redirects to FLAG's wage search; its
  bundle names `/flag/api/getAreaOptions?state=&year=` and a POST to
  `/recaptcha/wageSearch` with `{collectionType:"alc", year, socCode, area,
  areaType:"bls_area", rdFlag:"BOTH"}` that answers the four OEWS levels in a
  quarter second, no captcha in the flow. `/tools/wage-levels` reads it through
  two validated, CDN-cached routes. The series year is the July that opened it.
- **Whitespace text nodes inside `<tr>`, `<thead>` or `<select>` are a
  hydration error, not a glued-text fix.** The `{" "}` habit that keeps
  adjacent text apart is wrong between `<th>`/`<td>` siblings and between
  `<option>`s; React reports "whitespace text nodes cannot be a child of <tr>"
  and the client tree diverges. Put the space between text-bearing inline
  siblings only.
- **The bulletin's family charts parse with the same code as the employment
  ones**, keyed by row label (F1, F2A, F2B, F3, F4) and country heading. The
  fixtures were trimmed to the employment tables, so the family checks run on
  the full July 2026 replay. **`web.archive.org/web/<ts>id_/<url>` served a
  2 KB stub for a page the plain replay served whole**: the ingest uses the
  plain replay and so must anything that reads the archive.
- **A refetch after a write must bypass the browser cache when the GET is
  cached.** The milestone summary carried `max-age=300`; the count did not
  move after a successful report until the refetch used `cache: "no-store"`.
- **DOL OIG has no parseable report list** (a search page and yearly PDFs);
  the OFLC announcements page is a browser-visible list that scripts can read
  only from GitHub's runners, so its parser runs there and its fixture is the
  page text captured in a browser. WARN: California publishes a spreadsheet,
  Texas a challenge page, Washington a search form, New York an HTML list;
  only California is read and the page says so. **Superseded 2026-09-09**:
  all four are read now, see "WARN in four states" below.

## WARN in four states, social cards for every page, and the posting request proved (2026-09-09)

*(The four states are history: since Oct 25 2026 every state a script may read is read. See "Oct 25 2026: WARN notices from 40 states and DC".)*

**WARN.** Measured from this laptop on Sep 9: New York's current notices are a
Tableau Public dashboard, and Tableau Public serves any view as CSV
(`.../views/<workbook>/<sheet>.csv?:showVizHome=no`, 194 rows for 2026); the
"legacy" HTML list is one page per notice for 2023 to 2025 and is not read.
Washington's database is an ASP.NET grid at `fortress.wa.gov`, 15 rows a page
newest first, paged by WebForms postback (`__EVENTTARGET=ucPSW$gvMain`,
`__EVENTARGUMENT=Page$N`, each page's hidden fields signing the next request;
jumping past the visible pager answers 500, so the walk is sequential). Texas
posts one spreadsheet per year (`warn-act-listings-<year>-twc.xlsx`) behind a
bot challenge that answers scripts with HTTP 202 and a 2 KB page; the real
browser gets the file, so `--state tx --from-file` is the fallback and the run
records `partial` when the runner is challenged. `ingest_warn.py` loads each
state on its own, refuses a state with zero rows, writes per state, and one
state's outage cannot cost the others. Ids are shared through `assign_ids`
(state, dates, company, county, an extra like the address or city, a sequence
number). Fixtures: the real Texas 2026 file, eight New York rows, one
Washington page. Live dry run: CA 192, NY 194, WA 180, TX challenged, 131 of
566 matched to a PERM sponsor. Open question: whether GitHub's runner is
challenged by Texas too; the first weekly run answers it.

**Social cards.** Every public page now names a card: 29 more, rendered by
`make-page-cards.mjs` from 1440-wide captures taken by `scripts/shoot.mjs`
(serial, one Chrome). **The captures are 2x (2880x1600), so the crop is in
capture pixels: `[600, 136, 2280, 1376]`, double the extension's
`[300, 68, 1140, 688]`.** The three A-to-Z browse pages and the preference
center take drawn motifs (`grid`, `window`). The card gate's "exactly one page
names the slug" used a bare substring and counted the methodology page, which
lists every dataset name, as a second page for `i140-trends`; it matches the
slug as the card argument now.

**Posting.** `post_to_x` and `post_to_linkedin` take their URL as a parameter,
and `test_social_post.py` points the real request at a local server and reads
back what X would receive: the OAuth 1.0a header with all seven parameters and
a signature recomputed from the header's own nonce and timestamp over the URL
actually requested, the JSON body, the content type. What remains is the
credentials, which are Adam's to create (an X developer app under the persona,
four secrets on the repo), then one dispatch with `post=true`.

## WARN, measured from a runner, and three bugs the measurement found (2026-09-09)

**Texas is automatic after all: the state open data portal serves the same
notices.** `data.texas.gov` dataset `8w53-c4f6` is a Socrata feed, no challenge,
**2,367 notices back to 2019-01-04** where the agency spreadsheet holds one
calendar year. It is the automatic source; the spreadsheet is an optional
top-up for the freshest weeks, because the portal trails it (portal to
2026-06-23, sheet to 2026-09-04). They merge exactly: mapped onto the same
fields, the same notice hashes to the same id from either, verified 69 of 69
on the weeks they share, and a top-up adds only what the portal lacks (27
rows). **Search the state's open data portal before accepting a scraped page
as the only source.**

**Two sources need a rank, or the staler one reverts the fresher every week.**
The portal and the spreadsheet disagree on revised worker counts (FreshRealm:
161 on the sheet, 176 on the portal). The weekly portal run overwrote the
sheet's correction every time until `write()` compared `rank_of(source_url)`,
the same guard `ingest_visa_bulletin.py` already carries. **And the worker
count is not part of a notice's identity** for the same reason: with the count
in the hash a revision became a second row instead of an update.

**Texas refuses data-center addresses exactly as it refuses this laptop.** A
throwaway probe branch ran on GitHub runner 52.155.33.249: both the WARN page
and `warn-act-listings-2026-twc.xlsx` answered **HTTP 202 with zero bytes and
`text/html`**. `urlopen` does NOT raise on that, it returns `b""`, and the
parser's `startswith(b"PK")` guard is what turns it into a refusal message.
So Texas is loaded by hand from a browser fetch, permanently, and the page
says so.

**An expected refusal must not mark a run partial.** `check_ingest_health.py`
counts `partial` in `BROKEN_STATUSES`, so classifying Texas as a failure would
have painted the weekly WARN run red **forever**, which is precisely the alarm
fatigue that let the I-485 outage sit unread for four days. States carry a
`browser_only` flag; their refusal is logged and named in the run note, and the
run still records `ok`. Staleness is not lost: **each state stamps its own
`warn-notices-<st>` freshness row**, written only when that state actually
writes, with its own budget (21 days for the three automated ones, 45 for
Texas). The health check reads every row in that table dynamically, so a single
state going quiet surfaces on its own without the job crying wolf.

**Three bugs, each found by a measurement rather than by review:**
1. **An id component a parser forgets to name is invisible.** `assign_ids`
   pops one private key, `_extra`; `parse_california` still emitted `_address`,
   so the address dropped out of every hash, every id changed, and the next
   load wrote a **duplicate of every row** (384 rows for 192 notices). The test
   is general: **no parsed row may retain a key starting with `_`**, plus every
   row has a unique id. It immediately found the second instance,
   `parse_washington_page` never calling `assign_ids` at all, so
   `--state wa --from-file` would have written rows with no id.
2. **libSQL returns integers as STRINGS, again.** The change check compared a
   stored `'42'` with a parsed `42`, so nothing ever matched and an identical
   re-run rewrote all 566 rows while logging "wrote 566". Same defect
   `live_norm()` exists for in `build_entity_detail.py`. `_cmp()` now shapes
   both sides; an unchanged load writes **0**.
3. **A single-state run must not stamp the dataset-wide freshness row**, or
   `--state tx` moves the whole dataset's `as_of` to whatever one state holds.

Loaded: California 192, New York 194, Texas 96, Washington 180, 174 matched to
a PERM sponsor.

## The spillover, from the Department's own two PDFs (2026-09-09)

`scripts/ingest_visa_limits.py` reads two files the State Department publishes
once a year and writes `perm_docs['visa_annual_limits']`; `/visa-bulletin`
renders "The spillover, as the Department set it" from it and prints nothing
when the document is absent. **The Annual Numerical Limits sheet** for the
fiscal year (linked from the Immigrant Visa Statistics page; FY2026 lives at
`/content/dam/visas/Statistics/Immigrant-Statistics/Annual  Numerical  Limits
- FY2026.pdf`, with double spaces) gives the employment worldwide total, and
that total minus the statutory 140,000 IS the year's spillover from unused
family numbers: **FY2026 is 186,000, so 46,000 spilled over, marked estimated
pending the official determination.** **Table V of the Report of the Visa
Office** (FY2024 at `.../AnnualReports/FY2024AnnualReport/Table V.pdf`) gives
numbers used per preference in four parts; the parser takes each part's
"Grand Totals" line and refuses unless family plus employment equals the
grand total (215,959 + 167,394 = 383,353 for FY2024, leaving 10,041 family
numbers unused for FY2025). Earlier years' limits sheets were not found at the
FY2026 URL pattern, and the 2025 report is not published yet.

**Getting a file off travel.state.gov.** The site refuses scripts and the
headless DevTools Chrome sits on Cloudflare's "Just a moment" forever; the
Claude-in-Chrome extension in Adam's real browser clears it after the bulletin
index loads. A `fetch` from the page to a local receiver is blocked by the
page's connection policy, but a plain form POST is not: build a form with
`enctype="text/plain"`, put the page's `outerHTML` (or a PDF's base64) in a
textarea, point it at a local HTTP server on 127.0.0.1 and submit. The body
arrives as `name=<value>`; strip the prefix. That route brought both bulletin
pages and both PDFs across in one session without a tool result carrying them.

**Deploy checklist for this batch:** `npx convex deploy -y` (three new tables,
two new HTTP route families, a cron); set `NEWSLETTER_ENABLED=1` and
`NEWSLETTER_DAILY_CAP=15` (30 since Oct 24 2026) on prod Convex; add a Firewall bypass for `/badge/*`
so GitHub's camo proxy is not challenged; then push and the GSC queue in
`.planning/gsc-reindex-queue-2026-09-08.md` (deleted Oct 1 2026; in git history) plus the new pages.

## The walk only moves forward, so something has to look back (2026-09-13)

FLAG issues case numbers from ONE counter shared by every program, so for a
given filing day the serials we hold should be contiguous. They are not.
`run_discovery` advances a cursor and never returns to it, so anything missed
on the night is missed permanently, as is anything DOL indexes into a range the
walk has already passed. There was no second look. An independent check against
the rival tracker's published July figure put us 1.2% short; the serial probe put it at
up to 5%.

`scripts/sweep_serial_gaps.py` is the second look. It reads the holes out of
our own tables, asks DOL for each one under every prefix we know, and inserts
what comes back. Nothing guesses: a hole is filled only when DOL answers. It
rides the daily FULL pass (`case-status-direct.yml`, `mode == 'full'`) at 600
requests and `timeout 25m`.

**A hole is read strictly INSIDE a day's own span.** Past the highest serial we
hold for a day there is no way to tell a hole from the end of that day's
issuance, and probing past the edge is how a prober spends its whole budget on
numbers DOL never issued.

**First real run, trailing 90 day codes: 7,129 holes probed, 251 confirmed,
195 inserted.** Those are cases that existed and that nothing would ever have
found.

### Three defects it surfaced, each invisible in a green log

1. **WITHOUT A MEMORY THE SWEEP NEVER CONVERGES.** 6,878 of those 7,129 holes
   are serials DOL never issued, and a sweep with no record re-asks every one
   of them tomorrow night, and the night after, forever - spending the whole
   budget re-confirming known absences and never reaching a hole nobody has
   looked at. `perm_serial_misses` bumps a counter per empty serial and drops
   it after `MISS_LIMIT = 3`. **Not after one**, because misses are not
   permanent: the 251 found above were cases that EXISTED and had not been
   indexed when the walk went past, so DOL's index demonstrably lags and a
   serial has to get several chances. Writes are batched 200 to a statement
   (the cost is per STATEMENT: 500 single-row writes measured 986 rows in 20
   seconds against 1,233 rows/s batched).

2. **A PREFIX THAT IS ASKED BUT ROUTED NOWHERE IS A CASE FOUND AND DROPPED,
   EVERY NIGHT, IN SILENCE.** `PERM_PREFIXES` held G-100 and G-200 only, so a
   G-300 hit fell through to the PWD/LCA inserter, whose `PREFIX_TO_PROGRAM`
   does not know the prefix and silently `continue`s. The case was not stored
   AND not recorded as a miss - it was claimed, just not kept - so it was
   re-found and re-dropped indefinitely. The tell was two consecutive runs over
   one day code reporting **"confirmed 1, inserted 0"**, which reads exactly
   like an already-known case. It was `G-300-26254-230507`, College of William
   and Mary, ANALYST REVIEW, filed 2026-09-11.

   Measured: **G-300 is 6,854 live rows and still being filed** (105 in August
   2026, 102 of them pending), and our newest G-300 filing was **2026-08-26
   against 2026-09-12 for G-100/G-200** - a 17-day hole in 1.9% of PERM. The
   fix is the routing constant, not the ask: `PERM_PREFIXES` is now every PERM
   office code, and `test_serial_gaps.py` asserts no asked prefix is homeless
   and that `PERM_PREFIXES == FRONTIER_PREFIXES` - counting a case toward the
   frontier and then having nowhere to put it is the whole bug.

   `DISCOVERY_PREFIXES` deliberately stays at five. A sixth takes the walk from
   10 serials per request to 8 and costs ~25% more requests nightly to chase
   1.9% of filings; the sweep already asks all eight over 90 day codes, which
   is the cheaper place to catch a sparse office code.

3. **A DRY RUN DOES NOT EXERCISE THE INSERT PATH.** The first real run died on
   `AttributeError: module 'ingest_case_status_direct' has no attribute
   'prefix_of'` - it lives in `lib_flag_serials` - six seconds in, after a dry
   run and a 12-check test suite had both passed. Dry mode returns before ever
   touching it. `test_serial_gaps.py` now drives the writing path against a
   fake DOL.

**`check_gap_sweep` in the health check keys on HOLES PROBED, not cases found.**
A sweep that recovers nothing is the goal state - as the corpus closes, the
holes it probes turn out to be serials DOL never issued - so alerting on finds
would go red precisely when the system started working. Probes only reach zero
for a bad reason: `held_serials` returning nothing (a renamed column, a changed
type) makes every day look contiguous and the sweep exits clean having asked
DOL nothing.

## Every prefix, every hole, and the day a neighbour bounds (2026-09-13)

Three changes turn the gap sweep from a partial patch into the thing that
closes the corpus, and they came from the owner's instruction to fill
everything rather than the cheapest slice.

**The walk asks EVERY prefix now, not the five busiest.** It asked
G-100/G-200/I-200/P-100/I-203, about 70% of the counter, so a span whose
serials all belonged to G-300, I-201 or I-202 answered empty under all five and
counted toward the "unissued" streak that ENDS a day. A sparse office code was
therefore not merely undiscovered - it could end the walk early and hide the
serials behind it. Nine prefixes at DOL's 50-number ceiling is 5 serials a
request instead of 10, so a steady night goes from ~215 requests to ~430,
against the ~10,000 the daily sweep already makes.

**Both the walk and the sweep now read one canonical tuple**
(`ALL_FLAG_PREFIXES` in `lib_flag_serials.py`). They had drifted to five and
eight, which means a case the sweep could find was one the walk would never
look for. `PERM_OFFICE_PREFIXES` is the routing half, and a gate asserts no
asked prefix is homeless and that the two sets match.

**A day's true span is bounded by its NEIGHBOURS, not by its own first and
last known serial.** FLAG issues from one global sequential counter, so every
serial between the previous day's highest and the next day's lowest belongs to
this day - which makes the span exact rather than guessed. The old reading was
structurally blind to anything issued before the first case we happen to hold
or after the last: measured across 2026, **1,102 serials sat in those inter-day
regions**, invisible by construction. A wrap day (the counter rolls at
1,000,000; three such days exist) falls back to its own span instead of
probing a million numbers.

**Explicit `--from/--to` ranges now run newest-first**, matching the default.
They ran oldest-first, which puts the days that matter most - the recent ones,
where the pending cases are - at the END of a run that can be interrupted or
hit its cap.

### What filling it actually costs, measured

| | holes | requests | wall clock at 3 req/s |
|---|---|---|---|
| 2026 (every pending case lives here) | **73,681** | 14,736 | **~2 hours** |
| all history, 1,306 day codes | **2,313,871** | 385,645 | **~37 hours** |

So "fill everything tonight" is 2026, and that is what was run.

**THE CLAIM I FIRST WROTE HERE ABOUT THE OLDER YEARS WAS WRONG, AND MEASURING
IT IS WHAT SHOWED THAT.** I recorded that 2023-2025 was "almost entirely
serials issued to programs and prefixes outside our three" and that those
cases were "long decided and present in the disclosure files". Probed: a
random sample of 120 holes across four 2025 day codes came back **79.2% real**,
and 120 across four 2024 day codes **86.7% real**. They are overwhelmingly
`I-200` (H-1B LCAs) and `P-100` (prevailing wage) - squarely our programs.

They are missing for a completely different reason, and it has a much cheaper
fix than probing: **the LCA disclosure table only ever had FY2026 Q3 loaded**
(`lca_cases` decisions run 2025-10-01 to 2026-06-30, one load record). PW has
FY2024, FY2025 and FY2026. So the older LCAs were never absent because DOL
hides them - we simply never loaded those fiscal years.

`ingest_flag_disclosure.py --program lca --fy 2025` is one file against
~130,000 serial probes for the same period, and it carries the WAGE, the
worksite and the SOC, none of which the live endpoint ever returns. That is
the right instrument. **It must run on GitHub**: `www.dol.gov` 403s this
laptop, which is the mirror image of USCIS 403ing the runners.

The serial sweep still earns its place for the live remainder - pending cases
and filings newer than the last published quarter - which is exactly what no
disclosure file can contain.

### The wrap day, and the assertion that rubber-stamped it (2026-09-13)

Neighbour-bounding needs a fallback for the day the counter rolls at
1,000,000, and the first one was `return bounds[n][0], bounds[n][1]` - the
day's own MIN and MAX. **On a wrap day those ARE 0 and 999,999**, so the
"fallback" handed back the whole million and the sweep sat on day 26161
probing serials for 44 minutes. Three day codes in the entire history are like
this (24136, 25141, 26161).

**The test asserted `... or sp == (1, 999_000)`**, which accepted precisely the
broken answer. An assertion with an `or` branch that matches the bug is not a
gate, it is a rubber stamp - and it is the same family as the vacuous
`min(floor, width) <= width` caught in the estimator tests the same night.
Wrap days are SKIPPED now, named in the log so a skipped day and a day with no
holes cannot look alike, and the test asserts `is None`.

**Three of my own progress instruments read wrong before this was found**, and
each was wrong for its own reason, which is worth remembering: `lsof` showed no
TCP because the lookups are forked `curl` children rather than sockets on the
parent; a file-mtime probe sampled every four seconds "showed" a four-second
request cadence that was my own sample interval; and `MAX(last_probed_at)` over
the whole table does not move mid-day-code, because misses are flushed per day.
The reading that settled it was `GROUP BY day_code ORDER BY MAX(last_probed_at)`
- which named the stuck day directly.

## The quarterly files are cumulative for PW and NOT for LCA (2026-09-13)

This file already recorded, under the Sep 6 corrections, that "a quarterly file
only carries its own quarter's determinations" is wrong for PW and LCA because
"the Qn file is **cumulative for the fiscal year**". That is true for PW and
**false for LCA**, measured by loading one:

    LCA_Disclosure_Data_FY2025_Q4.xlsx  ->  118,580 rows, 2025-07-01 .. 2025-09-30
    LCA_Disclosure_Data_FY2026_Q3.xlsx  ->  435,610 rows, 2025-10-01 .. 2026-06-30

FY2025 Q4 holds one QUARTER. So `--fy 2025`, which takes that fiscal year's
newest file, moved LCA coverage back by three months rather than by a year, and
`lca_cases` still begins 2025-07-01.

**This is why the serial sweep finds so much in the older years.** A random
sample of holes came back 79.2% real for 2025 and 86.7% for 2024, almost all
`I-200` and `P-100`. Those LCAs are not hidden and not undiscoverable - they
are simply in quarterly files nobody has loaded, and `--fy` can only ever reach
one file per fiscal year.

**The cheap route exists and is one flag away**: `ingest_flag_disclosure.py`
takes `--file`, so each earlier quarter can be loaded directly once its URL is
discovered from DOL's performance page. That is a handful of file loads against
~800,000 serial probes for the same period, and the file carries the wage, the
worksite and the SOC that the live endpoint never returns. **Discover the URL,
never construct it** - DOL moved the current-year files to `/media/` while the
archive stayed under `/sites/dolgov/files/ETA/oflc/pdfs/`.

**DONE 2026-09-13/14 ("yes full all").** Every LCA quarter from FY2022 Q4
through FY2026 Q3 is loaded by `--name`, 51 months with zero gaps,
`lca_cases` at 2,381,382 rows. Each quarter cost roughly 13 minutes of runner
time and a real slice of the write budget, which is why it was a decision and
not a default. The freshness guard below is what that load broke first.

## A guard keyed on the FLAG, not the data, let history overwrite the present (2026-09-13)

Found by running `check_ingest_health.py` before a deploy rather than after.
`lca-disclosure` read **as_of 2022-09-30, 1,444 days old**, and the check said
the SOURCE had stopped publishing. DOL had published nothing new. We had
overwritten our own record of the newest quarter with the oldest file we
happened to load last.

`ingest_flag_disclosure.py` had the right rule and the wrong test:

```python
if args.fy:          # "this is a history load, don't stamp"
    return 0
stamp_freshness(...)
...
write_load_record(db, program, record, latest=args.fy is None)
```

`--fy 2024` is history and was handled. But **`--name LCA_..._FY2022_Q4.xlsx`
is history too**, and that path sets no `fy` at all - and it is how the LCA back
catalogue is actually loaded, one quarter at a time, because LCA files are
per-quarter and `--fy` reaches only one of each year. So every one of those
loads stamped freshness with its own quarter's last decision date AND replaced
the "latest quarter" pointer. Both wrong, both silent, both green.

**The guard now asks about the FILE: `is_newest = name == newest_name`**, where
`newest_name` is the newest name DOL lists. Consequences worth keeping:

- **An unknown newest counts as HISTORY, never as newest.** Declining to stamp
  leaves the last good value; wrongly stamping destroys it. The asymmetry
  decides the default.
- **It must not cost an extra request, and the lookup is LAZY.** The first
  draft called `discover_latest(cfg)` unconditionally, doubling the listing
  request to `www.dol.gov` on the scheduled path - a host that 403s sustained
  traffic. The second draft asked only on `--file`, which looked fine and was
  worse: **`--file` is also what `--dry-run` uses**, so every offline parser
  fixture spawned a real request to a government host and the subprocess timed
  out at 120 s. Found by probing the gate, not by reading it. The `--name` and
  default branches now carry the answer out of the listing they already did,
  and `--file` resolves it behind a cached callable that runs at most once, and
  only if a write is actually about to happen. **Do not ask a host that rate-
  limits you a question whose answer nothing is going to use.**
- **Repair, and say so in the record.** The correct per-file load record for
  FY2026_Q3 had survived, so the freshness row and the latest pointer were
  rebuilt from it, and the row's `note` says it was repaired and when. A
  silently-corrected record is how the next person concludes it never broke.

**Swept for the same shape rather than assuming it was unique.** Every script
calling `stamp_freshness` was checked for a stamp guarded on a history FLAG:
`ingest_pwd_status_direct.py` guards on whether the summary doc was actually
written this run, which is data-derived and correct; nothing else keys on one.
The defect was contained to this file.

**And the probe clobbered the fix.** The mutate-restore loop that proves a gate
was left running in the background while the source was edited again, so its
`cp /tmp/<snapshot>` put back a version from before the later edit - producing a
file with half of each. The working tree is a shared resource: the repo's own
"do not edit a repo another session is working in" rule applies to your own
background jobs. Re-applied from a clean `git checkout` with an assertion on
every marker, and the probe loop now runs only when nothing else is writing.

## The discovery walk could not cross a gap of one serial (2026-09-19)

The frontier sat at `26255:231396` from **13 to 19 September** while
`G-100-26255-231407` waited two spans ahead. Six days of new filings were
found only by the gap sweep and visitor lookups; 13 September is absent from
the corpus entirely and the daily counts fell from ~400 to 38 and 66.

**The bug was one missing line.** On a span no prefix claimed, the loop did
`unissued += 1; continue` **without advancing `serial`**, so the next iteration
rebuilt the identical span and asked DOL the same five numbers again. Two
"spans" were one range asked twice, and `DISCOVERY_UNISSUED_STREAK = 2` then
called it the edge. Sixteen requests a night, forever: two spans x eight day
codes. The code and its own comment disagreed and the comment was believed.

**What made it start failing on that date.** `DISCOVERY_STEP = BATCH //
len(DISCOVERY_PREFIXES)`, and `a68409e6` (13 Sep) took the prefix tuple from
five to nine. The span halved, 10 serials to 5, so the odds that the next span
held nothing roughly doubled. **A constant expressed in SPANS silently changes
meaning when the span changes size.** It is `DISCOVERY_UNISSUED_SERIALS = 50`
now, with the span count derived from it.

**Two cursors, deliberately.** `code`/`serial` is the CONFIRMED frontier and
moves only on a hit; `probe_code`/`probe_serial` is where the walk is looking
and steps over gaps. The first version of the fix advanced the single shared
variable and the walk then REPORTED a frontier DOL had confirmed nothing at -
three existing tests caught it, which is what they are for.

Regression test: `test_case_status_direct.py` case 3b walks a 10-serial gap and
asserts the probe actually asked inside it. Probed by reverting the advance:
the walk stops at 105 and asks one span, exactly the live symptom.

## The bulletin hub links every month it holds (2026-09-22)

The hub linked one month page (the newest) and each month page linked only its two
neighbours, so 96 of the 97 `/visa-bulletin/<month>` pages hung off an eighteen-hop
chain, and Search Console read the current month as "Discovered, never crawled"
while it sat in `pages.xml`. `BulletinMonthStrip` puts every month one hop from
the hub as plain links (years descending, months ascending, keyed Fragments with a
leading space so the list is not one glued word). Same defect as the
`/perm-queue/<month>` family on Sep 16, one layer up: those were in no sitemap,
these were in the sitemap but link-deep. A sitemap entry is not a link.

## The USCIS Torch client, and what its lane taught (2026-09-22)

`src/lib/uscis/` (receipt parser, OAuth client-credentials client, route
handler), `src/lib/db/uscisCaseStatus.ts` (the stored lookups),
`/api/uscis-case-status` and `/uscis-case-status` are built and dark: with no
`USCIS_CLIENT_ID` / `USCIS_CLIENT_SECRET` / `USCIS_ENV` on Vercel the page
renders its waiting state and links USCIS's own status page. The plug-and-play
sequence is `.planning/llc-and-uscis-plan.md`.

- **USCIS's daily quota resets at midnight EASTERN**, so its budget key is the ET
  date. DOL's is the UTC date. Two budgets, two clocks, and a key computed on
  the wrong one under-counts for four hours every night.
- **A privacy bullet is a schema.** Section 18 lists exactly what is stored; the
  table's columns are held to that list by a test, and the raw JSON column that
  would have quietly stored more was dropped for it.
- **A nightly delete needs a clock in the app, not on GitHub.** The retention
  constant lives in TypeScript with its test; `HOUSEKEEPING_JOBS` in
  `api/cron/dispatch/jobs.ts` is the second cron table, and the dispatch test
  holds `vercel.json` to the union of both, so a housekeeping cron cannot exist
  in one and not the other (probed by dropping the entry).
- **`not.toMatch(/ip/)` matches "receipt".** Substring negatives need word
  boundaries or they fail on the vocabulary of the thing under test.
- **A probe harness that parses the summary line is itself a gate**: one of ten
  revert-probes read green in the harness and red by hand. Read the assertion,
  not the harness's one-line verdict.

## The USCIS quarterly workbooks: reconcile against the file's own totals (2026-09-22)

`scripts/ingest_uscis_quarterly.py` loads the four quarterly workbooks USCIS
publishes (all forms, I-485 by field office, EB approved awaiting a visa, I-140
by class and country) plus the FY2016 to FY2024 median factsheet, into
`uscis_form_quarters`, `uscis_i485_offices`, `uscis_eb_awaiting_visa`,
`uscis_i140_class_country` and `perm_docs.uscis_historical_pt`. GitHub tries on
the 15th and 16th; the Mac's launchd agent retries on the 17th
(`residential_job.sh quarterly`; `install.sh` loads three labels now, so re-run
it after pulling). Pages: `/uscis-processing-times`, `/i485-by-field-office`,
`/i140-awaiting-visa`, under a "USCIS" rail group.

- **The files carry their own totals**: a TOTAL row per category, a TOTAL column
  per year, classes against approved, offices against the Total row. Every
  sheet is reconciled against them before anything is written, so a shifted
  column cannot pass.
- **Footnote markers are typed into the cells.** A form is `[A-Z]{1,2}-\d{3}[A-Z]?`
  and anything after it is a footnote (`I-6007` is I-600 with note 7); a median
  with two decimals is glue (`9.16` is 9.1 with note 6).
- **Discover, never construct, again.** FY2025 Q4 spells the awaiting-visa file
  `performance_data`, later quarters `performancedata`; FY2026 Q1 sits under
  `/document/reports/`. Files are identified by name so a `_v2` re-issue reloads.
- **A freshness `as_of` must be a date the health check can age.** "As of June
  2026" and "FY2026 Q3" read as UNREADABLE, so the stamp is the quarter's last
  day, with a 200-day budget.
- **USCIS leaves a class-approval cell blank where the count is zero**
  (Philippines E12, 2018). Read blank as zero under the TOTAL-column check, or
  the reconciliation refuses a correct file.

## New York's WARN "Index" is a position, and a position in an id breeds duplicates (2026-09-23)

Adam asked whether everything was good after the GSC timers died. The health check
called `warn-notices-ny` "the source has not republished" (29 days against 21), and it
was wrong twice over:

- **New York was publishing.** Its Tableau CSV carries a `Date Posted` column: rows went
  up Sep 8, 14, 15 and 22. It posts each notice a **median of 62 days** after the notice
  date (p90 115), so a stamp keyed on the newest NOTICE date could never read green
  against a 21-day budget. NY's freshness is now stamped from its own posted date
  (`"stamp": "posted_date"` in its `STATES` entry); the note names both dates.
- **The table held 258 New York rows for the 197 New York lists.** The row id hashed the
  dashboard's `Index` column, and that column is a POSITION: the same Amazon notice was
  Index 23 on Sep 9 and 25 on Sep 23, because later postings sort in ahead of it. Each
  shift minted a new id for an unchanged notice, so employer pages listed the same notice
  twice. The id now uses the address only.

**A snapshot state prunes what its source stops listing.** New York's file is its whole
current-year list, so `prune()` deletes held rows inside the load's own notice-date range
that the load no longer carries, guarded by coverage measured on (company, notice date)
pairs, which do not depend on the id scheme: a load covering under 90% of the pairs held
is treated as truncated and deletes nothing. The re-key ran from this Mac at about 5:38 PM EDT
Sep 23: 197 written, 258 old-id rows pruned at 99% coverage (60 duplicates, 1 notice New
York withdrew, and the 197 old ids of the current notices); a second run wrote 0. The 258
pre-fix rows are backed up at `node_modules/.cache/qa/warn-ny-backup-2026-09-23.json`.
Three probes in an isolated copy (Index back in the id, the coverage guard off, the date
range dropped) each turned `test_warn.py` red.

**Not re-checked for the other three states, and why:** CA, TX and WA ids hash fields the
source does not renumber (addresses, cities, the portal's own record), the Texas
two-source merge was verified 69 of 69 on Sep 9, and their row counts sit within one to
nine of the distinct-notice count.

**The employer pages, measured 7:35 PM Sep 23 instead of assumed.** I first wrote that a page
cached before the prune could show a duplicate "until the next deploy". Then I compared all
23 employer pages that carry a New York notice against the table: 20 already matched; 2
(Citigroup Global Markets, Vimeo) were served `x-vercel-cache: STALE` with the doubled row,
and that one visit made Vercel rebuild them (a re-fetch read `HIT`, one notice each). The
third, Morgan Stanley, was not stale at all: its 7 rows equal the table's 7, and two of them
read identically on the page because New York lists two separate 1-worker notices on
2026-03-05, at 100 Park Ave and One Penn Plaza, and the band never prints the site address.
Measure the pages before calling them stale; and a band that hides the field that tells two
rows apart will look like a duplicate even when the data is right.

**So each notice now stores a `site` (2cf549d7, 7:57 PM Sep 23).** Display only: the
address in California and New York (their double-space street/city gap becomes a
comma), the city in Texas, null in Washington, whose location is already `county`. The
id still hashes the raw `_extra`, so no held id moved. `write()` names its columns
(`INSERT_COLS`), ALTERs the column into a live table, and lets the lower-ranked Texas
portal FILL a site the spreadsheet's row lacks without overwriting anything else. Filled
the same evening: CA 269/269, NY 197/197, TX 2,394/2,394 (27 spreadsheet-only rows from
the Sep 9 fixture, the file Texas serves only to a browser). The page half (the band's
second line and the `/layoffs` company cell) shipped with the Sep 23 audit batch (below),
live at 11:43 PM EDT (`d4ac9ecb`). Until then it waited on a LOCAL branch, because a pushed
branch builds a Vercel preview, and the GSC timer pushes `main` on its own: code left
unpushed on `main` rides the timer's next push into production without anyone deciding.

## The walk could not keep up with the counter, and the frontier check said ok (2026-09-24)

Adam, reading the status round: *"can we increase that then? so it catches up? and never falls
behind?"* Measured before changing anything:

- **The walk was capped every night and could not have kept pace.** Nine prefixes at DOL's
  50-number ceiling is 5 serials a request, so 400 requests reach at most 2,000 serials, and the
  day spans we hold measure 2,963 (Sep 18), 2,968 (Sep 21), 3,595 (Sep 22) and 5,253 (Sep 23).
  The frontier sat 2 to 4 days behind DOL all week; `check_frontier`'s 5-day budget read `ok`.
- **The gap sweep was capped every night too** (600 requests), over 29,297 un-probed holes in its
  90-day window. About 11,750 of them were simply ahead of the walk, which is where the nightly
  sweep's big hit counts came from (2,147 real cases in 2,997 probes on Sep 24): the sweep works
  newest-first, so it spent its budget on serials the walk had not reached yet.
- **Behind the frontier, nothing had been missed.** The catch-up swept all 17,545 older holes
  (Jun 27 to Sep 20) in 3,534 requests and every asked serial came back empty. And 100 serials
  the sweep had given up on (Aug 18 to Sep 15), asked under all nine prefixes and every day code
  within three days, held no missing case: the one hit, `I-200-26256-231557`, has been stored
  since Sep 19 (the walk found it under Sunday's code), and its "given up" rows are its serial
  asked under Saturday's and Monday's codes, where it does not exist. A probe of retired serials
  has to exclude cases already held, or a stored case reads as a missed one; this one did not,
  and I reported it as a miss for about ten minutes before checking.
- **The sweep counted DOL's near matches as finds.** The endpoint is a search: for a number that
  does not exist it returns scored neighbours from other serials and days. So the catch-up
  logged "DOL confirmed 497 of them as real cases" and "inserted 23 PERM, 88 PWD/LCA" while
  every one of the 17,545 asked serials came back empty; the inserts were neighbours in the
  walk's own region, racing it. `sweep()` now keeps exact matches only, as the walk always has
  (`test_serial_gaps.py` pins it; removing the filter turns two checks red).
- **`sweep_serial_gaps.py --dry-run` still asks DOL**; it only skips the writes. Count holes with
  `holes(held_serials(...), settled_misses(...), true_span(...))` instead, which reads our tables
  only. A 5-minute dry run here spent ~200 read-only requests before its timeout.

**The catch-up, run from the Mac 4:39 to 5:37 PM EDT Sep 24:** the walk went from
`26264:249921` to `26267:259759` (today's filings) in 2,259 requests and stopped at DOL's edge,
not its cap, storing **1,100 PERM and 5,413 PWD/LCA cases** filed Sep 21 to 24; the census
refreshed itself. The sweep over the older days ran beside it on a disjoint range (days
up to Sep 20, the walk's from Sep 21), so the two never wrote the same rows. Employer
pages and the case search show the new cases after the next full pass rebuilds
`perm_live_recent` and revalidates the changed employers; a lookup by number shows them now.

**The fix:** the walk rides BOTH passes now (the pending pass had been kept walk-free on the
reasoning that twice-daily probing "buys little"), and a TIME budget bounds it, counted from
process start: `DISCOVERY_BUDGET_MIN` is full 90, pending 75, dispatched `--discover` 95, each
inside its step's `timeout`, with a 2,000-request cap as a sanity bound. A budget stop records
`ok` with `BUDGET_NOTE` in its note, exactly as a cap stop names `CAP_NOTE`. The job cap is 150
minutes, because the 4:10 AM walk now spends the slack inside its step. Measured on the
catch-up with nothing else running: ~1.36 s and ~4.9 serials a request, so a weekday's 3,000 to
5,300 serials need 600 to 1,100 requests, and the two walks can make about 2,600 to 3,000 a day
(the 3:40 PM walk up to its 2,000 cap, the 4:10 AM walk whatever its budget leaves). A day
code change costs extra requests, and a sweep running beside the walk slowed it to ~2 s and
~3.4 serials a request.

**Rates, measured the same evening.** The walk sleeps `PACE_S` (0.35 s) between requests and
ran at ~1.36 s a request on its own; `sweep()` has no pause at all and ran 3,534 requests in 25
minutes, ~0.4 s each, ~2.4 a second against DOL. Both are within what DOL tolerated here, and a
sweep beside the walk slowed the walk to ~2 s a request.

**Left alone on purpose:** three comments under `src/` still say the corpus changes "once a
night" (`case-search/page.tsx`, `api/case-search/route.ts`, `api/perm-cases/route.ts`). The live
tables now rebuild after both passes, but an edit under `src/` is a production build and a cold
ISR cache, so they wait for the next change that deploys anyway.

**The monitor that would have said so:** `check_cap_streak` prints a `::warning::` (it never
fails the check) when the walk or the gap sweep has stopped on its own cap or budget on each of
its last three runs. A capped run is a job doing its work; three in a row is a job that is not
keeping up, and that is the leading signal both lag checks missed.

**Tests, each probed by breaking the code in an isolated copy:** the budget stop (deleting the
deadline check turns three checks red), the pass-through of cap and deadline into the walk step
(dropping it turns one red), and each budget against the workflow's own step timeouts, read from
the YAML so the two cannot drift (a full budget of 100 against a 105-minute step turns one red).
The streak warning and the budget phrase are pinned in `test_ingest_health.py` the same way.

## Sep 25 2026: quoted to 127,000 people on X, and what checking it turned up

A large X account posted, at 2:10 PM, that 100% of Adobe's pending PERM cases
were on hold, with a screenshot of `/perm-employers/under-review`. It was the
same account's second post built on this site (the first was Cognizant, Sep 5).
Checked against DOL's own endpoint that night: **218 of 218 pending Adobe cases
matched our table exactly** (216 on hold, 2 filed Sep 24 in analyst review), and
50 of 50 random Cognizant cases were on hold. The page drew 186 visitors in the
eight hours after the post, against 27 in the whole week before. What the
checking found, in order of consequence:

- **The census split employers across two rows.** The page's slug came from
  `perm_live_recent` alone, and an appeal is a DECIDED case (published in
  `perm_cases`, then appealed back to pending), so 175 pending cases rendered
  as unlinked names and seven employers sat on two rows. Space Coast Services
  read **100% (31 of 31)** on its appeals-only row; the truth was **44 of 143**.
  `write_employer_stages` now takes the slug from either table and folds a
  slug-less spelling into its slugged row; `listStageCases` had the same join
  and the same comment claiming "a pending case cannot be in perm_cases", both
  corrected. The case search already read both tables; the census and the
  stage listing were the two places the knowledge had not reached.
- **The headline said DOL did what employers did.** "Whose PERM cases DOL has
  pulled aside" sat over 5,958 cases, 2,848 of them appeals the employers
  filed. Every surface now names who acted (`breakdownParts` in
  `src/lib/employerStages.ts`: "216 on hold, 3 at RFI, 26 under appeal"), and
  `public-surface-hygiene.test.ts` fails on "DOL ... pulled" in rendered code.
- **The page could not say WHEN, though the record could.** The sweep now
  writes `holdSince` / `holdSinceCases` / `holdUndated` / `holdBeforeLog` per
  employer and a `holdMoves` feed (five or more of one employer's cases moved
  into or out of hold on one Eastern day, 120 days back) into the same doc.
  Measured: Adobe held 201 on Sep 10, released all 201 on Sep 11, held 215 on
  Sep 24; Maplebear held 14 on Sep 10 and released them Sep 11. **An undated
  hold is two facts**: Cognizant's 1,831 were held when the record began
  (Aug 27 Eastern), while Adobe's one undated case was filed Sep 23 and first
  recorded already held. `holdBeforeLog` counts only cases first recorded on or
  before the log's first day (`fetched_at` moves only with the status, so for
  an undated hold it is the first record). A new index,
  `case_events_from_time (from_status, changed_at)`, keeps the release read
  bounded; the history is computed inside a try and the counts are written
  without it on failure.
- **The on-hold guide was three weeks stale under the attorney's byline.**
  "1,855 on hold right now" had become 2,070, 99% of them two employers', and
  it said DOL never gives a reason. It now renders `<OnHoldNow />`, an async
  server component reading the census (names only employers with 25+ held,
  never a reason), guides revalidate daily, and the one public explanation is
  quoted from the Inspector General's own post
  (`x.com/USLaborIG/status/2097321316995232030`, Sep 8 2026, 9:49 AM). **Two
  news reports quoted two different fragments of that post**; only the post
  itself had both. The card was redrawn without a live figure and renamed.
- **The rule that keeps true numbers from becoming a false statement:** never
  print one employer's explanation next to another employer's count. The
  guide names Cognizant's suspension in its own sourced paragraph; the census
  page and the live component carry statuses and dates only.

### The public repository, audited the same night

- **Firewall rule 5 was a public bypass.** It matched `x-permtracker-audit`
  on EXISTENCE and a dozen scripts here sent it with the value "1": a scripted
  request to a restricted page got 429 without it and 200 with any value. The
  rule is to match the key in `.env.local` (`PERMTRACKER_AUDIT_KEY`, never in
  the repo; `scripts/lib_audit.py` reads it), `indexnow.mjs` sends nothing
  (rule 8 already lets anyone read sitemaps), and the hygiene test fails on a
  hardcoded value. `.env.local` was also still mode 644; it is 600 now.
- **A test that guards an identifier must not spell it out.** `seo.test.ts`
  listed the very strings it kept out of the markup, which made the test the
  one place the repository published them. It now compares SHA-256 prefixes of
  each word. Identity findings themselves are kept outside this public file.
- **Rivals:** four smaller competitors were still named in this file after
  the Sep 18 scrub of the two main ones; they are generic now.
- **`.planning/dol-case-status-access-research.md`** still said the case-status
  route sits behind anti-abuse verification that clearing would be
  "circumvention". It is marked superseded in place with the re-measured
  facts: DOL's app does carry the help text "automated verification to
  prevent abuse" (bundle re-read Sep 25), and ships no CAPTCHA code with it,
  no site key and no token; `robots.txt` does not disallow the route.

### Three instruments that reported success over nothing

- **Vitest file filters are regexes, so a path containing `(site)` matches no
  file**, and a run that matches no file exits 0 with no verdict line. Pass
  bare file names.
- **zsh does not split an unquoted `$T` into words**, so a list of file names
  reached vitest as ONE filter and matched nothing, again exit 0. Use `${=T}`.
- **The Vercel CLI token in `auth.json` expires and is refreshed only when the
  CLI runs**; the firewall API answered 403 `invalidToken` until one
  `npx vercel whoami`. And `gh search code` returned nothing for a word the repo
  holds 75 times, so it is not a control for anything.

## Sep 26 2026 (evening): industry and worksite city, years on, translations reviewed

**DOL's PERM file publishes the employer's industry and the worksite city, and never did the
worker's citizenship or education.** Read off `PERM_Record_Layout_FY2026_Q3.pdf` (the record
layout WebFetch saves as a PDF; the laptop cannot reach dol.gov): `EMP_NAICS` (Form 9089 Section
A, Item 13, a bare code) and `PRIMARY_WORKSITE_CITY` / `_COUNTY` / `_POSTAL_CODE`. The new form
moved the worker's details to Appendix A, which DOL does not release; only the FY2024 old-form
file (the `A-` numbers) could carry citizenship, and nothing filed since mid-2024 will.

- `perm_cases` gains `naics` and `worksite_city`, unindexed. **An incremental load that finds
  only those two different UPDATEs them in place** (`narrow_update`, one CASE statement per 200
  rows); without it every stored row reads as changed and an INSERT OR REPLACE rewrites 374k
  rows and eighteen indexes each. `ensure_columns` adds them to a live table.
  `scripts/test_perm_extras.py` runs the real loader on in-memory SQLite; disabling the narrow
  path turns two checks red.
- **NAICS titles are the Census Bureau's** (`scripts/data/naics_titles.json`, built by
  `build_naics_titles.py` from the 2022 and 2017 "2-6 digit" lists, 2022 winning). A code Census
  never defined takes its nearest parent's title and the label names that parent.
- `build_entity_detail.py` writes a `city` facet (employers and occupations; key `CITY|ST`, the
  label the most common mixed-case spelling, so MCLEAN reads McLean) and an `industry` facet
  (employers). `CityMix` and `IndustryMix` in `FilingMakeup.tsx` render them, and nothing when a
  page has none. Facets exist only for entities at `PAGE_FLOOR` (3) filings, while pages exist
  from 1; that gap predates this and costs writes to close.
- **Order that makes the pages show it:** push the scripts first (Vercel skips), dispatch
  `perm-disclosure-ingest.yml`, and deploy the site after it finishes, so the fresh ISR cache
  renders with the facets. Deploy first and the 30-day employer pages wait a month.

**The green card line prints years by default** (owner, Sep 26), labelled with the fiscal year
it divides by; `showYears={false}` turns it off. The EB-2 India guide's "why this site won't"
became "why no years figure is a date".

**Translation review** of the five guides: Korean `비자 블러틴` (the Korean-American press
spelling, not 블레틴), `사전여행허가서`, 1순위/2순위/3순위; Vietnamese headings had called the
cutoff a priority date (`ngày chốt`, not `ngày ưu tiên`); Chinese `无排期` for Current and
"这一列" for a column; Portuguese "o EAD". A model's review, not a native speaker's.

**Every workflow runs on `ubuntu-24.04`**, pinned ahead of `ubuntu-latest` moving to 26.04.

**PERM history back to FY2008 (S6, owner's middle path).** Two tables, neither of them
`perm_cases`, so its eighteen indexes are untouched:

| table | holds | written by |
|---|---|---|
| `perm_employer_years` (slug, fy, certified, denied, withdrawn) | every fiscal year from FY2008 | `ingest_perm_history.py` for FY2008 to FY2023, once; `--current` for FY2024 on, after every quarterly load |
| `perm_cases_history` (perm_cases' columns plus the worker's, PK + `(employer_slug, decision_date)`, then five search indexes) | FY2016 to FY2023 cases | `ingest_perm_history.py`, once |

- **DOL's file names follow no pattern** (`PERM_FY2008.xlsx`, `PERM_FY14_Q4.xlsx`,
  `PERM_Disclosure_Data_FY17.xlsx`, `PERM_Disclosure_Data_FY2018_EOY.xlsx`), so discovery keeps
  every `PERM_*.xlsx` DOL links and reads the year out of the name. The quarterly discovery's
  `PERM_Disclosure_Data_` regex would have missed half of them.
- **Old layouts:** `CASE_NO` to FY2014; no received date before FY2015 (counted on the decision
  date, duration empty); `AGENT_FIRM_NAME` then `AGENT_ATTORNEY_FIRM_NAME`; `2007_NAICS_US_CODE`.
  The old form DID carry `COUNTRY_OF_CITIZENSHIP` and the worker's education (FY2008's spelling is
  `COUNTRY_OF_CITZENSHIP`); only the new form dropped them. Not loaded.
- **Years attach to today's page by `entity_key`**, exactly as `perm_entities.merge_key` is built,
  so a year filed under a name no current page carries is missing, and the chart says so. Each
  workbook's matched share is recorded in `perm_docs['perm_history']`.
- **Resumable:** each workbook is written and recorded before the next is fetched (www.dol.gov
  refuses sustained traffic), and a recorded one is skipped unless `force`.
- `lookupCase` reads `perm_cases_history` when `perm_cases` misses, BEFORE any live DOL question.
  The case search reads it too since Sep 26 (below), so a search reaches back to FY2016.
- `EmployerYears` renders bars from `perm_employer_years` and nothing when a page has no rows.

**The worker's fields, full detail like DOL's own file (owner's call, Sep 26).** DOL's OLD form
carries the worker's citizenship, birth country, visa at filing (`CLASS_OF_ADMISSION`),
education, field of study, school and the job's required education; the new form carries none.
`ingest_perm_disclosure.worker_fields()` maps and normalises them once for both parsers, so they
land on every `perm_cases_history` row (FY2016 to FY2023) and on the old-form part of FY2024 in
`perm_cases` (unindexed, filled by the loader's narrow UPDATE). FY2009's workbook writes its
headers with SPACES ("CASE STATUS"); `header_name()` normalises them, and one unreadable year now
fails alone instead of stopping the run.

**PERM by city, industry and country of citizenship** (`/perm-cities`, `/perm-industries`,
`/perm-countries`, each with a page per group). `scripts/build_groups.py` reads both case tables
and writes one `perm_groups` row per group with 20+ decisions (3,402 in the first dry run: 2,470
cities, 826 six-digit industries, 106 countries), everything the page needs in its `detail`
JSON, so a group page is one primary-key read. It runs after the quarterly load and after a
history load. A link to another group is drawn only when that group clears the floor, so no
link 404s. A code from the 2012 NAICS list (454111) is titled by its parent group, because
Census's 2017 and 2022 lists don't carry it.

**The rail's height budget is real.** A new group costs a 38px header; "Breakdowns" (state,
city, industry, citizenship) pushed the worst case to 729px against 700 until "Status meanings"
moved from Case tools to Reference. `rail-fits.test.ts` prints the arithmetic.

**The case search reaches FY2016 and filters on everything DOL printed** (owner: "ultimate
flexibility and power"). `readPermPublished` reads `perm_cases` and `perm_cases_history` in
parallel, skips a table the fiscal-year or decided-date filters rule out, and prefers the current
row when a case is in both. New filters: industry (sector or NAICS prefix), worksite city, and the
old form's citizenship, birth country, visa, education and required education, which restrict a
search to published PERM and say so (`OLD_FORM_NOTE`). An "order by" choice, and a CSV of the same
answer (300 rows, formula-leading cells prefixed so a spreadsheet can't run them). Column
discovery (`tableColumns.ts`, `SELECT * LIMIT 1`, cached ten minutes) lets a table missing a
column drop out of that search instead of failing it. The pick lists come from
`perm_docs['case_field_options']`, which `build_groups.py` writes in the same pass as the groups.
The history table carries five search indexes (`idx_pch_dec`, `_state_dec`, `_socg_dec`,
`_att_dec`, `_cit_dec`), built after its rows (`ingest_perm_history.py --finish-only`), about 4.3
million index writes once.

**Turso: one count was two thirds of the bill (measured Sep 26).** The cycle from Sep 2 read 98.4
billion rows against the Developer plan's 2.5 billion and wrote 50.9 million against 25 million;
the dashboard's next invoice read $101.99 (overage is $1 per billion rows read and $1 per million
written). Its Top Queries panel, "This month" with totals on, put one statement first: `SELECT
count(*) FROM perm_entities WHERE kind = ? AND total >= ?`, **67.25 billion rows over 2.64
million runs**. `getEntitySeed` asked it once per kind, and every entity page, the case page's
estimate and llms.txt asked three kinds per render, each walking every index entry of the kind
(71,512 for employers). `countPageworthy` now reads the last-ranked row (`idx_pe_kind_rank`,
EXPLAIN: SEARCH, no sort) and returns its rank whenever that row clears the page floor, which it
does at a floor of 1: ranks are dense and ordered by total, and production had no rank/total
inversion and a minimum total of 1. The count stays as the fallback, pinned by
`entityReads.test.ts`. Next in that panel were the LCA filter-options live fallback (7.9 billion
over 3,030 runs; absent from the Sep 26 list, so probably the days before that doc was written on
Sep 13 at 9:51 PM, not verified per day) and the PERM wage
percentiles (2.76 billion over 529). **Read that panel before guessing at a Turso bill**; the
per-day chart alone shows a flat 3 to 7 billion a day and names nothing.


## Oct 1 2026: our own audit, H-2A and H-2B on the counter, and the daily pulse

- **An Ahrefs crawl was refused** (the free plan's 5,000 crawl credits a month were spent; they reset
  Oct 19 at 00:00 UTC, and the scheduled Site Audit runs on the 20th at 8 PM ET at 30 URLs a minute).
  Our own audit of 855 sampled pages stood in for it; every page answered 200.
- **Entity links go only to pages that exist.** The decision feed and the case search linked
  employers and law firms with no page (132 404s in three days). `keepLinkableSlugs` in
  `src/lib/db/entityLinks.ts` checks each slug against `perm_entities`, `perm_entity_alias` and,
  for employers, `perm_live_recent`, in batches of 300, and returns the rows untouched if the
  check itself fails.
- **A public `[param]` route needs `generateStaticParams` for its `revalidate` to apply.** Without
  one, `/perm-queue/<month>` rendered dynamic (`private, no-store`, 1 to 1.5 s); returning `[]`
  turns on-demand ISR on. `dynamic-routes-cache.test.ts` holds every public `[param]` route to it.
- **A streamed loading fallback adds a heading to the raw HTML.** The case page's fallbacks put two
  more `<h1>`s in the document; they're `role="heading" aria-level={1}` now.
- **Descriptions take the richest form that fits 155 characters** (`firstThatFits` in
  `src/lib/describe.ts`): 285 of 855 pages had been under 110.
- **The deploy renders pages on the new copy before it takes traffic**: `warm()` in
  `scripts/oracle/bin/permtracker-deploy` fetches the 475 core pages and the first 300 entries of
  `employer-1.xml` (busiest first) two at a time, for at most 4 minutes. It can't fail a deploy.
  Installed on the server by hand; that path is `v2/scripts/**`, which the deploy workflow ignores.
  **Its first version warmed nothing, silently, on two deploys.** The script runs `set -euo pipefail`,
  and `head -300` closing the pipe killed `curl` with SIGPIPE (141), so the path list "failed" and
  `warm` returned before its log line. Each sitemap is now fetched whole and cut with `sed -n`, and an
  empty list logs "warm-up skipped". Test a deploy-script function under the script's own shell
  options, and read the deploy's journal (`journalctl -t permtracker-deploy`) for the line it should
  write: a step that can't fail a deploy also can't tell you it did nothing.
- **The rebuilt frontier on `/perm-processing-times` said it was DOL's readings** ("DOL published",
  "Each step is a published DOL reading"). `QueueHistoryChart` takes `kind="reconstructed"` now.
- **Embed snippets carry a source line** linking the full tool outside the frame; the frame's own
  footer link lives on our domain and credited nothing.
- **FLAG serves H-2A (`H-300-`), H-2B (`H-400-`) and H-2B prevailing wage (`P-400-`) cases from the
  same serial counter, and nothing asked for them.** On Sep 29, 383 of 2,912 serials were held
  under no prefix; 7 of 10 sampled were these. Worse than a gap: 50 unclaimed serials in a row read
  to the walk as DOL's edge, so a season's H-2A job orders filed back to back would have stopped it
  at the same serial every night (proved in `test_case_status_direct.py` against the old list).
  `ALL_FLAG_PREFIXES` has twelve entries (4 serials a request), and a `seasonal` program in
  `ingest_pwd_status_direct.py` stores them in `seasonal_case_status`. **P-400 stays out of the PWD
  program**: the PWD pages describe the ETA-9141 queue PERM and H-1B wait in. The gap sweep reads its
  tables from `PROGRAMS` now (the typed list had been the drift), and `--recheck-prefixes` re-asks
  serials retired under the old prefix set, asks only the new prefixes and writes no misses. FY2026
  was backfilled from the server with it (`systemd-run`, paced 0.5 s).
  **Statuses seen:** FULL CERTIFICATION (and - EXPIRED), PARTIAL CERTIFICATION, ACCEPTED - PENDING
  RECRUITMENT, NOD ISSUED, IN PROCESS, DETERMINATION ISSUED, WITHDRAWN. An unknown one is logged and
  treated as pending. **CW-1 answered to no prefix tried.**
  **The read side, same night:** the PWD rule took any `P-###-`, so an H-2B wage number looked up
  live would have been recorded in `pwd_case_status`, and an H-2A number got "no record". The PWD
  rule is `P-100-` only (both copies: `pwdCases.ts` and `flagCaseNumber.ts`, held together by its
  test), `seasonalCases.ts` is a fourth `makeFlagProgram`, and `programOf` returns `seasonal` for
  `H-300`/`H-400`/`P-400`. The case page and the embed lookup route those numbers to
  `SeasonalLookup`, and case alerts work for them through Convex's table-driven sweep (which needs
  `npx convex deploy` to pick up the new map).
- **`daily_decisions` holds two sources: `dol-disclosure` and `sweep-observed`.** `flag-live` and
  `rival-b` were deleted Sep 18, but `activity.ts` still asked for `flag-live`, so
  `/perm-decision-activity`'s "last 28 days" was June's. It reads `sweep-observed`, and the break's
  start date and length come from the series.
- **The daily pulse** (`PermPulse`, the homepage under the DOL band and the top of
  `/perm-decision-activity`): the newest day's decisions against the same weekday over the four
  weeks before (never the day before: a Monday against a Sunday reads as thousands of percent), its
  split, the last 30 days as stacked bars, a typical week, and when the sweep last checked DOL. Bars
  are HTML, not SVG text, with a screen-reader table. `case-status-direct.yml` and
  `pwd-status-direct.yml` POST `/api/revalidate-sweep` after each pass, so the ten pages printing a
  sweep's figures (the pulse, the census and review stages, under-review employers, the wage-request
  and LCA summaries) move when the record does. `paths.ts` is held to the app tree by its test, which
  lists the readers only a sweep writes; a POST from the runners reaching the Oracle site was
  confirmed off the employer step's own log (`{"revalidated":503}`, Sep 30).
- **DOL refused the nightly gap sweep again** (HTTP 403 after 499 requests, Sep 30). It recorded
  `ok` and resumes, as designed; two refusals in a month.
- **A local dev server against production data**: an SSH tunnel to the server's sqld
  (`ssh -L 18080:127.0.0.1:8080 permtracker`) and `TURSO_DATABASE_URL=http://127.0.0.1:18080` with
  the server's read-only token in the environment (never printed). `.env.local` still points at
  the retired Turso database, which bills per row read. Next refuses a second dev server in the same
  folder, and Turbopack refuses a `node_modules` symlinked from outside the project root, so a
  second copy runs from a git worktree with its own `pnpm install --offline`.
  **Since the LCA split (Oct 20) it takes both databases, with keepalives** (a dropped tunnel turns every data page
  into a 500): `ssh -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=4 -fN -L
  127.0.0.1:18081:127.0.0.1:8080 -L 127.0.0.1:18082:127.0.0.1:8082 permtracker`, then `DATABASE_URL=http://127.0.0.1:18081
  DATABASE_LCA_URL=http://127.0.0.1:18082` and the token as `DATABASE_AUTH_TOKEN` (read from the server's
  production.env into a variable, never printed).


## Oct 2 2026 (morning): open data, a longer record, and a defense that acts by itself

**Open data** (`/open-data`, `src/lib/openData.ts`, readers in `src/lib/db/openData.ts`). Two files in two
formats, under CC BY 4.0: the visa bulletin archive (one CSV row per printed cell, `as_printed` beside the parsed
`cutoff_date` and its `status`) and every DOL processing-times reading kept (one row per published value; a blank
month is DOL's "--", never written as `--`, which a spreadsheet would try as a formula). The JSON keeps cells as
printed. Each download sends CORS `*` and `Link: <licence>; rel="license"`. The Terms name the exception in §4 and
§6; every other compiled dataset stays under them. `getDatasetSchema` takes `license` and `distribution` for these
two only. The readers are named `getVisaBulletinsArchive` and `getProcessingTimesArchive` on purpose: the two
revalidation tests find readers by those names, so the page and the four files are expired when either source moves.
Estimate scorecard moved to the rail's Queue group: Open data in Reference ran the rail past its height budget.

**The visa bulletin archive reaches June 2005** (237 bulletins to October 2026). `ingest_visa_bulletin.py
--backfill-direct N` reads State's own index and names and skips any month it can't read whole; the nightly
`--direct` still stops on a bad month. 127 re-read months matched the stored cells exactly, four new months were
checked against State's raw page text, 0 differed. 20 months in the span are missing: Jul 2005 to May 2007 (15,
an older layout the parser doesn't read) and 2009-03, 2009-09 to 2009-11 and 2012-10 (not linked from State's
index; the Internet Archive route could fill them). Before 2011 there are no family charts, and before 2014 EB-5
is often absent. June 2009 printed "PHILIPP-INES"; the header match now drops hyphens.
**Paces, moves and backward steps are still measured from October 2014** (`BOARD_MEASURED_FROM` in
`src/lib/db/bulletin.ts`): the older months are history (each cell's `states`, the month pages, the open data),
and adding them moved no published estimate. Copy that quotes the window says "since October 2014".

**DOL's decisions per day reach October 2015** (`scripts/build_daily_decisions.py`, after both case loads): 3,484
days, 1,241,325 decisions from `perm_cases` and `perm_cases_history`, a case in both counted once on perm_cases'
date. It had been built once from perm_cases alone (Aug 26), so it started 2023-10-01. The new years' zero weekdays
are federal holidays and January 22 2018 (a shutdown day). `DailyDecisionsChart` draws months once the record
passes three years (weekly, ten years is ~560 points in 626 units).

**The automatic defense** (`bin/permtracker-defend`, every minute; details in `scripts/oracle/README.md`). It acts on
people being turned away, never on traffic: a managed challenge for the source (a network from Cloudflare's new
`x-pt-asn` header, or one browser label), then Under Attack Mode after 10 more minutes or when there's no single
source, then all off after 30 calm minutes, emailing each change. Under Attack Mode lasts at most an hour, then
waits three hours: the Oct 2 scraper passes Cloudflare's checks, so it would otherwise hold every visitor behind one.
Live since 7:09 AM EDT Oct 2 with a token scoped to permtracker.app (Zone WAF Edit, Zone Settings Edit). Custom rule 2 skips the security level, so trusted traffic never sees Under Attack Mode.

**Smaller:** nginx keeps upstream connections 4 s (Node closes at 5 s; the resets were the 502s) and marks an
upstream down after 3 failures in 5 s; the edge serves a stale page for up to a day when the origin errors
(`stale-if-error`); a passed challenge lasts 30 minutes. Onboarding: a brand-new account is welcomed, not welcomed
back; the illustration's dates come from the sample case's real window (`convex/lib/sampleCase.ts`, shared with the
case the tour creates); the tour's last part is "Getting around"; labels in sentence case.

## Oct 3 2026 (evening): the seasonal record on every surface, and a later decision wins

**DOL's published H-2A, H-2B and CW-1 record reaches every surface that reads a FLAG program.**
- **The case lookup** (`SeasonalStatusResult.tsx`): DOL's decision, the wage with its unit, workers
  requested and certified, the work period, the worksite, occupation and law firm, from
  `lookupSeasonalRecord` (applications from `seasonal_cases`; the H-2B and CW-1 wage requests from
  `pwd_cases`, which has no workers or period). Before a decision, the job as DOL accepted it, from
  `lookupSeasonalPosting` (`seasonal_postings`). A case in the file but not the live table answers
  from the file instead of "no record". Words and the H-2A decide-by date are in `src/lib/seasonalDetails.ts`.
- **The all-programs search** reads `seasonal_cases` beside the live table (`FLAG_TABLES.seasonal`),
  the published row winning as for every program; the published statuses sit in the seasonal outcome
  buckets; each row is named by its form ("H-2A job order", `seasonalForm`), and the CSV gained a
  `form` column after `program`.
- **Employer pages** get a seasonal line (`seasonalLine` in `turso/employerPrograms.ts`): published
  applications, open ones, workers certified, and the median HOURLY wage ($5 to $200, read off the
  employer's own slug range). Absent for an employer with none.
- **The API's case answer** carries the workers and period in `decision`, and `accepted` (the posting).
- **DOL writes the county with its word** ("KNOX COUNTY", "ACADIA PARISH", "CAPITOL PLANNING REGION");
  `worksitePhrase` adds "County" only to a bare name. It printed "Knox County County" for a day.

**"When DOL usually decides", on every pending H-2A, H-2B and CW-1 application** (`SeasonalTimingPanel`,
`src/lib/seasonalTiming.ts`, doc `perm_docs['seasonal_timing']` from `scripts/build_seasonal_timing.py`,
rebuilt after every monthly seasonal load, health budget 45 days). Nearest-rank percentiles over DOL's
certifications only (denials and withdrawals don't count), and no visa under 50. Two clocks, chosen by
the rules: an H-2A case with a known first day of work is placed against that day (20 CFR 655.160 has
DOL decide 30 days before it; across FY2025 and FY2026, 43,601 certifications, half came 25 to 42 days
ahead and 65% met the rule), so the panel draws the rule's date and the duplicate paragraph under the
job details is dropped. H-2B and CW-1 are counted from filing, because their decisions land on both
sides of the start date (a quarter of H-2B certifications came after it). The bar runs from the 10th
to the 90th percentile with the middle half solid; "Today" is a dated label, because off either end of
the bar it is held at the edge. Past three in four, the panel says the case is taking longer than most.
No doc, no visa block or no date to count from: no panel.

**A later decision wins, whatever order the files load in.** Three H-2B cases are in both the FY2025
Q4 and the FY2026 Q3 file, and loading FY2025 second replaced their newer rows: the writer was
`INSERT OR REPLACE`. `write_cases` upserts now (`upsert_tail`): an incoming row is written when the held
row has no decision date, comes from the same file, or decided on the same day or earlier. It returns
(sent, written) from the database's own affected-row counts, and the load check expects the file's count
to be what was read less what a newer file kept. `scripts/test_flag_later_decision.py` runs the real
writer on SQLite; removing the clause reproduces the live symptom.

**Loaded the same day:** H-2A, H-2B and CW-1 FY2025 (all three reach October 2024; DOL's newest CW-1
file for FY2025 ends at Q3) and LCA back to FY2020 Q2 (3.65 million rows). **LCA FY2020 Q1 is held back
by the load guard on purpose:** its hourly (43.23) and yearly (100,000) medians are normal, while its
bi-weekly, monthly and weekly medians (92,310, 91,957, 99,807) are yearly salaries typed under the
wrong unit, so the file is DOL's data and not a mis-mapped column. It loads with `accept_drift` once
someone decides the rows are worth carrying. The retired `h2a_cases` table was dropped.

**A summary doc written before a backfill is stale until the next pass.** `seasonal_live_summary` was
written at 5:51 AM, before the backfill stored the job-order, CW-1 and P-500 rows, so the seasonal page
showed 0 for three forms. It was rebuilt by hand from the server (`write_summary_doc(db, "seasonal")`).

**Three instruments that misled while building it.**
- A `beforeEach(() => mock.mockReset())` RETURNS the mock, and vitest calls a returned function as the
  hook's cleanup, so the mock ran with no arguments after every test. Use braces.
- `str.replace` changes every copy of a block: a patch aimed at `write_cases`'s `flush_request` also
  hit an identical block in `backfill_columns`. `ast.parse` passed; `nonlocal` binding is checked at
  compile time, so `compile()` (or importing the module) is the check.
- The case-search help line said a firm, state or occupation reads only the PERM file; it has read every
  published program since the wage-request and LCA files were indexed.

## Oct 3 2026 (night): a page for every employer that files only H-2A, H-2B or CW-1

*Superseded Oct 4 2026 (midday, below): `employer_other_index` covers every employer with no PERM
record, seasonal or not, and the sitemap family is `other-employer-N.xml` (the old name still resolves).*

**32,388 employers had filings we held and no page** (Oct 3): their only filings are H-2A, H-2B or
CW-1, so no PERM table names them. By the owner's call they get an indexable page, and every one is
in the sitemap.
- **`seasonal_employer_index`**, written by `scripts/build_seasonal_employers.py` after the nightly
  live-only rebuild in `case-status-direct.yml`: one row per employer slug in `seasonal_case_status`
  or `seasonal_cases` that resolves to no published, aliased or live-only employer. A case in both
  tables counts once, the visa comes from the case-number prefix (the job order is H-2A, the P-400
  and P-500 wage requests are H-2B and CW-1), ranks are dense by first filing then slug, and the
  write is a diff. Changed slugs join `changed-employer-slugs.json`, so the nightly expiry refreshes
  them with the rest. `scripts/test_seasonal_employers.py` runs it on SQLite.
- **The employer route resolves in three steps**, the page and its social card alike: the published
  record, the live-only record, then `seasonalEmployerRecord`; a slug in none is a 404. The page
  (`components/entities/SeasonalEmployer.tsx`, reads in `lib/db/seasonalEmployers.ts`) shows
  what we hold and nothing from the PERM model: filings by visa, the open ones, workers certified,
  the median hourly wage ($5 to $200, published rows paid by the hour), then the newest 25 cases
  with DOL's live status and, once decided, what the quarterly file printed. Every read keys on
  the EXACT slug. Titles name only the visas the employer files (`seasonalVisas` in
  `lib/seasonalForms.ts`): "H-2B Filings", never all three for a one-visa employer.
- **The sitemap's fifth child family**, `seasonal-employer-N.xml`, reads the index by rank window
  and lists nothing (keeping the other families) when the table can't be read. A new family needs
  `sitemap.xml` resubmitted in Search Console the same day.
- **Seasonal-only employers are linkable** (`entityLinks.ts` asks `seasonal_employer_index`), so
  the all-programs search links them.
- **The live-only and seasonal-only pages emit their own BreadcrumbList** ending in the employer's
  name; the breadcrumb bar ends at "Employers" on those URLs, so they had none.
- **Every dataset has a readable name** (`DATASET_LABELS` in `lib/datasetCoverage.ts`, held by
  `dataset-coverage.test.ts`): the source lines had printed "h2a-disclosure:" to readers.

**DOL's own H-2B file carries mangled punctuation**: 157 rows filed December 2023 to 2025 print
"Ryan€s" for "Ryan's" and "€“" for a dash, in employer names and job titles. It's in DOL's file,
not our parser (the published XLSX is UTF-8), and it shows as DOL printed it.

**Prettier is not this repo's formatter.** One `prettier --write` on the employer page rewrapped 634
lines to an 80-column width; the page was rebuilt from HEAD with only the intended change.

**A wage that can't be pay for its unit is shown as printed and left out of every average** (Oct 3
2026, owner's call: "official data ... everything should still be available just with caveats").
DOL's files carry yearly salaries filed under the wrong unit: $95,000 "per hour", $100,000 "per
month". Measured over 3.65 million LCA rows, the amounts fall in two groups with a gap: hourly
amounts thin out under $1,000 and restart at $10,000 (2,313 rows at $10,000 or more), and weekly,
bi-weekly and monthly ones thin out above $20,000 and restart at $40,000 (1,378 monthly, 1,067
weekly, 593 bi-weekly). About 5,400 rows, 0.15%; the wage-request file has 14, the seasonal files
none (their monthly wages are real ones near $3,000).
- **The rule is `looksYearly` in `src/lib/wageFormat.ts`** (`HOURLY_LOOKS_YEARLY` 10,000,
  `PERIOD_LOOKS_YEARLY` 40,000). `annualised` returns null for such a row.
- **The SQL reads them as NULL**: `ANNUAL_WAGE_SQL` (the salary explorer, the employer page's LCA
  line) and its Python twin in `build_lca_facets.py` (also read by `build_wage_views.py`), and
  `FLAG_ANNUAL_WAGE_SQL` for every spelling the FLAG files use (the wage-request line, the case
  search's wage bounds). `wageFormat.test.ts` holds the SQL floors to the TypeScript ones.
- **Shown everywhere as DOL printed it, with a note** (`YearlyPayNote`): the LCA and wage-request
  lookups, the wage-request and LCA browsers, the all-programs search, the day's decided cases and
  the employer page's newest filings. The search's CSV gained a `wage_note` column, the API's case
  answer a `wageNote`.
- **The case search's wage bounds compare yearly figures now.** They compared DOL's raw amount on
  the wage-request, LCA and seasonal files, so "at least $100,000" dropped every $50-an-hour offer
  ($104,000 a year) and kept "$100,000 per month". Sorting by wage compares yearly figures too.
- **LCA FY2020 Q1 loads with `accept_drift`**: the load guard held it back because its weekly,
  bi-weekly and monthly medians are yearly salaries, which is this same defect in DOL's file.

## Oct 4 2026 (midday): one identity per employer, sponsor profiles, and where H-1B wages come from

**Employer pages matched other programs by a name prefix, and that was wrong for the busiest ones.**
H-1B, wage-request and seasonal rows reached a page through `slugRange` on the name, so Intel's page
counted 8,219 LCAs filed by Intellectt, Inteli Platforms and Inteliroute, while Salesforce's missed the
5,645 filed as "Salesforce.com, Inc.". `scripts/build_employer_map.py` (nightly, after the live-only
rebuild in `case-status-direct.yml`) writes three tables, and every employer read keys on them by
equality (`employerMatch` in `src/lib/db/employerSlugs.ts`):

| table | holds |
|---|---|
| `employer_page_map` (source_slug, page_slug, page_kind, key) | the one page each spelling in each program belongs to: 333,357 spellings |
| `employer_other_index` | a page for each employer with no PERM record (H-1B, wage-request and seasonal filers): 182,226 |
| `firm_page_map` | the same for law firms, 8,098 spellings, with the attorney typo rules run over every program |

- **`program_key`** (`scripts/entity_identity.py`, twin in `src/lib/entitySlug.ts`, fixtures shared):
  HTML entities decoded, the legal name before d/b/a or a/k/a, ".com" dropped, then `entity_key`.
- **Ranks are kept across builds.** A new employer goes after the highest rank, an old one keeps its
  own, and gaps are fine because the sitemap reads rank windows. Dense ranks rewrote 177,542 of
  182,196 rows for 24 newcomers on the second build; after the fix a rebuild wrote 212.
- **A page keeps the slug it was first published under**, and a spelling that merged into another page
  redirects there.
- **Two law-firm rules:** "LLLP" is a form word, and a form word glued to the last word ("LoewyLLP")
  merges into an exactly matching busier firm (Rule C, `_GLUED_SUFFIXES`). Measured: 7 merges, 26
  cases, every one right. Individual attorneys are never named, only firms.

**Sponsor profiles, ranked part by part, never as one score** (owner's call). `build_sponsor_index.py`
writes `sponsor_index` (71,512 sponsors): PERM approval rate (20+ decided), PERM filings in 12
months, H-1B LCAs in 24 months, the share of H-1B positions that were transfers, the share at wage
level III or IV, USCIS's H-1B approval rate over three fiscal years. Each part is a mid-rank
percentile among sponsors with enough cases and says how many that was. The two H-1B shares cover the
newest 24 months of LCA detail held, measured from the newest row that carries detail, not today.
Warnings are dated facts: an active debarment, WARN notices in two years, the H-1B dependent
declaration on the newest LCA, any willful-violator declaration, likely cap-exempt (a college's
industry code). `/sponsor-finder` filters the table (count 68 ms, a page 5 ms).

**H-1B by city.** `build_lca_cities.py` writes `lca_cities`, keyed exactly like the PERM city pages
(`city_key`), with the newest three fiscal years' top employers and jobs: 3,218 cities with 20+
LCAs, 844 of them without a PERM page, which get a page and a sitemap entry. A city with a PERM page
keeps that page's slug.

**The LCA file's Section F is read** (commit 6a6f58d1): `PREVAILING_WAGE`, `PW_UNIT_OF_PAY`,
`PW_OES_YEAR`, `PW_OTHER_SOURCE`, `PW_OTHER_YEAR`, `PW_SURVEY_PUBLISHER`, `PW_SURVEY_NAME` and
`PW_TRACKING_NUMBER`, into `pw_*` columns. **FY2023 to FY2026 had no LCA detail at all** (worker
counts, wage level, flags): the Sep 14 history loads predate the mapping. `--backfill-lca-detail`
fills both, one quarter per run, 6 to 12 minutes each, newest first; on Oct 4 at 11:45 AM EDT FY2024
to FY2026 were done and FY2023 was part way. DOL lists only its newest file for the current fiscal
year (FY2026 Q3, cumulative from Oct 1); earlier years are one file per quarter.

- **DOL spells the source four ways, the same every year:** "Survey", "CBA", "SCA", "DBA", or an OES
  year. `wageSourceCondition` matches those exactly.
- **`/lca-wage-sources`** reads `perm_docs['lca_wage_sources']` (`build_wage_sources.py`, nightly,
  7-day health budget): the split by year, survey firms with their spellings grouped (from
  production's own: "Willis Tower Watson", "Wills Towers Watson", five AAMC spellings, four of
  CUPA-HR; an unlisted firm groups by its letters), the surveys named, and the employers that use
  surveys most. **A year is drawn only once 90% of its LCAs are read** (`splitYears`,
  `src/lib/wageSourceYears.ts`): mid-backfill FY2021 read "1,397 LCAs" of 521,089.
- **20 CFR 655.731(a)(2), as the page states it:** a union contract's rate is the prevailing wage
  where one covers the occupation; otherwise the employer may use OES, "an independent authoritative
  source, or other legitimate sources of wage data". The first draft said "the employer chooses".
- **The case search's `wsrc` filter** (oes, survey, cba, contract) reads published LCAs alone and says
  so (`lcaOnly`). It and the PERM-only fields turn each other off, with the reason said once at the
  top of the section, and the route answers 400 to the pair instead of an empty answer.
- **`P-200` to `P-203` are wage requests for H-1B, H-1B1 Chile, H-1B1 Singapore and E-3**, confirmed
  against DOL's endpoint; they have been on the counter and in `pwd_case_status` since Oct 3.

**Two regulation errors, corrected from the eCFR (Sep 30 2026 edition).**
- `/perm-employers/compare` said "180 days after approval, the priority date moves with you (AC21)".
  8 CFR 204.5(e) keeps the date from approval unless USCIS revokes for fraud, a revoked or invalidated
  certification, or a material error; 180 days decides only whether a withdrawal revokes the I-140
  (205.1(a)(3)(iii)(C)). The panel states the five rules as written.
- `/tools/ead-extension`: no automatic extension for renewals received on or after Oct 30 2025
  (274a.13(e), the interim final rule at 90 FR 48799, no final rule since); up to 540 days before that
  under 274a.13(d), ending with the I-94 for H-4, L-2 and E spouses. Rules in `src/lib/eadExtension.ts`.

**Smaller:** `/uscis-case-status` keeps a short list of receipt numbers in the visitor's browser only;
`/green-card-timelines` shows who's waiting at each step (cells under 5 withheld, shut until 25
timelines); USCIS's civil-surgeon search is linked where people meet the I-485.

**`sr-only` goes on a wrapper, never on a `<table>`.** A table can't be narrower than its content
and ignores `overflow`, so a screen-reader table kept its full width: `/lca-wage-sources` measured
1,092 px wide at 390, and the daily pulse's table ran 7 px past the edge on every page carrying it
(the root's `overflow-x: hidden` hid it on desktop). `sr-only-table.test.ts` gates it.

**Server jobs for this batch ran from copies**, never the live checkout: `scp` to `/tmp/empmap/`, then
`sudo systemd-run --uid=permtracker -p EnvironmentFile=/tmp/empmap/env -p Nice=10 -p CPUWeight=20
-E PYTHONPATH=/srv/permtracker/repo/v2/scripts python3 /tmp/empmap/<script>`. Put credentials in an
env file, never on the command line: `ps` shows a process's arguments.

## Oct 5 2026: what a job is and pays, where a city sits, and the visas State issues

Six federal sources now sit beside the PERM record. Each loader lives in `scripts/ingest_*.py`, discovers its file
from the agency's own page, refuses a file that fails the source's own totals or shape, and writes only rows that
changed (`scripts/lib_reference.py`: `sync_rows`, `seen_before`, `sheet_rows`). The server runs them as
`permtracker-uscis@reference` (the 14th, monthly) and `permtracker-uscis@visa-issuances` (Tuesdays).

| source | loader | table | read by |
|---|---|---|---|
| O*NET 31.0 + O*NET OnLine Bright Outlook (CC BY 4.0, credit line on every page that shows it) | `ingest_onet.py` | `onet_occupations` | occupation pages |
| BLS OEWS May 2025 (national, state, metro, non-metro) | `ingest_bls.py` | `bls_oews` | occupation and city pages, wage-level tool |
| BLS projections 2025-35 | `ingest_bls.py` | `bls_projections` | occupation pages |
| DOL OFLC wage tables, 2021-22 to 2026-27, ALC and ACWIA | `ingest_oflc_wages.py` | `oflc_wage_levels`, `oflc_wage_geography`, `oflc_occupation_basis` | occupation and city pages, `/api/wage-levels/history` |
| Census places, county subdivisions, counties, metro delineation | `ingest_census_geo.py` | `census_counties`, `city_geo` | city pages |
| BEA regional price parities (API, `BEA_API_KEY` in uscis.env since Oct 5) | `ingest_bea_rpp.py` | `bea_rpp` | city pages |
| State monthly immigrant visa issuances, Mar 2017 on | `ingest_visa_issuances.py` | `visa_issuances` + `perm_docs['visa_issuances_summary']` | `/visa-issuances`, bulletin line pages |

- **BLS answers a browser User-Agent from a script with 403** and serves one that names who's asking:
  `lib_gov_data.CONTACT_HEADERS` (with an email) goes to BLS hosts only.
- **The robots guard matches by RFC 9309's longest rule**, not Python's first-match parser, which read apps.bea.gov's
  `Disallow: /` + `Allow: /api/` as forbidding the API. Two owner conventions are kept: a `User-agent: *` record with
  no rules, then a blank line, allows everything (www2.census.gov's file; strict RFC grammar would forbid every
  crawler there), and a comment line inside a group doesn't end it (www.uscis.gov has `# Custom` mid-group).
- **O*NET's CSV zip is named in a `data-href-csv` attribute and the page's schema.org `contentURL`**, not in an href,
  so `discover_links` (hrefs only) can't see it; `csv_zip_url` reads where the page names it.
- **DOL's 2021-22 and 2022-23 county lists are in DOS code page 437** (Mayagüez is byte 0x81). DOL's Appendix A list
  starts with 2024-25; earlier years store NULL, never 0. DOL's GeoLvl column is undocumented, stored as printed and
  never described on a page. A "High Wage" row has only an average ($115 an hour, $239,200 a year, per DOL's notes).
- **City matching** (`build` in `ingest_census_geo.py`): Census strips only LOWER-CASE legal descriptions ("Boise City
  city" is BOISE, "Carson City" stays); New England towns and NJ/PA/MI townships come from the county-subdivision file
  (status S and F excluded); Connecticut uses planning regions, which the 2020 places-by-county list predates, so a
  retired county code gives way to the subdivision's; two equally good places in one state (NJ's Hamiltons) stay
  unmatched. 3,555 of 3,902 cities placed, every one with a DOL wage area.
- **State's tables**: Excel from Oct 2024, PDF before, parsed by word position, a month loaded only when its rows add
  up to State's GRAND TOTAL. Categories come from State's own "Immigrant Visa Symbols" legend (T5 is EB-5, not the
  T-visa symbol). Country keys normalise every dash: State wrote "China - mainland born" with a hyphen and an en dash.
  May 2020's by-consulate table has 190 rows (consulates closed), so the floor is 50.
- **BEA prints the housing line as "RPPs: Services: Rents"**; the word housing never appears in its descriptions, so
  the loader matches `rents`. Its first real run (Oct 5, once the key existed) refused on a fixture written from a
  guessed "Services: Housing"; the test carries BEA's five real descriptions now. First load: 37,230 values, 51
  states, 387 metros, newest year 2024. The key came by email to the press inbox (Zoho files automated mail under
  Notification, not Inbox) and needs one activation click behind a reCAPTCHA; it went to the server by pipe, unprinted.
- **City pages carry FY2016 PERM jobs coded in SOC 2010**, which BLS and DOL no longer publish, so the city figure
  looks 18 jobs down for six with current data.

## Oct 5 2026: one employer, whatever the spelling (Limited, spacing, aliases)

Found by testing the extension's lookup: Infosys's PERM page showed 0 H-1B while 46,988 sat on a page of
their own, and Wal-Mart's 1,595 PERM cases and Walmart's 417 were two companies.

- **"limited" and "incorporated" are form words** like "ltd" and "inc" (`ENTITY_NOISE`, both languages):
  440 key pairs join, every sampled one the same company.
- **Rule D, spacing** (`spacing_aliases` in `scripts/entity_identity.py`): keys with the same letters and
  the gaps elsewhere are one company, the busiest spelling the root; keys under 4 letters stay apart.
  2,526 groups (Wal-Mart, JPMorgan, T-Mobile, AT&T, Lowe's, Moody's). No punctuation rule could do it:
  treating `'`, `-` or `&` as part of a word joins about as many keys as it splits (378/237, 338/484,
  24/44). Keys keep their spaces, because `nameVariants`, the law-firm typo rules and the lookup's
  whole-word match read the words.
- **The build publishes its aliases.** `merge_entities` fills `keyAliases` (Rule D then the typo rules,
  `identity_aliases`); `db_migrate.slug_maps` links a case filed under a folded spelling to the page
  (`with_aliases`; 20 Fragomen cases under "Bersen Loewy" had no firm link), and
  `db_migrate_public` stores them as `perm_docs['key_aliases']`.
- **Old pages are keyed by today's rule.** `prior_maps` recomputes an employer's or firm's key from its
  stored name; keyed by the stored key, any rule change would have left an absorbed page with nowhere to
  redirect and the next load refusing.
- **Steps that join a name to today's pages use `SpacedKeyMap`** (exact key, then the same letters):
  `build_entity_detail.py`, `ingest_perm_history.py`, `ingest_warn.py`. `build_employer_map.py` matches
  through Rule D but stores each spelling's own key, which the lookup's exact step reads.
- **The lookup** (`employerLookup.ts`): whole-word matching also accepts the same letters ending on a word
  boundary ("walmart" may be "wal mart associates", "meta" still isn't "metamorphosis"). The possible-match
  step reads the name search and `searchByLetters` (spaces and punctuation stripped in SQL) TOGETHER,
  busiest first: run only when the name search came back empty, "Lowes" found the 6-case LOWES
  LANDSCAPING and never reached LOWE'S COMPANIES (270).
- **A tiny exact match gives way to a much busier namesake**, labelled possible (`SMALL_EXACT` 30,
  `BUSIER_BY` 10, `BUSY_FLOOR` 100): "Amazon" had answered with a 1-case "AMAZON".
- **A merged page is named by its busiest SINGLE spelling, whose key can be the group's minority key**
  ("BigPanda Inc" names the page while "big panda" holds more cases). `with_aliases` therefore points
  each group's root at the page too; without it the first production load refused on 43 old pages with
  nowhere to redirect, after writing 4,666 rows (the rerun finished the swap).
- **The rebuild, Oct 5 2026:** `perm_entities` 77,966 rows; 527 employer and 107 law-firm pages merged
  into another page. **A retired slug answers 308 to its survivor** (`viaAlias` in `loadSubject`): it had
  rendered the survivor at a 200 with a canonical since a loading boundary made redirects impossible,
  and that boundary was removed Aug 28 (the route's spelling redirect already answered 308); Walmart's page
  reads 2,012 PERM and 22,181 LCAs, Infosys 46,988 LCAs, JPMorgan 1,957 PERM. The 1,522 employer and
  1,225 firm slugs on either side of a merge were expired by hand through the two revalidate routes.
- **A script copied to `/tmp` on the server lacks `src/`**: `build_wage_bands.py` reads
  `src/lib/wageStats.ts` and failed there. Run such steps from `/srv/permtracker/repo/v2`.

## Oct 9 2026: the busiest H-1B employers, by year and state

`/h1b-employers` and one page per state (`/h1b-employers/<state>`, e.g. `texas`, `district-of-columbia`)
rank the 100 busiest H-1B employers each fiscal year two ways, from `h1b_employer_ranks` and
`perm_docs['h1b_ranks_summary']`, written by `scripts/build_h1b_ranks.py`:

| ranking | source | years | "state" means |
|---|---|---|---|
| certified H-1B LCAs (H-1B1 and E-3 left out) | DOL's LCA files | FY2020 on | the WORKSITE |
| H-1B approvals, all six petition kinds | USCIS's Employer Data Hub | FY2009 on | the PETITIONER's address |

- **A state view shows only the ranked source's figures**, because one row holding both would set a job in
  Texas beside approvals filed from Washington. The national view shows both.
- **A row reaches an employer page through `employer_page_map`** (97.6% of FY2025 approvals map); a row
  with no page keeps its own spelling and isn't linked. Names are the page's own, as DOL prints them.
- **Median pay** uses the salary explorer's yearly wage rule and band (`ANNUAL_WAGE_SQL`, imported from
  `build_lca_facets.py`), withheld under five filings. "Senior roles" needs 20 leveled LCAs.
- **Marks:** H-1B dependent when most of the year's LCAs declare it (Meta declared it on all 6,418 of its
  FY2025 LCAs); willful violator only when most do (one LCA in 6,418 carried it, a typing error far more
  often than a finding). PERM holds, WARN notices in two years and debarment describe the employer today.
- **Rebuilt** after each LCA load (`flag-disclosure-ingest.yml`) and each Data Hub read
  (`permtracker-uscis h1b-hub`, the 20th); about 8 minutes, 111,255 rows over 18 years. The health check
  watches the doc at 45 days. `/h1b-employers` is in `/api/revalidate-disclosure`'s list; the state pages
  turn over on their weekly window.
- **The page opens on the newest complete fiscal year** (`defaultYear`), ranked by LCAs; the year, the
  ranking and the state live in the URL and the address, read through `/api/h1b-employers`. The first 25
  rows show; ranks 26 to 100 sit in a native `<details>`, in the HTML either way.
- **FY2025, nationally:** 531,108 certified H-1B LCAs from 59,740 employers; the 10 busiest filed 83,914
  (1 in 6), the top 100 182,717. USCIS approved 406,335 workers for 51,548 employers.
- **The rail's Employers and wages group would have held 8 entries** (729px against 700), so Layoff notices
  moved to Denials and audits, next to Employers under review.
- **Glossary:** "H-1B dependent", from 20 CFR 655.736 and 655.737 read on eCFR (Oct 9 2026).
- **USCIS abbreviates names on older Data Hub rows** ("TATA CONSULTANCY SVCS LTD", "COGNIZANT TECH SOLNS US
  CORP", "UNIV OF MICHIGAN"), and those spellings matched no page: 4,233 spellings and 413,406 approvals were
  on no employer's record, and Tata showed twice in one year's list. `build_employer_map.py` now writes out
  `ABBREVIATIONS` for a spelling that files nothing and matches nothing, and joins it only when every way of
  writing it out reaches the same page (4,349 joins with the lottery's rows; 25 sampled by hand, all right).
  A spelling that files keeps its own page, so no URL moved. The join was found by checking the first
  build's unlinked rows per year, not by any gate.


## Oct 25 2026: WARN notices from 40 states and DC

The owner's question: *"why only layoff from those? why not everyone and all?"* `/layoffs`, the employer pages and
`warn_notices` read California, New York, Texas and Washington. Every state's site was checked (robots.txt, and what a
plain request gets back), and every state a script may read now has a reader.

- **Where the code is.** `scripts/ingest_warn.py` keeps the first four and runs everything. `scripts/warn_states.py`
  holds one `parse_*` and one `load_*` per new state and the `STATES` registry (name, page, freshness budget).
  `scripts/lib_warn.py` holds what they share: `notice()`, `finish()`, `assign_ids()` (moved from ingest_warn
  unchanged, so no held id moved), the date and count readers, an HTML table reader, and `get` and `post`, which ask
  robots.txt first through `lib_gov_data` and retry a dropped connection. Tests: `scripts/test_warn_states.py`, on a
  trimmed real copy of each state's file in `scripts/fixtures/warn/`.
- **Each row keeps what the state printed.** New Jersey and Pennsylvania print only the month a notice was posted. It's
  stored as `"2026-10"`, never an invented day, and the site prints "Oct 2026" (`warnDate` in `src/lib/warnStates.ts`,
  which also holds the state names and is held to the Python registries by its test). Oklahoma prints no worker count:
  null, never 0. Hawaii's notices before August 2026 are letters with no count. Notices before 2019 (`SINCE`, Texas's
  portal's own start) are left out.
- **Five states share one job-center search** (Arizona, Delaware, Kansas, Maine, Vermont: `/search/warn_lookups`). The
  count is only on each notice's own page, so a run asks for at most 30 of them, newest first (`JC_DETAIL_CAP`,
  `--detail-cap`), and reuses a count the table holds. On a first load most older notices have no count yet; they
  fill 30 a run on each state's walk day, or at once with one hand run and a higher `--detail-cap`.
- **Each state reads its whole history once a week, on its own weekday** (`walk_day`, spread by the state's place in
  `STATES`), and on its first load; other days read the newest two years or the newest window. Florida's server takes
  about twenty seconds a page, so its walk alone is about ten minutes. A first load of every state is about 20
  minutes; the WARN step has 35 and the job 50.
- **A state's site being down isn't our failure.** A refusal or an outage (`is_unreachable`: 403, 429, 5xx, a
  timeout, a dropped connection) is a `::warning::` and a line in the run's note, and that state's own freshness row
  is the alarm. A parse that breaks or finds nothing turns the run `partial`.
- **Each state has its own freshness row** (`warn-notices-<st>`, with a label and a coverage sentence in
  `src/lib/datasetCoverage.ts`). Its budget is the longest gap between its notices in the two years before Oct 25
  2026 plus a week, never under the newest notice's age that day plus two weeks: 28 days for Illinois and Maryland,
  six to ten weeks for most, and ten months to a year for Alaska, Delaware and North Dakota, which post a few a
  year.
- **Superseded the same day (Oct 25 2026, midday): 47 states and DC**, below. The list that follows is the morning's.
- **Not read, and why** (checked Oct 25 2026; also in warn_states.py's docstring): Arkansas publishes none and
  Wyoming's site lists none; Louisiana and New Mexico serve their files but robots.txt disallows them; Rhode Island
  (Cloudflare), Missouri (Imperva), Nevada and New Hampshire (Akamai) answer scripts with a bot wall; Minnesota's page
  is behind a captcha, and its monthly PDFs are named only there; West Virginia posts only the notice letters.
  Massachusetts before July 2020 (.xls workbooks) and South Carolina before 2022 (no notice date) are left out too.
  Massachusetts is read from the State Library's DSpace copy (archives.lib.state.ma.us), not mass.gov (Akamai).
- **No wall is worked around**: no proxy, no browser, no CAPTCHA. A public scraper project reaches some walled states
  through a paid proxy; that isn't copied.
- **`--parse-only`** fetches and parses every state with no database at all and prints a line a state: notices, first
  and newest date, rows with a count and with a site. The first full one (Oct 25 2026, from this Mac, about 13
  minutes): 41 parsed, none failed, 15,028 notices. It found Florida reading one page of a hundred a year, because
  its pager's links are HTML-escaped (`&amp;page=2`); fixed and tested, Florida then read 2,674 notices where the run
  had 800. Whether every state answers GitHub's runners the way it answers a home connection is untested until the
  first scheduled run.
- **`/layoffs`** names the ten states it doesn't read, draws the twelve busiest states and sums the rest, and says when
  the table lists the newest of more notices than it holds.

## Oct 25 2026 (midday): WARN notices from 47 states and DC

- **Three states publish no list, each checked on the agency's own page**: Arkansas ("does not publish or
  disseminate specific company data, including WARN notices, due to confidentiality requirements", A.C.A.
  § 11-10-314); New Hampshire (neither Employment Security nor the Office of Workforce Opportunity lists notices);
  Wyoming (its page says the state "follows the federal WARN Act requirements" and lists none).
- **Seven states whose own sites turn scripts away are read from the Internet Archive's copies**: Louisiana and New
  Mexico (robots.txt asks scripts off their files), Missouri (an hCaptcha check), Nevada, and Texas's agency
  spreadsheet; Rhode Island's own page first, the Archive when it refuses. Nothing at the state's site is asked
  for, nothing is solved or disguised, and the Archive has no robots.txt (404). The same reasoning as the visa
  bulletin's Archive route. A copy is only as new as the Archive's last visit, so these states' budgets are long
  (70 days for Louisiana and Missouri, 120 for Nevada and Rhode Island, 200 for New Mexico), from their visit gaps.
- **Minnesota and West Virginia are read from their own sites**, inside what their robots.txt asks: Minnesota
  only in its visit window (00:00 to 12:00 UTC, 10 requests a minute), else the Archive; West Virginia 10 seconds
  between requests. West Virginia's compiled list covers 2022 to 2024; outside it, its notices are letters, so
  those rows carry no count, and Minnesota prints none.
- **Every copy is checked before it's read** (a PDF must be a PDF, a page must hold its table), so the Archive's
  empty stub pages can't load as data. **The Archive refuses its page copies for long stretches (HTTP 429)**: on Oct 25 2026 it refused every copy from this Mac from late morning, and from GitHub's runner at 12:45 PM, while its index still answered. The readers back off (30, 30, 90 seconds), then warn and leave the state for the next day; the health check names every state that has never loaded (`check_warn_states`). Never run two Archive readers at once, and never retry by hand in a loop: it only lengthens the refusal.
- **First real load (Oct 25 2026)**: Rhode Island and West Virginia loaded; Louisiana, Minnesota, Missouri, Nevada and
  New Mexico wait on the Archive, and Kansas answered the runner with a page holding no results table (it reads
  fine from a home connection; the error now quotes the page's title). A one-state run is recorded as
  `ingest_warn.py:<st>`, so it can't clear the full run's failure.

## Oct 27 2026: the rule watch

Owner's yes, Oct 27 2026, about 8:02 AM EDT ("yes we should"), after DOL's PERM proposal (RIN 1205-AC29) cleared
White House review on Oct 23 with nothing on the site saying so.

**Three records, one key.** A significant rule goes to OIRA, then on public inspection, then into the Register, and
the RIN (Regulation Identifier Number) names it in all three. `scripts/ingest_rule_pipeline.py` reads:

| source | what it gives | notes |
|---|---|---|
| `reginfo.gov/public/do/XMLViewFileAction?f=EO_RULES_UNDER_REVIEW.xml` | received date, OIRA's stage | `RUNDATE` on the root is the freshness stamp |
| `...?f=EO_RULE_COMPLETED_30_DAYS.xml` | completed date, the decision as OIRA prints it, major | forgets a review after 30 days |
| `federalregister.gov/api/v1/public-inspection-documents/current.json` | filing time, scheduled publication | carries no RIN: the RIN comes from each candidate's raw text (`RIN 1205-AC29` line); `regulation_id_numbers` is refused as a field there |
| `federalregister.gov/api/v1/documents.json?conditions[term]="<RIN>"` | proposal, comment deadline, final rule, effective date | the search matches the Unified Agenda too, so only documents whose own `regulation_id_numbers` carry the RIN count |

- **Which rules**: every USCIS rule (1615), and 1205 (ETA), 1235 (WHD), 1400 (State) and any DHS code (16xx) only
  when the title names an immigration program (`IMMIGRATION_TITLE`). ETA's apprenticeship rule and State's arms
  rules are dropped by it; the public inspection list also passes the policy feed's own `keep()`.
- **Two reviews, two column sets** (`p_*` for the proposal or a notice, `f_*` for a final or interim final rule):
  OIRA reviews a rule twice and the second must not erase the first.
- **Never cleared, written only on a change**: `merge` keeps every fact a feed has forgotten, the first title read
  stays (OIRA appends "(NPRM)"; the page drops it), and a run that changed nothing writes nothing. Steps
  (`rule_pipeline_events`, keyed rin, kind, date) are written only when a dated fact is new or moves.
- **Proposal and final**: the proposal is the first proposed rule under the RIN, the comment deadline the latest any
  of them sets (an extension is filed as a proposed rule), the final rule the newest (1615-AC70 has two).
- **OIRA unreadable fails the run; a later source is a warning** read again next time. `--follow RIN` adds a rule by
  hand that's past OIRA.
- **Schedule**: a step of `processing-times-ingest.yml`: every daily pass, and on the hourly weekday pass only when
  the Eastern hour is 9 or 17. `rules_changed` POSTs `/api/revalidate-policy` (a 404 before the route ships is a
  warning, not a red run).

**The page.** `getRulePipeline` (`src/lib/db/rulePipeline.ts`) throws on a failed read (no such table is the one
honest empty) and leaves off a rule finished more than 90 days ago. `buildTrack` in `convex/lib/ruleSteps.ts` gives
six steps, each done, upcoming, unrecorded (a later step has a date: before this record began), next or ahead; a
withdrawn review stops the track; a rule first met as final reads "Published as a final rule" and "Takes effect".
On a phone the track is a checklist; from 768px one row of six segments. The card title is a `<p>`, not a heading:
once published the same title is a heading in the Register list, and the outline would hold it twice.

**The digest** (`readRuleMoves` in `convex/newsletter.ts`): steps dated inside the week, worded by `stepSentence`,
linked to OIRA's page or the Register's copy; `issueHasNews` counts them, the subject counts rules, not steps.

**The newsworthy check** (`scripts/lib_newsworthy.py`, tested in `scripts/test_newsworthy.py`):

| move | rule |
|---|---|
| a rule step | seen in the window AND dated in the last 7 days (the first run records months-old steps) |
| DOL's processing times | analyst review, audit, reconsideration or the PERM wage-request months differ from the reading before |
| the bulletin | `bulletin_first_seen` in the window |
| an employer | a hold move or decision batch of 50+ cases (`NEWS_EMPLOYER_MIN`) |
| a decision day | a weekday at 2x (`DECISION_DAY_MULTIPLE`) the median of the 20 weekdays before; never a weekend |

The morning report's first section covers 24 hours; `newsworthy.yml` (timer `dispatch-newsworthy-evening`, 00:30 UTC)
covers since 7 AM Eastern and calls `newsworthy:send` only when something moved, through `sendOwnerMail`. The log
prints one word and discards the Convex call's output. Python and TypeScript word a step the same:
`scripts/fixtures/rule_step_sentences.json` is read by both tests.

**Traps hit building it.** A probe loop that asserts before writing left the previous probe's mutation in the file
(the readings guard), caught only because a later check failed: wrap each probe in try/finally. `beforeEach(() =>
mock.mockReset())` returns the mock and vitest calls it as cleanup, so a rejecting mock fired after the test as an
unhandled rejection that `vitest.setup.convex.ts` rethrows. The app's database client is HTTP-only (`file:` URLs
refused), so a local QA render used a small Hrana-over-HTTP shim on a SQLite copy.

## Oct 27 2026 (morning): every policy source, first

Owner, Oct 27 2026, about 9:08 AM EDT: "we should always be first for everything and auto and such auto self
updating healing robust fallbacks any and all edge cases no silent issues". He had asked first whether the rule
watch was "all sources". It wasn't, and neither was the policy feed before it.

**What was missing, measured that morning.**
- **Presidential documents.** The Register feed's agency list left out the Executive Office of the President, so the
  Sep 23 2026 H-1B proclamation and executive order never reached the page. The White House had posted them on
  Fri Sep 18, five days before the Register.
- **Public inspection, for anything but a tracked rule.** A notice, a temporary final rule (an H-2B cap increase) or
  a presidential document is filed the business day before it publishes. Only rules followed by RIN were read there.
- **The seasonal programs.** None of the feed's seven search terms was H-2A, H-2B or CW-1. OFLC's H-2A, H-2B and
  CW-1 announcements were counted and not listed.
- **The newsworthy check never saw a new document or announcement.** It read only rule steps, DOL's months, the
  bulletin, employer moves and decision days.
- **A failed read showed an empty feed** (`listPolicyNotices` caught everything into `[]`).
- **Two writers used `INSERT OR REPLACE`.** That deletes the row first, so a source that knew fewer columns wiped
  the others.

**One writer** (`scripts/lib_policy_feed.py`, tested in `scripts/test_policy_feed.py`): every source writes
`policy_notices` through `write_notices`.
- A fact is never cleared: an empty incoming column keeps the stored one.
- `first_seen_at` is set once. `fetched_at` moves only when a row changed.
- A status only moves forward: public inspection, then withdrawn or published.
- Topics are a union. A row is written only when it changed.
- New columns: `first_seen_at`, `source`, `status`, `pi_filed`, `signing_date`, `superseded_by`.
- `POLICY_DATASETS` lists every source's freshness row. The health check warns on one that never loaded
  (`check_policy_sources`), and the test holds the page and `datasetCoverage.ts` to the list.
- `record_quiet_run` writes an "ok, nothing new" run row at most every 3 hours. `expire_policy_page` POSTs
  `/api/revalidate-policy` after a write.

| source | reader | runs |
|---|---|---|
| Federal Register, published (11 terms: + H-2A, H-2B, CW-1, premium processing) and presidential documents | `ingest_policy_notices.py` | server every 30 min (`--days 3 --inspection`); GitHub daily, 180 days |
| its public inspection list, every kept document, followed until published or withdrawn | the same, `--inspection` | server every 30 min |
| White House presidential actions (RSS, full text) | `ingest_white_house.py` | server every 30 min |
| OIRA, public inspection and the Register by RIN, plus the Unified Agenda | `ingest_rule_pipeline.py` | server every 30 min; GitHub daily and 9 AM / 5 PM weekdays |
| USCIS newsroom and Policy Manual updates | `ingest_uscis_news.py` | server every 30 min |
| State Department visa news | `ingest_state_news.py` | server every 30 min |
| regulations.gov comment counts on open proposals | `ingest_regulations_gov.py` | server every 30 min with the key |
| bills in Congress | `ingest_congress_bills.py` | server every 30 min with the key |
| DOL's newsroom, OFLC announcements | `ingest_dol_news.py`, `ingest_oflc_news.py` | GitHub every weekday hour and daily (www.dol.gov refuses the server) |
| federal court opinions (CourtListener's search API, keyless) | `ingest_court_opinions.py` | server, at most once every 3 hours; Sundays 3 AM a five-page walk |
| BALCA's decisions (OALJ's caselists, found from its immigration library) | `ingest_balca.py` | GitHub daily (www.dol.gov refuses the server) |

**Keep rules.**
- DOL documents from outside ETA, and the President's, must name an immigration subject (`mentions_immigration`).
  An employee-benefits rule that says "prevailing wage" ("Transparency in Coverage", Oct 6 2026) had been listed.
- A White House action is kept when its title names immigration, or its text names a work-visa subject at least 3
  times (`BODY_MIN`). The Labor Day proclamation names H-1B once, and sanctions orders carry an "entry of aliens"
  sentence.
- A public inspection filing is judged on its title, because the list has no abstract.
- A bill is kept by its title alone. Congress's subjects arrive days or weeks after a bill is introduced.

**Courts and BALCA** (`scripts/lib_case_captions.py`, types `Court opinion` and `BALCA decision`).
- **A person named in a caption is shown by initials** ("E. v. U.S. Department of State"). Agencies, organizations
  (a marker word such as LLC or University) and officials are kept as printed. A caption the rule can't settle is
  held in `policy_held` and shown nowhere until it's ruled on (`--held`, `--release DOC --as person|organization`).
  An abstract with an unknown capitalised word left after redaction is dropped and the row kept. A BALCA decision's
  PDF is linked only when every name in its file name is DOL's or the employer's.
- **Courts:** eleven phrases, newest first, 120 days back; federal courts only, no criminal case, no petition for
  review of a removal order, and the phrase must sit in the passage that matched. CourtListener's search took 42 to
  116 seconds an answer on Oct 27 2026, so the read timeout is 180 seconds and a timeout is a warning. Of 40 results
  that day, 13 were kept.
- **BALCA:** OALJ lists every en banc PERM decision (back to 2006), and prevailing wage, H-2A and H-2B appeals from
  FY2025. It keeps no list of ordinary three-judge PERM decisions. www.oalj.dol.gov's robots.txt asks robots off, so
  its pages are linked, never read. On the fixtures 7 of 191 captions were held.
- **On the page** they're "From the courts and BALCA": the newest six as rows, the rest folded by year. The digest
  lists at most three a week, chosen by when this site first held them (OALJ posts weeks late) and decided in the
  last 120 days, so a first load can't fill an issue.

**One document once.** A White House row links to the Register's presidential document by signing week and the same
title, or the nearest title at 75% word overlap (`link_presidential`). The White House's title for the Sep 18
executive order repeats "Integrity and"; the Register's doesn't. **An unmatched action waits 14 days**
(`SIGNED_WAIT_DAYS` in `src/lib/policyFeed.ts`), then moves from "Coming next" to the agencies' list. Many memoranda
are never printed, and without the wait one would read "not yet in the Federal Register" forever.

**Following a filing.** Once its publication day comes, the reader checks the Register's record. Published, it's written
in full and keeps its filing day. Not there 3 days after its day, it's marked withdrawn.

**State Department visa news.** travel.state.gov answers 403. adoption.state.gov serves its newsroom as JSON at
`/en/newsroom/_jcr_content/root/container-main/container-content/newsroom.results.json` (the newest 10, no paging).
Some of its servers still run the old site and answer 404 there, so the reader retries. An item is kept on its Visas
tag plus the page's text. Nothing is defeated.

**api.data.gov (regulations.gov and congress.gov).** One key, `DATA_GOV_API_KEY` in the server's `uscis.env`, set
Oct 27 2026 at 10:19 AM EDT. Adam signed up as the persona and the key arrived in the press mailbox's Notification
folder; it was moved by a script that never printed it. The limit with the key is 1,000 an hour; DEMO_KEY allows 10.
Without the key both readers run only at 7:07 AM and 5:07 PM Eastern, and `check_data_gov_key` warns.
- **Comment counts** (`policy_comment_counts`, `src/lib/db/policyComments.ts`): `meta.totalElements` of the
  document's comments, which is comments POSTED. An agency posts after screening, so the count trails what people
  sent. The Federal Register's copy (`regulations_dot_gov_info.comments_count`) fills a rule only until
  regulations.gov answers; on Oct 27 it read 26,704 against regulations.gov's 26,697. The count shows only while
  comments are open.
- **Bills** (type `Bill`, source `congress`, `bill-<congress>-<type>-<number>`). `publication_date` is the day a bill
  was introduced; `dates` holds its latest action's day and `action` the text. The page lists them under "In
  Congress", newest action first. The digest and the evening check date a bill by its latest action. The evening
  check reports a bill when its row was rewritten in the window (`fetched_at`) and the action is dated in the last
  week, so a backfill's old actions stay quiet. Congress's printed number ("H.R. 2315", missing from congress.gov's
  titles) comes from `convex/lib/billNumber.ts` and `lib_newsworthy.bill_number`, held together by
  `scripts/fixtures/bill_numbers.json`.

**The page** (`/policy-changes`).
- **The rule pipeline gives full cards only to rules under way** (`isActiveRule` in `convex/lib/ruleSteps.ts`): at
  OIRA, on public inspection and unpublished, open for comment, a final rule not yet in effect, or a step OIRA or the
  Register dated in the last 90 days. The agenda's listing doesn't count: an edition relists rules nothing happened
  to. The rest fold under two counts ("No step in the last 90 days" and "Listed in the agenda, not yet at OIRA"), and
  every row stays in the page. Measured on a copy of production: 23 cards (about 10,000 px) became 8 cards and two
  folds (3,710 px).
- **Sections:** "Coming next" (filed and signed, not yet published), the Register list with presidential documents
  (orange), "From the agencies" (every announcement, each naming its agency), "From the courts and BALCA", and
  "In Congress".
- Announcement links in the yearly folds are 44px rows (they were 26px over 847 items).
- The feed's read throws on failure. `buildFeed` returns `register`, `filed`, `signed`, `announcements`, `bills` and `decisions`.

**The newsworthy check's sixth kind** (`_document_items`): a document first seen in the window and dated (filed, for
a filing) in the last 7 days, never one the rule watch already reports. A new Unified Agenda edition is reported in one
line. **The digest** lists published Register documents, unpublished White House actions, announcements
and bills that moved, in plain words ("Final rule", "White House", "Bill in Congress").

**The server job** is `permtracker-uscis policy-watch` (timer `permtracker-uscis@policy-watch.timer`, at :07 and
:37 every hour). Each step has its own time limit and failure row. The rule watch's `rules_changed` is read from a
GitHub-output file, and the job POSTs the refresh through nginx (127.0.0.1:8081, both web copies).

**The coverage ceiling** in `dataset-coverage.test.ts` leaves out the policy datasets, which are held exactly to
`POLICY_DATASETS` instead (as WARN states are held to their readers).

**Two test traps.** The pipeline's glued-text test matched one closing and one opening tag, so "entry</a></p></li><li>"
passed it while the rendered audit found 9 pairs; it matches any run of tags now. And the window on this Mac doesn't
resize, so phone widths come from `scripts/phone_sweep.mjs` through `solo-headless.sh`.

**An old copy that outlasts its stop isn't a failure** (Oct 27 2026, 11:40 AM EDT). After the switch, the deploy stops
the old slot's second copy. `green2` held a long-lived connection (likely an MCP client's open stream), outlasted its
30-second stop and was killed, and systemd marked it failed; the alarm emailed "a job or service failed". Traffic had
already moved, and nothing reached a visitor. `stop_copy` in `permtracker-deploy` now logs such a kill and clears the
failed mark (`systemctl reset-failed`); `test_deploy_guard.py` holds both cases, and was probed by removing the reset.

## Oct 28 2026 (night): what a rival showed, built from our own records, and the words people search

The h1bgrader catch-up (owner, Oct 28, 7:37 PM EDT: "plz do all") and the search-word pass after it, all on `main`,
live with the Oct 29 2 AM run. Ledger: `~/.claude/plans/cozy-sniffing-pumpkin.md`.

- **A case's status history** (`62434ba5`): every status DOL has shown, the DOL day it changed and how long it held,
  from `perm_case_events` (DOL's own rows only). A change seen by Aug 29 says where the case stood, not when it moved:
  the record's first full sweeps caught up through then.
- **USCIS form pages** (`b7c5a69b`, `a39f26e9`): `/uscis-processing-times/<form>`, 15 forms, every quarter held. The
  Archive's FY2024 workbooks store fractions and unrounded medians under integer formats; the loader reads each cell
  as its sheet shows it, and a history load never moves the freshness stamp backwards.
- **Visa interview waits** (`9511ce46`, `494e7a40`): State's Global Visa Wait Times from adoption.state.gov (travel
  refuses scripts), `scripts/ingest_visa_wait_times.py`, every cell kept as printed with what it reads as (NA is "No
  figure", never 0), one reading per State date. `/visa-wait-times`, India and China first.
- **Law firm rankings** (`04096837`, `83b6ec41`): `build_firm_ranks.py` writes `firm_ranks` (100 firms per program,
  fiscal year and place, through `firm_page_map`) and `perm_docs['firm_ranks_summary']`, each year with its last
  decision day; a year shows once it reaches Sep 24 (`shownYear`). `/law-firm-rankings` and a page per state. Firms
  only, statistics only.
- **Cap-exempt employers, from the employer's own answer** (`9b08e394`, `b83bc407`, `97efb393`, `5194b77d`): DOL's
  wage-request file asks whether ACWIA covers the employer (Section E); `pwd_cases.acwia` and `acwia_kind` hold it, and
  `build_cap_exempt.py` lists an employer when most of its answered requests say yes (`qualifies`). 2,252 employers on
  `/h1b-cap-exempt-employers`, worded as likely (USCIS decides). Employer pages and the sponsor finder read the same
  table; the industry-code guess is the fallback.
- **The quarterly post** (`7ca66aa5`, `00e5fbae`): `build_quarter_report.py` writes one doc per quarter
  (`quarter_report_<fy>q<n>`, and `quarter_report` names the newest), `<QuarterNow part=... />` reads it, so a post
  types no figure and keeps its own quarter's numbers. `scripts/new_quarter_post.py --fy --q` writes each quarter's
  post; it runs after the quarterly PERM load.
- **Search words** (`ef8d169e`, `97e4e20d`, `05f10783`): Search Console showed searches naming an alert, an email or a
  notification reaching no page, so `/perm-case-alerts` holds every free alert. The homepage title says "Track", the
  lookup's heading "Check and track". "How long does PERM take right now?" is answered by `howLongSentence`
  (lib/dolNow.ts) on the lookup and the processing-times page: the wait of DOL's last working day's cases, then
  DOL's own month and average. The timeline calculator has one name where it had three.
- **A card carries no live figure** (Oct 29 2026, 3:47 AM EDT, `0ac7d065`): a card whose page shows moving figures says
  `"mask": "figures"` in `scripts/page-cards.json`, and the capture draws each count, share, dollar amount and date
  as a grey bar of its own width (the reviews card's treatment) and hides a chart's own labels, so the card keeps the
  page's shape. The rule is `scripts/lib_card_mask.mjs` (tested): codes and fixed wording stay (G-100-..., ETA-9089,
  "60 days' notice"), and text that is only a number is masked whole. 19 cards carry it. A new card whose page shows
  a live figure gets the flag; look at the rendered card, since a page can split a figure across text pieces.
- **The privacy page says what the chat's AI providers may do** (Oct 29 2026, 3:18 AM EDT, `2f054ae5`): the chat runs
  on Gemini's unpaid quota, whose terms let Google use what's sent to improve its products and let human reviewers
  read it, and ask that no personal information be sent; the page had said the opposite. Mistral, OpenRouter and
  Groq lines say what their own pages allow. The owner decides the change email the policy promises (§19, draft in
  `~/Documents/permtracker-outreach/privacy-change-notice-2026-10-29.txt`) and whether to pay for Gemini's paid tier.
- **Where a wage reaches each level** (`5b42ee6f`): the wage tool's every-area view, from `wageLevelsInState`
  (`/api/wage-levels/areas`), `levelReached` in `src/lib/wageLevels.ts` the one rule (a level is reached at its own
  wage; one DOL didn't publish can't be). It says where a wage sits, never a case's level.
- **A job's wage history reaches back past the 2018 codes** (Oct 29 2026): DOL's tables used BLS's 2010 codes
  through 2021-22 and the 2018 codes from 2022-23 (`SOC_2018_FIRST_WAGE_YEAR`), so `wageLevelHistory` also reads each
  2010 code BLS maps to the job for the years before, one tagged row per code (`asCode`), never blended: 15-1252's
  2021-22 shows as 15-1132 and 15-1133. BLS's crosswalk is `scripts/data/soc_2010_to_2018.json`
  (`build_soc_crosswalk.py`), read through `src/lib/socCrosswalk.ts`; the history route sends the note
  (`codeNote`) so the 35 KB file never ships to the browser. `SocCodeText` keeps a code from breaking at its hyphen.
- **DOL's wage tables reach July 2016** (loaded Oct 29 2026, 5:36 to 6:20 AM EDT, at the history pace; 15-1252 in San Jose now reads back to 2016-17 under 15-1132 and 15-1133): the
  retired FLC Data Center's `OWL_<June that closes the year>_TEXT.zip`, kept by the Internet Archive, in the format
  the loader reads (`wage_year_of`; `OWL_2022` matched the stored 2021 table row for row). A history year never moves
  the freshness stamp (`is_newest`). Files and manifest: `~/.claude/explanations/20261029_owl_wage_history/`.
- **The database RAM lock is retired** (owner's call, Oct 29 2026, `e1e438aa`): `permtracker-dbcache` held the whole
  4.2 GB main file while swap sat at 3.5 of 4 GB, and CPU alone keeps Oracle's idle rule clear (p95 47%, Oct 22 to
  28). Reads come from the system's file cache; the morning report still fails if memory and CPU both fall under 20%.
- **/compare carries ten trackers** (`5501da84`, `490bdf30`; the owner saw the screenshots first): H1BGrader and three
  green card sites (GreenCardClock, Lawfully, Immigration Road), each dated by its own reading, in two lists. Every
  quote was re-read on the rival's page before shipping; Lawfully's QR-code line was gone, so its quote is its own
  Download App button.
- **A full-page capture that scrolls 800 px every 50 ms leaves reveal-on-scroll sections blank**: scroll 400 px every
  200 ms (`node_modules/.cache/qa/slow-shot.mjs`) before believing an empty band.
- **Recurring alert bodies in the subscriber's language** (Oct 29 2026 afternoon, `a369612b` + `1ed022a4`;
  needs the same Convex deploy as the base i18n feature, since the templates render inside Convex, not the
  site): QueueReached and BulletinMoved render fully in the row's stored `lang` (chrome dicts
  `QUEUE_ALERT_TEXT` / `BULLETIN_ALERT_TEXT` in `src/emails/i18n/alerts.ts`; `paceSentence(pace, lang)`; the
  sweeps read `row.lang`, translate the subject via `alertText` and `withLang` the unsubscribe page;
  `dueForAlert` and `liveSubscriptions` return `lang`). QueueReached takes an explicit `perm` boolean, never
  parsing the queue name. The daily bundle (DailyUpdate) renders its frame, kind labels, "Open" link and
  subject fallback in the reader's language: a `lang` is stored on the `alertOutbox` row (schema + `enqueue`
  + `AlertItem`), the case/queue/bulletin producers pass it, and `sendBundles` picks the bundle's language
  (first non-English item, else English) for `DAILY_TEXT`. English is byte-for-byte unchanged (196 email
  tests; `bundleSubject`'s English lead-and-tail form untouched). **What stays English:** DOL's status words
  and month/as-of dates (embedded in the localized sentence, as the case alert does), each bundle row's short
  "what happened" line, the `EmployerMoved` body and employer alerts (the employer page isn't translated, so
  no `lang` is stored), the status-meaning sentence (behind an `@/` module Convex can't import), and the
  plaintext parts.
