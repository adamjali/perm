# The server, deploys, the front door, monitoring and costs

The Oracle server and Cloudflare, nginx and its limits, the firewall and the automatic defense, deploys and the night window, the health check and the morning report, alarms, backups, the database's performance, and the Vercel and Turso history behind the bills.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## Two clocks and two networks run the ingests (2026-09-07)

GitHub's `schedule` trigger fired every cron here hours late for nine days
running, so the six daily and weekly jobs are dispatched by **Vercel cron**
through `/api/cron/dispatch/<job>` (`workflow_dispatch` with a fine-grained
token). `ingest-health` keeps a late GitHub schedule as a second, independent
clock. And because `www.uscis.gov` 403s GitHub's runners on some days, two
**launchd agents on Adam's Mac** retry the I-485 and I-140 fetches the day
after GitHub's attempt. Schedules, secrets, proofs and reversal:
[`v2/CLAUDE.md`](v2/CLAUDE.md), sections "Vercel's clock dispatches the
GitHub jobs" and "The residential runner".

## Turso: production's default token is READ-ONLY on purpose (2026-08-28)

Vercel prod's `TURSO_AUTH_TOKEN` cannot write; the local `.env.local` holds
a FULL-ACCESS token under the same name. So write code passes every local
test and dies in prod with `LibsqlError: BLOCKED: SQL write operations are
forbidden` - and behind the case page's `.catch(() => null)` that rendered
as an ordinary "no record". Cost an afternoon. The posture is worth keeping
(the read layer runs on a credential that cannot corrupt the corpus):

- Web-side writes go through `exec()` in `src/lib/db/client.ts` ONLY,
  which rides `TURSO_RW_AUTH_TOKEN` (Vercel prod env) and falls back to the
  default token in dev. Never call `turso().execute()` for a write.
- Before believing a prod write worked, check for the ROW, not the exit
  path. `vercel env pull` redacts sensitive values (`[SENSITIVE]`), so the
  prod credential cannot be probed locally - diagnose via `vercel logs`
  with a NAMED error tag (`[caseDiscovery]` pattern: every failure branch
  logs its cause; a discovery that throws is indistinguishable from a miss
  otherwise).
- The client also carries a 20s per-query deadline with one retry on a
  fresh request, and `next.config.ts` a 180s prerender budget: during
  Turso's 2026-08-28 degradation (their status page's own word), point
  reads stayed fast while scans hung with no response headers, and three
  production builds died on the default 60s. A deploy should get slower
  under a slow provider, not fail.
- Vercel builds from GIT: `convex/_generated/` must be COMMITTED after
  codegen, or the deploy typechecks against yesterday's API and fails on a
  module that exists locally.

## Turso forbids ANALYZE, so an index has to win on its own shape (2026-08-30)

`db.execute("ANALYZE")` returns `SQL not allowed statement: ANALYZE`, and
`sqlite_stat1` does not exist on this database. Every plan is therefore chosen
from SQLite's no-stats heuristics, which has two consequences worth knowing
before adding an index:

- **Design the index so the query cannot be served by a worse one.** Lead with
  the equality the query filters hardest on, and put the ordering column last
  so the sort comes free. `perm_case_status` had `case_status_month (month,
  status)` and `case_status_final (is_final, filing_date)`; a per-status list
  matched neither well and read all ~98,000 pending rows to return 974.
  `case_status_stage (current_status, is_final, filing_date)` serves it
  directly.
- **AN `EXPLAIN QUERY PLAN` IN THE SAME PIPELINE AS ITS `CREATE INDEX` REPORTS
  THE OLD PLAN.** The statement is prepared against the schema as it was when
  the pipeline opened, so the new index is invisible to it. This looked exactly
  like "SQLite is ignoring my index" and cost a detour through storage classes
  and stats before a second, separate call showed it had been right all along.
  Re-run the EXPLAIN in a fresh request.

## A prefix range on the leading index column forces a sort, always (2026-09-02)

The employer searches over `pwd_cases` / `lca_cases` are
`employer_slug >= ? AND employer_slug < ?` ordered by `received_date DESC`.
`EXPLAIN QUERY PLAN` shows the index being used AND a `USE TEMP B-TREE FOR
ORDER BY`, which reads every row for that employer to return five.

**The obvious fix does not work, and it was measured rather than assumed.**
Adding `case_number` as a third index column (so the index covers the full
`ORDER BY received_date DESC, case_number DESC`) changed the plan **not at
all**. The reason is structural: with a RANGE on the leading column, rows come
out ordered by `employer_slug` first, so any ordering that crosses several
slugs must be sorted. Only an equality on the leading column lets the index
supply the order.

The index kept its two-column shape and the comment now records the
measurement. The sort is bounded by one employer's filings, which is the
point - the read never touches rows belonging to anybody else. **This is the
counterpart to the `idx_pe_kind_decided` win: an expression index fixed that
one because the filter was an equality plus an expression, not a range.**

**Re-EXPLAIN in a FRESH request**, as always here: an EXPLAIN in the same
pipeline as its own CREATE INDEX reports the old plan.

## revalidateTag would be a silent no-op here (2026-08-30)

Tags attach to data through `fetch` with `next.tags`, `unstable_cache`, or
`cacheTag` inside a `"use cache"` scope. This app uses none of them - Turso is
read through a raw libSQL client - so `revalidateTag('anything')` returns 200,
logs nothing, and leaves every prerender in place. Same family as the
server-side concurrency check whose only client never sent the header.

**`revalidatePath` with a LITERAL path is the mechanism that works**, and it is
also the right shape: `/perm-employers/[slug]` carries `revalidate = 2592000`
because ~21,495 live-only pages on a short window is what took Vercel's ISR
write meter to 100%. A tag over all of them would expire all of them at once
and reproduce exactly that. `POST /api/revalidate-live-employers` takes the
few hundred slugs the nightly diff says moved; `build_entity_detail.py` writes
`changed-employer-slugs.json` (busiest first, capped at 800 to match the
route), and `case-status-direct.yml` posts it. **Never the
`('/perm-employers/[slug]', 'page')` pattern form** - that expires all ~33,700
employer pages in one call.

`export const revalidate` is route-segment config: one statically analysable
value per segment. Two render branches in one route file cannot have two
windows, which is why this exists at all.

**The second one is `POST /api/revalidate-dol` (2026-09-01), and it takes NO
input.** The homepage band says "Live from the Department of Labor · <date>",
where the date is DOL's own as-of stamp parsed from their table caption, not our
fetch time. The ingest runs daily but the pages carrying that number sit on
`revalidate = 86400`, so on the day DOL moves the fresh figure could be in Turso
while every page served the old one for up to another 24 hours: worst case ~48h
behind DOL, on a band whose whole claim is that it is live. `page.tsx` had said
"The ingest should also revalidate on demand" since it was written.

Two design points worth keeping:

- **A fixed list, not caller-supplied paths.** The employer endpoint must accept
  slugs because which employers moved is only known at runtime. Here the set is
  static (the ten ISR pages that read `getProcessingTimes()` or
  `lib/db/estimate`), so taking no input removes path validation, traversal,
  and any way to aim the endpoint at something else. `/perm-queue/[month]` and
  `/perm-case-status` are deliberately excluded, each with its reason in the
  route, and `route.test.ts` re-derives the list from the app tree so a new page
  cannot quietly start serving a stale figure. Both drift guards were probed by
  breaking them.
- **Gated on DOL actually republishing**, via a `dol_changed` output the ingest
  computes BEFORE its write (the table is keyed on `perm_as_of`, so
  `INSERT OR REPLACE` destroys the evidence). DOL moves roughly weekly, so
  firing every night would expire these pages on the ~29 days a month nothing
  changed, and every expiry a visitor walks into is a paid ISR render for an
  identical number.

## ISR cost: what actually drives it, and two models that were wrong (2026-09-01)

**A WRITE UNIT IS 8 KB, NOT A PAGE.** Vercel: *"One write unit equals 8 KB of
data written to the ISR cache."* So 951,650 units over five days is **~7.6 GB**,
which at this site's page sizes is ~29,000 regenerations, not 951,000. Reading
units as pages overstates the rate by ~33x. Corollary: **page SIZE is the bill**.
Measured: `/` 320 KB (40 units), `/perm-wages/[slug]` 330 KB (42), `/perm-queue`
289 KB (37), `/tools` 178 KB (23).

**EVERY DEPLOY STARTS THE ISR CACHE COLD. (Corrected 2026-09-02; the 09-01
version of this paragraph said the opposite.)** The earlier text quoted the
storage-retention sentence ("all the data you write remains cached for the
duration you specify...") as if it covered deployments. It does not. Vercel's
ISR page: *"It is scoped to a specific deployment where each deployment
generates its own cache"* and *"each new deployment uses its own ISR cache and
does not reuse the cache from a previous deployment."* The cache-status page
lists a deployment as a cause of a **Cold** miss: *"after a new deployment
(Vercel scopes cached responses to the deployment that produced them)"*. The old
cache survives only so rollbacks work. So after every production build, each
ISR path is regenerated and WRITTEN on its first request, and "unchanged output
costs nothing" cannot help, because the new cache holds nothing to compare
against.

**Measured: five production builds in the 24 hours around 2026-09-01 (`vercel ls`:
09:38, 10:33, 21:43, 23:04, 23:57 EDT) -> $3.23 of ISR writes on the Sep 1 usage
line, ONE day** (~808k units, ~6.5 GB, roughly 20-25k regenerations), against $3.81 for
the five days before it. **Deploy count is an ISR lever, not only a
build-minutes lever.** Corollary: an entity window of 2592000 is really
min(30 days, time to next deploy); with daily pushes that is about a day, so
raising windows buys nothing until pushes are batched. A comment-only change
under `src/` (the `Footer.tsx` doc commit) is a full cold-cache event, because
`ignoreCommand` cannot tell it from code. The 31-day eviction rule still holds
within one deployment.

**UNCHANGED OUTPUT COSTS NOTHING**, so unexpected writes mean genuine
non-determinism in the render. Checked here and ruled out: every `new Date()` in
an ISR page is date-only (`.slice(0,10)`) on a page that revalidates daily.

**What actually drove writes, in order:**
0. **Deploys.** Each one cold-starts the whole ISR tree (above). Five in 24h
   cost more than the previous five days combined.
1. **Crawlable surface.** Entity pages ARE the sitemap (20,960 of ~21,110 URLs)
   and each crawler visit to a lapsed page is a paid regeneration. Cut 35% by
   raising `MIN_TOTAL_FOR_PAGE` 3 -> 5 (16,309 -> 9,646 employers). **REVERSED
   2026-09-10: the floor is 1 and the surface is 78,600 URLs** - builds were
   the bill, not crawls; see "Every entity page is indexable now". This
   paragraph is kept as the record of what was believed and why. Nothing
   404s: sub-floor pages still render, they go `noindex` and leave the sitemap.
2. **Windows shorter than the data.** `/perm-queue`, `/perm-queue/[month]`
   (~39 pages) and `/perm-decision-activity` sat on `revalidate = 3600` while
   their own comments said the data "moves daily" and "quarterly" - ~984
   regenerations/day expressing at most one change. Now 21600 (6h).
3. **Page size**, which is where the next section went wrong.

## Turso bills rows READ, and two queries read 143k rows per entity page (2026-09-02)

The Aug 28-31 invoice charged **7.75 billion rows read** ($7 over the plan's
1B), and by the afternoon of Sep 2 the new cycle had already read **11.58
billion** against a 2.5B allowance. Writes were nowhere near the cap. Turso's
own dashboard (`app.turso.tech`, sidebar "Usage") is where to read this; the
CLI is not installed here and the platform API needs a token we do not hold.

**EXPLAIN QUERY PLAN over the read layer found the cost.** Every employer,
firm and occupation page render ran:

| query | plan before | rows per render |
|---|---|---|
| `nameVariants`: `merge_key = ? OR merge_key LIKE ?` | walks the whole kind (`idx_pe_kind_total (kind=?)`) | 71,512 |
| `fieldDistribution`: `(IFNULL(certified,0)+IFNULL(denied,0)) >= ?` | walks the whole kind | 71,512 |
| `count(*) FROM perm_entities WHERE kind = ?` | covering index, every entry | 71,512 |

~213k rows per render, times the tens of thousands of regenerations a cold
ISR cache produces after each deploy, is the invoice. Fixes, each verified by a
fresh EXPLAIN (an EXPLAIN in the same pipeline as its CREATE INDEX reports
the OLD plan):

- **A range beats OR + LIKE.** `merge_key >= root AND merge_key < root || '!'`
  captures exactly `root` and `root <suffix>` (space, 0x20, is the last
  character below `!`, 0x21) and is served by the existing `(kind,
  merge_key)` index.
- **An expression index serves a filter on an expression**, if the SQL text
  matches the index expression exactly: `CREATE INDEX idx_pe_kind_decided ON
  perm_entities (kind, (IFNULL(certified, 0) + IFNULL(denied, 0)))` turned the
  cohort read into `SEARCH ... (kind=? AND <expr>>?)`, 9,176 rows. Created
  live; it took effect for the deployed code immediately because the text
  already matched.
- **Ranks are dense 1..N per kind** (measured `MAX(rank) = COUNT(*)`), so the
  kind's size is one read from the top of `idx_pe_kind_rank`, not a count.
- `perm_cases` had **no index on `received_date`**; `idx_pc_received
  (received_date, days)` covers the cohort-duration fallback.

**How to audit this again:** pull every SQL literal out of `src/lib/db`,
bind `?` to placeholders, `EXPLAIN QUERY PLAN` each against production with
the local token, and read for `SCAN`. Crude extraction mis-parses concatenated
strings (they show as `WHERE x`); those need a manual EXPLAIN. Also: LIKE with
a prefix does NOT use an index on a BINARY-collated column (LIKE is
case-insensitive by default), which is why the FLAG prober's `LIKE
'G-100-26238-%'` reads were rewritten as primary-key ranges too.

**robots.txt now disallows `/perm-case-status?`.** Every case number on the
site links to a lookup URL; each is a dynamic render that can ask DOL live,
and a crawler walking thousands of them is pure cost. The bare page stays
indexable.

**Turso offers a one-time "Vegas Blackout"** on the Databases page: erase one
day of usage, no questions asked. Use it on the worst day of a runaway cycle.

## Vercel binds env at DEPLOY time, so a new secret needs a rebuild (2026-08-30)

`vercel env add REVALIDATE_SECRET production` succeeded and `vercel env ls`
showed it, and the endpoint still answered **403 to the correct secret** -
because the running deployment was built before the variable existed.
`process.env.X` in a route handler resolves against the environment bound at
build. A `vercel redeploy <url>` fixed it in one step.

**Read what the endpoint WROTE, not that it returned something.** The 403 was
indistinguishable from a wrong secret, and shipping on the assumption that
"env var set + route deployed = wired" is exactly the failure this repo keeps
meeting. After the redeploy the live dispatch returned
`{"revalidated":1,"skipped":2}` for a payload of one good slug, `../..` and
`BAD` - which proves the guard and the action in one call.

## The Turso retry excluded the failure it was written for (2026-08-31)

`withDeadline` in `src/lib/db/client.ts` guarded itself with
`!String(e).includes("turso query deadline")`, so it retried **only the deadline
it raises itself**. Production threw `SocketError: other side closed` inside
`TypeError: fetch failed` on a `perm-employers/[slug]` server component - a
dropped keep-alive connection, the most retryable error there is, and the exact
case the helper's own comment says it exists for.

- **The reason is in `e.cause`.** `String(err)` on undici's wrapper is exactly
  `"TypeError: fetch failed"`, so a message-only predicate can never see
  `other side closed`, `ECONNRESET` or a DNS failure. The chain is walked now.
- **READS ONLY.** `exec()` shares the helper and writes; "other side closed"
  does not say whether the server processed the statement, so a retried INSERT
  could double-apply. `retryTransient` is a parameter for that reason.
- `clientRetry.test.ts` builds a real `cause` chain in every fixture - a test
  putting the reason in the message would pass against the broken version. It
  lives in `unit-isolated` because it mocks `@libsql/client` and calls
  `vi.resetModules()`.

## Where to look when something is broken in production

| surface | access |
|---|---|
| **PostHog** | MCP, connected — project 322551. **Exception autocapture is OFF**, so its error counts are a floor, not coverage. A signed-in person's `distinct_id` is their `userProfiles._id` (`LoginTracker`), not the user id or email |
| **Sentry** | **No MCP exists.** Read the alert emails; the Gmail OAuth token under `~/emails/gmail-cleanup/` works. **SEARCH `from:getsentry.com`, NOT `sentry.io`** - they send from `noreply@md.getsentry.com`, so a `from:sentry.io` filter returns nothing and reads as "no alerts". That exact query said the inbox was clean on 2026-09-13 while a weekly report listing 44 errors sat in it. They land in `CATEGORY_UPDATES`, not the primary tab. The weekly report is the highest-value one: it ranks issues by count and is the only place the span p95s appear |
| **Convex** | `mcp__convex__logs` with `status: "failure"`, and `mcp__convex__insights` |

**Check Sentry's `environment` tag first.** The DEV environment reports to the
same production project, so an alert with `server_name = Adams-MacBook` and a
`127.0.0.1` URL is a local blip rather than an incident.

## A disclosure load starves the site's reads, measured (2026-09-02)

While `ingest_flag_disclosure.py` wrote a 147k-row file, an ordinary
`GROUP BY state` over `perm_cases` (a different table) was sampled every ten
seconds and went from **~0.3s to a worst of 59.2s**. In the same window a
production build's prerender blew its **90-second** query deadline twice on
`/tools/salary-explorer` and only survived on the third attempt of three.

**The load is a background chore and the site is not**, so the writer yields:
`WRITE_PAUSE_S = 0.35` between write requests (2,000 rows each), which adds
about 26 seconds per 147k rows. `--pause 0` disables it. Probed by timing
`write_cases` against a fake driver at pause 0 and 0.2.

Two things this explains that looked like other bugs. A build failing on a
query that is normally instant is not a slow query, it is a busy primary; and
"Turso is degraded" is worth checking against **our own** writers before their
status page.

## Vercel: builds are the bill, not traffic (2026-08-31)

$20.05 of a $20 credit, and the breakdown is not where anyone assumes:

| line | cost | share |
|---|---|---|
| **Build CPU Minutes** | **$13.20** | **66%** |
| Observability Events | $2.49 | 12% |
| ISR Writes | $2.29 | 11% |
| Speed Insights Plus | $0.65 | 3% |
| **Function Invocations** | **$0.12** | 0.6% |

**Crawler traffic across 21,110 sitemap URLs costs 12 cents.** Deploys cost
~$0.60 each. Read the real numbers with `npx vercel usage`, and the per-build
breakdown with `npx vercel inspect <deployment-url> --logs`.

What was wrong, all found in one build log:

- **`VERCEL_FORCE_NO_BUILD_CACHE` was set** (228 days old). Worst of both
  worlds: recompile from scratch every time AND still spend 1m12s building and
  uploading a 617 MB cache nobody restores. Deleted.
- **Build machine was Elastic**, which Vercel auto-scales to **Turbo (30
  cores)** "based on recent build usage" - the more you deploy, the bigger the
  machine, the faster the burn. Billed in CPU-minutes, so 30 cores x 6 min =
  ~180. Pinned to **Standard (4 vCPU)**. If a build nears the 45-minute
  ceiling, Enhanced is the next step.
- **Every push built everything**, including script- and docs-only pushes.
  `vercel.json` `ignoreCommand` now skips a build when nothing outside
  `scripts/`, `.github/`, `.planning/`, `docs/`, `*.md` and tests changed.
  **Probe it in BOTH directions** before trusting it: one `src/` file must
  force a build, and `content/`, `convex/` and `public/` must never be skipped.
  A wrongly-skipped build is a change that silently never ships.
- **`PRERENDERED_ENTITY_HEAD = 25`** (was 100 x 3). Entity details were 303 of
  483 prerendered pages; `dynamicParams` is true, so every slug still resolves.
  483 -> 259 pages, static generation 104s -> 75s locally.

**Speed Insights and Observability were NOT cut, reversing an earlier
recommendation of mine.** Speed Insights carries real RUM (211 samples on `/`
scoring 80) and PageSpeed's "No Data" is CrUX, a different and much larger
sample - so it is the only real-user measurement this site has. $1.81 of a $14
bill against $13.20 of builds: the lever is deploy count, not add-ons.

## The health check measures progress now, not activity

Every line in `check_ingest_health.py` used to answer "did the job run" and
"did it exit 0", the two questions a deadlock passes. `lca-status` read
"2026-09-06 ok" with the note "0 checked, 0 moved" over a table whose newest
filing was Aug 27. Three changes, each pinned by `test_ingest_health.py`:

- **Runs are keyed by filename AND mode.** Filename-only let Monday's clean
  `--pending` row erase Sunday's failed `--full` row before the 6 AM cron
  looked; the weekly job could fail every week and never be reported. The
  workflow failure hooks record the mode (`--script "x.py --$MODE"`).
- **`check_frontier`** judges the walk's own cursor (5 days; measured normal
  lag 0 to 2, a Friday filing after a Monday holiday is 4). Not
  `MAX(filing_date)`: a visitor looking up a fresh case inserts a fresh row
  and keeps that number green with the prober dead.
- **`check_discovery_yield`** fails when the last four walks inserted nothing.
  Every walk now records its own `ingest_runs` row, including the nightly one.

Also: a pass that checked 0 cases stamps no freshness (the LCA daily pass is
0 every day; its weekly window pass stamps it with an 8-day budget);
`record_ingest_failure.py` reads its row back and catches `SystemExit`,
which is what a missing credential raises.

## Meta's crawler was 65% of all traffic, and pages were never the lever

The Firewall Traffic tab on Sep 6: **Facebook, Inc. (AS32934), 553,800 of
~852,000 requests in 24 hours**, one JA4 fingerprint, dozens of rotating
`57.141.18.x` addresses, and only 72.6k of them honest
(`meta-externalagent/1.1`); the rest wore browser user agents and ignored
`robots.txt`. It spent the 2,000/day DOL lookup budget by 5 AM daily.
Entity pages were **2.6%** of requests. Three rules, dashboard only:

1. Deny AS 32934 on `/perm-case-status?case=` (link-preview agents exempt).
2. Rate-limit AS 32934 **keyed on JA4** to 30/min, 429 (Meta AI may still
   index the data pages; Adam's audience lives on WhatsApp and Facebook).
3. Rate-limit `/api/*` to 60/min per IP, 429.

Function-log rate fell from ~17 req/s to ~0.35 req/s within two hours. The
managed "Bot Protection" and "AI Bots" toggles stay in **Log**: enforcing
them would challenge the nightly `/api/revalidate-*` POSTs and the AI
crawlers this site wants. **Vercel Hobby is unreachable regardless of pages:**
its 1M edge-requests/month cap counts cached hits and pauses the project when
exceeded; humans alone are ~2M. The floor is Pro at ~$20 flat once the
crawler and the proxy are fixed. Vercel Support confirmed non-commercial use.

## The four exposures closed on Sep 7 2026, and what each one costs to keep

Adam asked whether "the same things can't happen again, or the same class, or
even not like it". The honest list of what was still exposed after the Sep 6
work, and the fix for each:

**A parser that emits plausible wrong values.** Both loaders resolve columns
by header name and refused only when a REQUIRED column was missing; a column
DOL renamed logged "(no column for ['wage']; those land as NULL)" and the run
reported success. `scripts/lib_load_guard.py` now fingerprints every load
(which columns resolved, blank share per column, median wage per unit,
rows with impossible values) and the loaders compare it with the previous
load of the same program BEFORE writing: a lost column, a blank share up 25
points, a median moved by half, or over 1% impossible rows refuses the file
with nothing written. Thresholds are MEASURED margins: over 634,638 PW and
437,496 LCA rows the worst impossible-value share is 0.06% and blank shares
are stable to under a point between quarters. `ingest_flag_disclosure.py`
does one extra parse pass (about a minute) and stores the fingerprint in
the load record; the PERM parser puts its fingerprint (resolved columns
keyed per FISCAL YEAR, because a quarter's filename changes every quarter)
into `perm-cases.ndjson.gz.meta.json` and `db_migrate.py` judges it
against `perm_docs['perm_cases_fingerprint']`, recorded only after VERIFY.
`--accept-drift` overrides the drift half for a human who read the log;
nothing overrides impossible values. The first guarded load of each program
has no baseline and records one. `test_load_guard.py` probes every branch.

**A backfill that stops chaining.** A leg that died before moving the
frontier printed "no progress; not chaining" (by design) and nothing ever
restarted it. The progress record now carries `from`, `to`, `complete` and
`lastDayDoneAt` (moved only when the frontier moves); the scheduled daily
PWD run asks `--resume-check` and dispatches ONE leg when an incomplete
backfill has been quiet 20 hours. One a day, so an outage cannot loop it.
`check_backfill` in the health check fails at 7 days without movement.

**Slug suffixes that shifted each quarter.** `db_migrate_public.py`
dropped the entity table and reassigned `-2`/`-3` by volume order, so two
spellings of one firm swapped URLs when the busier one changed.
`plan_sticky_slugs` reads the live slugs first: an entity keeps its slug,
newcomers get the first free suffix, every prior slug stays reserved, and
each slug nobody kept gets an alias row to the busiest holder of its merge
key or the run REFUSES (`--allow-vanished` to proceed). Occupations are
keyed by SOC code as well as title: 54 titles sit under two codes each, and
keyed by title alone the pair swapped every rebuild. Live control over the
real table: reversed volume order keeps 78,600 of 78,600 slugs.

**A crawler on paths the four rules do not cover, with no alert.** Vercel's
only firewall alert fires at 100,000 requests per 10 minutes, ten times the
Meta crawler's rate. Two things: Bot Protection moved from Log to
CHALLENGE (verified bots, Googlebot to PerplexityBot to facebookexternalhit,
are excluded by IP range and reverse DNS, never by user agent; the bypass
rules cover what the directory lacks: WhatsApp, Slack, Discord, Telegram
previews, `/feed.xml`, `/llms.txt`, the revalidate POSTs by secret header,
and the site's own audit scripts by `x-permtracker-audit` carrying the key in
`.env.local`, since Sep 25 2026), plus rule 5, 300
requests a minute per IP on page paths. And `check_lookup_demand` in the
health check fails when a day's live DOL lookups exceed five times the
30-day median with a floor of 500, the number that crawler moved first.

Also fixed on the way: a failure row recorded under the bare filename (the
pre-Sep-6 hook shape) could never be superseded because every later run is
mode-keyed; a later clean run of the same script now clears it.

## The Firewall as of Sep 7 2026: Challenge mode, nine rules, and the order that makes them safe

Bot Protection is in **Challenge** (was Log). Vercel evaluates only requests that
are neither a verified bot nor a real browser, and verification is by IP range,
reverse DNS or Web Bot Auth, never by user agent. Its own log for the day before
the flip: 25.4k requests it would have challenged, every one a browser user
agent (one literally HeadlessChrome) from Tencent, Azure, AWS, Datacamp and
Google Cloud addresses. Verified crawlers never reach that evaluation, and the
directory covers Googlebot, Google-InspectionTool, Bingbot, Applebot, GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot,
Meta's three crawlers, facebookexternalhit, Twitterbot, LinkedInBot, Chrome
Lighthouse, Ahrefs and Semrush. **A challenge answers HTTP 429**, not 403.

Custom rules run top to bottom, before the managed ruleset, and **a Bypass
skips every rule after it, managed ones included**, so order is the design:

| # | rule | why it sits here |
|---|---|---|
| 1 | Deny AS 32934 on `/perm-case-status?case=` (previews exempt) | Meta's crawler |
| 2 | AS 32934, 30/min keyed on JA4, 429 | Meta AI may still index, not 40x a day |
| 3 | `/api/*`, 60/min per IP, 429 | backstop |
| 4 | `/perm-case-status?case=`, 20/min per IP, 429 | the expensive path, any network |
| 5 | Bypass when `x-permtracker-audit` EQUALS the key in `.env.local` (`PERMTRACKER_AUDIT_KEY`, read by `scripts/lib_audit.py`) | the site's own audit scripts skip Bot Protection AND rule 6, because `audit_all_pages.py` walks 61 URLs faster than 300 a minute. Until Sep 25 2026 the rule matched the header's mere EXISTENCE, and this public repo printed the header in a dozen scripts: any client sending `x-permtracker-audit: 1` skipped the challenge (measured: 429 without, 200 with) | |
| 6 | 300/min per IP on paths not under `/_next/`, 429 | a runaway script that passes the challenge |
| 7 | Bypass user agents WhatsApp, facebookexternalhit, Slackbot, Discordbot, TelegramBot, SkypeUriPreview | link previews the directory does not verify; iMessage claims facebookexternalhit from Apple addresses, so it is unverified too |
| 8 | Bypass `/feed.xml`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/sitemaps/*` | cheap static files read by unverified tools |
| 9 | Bypass `/api/revalidate-*` when `x-revalidate-secret` exists | the nightly POSTs from GitHub Actions |
| 10 | Bypass `/api/cron/*` when the user agent contains `vercel-cron` | Vercel's own cron invocations of the dispatcher. **A condition on the `authorization` header never matched** (measured 9:08 AM Sep 7: the secret-bearing request was still challenged), while the same request with Vercel's documented `vercel-cron/1.0` user agent passed. Spoofable, and harmless: the route itself demands `CRON_SECRET` |

AI Bots stays on **Log**. `scripts/probe_firewall.sh` (deleted Oct 1 2026 with the Vercel firewall) proved all of it from
the laptop in one run and is the thing to re-run after any change.

**What Challenge mode deliberately costs:** a script calling `/api/*` without
the audit header is challenged (Vercel: "Direct API calls from scripts, cURL
or Postman will fail"). The site's own pages call those routes from a browser
that already holds a challenge session, so nothing on the site breaks; the
change is that third parties cannot script the JSON routes any more. A bypass
on those paths would re-open the exact vector rule 4 closes, so it is not
added. `docs/API.md` documents Convex functions, not those routes, so no
published contract changed.

**Two traps in the rule editor.** The natural-language generator inverts
negative operators ("does not start with" came out as "Starts with"; last night
"does not contain" came out as "Contains"): read the generated condition and
fix the operator through its dropdown by reference. And the page drops any text
typed in the same automation batch as its own load; type in a later step.

## GitHub's scheduler runs this repo's crons hours late, every day (measured 2026-09-07)

Every "04:10 ET" and "06:00 ET" in this file is the DECLARED time. The
measured time is two to seven and a half hours later, on every one of the
last nine days:

| workflow | cron (UTC) | measured delay, Aug 29 to Sep 6 |
|---|---|---|
| processing-times-ingest | 07:00 | +239 to +452 min |
| case-status-direct, daily full | 08:10 | +219 to +277 min |
| case-status-direct, pending | 19:40 | +118 to +137 min |
| pwd-status-direct, daily | 09:40 | +140 to +190 min |
| ingest-health | 10:00 | +196 to +444 min |

So the "4:10 AM" sweep has been finishing around 9 to 10 AM ET, and the
health check reads it around 9:30 to 10:30 AM, and on Mon Sep 7 at 8:45 AM
nothing scheduled had fired at all yet. GitHub documents that `schedule`
"can be delayed during periods of high loads" and that delayed runs may be
dropped; it does not document delays of this size. The weekly CodeQL cron on
the same repo fired 3 minutes late the same morning, so it is per-workflow
queueing, not the repo being disabled (every workflow reads `active`).

Consequences: any freshness budget or "checked today" claim must allow for
a run landing in the afternoon; a dispatch by hand is the reliable way to get
a sweep at a chosen time; and the fix, if the delay matters, is to trigger
`workflow_dispatch` from a precise external clock (a Vercel cron job hitting
a small route that calls the GitHub API with a fine-grained token scoped to
`actions: write` on this repo) rather than trusting `schedule`.

## Vercel's clock dispatches the GitHub jobs (2026-09-07)

Because GitHub's `schedule` fired every cron here hours late (previous
section), the daily ingest jobs are now Vercel cron jobs. `vercel.json`
carries six entries pointing at `/api/cron/dispatch/<job>`; the route
(`src/app/api/cron/dispatch/[job]/route.ts`, table in `../jobs.ts`)
verifies the `Authorization: Bearer <CRON_SECRET>` header Vercel adds to
every cron invocation, refuses unknown jobs, skips a workflow that already
has a run inside 20 minutes (Vercel documents that cron delivery can
duplicate), and fires `workflow_dispatch` on `adamjali/perm` with the job's
inputs. Pro invokes within the minute; the test next to the route holds the
job table and `vercel.json` together so a job cannot exist in one and not
the other.

| job | workflow, inputs | UTC |
|---|---|---|
| `processing-times` | processing-times-ingest.yml | 07:00 daily |
| `case-status-full` | case-status-direct.yml, mode=full | 08:10 daily |
| `pwd-daily` | pwd-status-direct.yml, mode=pending | 09:40 daily |
| `ingest-health` | ingest-health.yml | 10:00 daily |
| `pwd-weekly-full` | pwd-status-direct.yml, mode=full | 10:40 Sundays |
| `case-status-pending` | case-status-direct.yml, mode=pending | 19:40 daily |

**Two secrets.** `CRON_SECRET` was generated here and added to the
production environment on Sep 7. `GITHUB_DISPATCH_TOKEN` is the fine-grained
personal access token `permtracker-cron-dispatch` (no expiry, repository
access limited to `adamjali/perm`, permission Actions: read and write,
Metadata read-only), created 9:24 AM Sep 7 with Adam approving GitHub's
sudo prompt on his phone. It reached Vercel by Cmd+C in the token page and
`pbpaste | vercel env add GITHUB_DISPATCH_TOKEN production --sensitive`,
so the value never passed through a transcript. If the token is ever
missing the route answers **500 "GITHUB_DISPATCH_TOKEN is not set"** and
nothing is dispatched. **Vercel binds env at deploy time**, and
`vercel redeploy` of a docs-only commit is SKIPPED by the ignore rule (a
9-second "Canceled" deployment), so binding a new variable needs a build
that carries a change under `src/`. The Firewall bypasses `/api/cron/*` for the
`vercel-cron/1.0` user agent every cron invocation carries (rule 10); a
rule keyed on the `authorization` header was tried first and never
matched, so the WAF evidently cannot see that header. Measured, not
assumed: with the secret and a curl user agent the route was challenged,
with the secret and `vercel-cron/1.0` it answered.

**Proven 9:40 AM Sep 7 and the `schedule:` blocks removed.** A dispatch
through the route answered 200 at 13:40:43 UTC, GitHub created run
34128732840 one second later and it finished green. The three data
workflows (case-status-direct, pwd-status-direct, processing-times-ingest)
no longer carry a `schedule:` at all, or the sweep would run twice a day:
once on time from Vercel, once hours later from GitHub, with the concurrency
group queueing the second rather than dropping it. `ingest-health` keeps its
GitHub schedule as a second, independent clock on purpose: if Vercel's cron
ever stops, the late GitHub run is what reports the silence. The route's
20-minute guard covers Vercel's own duplicate deliveries only.
The PWD daily pass carries its resumer step on the dispatched run too
(`inputs.mode == 'pending'`), not only on the `schedule` event.

Prove a dispatch with `npx vercel crons ls` and a manual invocation, then read
`gh run list --event workflow_dispatch`. A green Vercel cron log line is not a
run; the run is.

## The residential runner: www.uscis.gov from this Mac (2026-09-07)

`www.uscis.gov` serves residential addresses and 403s GitHub's datacenter
runners on some days (four refusals with backoff on Sep 7). Three fetches
depend on it: the I-485 inventory (monthly), the I-140 quarterly counts and
the I-140 trends (both best-effort in the Federal data ingest). Nothing else
on the site treats datacenter and residential addresses differently: DOL's
disclosure files are the opposite case (they 403 this laptop, not GitHub),
`flag.dol.gov` serves both, and `egov.uscis.gov` and `travel.state.gov`
challenge every script from any address, so only a browser clears them.

`scripts/residential_job.sh <i485|i140>` is the runner, driven by two launchd
agents (`scripts/launchd/*.plist`, installed by `scripts/launchd/install.sh`,
which fills the repo path and reloads them; safe to re-run). GitHub keeps
trying first; the Mac tries the day after:

| job | GitHub tries | this Mac tries (local time) |
|---|---|---|
| `i485` | 04:00 ET, 6th to 10th | 10:30, 6th to 10th |
| `i140` (counts, Convex store, trends) | 8th of Jan/Apr/Jul/Oct, 20th monthly | 10:45 on the 9th and 11th of those months, and the 21st monthly |

Three levels of retry: the scripts' own four attempts with backoff, five
calendar days a month from each side, and launchd running a job that fell
due while the Mac slept as soon as it wakes. Failures are recorded through
`record_ingest_failure.py` under the bare script name, so the health check
sees them and a later clean run from either side supersedes them; a whole
month lost trips the dataset's own freshness budget (45 days for I-485, 135
for the I-140 pair). Logs are one file per run in
`~/Library/Logs/permtracker/`, pruned at 60 days by the wrapper; a lock
directory keeps one run per job. The wrapper fast-forwards `main` first so
the laptop runs the same code as the runner, and names every path because
launchd hands a job almost no PATH (node lives under nvm here).

Proven Sep 7, 10:20 AM: both agents kicked through `launchctl kickstart`
finished rc=0, I-485 fetched four months from USCIS, the I-140 store was
correctly refused as unchanged, trends verified 66 rows, and the health
check read every run clean. Needs the Mac logged in and not shut down.

**The Mac wakes itself at 10:25 AM every day (set by Adam, Sep 7 2026,
10:37 AM ET):** `pmset -g sched` reads "wakepoweron at 10:25AM every day".
It covers the asleep case only: FileVault is on, so a powered-off Mac stops
at the disk-unlock screen, and a logged-out Mac has no session for the
agents to run in. Reverse it with `sudo pmset repeat cancel`; remove the
agents with `launchctl bootout gui/$(id -u)/app.permtracker.i485` (and
`.i140`) and delete the two plists from `~/Library/LaunchAgents`. GitHub's
own attempts and the health check's freshness budgets are unaffected by
either.

## Pressure needs a PAUSE; a dropped socket does not (2026-09-09)

Two production builds failed prerendering `/tools/salary-explorer` on
`SQLITE_NOMEM`, with a successful redeploy in between. The retry was already
allow-listing that code (added 2026-09-03 for this same page) and it still did
not help, because **`withDeadline` retried immediately and only once.** An
instant retry is exactly right for `other side closed` (the point is to ride a
new connection) and close to useless for memory pressure: the far end ran out
of room to answer, and milliseconds later it still has none.

Pressure now gets a third attempt with a real wait (1.5 s, then 3 s); network
errors and the deadline keep their single immediate retry, pinned by a test
that a dropped connection still stops at two. The queries themselves are not
the defect: by hand, the two window functions behind that page ran in **0.8 s
and 2.8 s**. They are simply the largest memory consumer in a build that
prerenders many pages at once, so they are the first to lose under contention.
The deeper fix, if it recurs, is the established one: precompute into
`perm_docs` the way `review_stages` and `live_census` were.

## The due-check routine, and why the manual steps stay manual (2026-09-09)

Three things cannot be automated, and the obstacle is a browser challenge or
Adam's own account, never a missing scheduler:

| task | why not | how often |
|---|---|---|
| the current visa bulletin | travel.state.gov 403s every script as policy, and USCIS's chart page carries **no cutoff dates**, only a link back to State (checked 2026-09-09) | monthly, mid-month |
| Search Console reindex | no API; Google's Indexing API is `JobPosting`/`BroadcastEvent` only | after each deploy |
| Table V and the limits sheet | same Cloudflare | yearly |

A Claude routine changes none of that: it runs headless on a data-center
address, which is exactly what gets refused, and routines cannot push to main
anyway (Anthropic's git proxy rewrites every routine push onto a `claude/*`
branch). **What a routine CAN do is the part that actually failed: reading the
alert.** `trig_01U2UC9qeUvdft461DoV785m` ("PERM Tracker Due Check") runs
Mondays and Thursdays at 9 AM ET on `claude-opus-5`, push notifications on, and needs **no
secrets at all**: it reads the ingest-health conclusion from GitHub's public
API, reads "the newest bulletin we hold is <Month Year>" off our own
`/visa-bulletin` page, and asks the Internet Archive's CDX index whether State
has published the next month. A capture is proof it is out; an empty result
after the 18th is stated as probable, never certain, because the Archive lags
publication by a few days. Silent one-liner when nothing is due. **Proved by a manual fire on 2026-09-09: 62 seconds, and it returned "nothing due. Health check green, newest bulletin September 2026."** The one thing that needed a second attempt is worth keeping: our own page is server-rendered React, so a sentence in the copy is split by JSON punctuation in the raw HTML and a naive `grep` for it matches nothing; strip `\`, `"` and `,` first.

**Our own firewall challenged a bare script with HTTP 429 until Sep 15**, which
is why the routine sends `x-permtracker-audit: 1`. Since rule 12 (Sep 15) any
client reads an ordinary page, and since Sep 25 rule 5 wants the secret key,
so the routine's header is now inert and harmless: it reads `/visa-bulletin`
through rule 12 like anyone else.

## A doc-missing fallback fails SILENTLY, and that is what killed the deploy (2026-09-13)

Loading the LCA disclosure history took `lca_cases` from 437,496 rows to
**1.96M**, and the next production build died:

    Failed to build /(site)/(public)/lca-wages/page (attempt 1 of 3)
      because it took more than 180 seconds
    Error: turso query deadline (90000ms, attempt 2): WITH t AS (SELECT
      substr(soc_code, 1, 7) AS code, soc_title AS title, COUNT(*) A

`/lca-wages` runs four aggregates over the whole table at build time. Measured
against production with the loader stopped, so this is SIZE and not contention
(a bare `COUNT(*)` is **16.8 s**):

| query | time | against |
|---|---|---|
| filter options | blew 90 s | the build's own deadline |
| `getLcaWageByState` | **33.6 s** | the read layer's 20 s deadline |
| `getLcaWageHistogram` | 5.2 s | |
| `getLcaWageStats` | 4.8 s | |

PERM had had `wage_filter_options` since its salary explorer hit the same wall.
LCA's twin was never built, and the second half - the stats, histogram and
by-state panel - had no precomputed form on EITHER program.
`scripts/build_lca_facets.py` writes all of it into
`perm_docs['lca_filter_options']`, and the four readers prefer the doc and keep
their live query as the fallback.

**THE FALLBACK IS WHY THIS WENT UNNOTICED AND IS STILL THE RIGHT DESIGN.** A
missing doc is a correct, slow page. Nothing errors, nothing logs, nothing looks
wrong - until a build runs several of those prerenders at once and one of them
passes 180 seconds. So the doc needs an alarm of its own:
`check_precomputed_docs` in `check_ingest_health.py` holds the five docs the
read layer depends on (`lca_filter_options`, `live_census`, `review_stages`,
`wage_filter_options`, `alphabet`) with a budget each, and fails when one is
missing, empty or stale. Its own test asserts every key in that list is read by
a real `doc(...)` call or `key = '...'` SQL under `src/` or `convex/` - a doc
nobody reads is a check that can only cry wolf.

**A DOC THAT DISAGREES WITH ITS OWN FALLBACK IS WORSE THAN NO DOC**, because
both look right. Three things hold them together, and the middle one is the only
one that catches a bad port:

1. **The doc is rebuilt where the data lands.** `flag-disclosure-ingest.yml`
   runs the builder after an `lca` load and BEFORE the revalidation step -
   expiring first regenerates those pages against the previous quarter.
2. **The percentile SQL is DERIVED from the TypeScript, not restated beside
   it.** `test_lca_facets.py` reads `percentileExpr` / `statePercentileExpr` out
   of `publicData.ts`, resolves their template literals with the same locals the
   TS declares, and compares the strings. The first version hand-wrote the
   expectation, which is tautological: probing it showed that changing the
   quantile list on EITHER side moved answer and expectation together and stayed
   green. The quantile arrays are now read out of the TS too.
3. **A whole-table control.** The doc's by-state rows were compared against a
   live run of the same query: **55 states x 7 fields, 385 values, all
   identical**.

**And be honest about what a guard does not catch.** `verify_median` asks for
the two wages at the interpolation's own ranks with a plain `ORDER BY / OFFSET`
and checks p50 lands between them. On the real corpus it printed *"p50 116,376
verified between ranked 116,376 and 116,376"* - both neighbours hold the same
wage, because that is a fat mode, so on THIS population it cannot tell an
interpolating port from a nearest-rank one. It catches a query built over the
wrong ROWS (a changed band, a dropped status clause); the string equality in (2)
is what catches a wrong port.

**The width is checked, not assumed.** `binWidth()` is ours to change, so the
doc stores the width it binned at and the reader falls back on a mismatch rather
than redrawing the histogram at half scale with nothing erroring.

**`getLcaWageByState` drops the state from its own WHERE**, so a per-state
selection has the same by-state answer as the default view - which is what makes
the panel a comparison. The doc therefore serves the state pages too, and
`isDefaultLcaFilter({ ...f, state: null })` is deliberate, not a slip.

### Two traps hit while probing this

**`cp` does not reliably invalidate a `.pyc`.** Probing by mutation, restoring
the good file and re-running kept reporting the MUTATED value: Python caches on
(mtime, size), the mutation was the same byte length (`0.05` -> `0.06`) and the
restore landed in the same second. Every probe loop here now clears
`scripts/__pycache__` first. A restore that silently does not take makes a probe
report the opposite of the truth.

**`pgrep -f <script>` matches the polling loop's own command line.** Three
`until pgrep -f build_lca_facets; do sleep; done` loops never exited, because
each one's own `eval` string contains the name it is grepping for. The repo's
own note says to grep the behaviour and not the vocabulary; this is that rule
applied to a process list. Prefer `Monitor`, or match on a pid captured at spawn.

## The health check went red for a condition nobody can act on (2026-09-15)

The due-check routine reported the ingest health check red for four days, 8 runs
in a row, and pushed a notification. Cause: `processing-times` read as of
2026-08-31, 14 days against a 10-day budget. **That date is DOL's own stamp.**
`processing-times-ingest` ran every day, and every run logged "DOL as-of
2026-08-31 is unchanged"; DOL moved the figure 08-28 -> 08-31 on Sep 5 and has
held it since, longer than its usual roughly-weekly rhythm. `check_ingest_health.py`
already prints "THE SOURCE HAS NOT REPUBLISHED for: processing-times... check
the agency's page before touching any code" for exactly this (added Sep 13),
and still returns 1 for it.

**Both halves are fixed (2026-09-15, 9:45 to 10:00 AM EDT), and a third defect
of the same family came out of the fix:**
- `freshness_verdict()` splits a stale row into failing and watching: our
  ingest not running fails at once; a source that has not republished is a
  printed `::warning::` (visible in the run summary) until it has been silent
  for `SOURCE_PAUSED_GRACE` (3) times its budget, then it fails, because by
  then the page may have moved or the parser may be reading a stale element.
  Pinned by `check_freshness_verdict` in the test, probed at grace 0, at a
  dropped ingest-dead branch, and at an off-by-one boundary: each flips
  exactly the assertion it targets.
- **The gap sweep was the second red.** `sweep_serial_gaps.py` recorded
  `partial` when it stopped on its own 600-request cap, and `check_runs`
  counts every `partial` as BROKEN, so a night with many holes (Sep 15: 2,998
  probed, 2,113 found) painted the check red for doing its job. It records
  `ok` now and names the cap in its note (`CAP_NOTE`, the WARN ingest's
  browser-only precedent); the reader tolerates an older `partial` carrying
  that exact phrase (`SWEEP_CAP_NOTE`, pinned byte-identical by a test that
  reads the sweep's source). Today's row was re-recorded with a note saying
  why. Live run after both fixes, DOL still late and the sweep still capped:
  **exit 0**, one warning, "All datasets within their declared budgets".
- **The due-check routine reads the verdict now.** Its prompt downloads the
  newest run's log (public, no token) and prints each verdict line from its
  keyword onward, classifies THE SOURCE HAS NOT REPUBLISHED and a cap stop as
  watch items, OUR INGEST HAS STOPPED and RUNS BROKEN as tasks, and takes its
  whole timestamp from `date '+%A %b %-d, %-I:%M %p %Z'` so no weekday is
  ever invented. Proved by a manual fire at 9:46 AM EDT (155 s): "Tuesday Sep
  15, 9:46 AM EDT - nothing due ... Watching: DOL has not republished
  processing-times for 15 days; our ingest is fine." Two prompt lessons from
  that fire: print a matched line from its KEYWORD, not its tail (the tail cut
  off the dataset's name), and give the Internet Archive a 45-second limit
  (it answered 504 for 75 s).

**And the three real failures in the same window, already fixed.** The
OFLC-announcements and WARN steps added to `processing-times-ingest.yml` on Sep 8
lacked the `working-directory: v2` every sibling step carries, ran from the repo
root, and died on "can't open file" at 3:00 AM on Sep 10, 11 and 12. Fixed in
`566ff3a6` (Sep 12, 8:09 AM EDT). **The `|| python3 scripts/record_ingest_failure.py`
fallback on the same line died the same way**, so nothing was recorded and the
health check's failed-runs line could not see three days of failures. A recorder
that shares the step's working directory shares its failure mode.

## The firewall, inverted: allow all, restrict the expensive set (2026-09-15)

Adam: *"instead of restrict all and allow some it's allow all and restrict some."*
Bot Protection stays in Challenge (its browser session is what lets the site's
own API calls through), and two bypass rules below the rate limits carry the
inversion. Applied through the REST API (`PATCH
/v1/security/firewall/config`, actions `rules.update` / `rules.insert`, the
CLI's own token), which avoids the editor's operator-inversion trap entirely;
config version 13 -> 16.

| # | rule | change |
|---|---|---|
| 1 | Meta deny on `/perm-case-status?case=` | `meta-externalfetcher` (Meta AI's on-demand fetcher) added to the exemptions beside the two preview agents |
| 2-10 | unchanged | |
| 11 | **Bypass AI assistants and AI crawlers** | user agent contains Claude-User, ClaudeBot, Claude-SearchBot, ChatGPT-User, OAI-SearchBot, GPTBot, PerplexityBot, Perplexity-User, meta-externalfetcher, Amazonbot, DuckAssistBot or Google-Extended |
| 12 | **Allow every cheap path** | two OR groups: every path NOT under `/api/`, `/ingest/`, `/perm-employers/compare`, `/prefs`, `/unsubscribe`, `/queue-alert`, `/case-alert`, `/bulletin-alert`, `/employer-alert` (added Sep 26) and not `/perm-case-status`; or that lookup path WITHOUT a `case` query |
| 13 | **Bypass one-click unsubscribe POSTs** (Sep 26 2026) | method POST AND path exactly `/prefs/unsubscribe`, `/unsubscribe`, or `/case-alert/unsubscribe` and its queue, bulletin and employer siblings. Mail providers send RFC 8058 one-click from their own servers, which cannot pass a browser challenge: measured before the rule, every one of those POSTs got 429 `challenge`, mail already in inboxes included. Each endpoint checks a purpose-scoped signed token and can only turn mail off; GETs stay challenged |
| 14 | **Bypass sign-in POSTs to the auth proxy** (Sep 28 2026) | method POST AND path exactly `/api/auth`. That route is Convex Auth's proxy for password sign-in, codes, Google sign-in and TOKEN REFRESH. A browser Bot Protection flagged got the challenge page as the fetch reply, so `signIn` threw `Unexpected token '<'` (Safari: `The string did not match the expected pattern`) and the person could not sign in (Sentry 4A, 4D, 4G); a challenged refresh also leaves a signed-in user's next mutation unauthenticated (the onboarding `Server Error`s, 4B and 46). `auth:signIn` is a public action on the Convex deployment anyway, so the challenge protected nothing; rule 3 still rate-limits `/api`. Measured after: POST reaches the app (a junk body gets Convex Auth's own 400), GET and every other `/api` path still 429 |

**Measured after:** a plain script gets 200 on every page and 429 on the
restricted set; a script claiming any listed assistant passes the live lookup
(rule 4's 20/min per IP still binds); a browser-looking script on `/api` is
still challenged; a real Claude fetch read `/perm-queue` and a live case page
where it got 429 before. `scripts/probe_firewall.sh` (since deleted) carried five new lines.
What this costs: unverified scrapers read cached pages, bounded by 300/min per
IP; the lookup budget and the API stay behind the challenge for anyone not on
the list. Vercel's `Claude-User` verification did not cover the addresses a
Claude Code session fetches from, which is why the user-agent rule exists.

**Why the Meta deny stays.** Rule 1 blocks exactly one thing: non-preview,
non-fetcher requests from AS 32934 for a case lookup carrying `?case=`. That is
the shape of the Sep 6 crawler (553,800 requests a day, browser user agents,
the DOL budget gone by 5 AM). Rule 2 bounds volume; rule 1 bounds the BUDGET,
which a client can drain under the volume cap (30/min x 24h = 43,200, the
budget is 2,000). People browsing inside Meta's apps are on their own phones'
networks and never meet either rule.

## Two red lights on 2026-09-20, and only one of them was a defect in the thing it named

Both surfaced the same morning, both from checks that had been quietly right.

**A stop on your OWN budget is not a failure, and this is the second job to
learn it.** The discovery walk recorded `partial` when it exhausted its
400-request cap, and `check_ingest_health.py` counts every `partial` as BROKEN.
So the nights the walk is catching up - exactly the nights it does the most
useful work - painted the whole check red: today's run inserted 74 PERM and 334
PWD/LCA cases and moved the frontier 1,761 serials, and was reported as a broken
ingest. `sweep_serial_gaps.py` had this identical defect fixed on 2026-09-15 and
the walk was not swept with it. It records `ok` and NAMES the cap now
(`CAP_NOTE`, byte-identical to the sweep's and to the reader's
`SWEEP_CAP_NOTE` - `test_ingest_health.py` pins all three, not two), `failed` is
reserved for DOL going away, and a new `capped` flag keeps "ran out of budget"
distinguishable from "reached the edge of what DOL has issued".
**When you fix an alarm-fatigue defect, grep for every other producer of the
same status before closing it.**

**A dead mirror can still take CI down.** `ingest_visa_bulletin.py` has emitted
`familyFinalAction` / `familyDatesForFiling` since the family charts shipped
2026-09-08. Neither `storeBulletins`' args validator nor the `visaBulletins`
table declared them, and Convex rejects an extra field outright, so the first
scheduled run afterwards failed the whole mutation with
`ArgumentValidationError: Object contains extra field familyDatesForFiling` and
took `Federal data ingest` red. The USCIS 403s in the same log are the
documented datacenter refusal the Mac's launchd agents cover; this was the only
fatal step, and the Turso load sits AFTER it in the job.

**The site was never affected, and that is the uncomfortable part.**
`/visa-bulletin` and its family page read the bulletin from Turso, which the
same script writes directly. Nothing in `src/` reads `api.visaBulletin` at all -
the only readers of the table are inside `convex/visaBulletin.ts` itself. It is
the **fourth** write-only Convex mirror, and the 2026-09-06 audit named it in H7 beside
`permCases`, `permEntities` and `permWageStats`, and only its step survived that
sweep. **Retired the same day**: the workflow's Convex store step and
`convex/visaBulletin.ts` are gone, and `npx convex run visaBulletin:storeBulletins`
now answers "Could not find function".

**The TABLE is kept, with its rows.** The 09-06 precedent was to leave
`convex/schema.ts` alone; dropping a table means deleting production data, and
the only gain is tidiness. Its doc comment says plainly that it is retired
rather than describing an ingest that no longer runs, and the optional family
fields stay declared because three rows carry them and a strict table rejects a
document it cannot describe.

**THE PAYLOAD FILE WAS NOT CONVEX-ONLY, AND ONE MORE GREP IS WHAT CAUGHT
THAT.** `db_migrate_public.py` reads the same `visa-bulletin.json` from the
artifact, so deleting the fetch step or `--out` alongside the dead write would
have broken a live Turso load whose own test pins "a MISSING visa-bulletin.json
must not fail the load". **Before deleting a producer, grep for every consumer
of what it produces, not just the one you are removing.** The same pass also
found the script writes Turso directly on BOTH routes, which is why the pages
that actually serve the bulletin never depended on the Convex path at all.

**AND THE SWEEP FOR SIBLINGS FOUND ONE MORE, STILL ARMED.** `visaBulletins`
was not alone: `permDisclosure:storeStats` was in the SAME workflow one step
above it, writing `permDisclosureStats` - a table whose only reader,
`getLatest`, has zero call sites anywhere, while the figures the site serves
come from Turso's `disclosure_stats` doc. Both were named in the 09-06 audit's
H7 and both steps survived that sweep. Retired the same day, along with the
"Split the payload" step that existed only to build its payload.
`perm-payload.json` was left alone because it IS load-bearing (two Turso
loaders read it) - the second time in one day that grepping for every consumer
of a produced file, not just the one being removed, changed the shape of a cut.

**The instrument that found it was a REACHABILITY WALK, not a grep.** A
grep-shaped pass had already been fooled by `api.permEntities.getBySlug`
appearing in a COMMENT. Stripping comments, then walking transitively from real
entry points (src `api.*`/`internal.*` calls, `convex/http.ts`, `crons.ts`, and
`convex run` in workflows and scripts) over all 354 exported Convex functions
returned 79 unreachable. Checked against three findings by hand plus a control:
it correctly separated dead `apiUsage:getUsage` from live
`apiUsage:getUsageInternal`, and kept `uscisI140:getLatest` reachable on its two
real call sites. Most of the other 79 are deliberate hand-run admin tools
(migrations, incident cleanup, onboarding resets) and are not defects.

**The rest of the surface is clean, measured the same day**: of 35 Convex
tables, ZERO are write-only; the 19 Turso tables the ingests write are all read
(the three the app does not read - `ingest_runs`, `perm_serial_misses`,
`sweep_runs` - are monitoring state the health check reads); `permCases`,
`permEntities` and `permWageStats` are dead but DISARMED, their tables empty
and nothing dispatching them.

**Timers for the GSC queue (session-only).** `CronCreate` fires
`7 15,17,19 * * *` into this session: gate cheaply on the ledger, run the queue
until Quota Exceeded, then a status round. It exists because the quota window is
rolling 24h from the FIRST request, so it drifts a few minutes later each day
and a single fixed attempt eventually lands early. The catches: the jobs live
only as long as this Claude session, recurring jobs auto-expire after 7 days,
they fire only while the REPL is idle, and they need Chrome open with the
extension connected.

## A refusal from DOL is a stop, not a crash: the third producer of the same false red (2026-09-22)

`flag.dol.gov` answered **HTTP 403** about 84 seconds into the 4:10 AM gap
sweep, on the tail of the ~10,000 requests the main sweep had just made in the
same job, and after `lookup_with_retry`'s four attempts (52 seconds of
backoff). `sweep_serial_gaps.py` raised, the failure hook recorded `failed`,
and the health check went red for a refusal nobody can act on: the main sweep
had finished clean minutes earlier and DOL answered 200 again by 3:36 PM.

This is the SAME class fixed for the sweep's own cap on Sep 15 and the walk's
cap on Sep 20, and the Sep 20 note said to grep for every other producer of
the status before closing it. The grep was for `partial`; this producer raised
an exception, so it was not a `partial` and the grep could not see it. **The
class is "a stop the job cannot help", not one status string.** A refusal now
records `ok`, keeps what was found, records only the misses DOL actually
answered, names the refusal and where it stopped (`REFUSAL_NOTE`), and resumes
from the same window tomorrow. Only `RuntimeError` (the HTTP-status shape
`lookup` raises) is caught; a code defect in the insert path still propagates,
pinned by a test that raises `KeyError` and expects it back. A persistent
refusal is still caught twice: the main sweep fails first, and
`check_gap_sweep` fires when three runs probe nothing.

Probed by running the new tests against HEAD's sweep in an isolated copy: the
test crashes on the `RuntimeError`, which is the live symptom. Today's row was
re-recorded `ok` with a note naming the run, the cause and the fix, as on
Sep 15; the original `failed` row stays in the table below it.

**Two GSC driving rules from the same afternoon.** A `Dismiss` click that
lands leaves focus on the `REQUEST AGAIN` button, and if the next search-bar
click does not register, the `Return` meant for the bar re-submits the page
just requested (Google answered "Something went wrong"; no slot was visibly
lost, but that is luck). Split every inspection into two batches: dismiss and
focus, then assert `document.activeElement.tagName === "INPUT"`, and only then
type. And the expand-chevron click on an indexed page never registers inside
the batch that navigated there; click it standalone.

## Sep 27 2026: what the bills showed, and two QA finds

**A Data Cache entry's window is the ceiling of every page that reads it.** getFreshness sat in an
hour-long `unstable_cache` under DataProvenance, so the build's route table printed **1h for 86 ISR
pages** declaring a day, six hours or thirty days, and every visit more than an hour after a render
rebuilt the page. Vercel billed **15.3M ISR write units against 3.8M reads** for Aug 28 to Sep 28
($61 of $141 after the credit). getFreshness is `cache()` now; the entity cohort caches hold a week
and `/api/revalidate-disclosure` clears their "entities" tag. After the fix the table reads 59 at 1d,
27 at 1w, 11 at 30d, 11 at 6h, none at 1h. `isr-window-caps.test.ts` fails on any `unstable_cache`
or fetch window under a day, probed with each of the three reverted. **Read the route table's
Revalidate column after any change to a shared read**; `npx vercel usage --breakdown daily --json`
shows the cost by service by day.

**The Turso count** (67B of the cycle's 98B reads) and its fix are in the evening section above.
After both fixes deployed at 8:14 PM the counter moved 0.01B in 12 minutes, against ~0.5B an hour
before; a full day is the real measurement.

**Two search defects found only by querying production after the deploy:**
- An employer search with `fy=2019` answered **0 rows for Adobe while the history held 184**: the
  employer read takes the newest SLICE_CAP decisions by index, then tests the year. A fiscal year
  now rides the covering pass as its decided range (FY2019 = 2018-10 to 2019-09), intersected with
  any decided range. `fiscalYearMonths` in `caseSearchReads.ts`.
- **241,817 history rows (28%) carried no employer slug**, so the prefix search could not reach them
  (Adobe's 505 as ADOBE SYSTEMS INCORPORATED). They take their own name's slug, perm_live_recent's
  rule (`ingest_perm_history.py --fill-slugs`, 4 nameless rows left). A fallback slug is not a page:
  history facets and `build_groups.py` link a sponsor only when `employer_page_slugs()` holds it.

**Old-form worker fields end at FY2024** (92,248 `A-` cases, the last decided Sep 30 2024, none in
FY2025). Copy that said "early FY2025" said something the data does not.

**The shared `unit` pool leaked a `vi.mock` twice in one night**: caseLookupHistory.test.ts and then
embedLookup.test.ts mocked `./caseDiscovery`, and caseDiscovery.test.ts read null for a real hit.
Green alone, red in the full run. The victim is in the isolated pool now too, so no neighbour decides
what it imports.

**The heading audit walked the whole sitemap** because the three breakdown families were missing
from its TEMPLATED list: each page a cold ISR render on a fresh deploy. Stopped a few hundred pages in;
the list now carries them, `/embed/`, `/visa-bulletin/categories/` and the bulletin months, and a
comment saying a new [slug] family goes on it the day it ships.

## Sep 28 2026: precomputed salary views, sign-in behind the firewall, the morning report

**Heavy salary selections are precomputed** (`scripts/build_wage_views.py` -> Turso `wage_views`,
read by `src/lib/db/wageViews.ts`). Every status x occupation group x state x fiscal year holding
5,000+ filings, PERM and LCA, in the SQL's own arithmetic (linear interpolation at (n-1)p, SQLite's
half-away-from-zero ROUND, `binWidth` ported). `test_wage_views.py` compares every view with the live
SQL on a fixture; the readers take a view first and run the live query on a miss, and never serve bins
at a width the caller didn't ask for. Rebuilt after each disclosure load; `check_wage_views` in the
health check fails when the table is missing, short or older than 125 days. The Sep 27 Top Queries
put the PERM percentiles at 2.76B reads and the LCA explorer at 843 deadline errors (Sentry 3K).

**The blended RFI funnel drives from our 900 watched RFIs, not the 400k status table** (a LEFT JOIN;
without ANALYZE the planner had chosen the big side). Same answer, measured on production.

**The entity load swaps tables atomically.** `db_migrate_public.py` fills `perm_entities_next` and
`perm_wage_stats_next`, verifies them, then one transaction drops, renames and indexes. The old
drop-then-fill left pages reading a table without `recent_12m` for minutes (Sentry 4E, 4F: 497 events).

**Sign-in errors are classified, not reported.** `isBlockedResponseError` (a page instead of JSON) and
`isMaskedServerError` (Convex's production mask) in `src/lib/auth/auth-errors.ts`. At a code step a
masked `Server Error` is Convex Auth's own "Could not verify code", so it reads as a wrong code, not a
Sentry error. Case-form validation is a breadcrumb and a PostHog event now, never a Sentry issue, and
it no longer ships field VALUES anywhere. Onboarding's two writes retry once (`retryOnce`). Sentry
ignores the MetaMask extension, Safari's `sw.js load failed` and injected `executors/<n>.js` scripts.

**The morning report.** `daily-monitor.yml`, dispatched by Vercel cron at 11:30 UTC (7:30 AM EDT),
runs `scripts/daily_monitor.py` (ingest health, every workflow run and re-run, the site's pages,
HTTPS and domain expiry, what the data did, the Turso and Vercel bills against their plans with a
2x-the-median spike rule, PostHog traffic, new Sentry issues), then `dailyReport:send` adds accounts,
subscribers, Resend's own 24-hour log, the outbox, budget refusals and recorded errors, stores it
(`dailyReports`, 60 days, the admin page's Monitor tab) and emails SECURITY_ALERT_EMAIL. The Actions
log is public: the script prints one status word per section and `test_daily_monitor.py` fails on a
digit. A section without its secret says "off" (TURSO_PLATFORM_TOKEN, VERCEL_TOKEN,
POSTHOG_PERSONAL_API_KEY, SENTRY_AUTH_TOKEN). The routine "PERM Tracker Daily Report Review"
(`trig_01V1WvJPEyywHhGyVgNL9MJg`, 12:30 UTC) reads the email through the Gmail connector and pushes
only what needs Adam; no report by then is its own alarm.

**The bills the first report measured** (Sep 27, 11:59 PM EDT): Turso $143.12 over plan for Sep 2 to
Oct 1 (110.9B reads of 2.5B included, 59.7M writes of 25M), Vercel $163.40 against $20 of credit for
Aug 28 to Sep 28 ($62.83 of it ISR writes). Reads fell from ~1.5B to 0.41B per 4 hours after the
Sep 27 count fix; the wage views are the next cut. Cache windows were left alone: lengthening the
remaining daily pages saves under a dollar a month and the move to free hosting ends the cost.

## Sep 29 2026: every resource has a ceiling, every copy has a second

A post-switch audit, asked for as "make sure nothing can explode, use up a limit or take the server
down". Everything below was measured on the server first. The runbook with every unit is
[`scripts/oracle/README.md`](scripts/oracle/README.md).

**Crawlers took the site down three times in one night, and they were exempt from every limit.**
nginx waved Cloudflare-verified crawlers past all rate limits, right on Vercel (it scaled out per
request) and wrong on one 2-CPU server: YandexBot (12:43 AM EDT) and PerplexityBot (7:19 AM) asked
for up to 280 employer pages a minute, each page runs about 15 reads over one employer's filings,
the reads queued past the 20-second deadline, and 1,742 employer pages answered 500 (Sentry
JAVASCRIPT-NEXTJS-4T). At 4:56 AM the live copy stopped answering for six minutes until the watchdog
restarted it. Now each crawler gets 60 pages a minute keyed on its name, all of them 120 together
(429 with Retry-After), and at most 64 requests are inside the app at once (503 with Retry-After).
Oracle's own page says the Always Free A1 limit is 2 OCPU / 12 GB, so this server is already at it;
capacity cannot be bought for free, only protected.

**The page cache had no ceiling.** Next writes every page it renders into its release
(.html/.meta/.rsc/.segments per page); the live release held 13 GB after seven hours, and a full
crawl of 106,000 URLs would put about 69 GB in each of two releases on a 145 GB disk.
`permtracker-prune` (every 30 minutes) removes pages written after the deploy, least recently used
first, above 20 GB live / 4 GB standby / 0 for old releases. A removed page is a clean cache miss:
Next's file-system-cache.js returns null from its catch and renders again. 12 GB freed on its first
run.

**nginx could not read the files it claimed to serve.** `/srv/permtracker` is 750, so every request
for `/_next/static` hit "Permission denied" (57,604 in a day) and fell through to Next, which holds
only its own release's chunks: 309 build files answered 404 to visitors mid-session across a deploy.
The three parent folders now let others pass through (no listing) and `shared/` is world-readable;
env files (640, group-only) and secrets (600) stay closed, checked as www-data.

**Images and public files went through Next and through each visitor's page limit**: 2,384 image
requests from ordinary browsers got 429 in one day, because the service worker fetched them in a
burst. nginx serves the public folders from `$A/live/public` (a link the deploy script switches with
traffic), a day at Cloudflare's edge. And **the service worker precached 18.5 MB of images and 340
build chunks on every visitor's connection** for no offline benefit (documents are NetworkOnly); it
now precaches the two notification icons only (`service-worker-precache.test.ts`).

**Processes have priorities and ceilings** (`scripts/oracle/systemd/dropins/resources-*.conf`): the
database is last for the out-of-memory killer and first for CPU and disk; each web copy restarts
past 3.5 GB; the RAM lock (3.2 GB locked) is killed first, which frees memory at once; jobs yield
and stop at 4 GB; every job has a time limit. OOMScoreAdjust applies at process start, so it was
also written into `/proc/<pid>/oom_score_adj` of the running processes: nothing restarted.

**Backups: what could not be rebuilt had no second copy.** Convex keeps backups only on Pro, for 7
days, inside Convex; the server's secrets existed only on the server. Both now go to R2 nightly,
SEALED with the public half of a backup key (CMS, AES-256-GCM); the private half is only on the
owner's Mac (`~/.config/permtracker-backup/`). The Convex export is sealed ON the GitHub runner,
which already held the Convex key, and handed to the server through the deploy key's existing
forced command (`permtracker-deploy convex-backup`, which accepts only a CMS file), so no new secret
was created or moved anywhere. The sealed server copy runs as root and refuses to write if any
listed path is missing: a copy that silently skipped the root-only files would look complete. The
first version DID miss the database signing key (`/root/permtracker-jwt`), found by reading the
runbook's secrets table against the list.

**Sentry has a per-process budget** (`src/lib/sentryBudget.ts`): 5 copies of one error and 60
errors an hour, 500 log lines an hour. Normal days send about 10 errors and under 1,000 log lines;
Sep 29 sent 2,008 and 21,311, enough storms of which would spend the plan and hide the next real
error. The next event after a hold carries `budget.held_before`.

**Also fixed on the way:** www.uscis.gov refused GitHub's runners on every attempt (six of six)
and each refusal wrote a failure row newer than the server's success, so the USCIS workflows are
manual now and the server is the scheduled runner; the I-140 quarter is stored in
`perm_docs['uscis_i140']`, which the two tool pages read first, because only GitHub held the Convex
key the old path needed. Dependabot moves the CodeQL actions as one group. The corpus load's "kept"
count for occupations used the wrong key (it read 0 kept over 1,410 unchanged slugs).

**Instruments that misled during this audit, for next time:** `ps %CPU` is a lifetime average, not
current load; an nginx config test in the same second as `systemctl reload` is answered by the old
workers; a probe copy of a test that reads files by relative path crashes silently in a scratch
directory (run mutations in place, with a saved copy); `sed` treats `[` in a pattern as a bracket
expression, so a probe mutation containing `payload["x"]` never applied and the probe "passed".

## Sep 29 2026 (afternoon): every limit set from a measurement, and on the lax side

The owner's call: "lax broad limits everywhere; performance, experience and SEO first; highest reasonable". Every
limit in the stack was inventoried (about 130: app, Convex, email, auth, AI chat, embeds, jobs, nginx, Cloudflare)
and each was either raised, kept with a reason, or found to be an outside cap. What the numbers rest on:

- **A background pre-load is cheap, and a real click is not.** Next marks it `next-router-prefetch: 1`; on the live
  app a pre-load of a case page answered in 0.18 s with the loading shell and the DOL live-lookup counter did not move,
  while the click took 0.81 s and did. Counting pre-loads against the lookup limit had refused 24 of them in an hour.
  nginx now gives pre-loads their own allowance and never counts them as lookups. Next itself runs at most 4
  pre-loads at once per browser (12 for a hovered link, `segment-cache/scheduler.js`).
- **A cached page answers in about 10 ms and a cold one takes 0.1 to 2.6 s** (about one a second is all this server
  builds). So speed is protected by in-flight caps, which adapt to cost, and the per-minute rates sit where no person
  meets them. People are SLOWED before they are refused (nginx two-stage `delay=`; waiting requests do not count
  toward in-flight caps, tested); a refusal is a page that reloads itself, JSON under `/api`.
- **The local database reads 2,000 filings in 8 to 37 ms**, where Turso took 1.5 to 6.8 ms a row, so the case
  search's per-program window went from 400 to 5,000 (`SLICE_CAP`). The on-page answer stays 300 rows.
- **The DOL live-lookup budget was already 100,000 a day** (used: single digits); its timeout went 3.5 s to 8 s.

Changed: nginx per-address rates and caps, crawler allowances (Google and Bing outside the shared pool), the prune
budgets (60 GB live, 6 GB standby), Cloudflare's flood backstop (500 per 10 s), security level (low) and challenge
lifetime (a week); subscribe attempts per address 5 to 30 an hour, cases per address and employers followed 25 to
100, employer-move freshness 3 to 7 days, community timelines and milestones 6 to 20 an hour and 300 to 1,000 a day,
browser push 5 to 20 an hour, 200 to 1,000 a day and 10 to 25 cases, contact form 3 to 10 an hour, embeds 50 to 500
per site and 5,000 to 20,000 in all, case-write bursts 10 to 30, the idle sign-out 15 to 30 minutes (OWASP ASVS 4.0.3
requirement 3.3.2, Level 2; Level 3's 15 minutes also requires two-factor sign-in, which the app does not have), the
address block and the account suspension 24 hours to 1 hour (a stranger can trigger the suspension), USCIS calls
gained a 10 s limit and 60 a minute per address, the job-description box matches the server's 50,000.

Kept, with the reason: every email pool (Resend's free plan caps the account at 100 a day and the pools already fill
it; the worst day with the digest on is 105, the ledger in `convex/caseAlerts.ts` now says so), sign-in attempt
limits, the free AI and web-search quotas, USCIS's own quota, the Sentry budget.

Found on the way, and fixed: nginx keeps its OLD rules when it refuses a reload while `systemctl reload` exits 0
(`permtracker-deploy` now counts a reload only when new workers appear); crawler limits applied to ordinary pages only;
`/api` refusals were nginx's stock HTML; a site-wide sign-in-code refusal told people codes had gone "to this
address"; the prune script was installed where its timer did not run it. `scripts/oracle/test_nginx_conf.py` (CI)
holds the front door's rules, with five probes that must fail.

## Sep 29 2026 (evening): no limit is silent, nothing grows forever

Adam: *"make sure for this and things like it no silent always says why and shows"*, then overflow,
paging and "nothing can grow forever" across the public site, the app, admin, backend and server.
An audit found 33 silent limits; each now names itself, gives the wait, or pages.

- **Why a lookup has no answer is a type, not a guess** (`src/lib/dolMiss.ts`): `none` (DOL
  answered, no record), `unavailable` (DOL didn't answer in 8 s), `budget` (the day's live
  checks are used up; resets at midnight UTC, said in Eastern time), `not-asked` (the counter
  failed), and `records` (our own tables couldn't be read). Only `none` may read as "no record";
  the PERM, wage-request and LCA pages, the JSON API and the embed all read the same helpers.
- **A failed public request shows the server's own reason and a Try again button**
  (`src/lib/fetchFailure.ts`, `RequestFailed`): `usePublicQuery` returns `failure` and `retry`,
  and nginx's 429/503 JSON sentence reaches the page instead of "reloading usually clears it".
- **Capped lists ask for one over and say "the first N"**: the employer name search (200 +
  50 live-only), the palette (5 per kind, live-only employers and a see-all row to
  `/perm-employers?q=`), the case search (1,000, shown 100 at a time), the employer page's
  newest filings, the under-review moves, the timelines board (newest 5,000 scanned), the daily
  alert bundle (12, "more tomorrow"), the digest's "+N more" (counted before the cut).
- **Stale precomputed docs say so**: the case page, the status dictionary and the follow panel
  name the missing census instead of dropping sections or claiming "nothing happened".
- **The estimate says why its lead model is missing** (`PACE_ABSENT` caveat in queueEstimate.ts).
- **Signed-in app**: notifications page through `_creationTime`; every case read goes through
  `convex/lib/userCases.ts` (newest first, up to 5,000, `truncated` flag, `CaseCapNotice`);
  capped inputs use `src/components/ui/char-limit.tsx`; rate limits give the wait.
- **Chat**: cut-short replies say why (saved in message metadata) with Continue; a spent
  web-search quota is not "nothing found"; 8,000 output tokens (Groq keeps 4,000).
- **Retention**: `scripts/lib_housekeeping.py` on the nightly full sweep (serial misses 180 days,
  per-day counters 90, run logs 400); `convex/retention.ts` daily (errors 180, email events 365,
  API usage 90). Audit logs stay indefinite by policy. sqld's snapshots are bounded by its own
  merge rule (2x the database or 32 files).
- **The development deployment runs every cron**, still pointed at Turso, and emailed the owner
  three "[System Error]" alerts on Sep 29. `ADMIN_ERROR_EMAILS=off` (set on dev only) mutes them,
  and every admin error email now names its deployment.
- **The morning report** reads Resend's log with the sending key and no longer has a Vercel section.

### No email is refused and lost: one real day count, big pools, a retry queue for every send

Adam: *"for the ones refused are they queued for next days? if not fix... so this doesn't happen
again"*, then *"make limits more before limiting"*, *"any limit we hit needs to be bigger"* and
*"for any and all email failures like resend or anything so never just refuse and lost"*. He is
staying on Resend's free plan (100 a day, sent and received together, a UTC calendar day; 3,000 a
month).

**Why the limit was hit, measured:** normal demand from real people. 46 confirmation emails Sep 26
to 29 went to 44 distinct addresses (38 Gmail), 31 of the 40 checkable ones confirmed, and traffic
was ordinary (about 1,000 visitors on Sep 28, against 400 to 1,300 all month). Sign-ups had grown to
about 14 a day against a case-confirmation cap of 15 sized in August for 2 to 5. Resend's own count
never passed 57 that cycle. 17 attempts were refused on Sep 28 and 29 and nothing about them was
kept, so who they were can't be recovered.

- **Resend's 100 is guarded once, by what was actually sent** (`convex/lib/emailLimits.ts`,
  `emailDays`): the day keeps the highest of this app's own count, Resend's `x-resend-daily-quota`
  header (on sends only, not reads) and Resend's list of sent mail plus 5 for received mail. List mail
  stops at 85; sign-in codes keep the last 15.
- **Every send but a sign-in code goes through `sendOrQueue`** (`convex/lib/email.ts`, all 21 call
  sites): at the ceiling it doesn't try and queues for the next UTC day; a success records the count; a
  failure a retry can fix (Resend's limits or outages, the network, a key or domain problem) goes into
  `emailRetries` (`convex/emailLedger.ts`) and the caller sees `queued: true`, not an error. Only a
  blocklisted recipient or a malformed request comes back as an error. Admin mail
  (`priority: "high"`) may use the whole 100. Retries back off 5, 15, 60, 180 minutes then every 8
  hours; a quota refusal waits for midnight UTC; after 14 days, or past 1,000 waiting, a send is
  counted as lost and the admin emailed once that day.
- **Sign-in codes are counted, never queued** (`recordAuthSend`): a late code is useless, and the
  form already says to ask again.
- **The pools are now per-kind abuse bounds, not shares of 100**: case confirmations 15 to 60, case
  alerts 18 to 60, queue confirmations 18 to 40, bulletin confirmations 6 to 30, bulletin alerts 12
  to 40, preference links 6 to 20, sign-in codes 40 to 80. `src/lib/__tests__/alertBudgets.test.ts`
  holds them to the ledger in `convex/caseAlerts.ts`.
- **A confirmation either limit holds back waits** (`convex/confirmationQueue.ts`, `admitConfirmation`
  checks the day's count then the pool, read-only until both pass): one row per (kind, address), 1,000
  in all, 7 days, answered `queued: true` in fixed words and headed "Your email is in a short queue".
  One drain (right after anything is queued, and every 15 minutes) sends due retries first, then
  confirmations, while the day is under 85.
- The admin page's Alerts and email tab shows today's count against 100, the retries waiting and
  anything given up; the morning report says the same for the UTC day that just ended. `emailDays`
  is kept 400 days (`convex/retention.ts`).

## Sep 30 2026 (night): what silently broke after the privacy change and the move

Adam asked to find every silent breakage before fixing any. Found by comparing each event's volume
before and after Sep 27, reading every browser exception since, and walking the server's logs.

- **Cookie-free analytics lost every anonymous visitor's country.** `cookieless_mode: "on_reject"`
  (Sep 27) has PostHog drop the IP BEFORE its GeoIP step, so from Sep 28 12:00 UTC 4,443 of 4,529
  pageviews a day had no `$geoip_country_code`; signed-in events kept theirs. It was the privacy
  change, not the server move (the nulls start ten hours before the switch). The country now comes
  from Cloudflare: `src/lib/edgeCountry.ts` reads `loc=` from same-origin `/cdn-cgi/trace`
  (no cookie, nothing stored, two letters only, XX and T1 dropped, 800 ms cap), PostHog starts
  after it, and before_send adds the code to every event. **posthog-js drops any call made before
  init**, so `analytics.ts` holds calls while it starts (`holdUntilStarted` / `releaseHeld`,
  `whenAnalyticsReady`) and replays them in order; with no startup in progress (no key, tests)
  calls run at once. The privacy page says country only, never city or IP, for signed-out visits.
- **The header looped ("Maximum update depth exceeded", React #185) on three live pages.** A phone
  fires `resize` when its toolbar moves; the header reset its height reservation on every resize,
  so while scrolled `--site-header-max-h` dropped 71 to 59 px, the page jumped 12 px, and scrollY
  crossed the single 10 px threshold back and forth. Reproduced at 393 px on production. Now the
  reservation resets on a WIDTH change only, and the bar compacts past 24 px and grows back under
  4 px (`SCROLL_COMPACT_ABOVE` / `SCROLL_EXPAND_BELOW`): a band no 12 px shift can cross.
- **Browser errors reach PostHog, not Sentry, and the morning report read only Sentry**, so the loop
  sat unread. `daily_monitor.py` has a browser-errors section (warns on a message seen in 2+
  sessions), and before_send drops measured noise that isn't ours: Zalo's in-app `zaloJSV2` (192
  events in 3 days), Android WebView bridges, Safari's `sw.js load failed`, opaque `Script error.`
  and a browser refusing service-worker registration ("Rejected" inside `register()`).
- **The report's "visitors" counted crawlers**: it now gives likely people beside it (on a phone, or
  more than one page; about 776 of 1,077 on Sep 30). An estimate, labelled as one.
- **Turnstile's automatic token refresh was counted as a failed check** (255 "failures" from three
  idle login tabs on Sep 29). The widget's onExpire no longer reports; a real failure still does.
- **The Security page still said the site runs on Vercel**, the privacy list omitted Cloudflare
  (every request passes through it) and still listed PostHog session replay (off since Sep 6), and
  the compliance docs described Vercel, BotID and a Mac's launchd jobs. All say Oracle and
  Cloudflare now; `analytics-cookieless.test.ts` fails on "Vercel" in the legal and security pages.
  Oracle (OCI) and Cloudflare both publish SOC 2 Type II reports, checked on their own sites.
- **Checked and fine:** Sentry is connected and tags the deployed release (a test event through
  `/api/sentry-check`, resolved after); every env var the app reads is on the server or derived;
  emailed links, one-click unsubscribe, badges and social cards answer; build files of every recent
  release stay served; CAA lists Cloudflare's certificate authorities and the certificate runs to
  Dec 27; the browser-UA clients the rate limits refused were scrapers (600 requests in 2 minutes);
  Convex shows only retried sign-in conflicts. **Corrected Oct 1 2026:** about 0.09% of `/ingest`
  posts get a first-try 502, and NOTHING is lost. posthog-js retries a status-0 or 5xx post with
  backoff (its resends carry `retry_count=` in the URL), and nginx shows those resends answered 200,
  80 of 80; the 502s don't line up with restarts either. This note first said events were dropped
  "whenever the app restarts", which was wrong on both counts. Also left alone: rare webpack
  "reading 'call'" errors right after a deploy.

## Oct 2 2026: two copies, a scraper, crashes that left no trace, and the bylines

**One copy of the site was the ceiling, and a scraper found it.** Node builds a page on one CPU, so one
copy saturates at two to three times normal traffic while the second CPU idles. On Oct 1 at 11:34 PM,
11:51 PM, 12:12 AM and 12:16 AM EDT a scraper on rotating addresses (browser user agents, realistic
referrers, mostly Chinese ranges plus US proxies) walked `?case=` lookups and filled all 64 in-flight
slots; people got "busy" pages. Three changes, all in `scripts/oracle/` (runbook in its README):
- **The live slot runs two copies** (`@<slot>` and `@<slot>2`, ports 3001/3011 and 3002/3012, the second
  from `<release>.w2`); nginx splits by `hash "$uri?$pt_args_no_rsc" consistent`, so a page and its
  click data hit the same copy's cache. `permtracker-deploy` starts and checks both, warms both, and
  rolls back to the other slot's first copy at once. The health check lists the second copy and the
  morning report warns when the site runs on one.
- **Lookups from everyone together hold at most 24 of the 64 slots** (`pt_lookup_conn`), so a lookup
  walk can't fill the app whatever addresses it rotates through.
- **Refresh calls reach both copies**: Next keeps the stale-page list in each process's memory, so
  `/api/revalidate-*` goes to the first copy and nginx `mirror`s it to the second.

**`MaxListenersExceededWarning` was the analytics relay.** Next's external rewrite (httpxy), compression
and Sentry's request tracking put 11 `close` listeners on every relayed `/ingest` response, about 1,500
warnings an hour. nginx relays `/ingest/` straight to PostHog now (runtime DNS, `X-Forwarded-For` the
visitor's address, cookies stripped); zero warnings since. Visitor counts per hour were checked before
and after: no merging. `next.config.ts` keeps its rewrite as a fallback nothing reaches.

**An error screen hid every crash it caught.** A visitor's /perm-cases showed "This page's figures
didn't load" and "Try again" re-rendered the same broken state; nothing was recorded, because React
handles an error a boundary catches (PostHog's automatic capture never sees it) and Sentry isn't loaded
on public pages. `src/components/error/recovery.ts`: every error screen (public, app, global) records
the error in PostHog as `$exception` with where it was caught; an error a fresh load cures (old code
after a deploy, a dropped request) reloads the page by itself at most once a minute per tab; "Try again"
is a real reload. The stale-deployment reload, which had no limit, goes through the same once-a-minute
claim.

**Counting people shown a refusal page.** Both nginx refusal pages carry a 1-pixel image
(`/__pt/busy-seen`) that only a browser drawing the page asks for; nginx logs it to its own file, the
health check counts people per day (address plus browser, crawlers left out) and the morning report
prints the week and warns at 10 people shown "busy" in a day or 3+ on 3 days running: the signal for
adding CPUs. nginx's `return` answers before `limit_req` runs, so the image is `empty_gif`.

**The root icons come from disk.** Next served them `max-age=0`; in 5 hours about 1,800 requests went
through the app for unchanged icons and some were refused under the page limits. `sw.js` stays with the
app: a service worker's security policy comes from its own response headers.

**Articles carry team bylines** (`CONTENT_TYPE_CONFIG[type].byline`: blog and changelog "PERM Tracker
team", guides "PERM Tracker data desk"), emitted as an Organization tied to the site's own; a person's
name becomes a Person only through `KNOWN_PERSON_AUTHORS`. 46 articles carry an `updated` date from
their real last revision; cards say "Updated <date>", the feed adds `atom:updated` and `dc:creator`.

**Google Discover**: every article's lead image is 1,200px or wider (one 800px photo became its own
card, `scripts/make-article-cards.mjs`), and every page sends `max-image-preview:large`. Four legal pages
had restated `robots: { index: true }`, which replaces the root's whole object and dropped it;
`robots-preview.test.ts` fails on a page doing that.

**A second scraper, on ordinary pages, met a Cloudflare browser check.** 2:42 to 2:46 AM EDT: Tencent Cloud
addresses (AS132203, 43.172/43.173, one Windows Chrome label) sent 69% of page requests and filled all 64 app
slots, so about 1,240 requests from everyone else got busy pages. The lookup cap couldn't help (these were page
views). Cloudflare custom rule 3 makes AS132203 pass a managed challenge; verified crawlers skip it through rule 2.
Within a minute Tencent's requests at the server fell from 1,354 a minute to 12. The scraper then moved to
residential proxies (40 to 54 home and mobile addresses a minute, each too slow for any per-address limit) under
one label, Windows Chrome/151.0.0.0: 3,643 requests in 12 minutes against 72 from 4 addresses the whole day before.
Rule 4 puts Windows Chrome reporting 151 or 80 to 139 through Cloudflare's interactive (one-click) check, switched from the automatic one at 3:10 AM because the Chrome/151 part passed it; PostHog showed real Windows Chrome on 80 to 139 at 19
pageviews in 3 days, and version 151 at one pageview per session (a headless browser that runs our JavaScript, so
it also inflates PostHog's visitor counts and would count as a person in the busy-page tally). Its click-data
requests carried believable referrers, so "no referrer" was not a usable tell (8 of 367,000 real ones lacked it).

**Email links go from nginx straight to the backend**: `/prefs`, `/unsubscribe` and every alert's confirm and
unsubscribe. They were the last relayed-through-Next requests (the last MaxListeners warnings), and two defects
came out of moving them: the backend sends no Cache-Control, so Cloudflare kept these pages up to 2 hours (a
reopened preferences link could show settings already changed), and they carried no security headers. nginx marks
them `private, no-store`, unframeable and no-referrer, and passes only the headers the backend needs (Cloudflare's
own, like CF-Connecting-IP, are refused by the backend's Cloudflare). 19 answers compared before and after: byte
for byte identical. Cloudflare's stored copies were purged by prefix.

**A repeat click on a confirmation link says "You're already on the list"** for case and employer alerts, where it
said "This confirmation link is no longer valid" to people who were subscribed (one did, Oct 2). An unsubscribed
address still gets nothing back, so an old link still can't re-subscribe anyone. The bulletin and queue alerts
already answered this way.

**Meta's AI crawler reads at 30 pages a minute** (`pt_meta`, owner's call). It was the biggest load that wasn't a
person: a median 73 pages a minute (peaks 133) from 110 addresses, mostly employer pages built from scratch. It
still reads every page, more slowly; the other crawlers keep 90.

**The welcome email is signed "The PERM Tracker team"**, like the bylines (`welcomeSignoff.test.tsx`). The About
page is the one place a person is named.

**The first two-copy deploy (81d3d8c9, 3:15 AM EDT) went as designed**: both new copies warmed with 779 pages,
traffic switched, the old slot kept for rollback. It showed one false alarm: Node exits 143 when systemd stops it,
so the old slot's stopped second copy read "failed" and would have warned every morning. `SuccessExitStatus=143`
in the web drop-in (`systemd/dropins/resources-web.conf`) makes a normal stop read as one.

**The attorney hero** fits more on one screen: at 1440x900 the dashboard picture's top moved from 539px
down, 60% visible, to about 80% visible.

## Oct 3 2026: browser errors read to their cause, sitemap dates from git, the nightly bulletin read

**The search pages crashed on Chrome 109** (the last release for Windows 7 and 8.1): `usePublicQuery` used
`AbortSignal.any` (Chrome 116+, Safari 17.4+). One controller and a timer now do the same job, and a `timedOut`
flag, not the abort reason, marks a timeout, because older browsers reject an aborted fetch with a plain
AbortError whatever reason was given. The test stubs `AbortSignal` without `any` or `timeout`. Server code may
keep `AbortSignal.timeout`; anything that runs in the browser must not use `AbortSignal.any`.

**"Cannot read properties of undefined (reading 'call')" is in the live build, not stale pages.** About 20 a day
since the error screens started recording (Oct 2), every one carrying the `dpl=` of the build live at that moment,
caught by the error screen and cured by its automatic reload. Next already turns a build mismatch into a full load
(on navigation and on prefetch), so it isn't version skew. It didn't reproduce in 14 clicks. `reportCaughtError`
now adds `failedRequests` to any reload-curable error: build files and page data that came back with a non-2xx
status, or a script answered as something other than JavaScript. Read that property on the next one before
changing anything.

**Every build writes `static/build-TfctsWXpff2fKS/`, the same folder name**, and the deploy copies static files
into `shared/` with `--no-clobber`, so the shared `_buildManifest.js` is older than any release on the server.
Harmless today because no App Router page loads it (checked: the HTML doesn't reference it); it would matter if
a Pages Router page came back.

**Cloudflare keeps page HTML for a day to a week and serves the stale copy while it refreshes**
(`s-maxage` plus a year of `stale-while-revalidate`), so a visitor can get a page built by an earlier deploy.
Old build files stay in `shared/`, so such a page still works; it explains a filtered error (Zalo's) still
arriving from a page cached before the filter shipped.

**Sitemap lastmod comes from git** (`scripts/page_dates.mjs` -> `src/lib/sitemap/page-dates.json`, read by
`changed()` in `src/lib/sitemap/build.ts`). For each page: the newest commit day across its own folder and what
it imports from `components/` (not `ui/` or `layout/`), `lib/constants/` and the app tree, two imports deep.
Pages that print DOL's or the sweep's figures take the later of that and the data date (`newer()`). The deploy
checks out the whole history without file contents (`fetch-depth: 0`, `filter: blob:none`) and writes the file
before the build; in a shallow clone the script keeps the committed file. 80 hand-typed dates are gone (/terms had
said June 15 after changing Oct 2); `page-dates.test.ts` fails if the sitemap asks for a route the file lacks.

**The nightly bulletin read only looks forward.** `ingest_direct` without `skip_bad` takes months newer than the
newest held and upgrades held ones; never-held history older than that is the backfill's (`--backfill-direct`).
After the Oct 2 backfill to 2005 the nightly run tried 2007-05 (an older layout), failed, and turned the health
check red; it would have done so every night.

**DOL's processing-times pages refresh when any figure moves**, not only the PERM date: the ingest compares the
stored snapshot with the new one. DOL moved its wage figures on Sep 30 with the PERM date unchanged, and the pages
waited about two days. **Every reading is kept now**: `processing_times` holds one row per PERM date (the newest), and
`processing_time_readings` one per (PERM date, wage date) pair, written before the overwrite so its seed still sees the
reading being replaced. The open-data history reads the readings (falling back to `processing_times`) and writes each
half once per DOL date: it had repeated the shared half whenever only one date moved. The one reading the Sep 30 move
had overwritten (PERM Sep 22, wage Aug 31) was restored from the Oct 2 nightly backup.

**The automatic defense acts at 5 people shown the busy page in 10 minutes** (owner, Oct 3; it was 2), and every
Under Attack episode is followed by the three-hour wait, not only one that hit the hour cap.

**The API's entity answers carry dates and the live queue**: `meta.asOf` is the disclosure files' last decision
day, `pendingNow` is DOL's live status for the entity's cases by stage with the sweep's day, and each kind carries
only its own fields (an occupation its code and median wage, a law firm its state). The MCP tool descriptions
carry example calls.

**PostHog's "new error type" alert** is what fills the inbox: it fires on any error message first seen in the
last hour. Microsoft's link scanner ("Object Not Found Matching Id:N, MethodName:...") is filtered now.

**A deploy's own warm-up set off Under Attack Mode (Oct 3, 8:45 AM EDT).** Warming 874 pages on both new copies at
the live copies' CPU weight starved the live site on its 2 CPUs: up to 64 page requests a minute got the busy page,
nobody drew the busy pixel, and the defense's "app full 3 minutes running" rule fired. It was switched off by hand at
8:47 AM. Now the new copies warm at CPU weight 20 against the live copies' 200 (restored before the switch), and the
deploy writes `health/deploying` while it runs, during which the defense ignores app-full minutes (people shown busy
still count; a marker older than 20 minutes is ignored).

**The wage-request estimate counted its wait from the wrong date until Oct 3.** `estimatePwdQueue` added the months
of work ahead to the REQUEST month instead of DOL's as-of date, so on Oct 3 a June request showed "July 2026" and a July
request "August 2026", months already past (September came out right only because the two dates coincide). It now
counts from the as-of date, reading Sep 30 as the whole month gone. The scorecard had recorded 144 wage predictions that
way (typical miss 79 days, the bug, not the estimator); they're relabelled `pwd-queue-request-month`, kept, and left out
of the public line, which grades only `pwd-queue` (`PWD_MODEL` / `PWD_BEFORE_FIX` in `src/lib/scorecard/score.ts`).

**The MCP server is in the official MCP Registry** as `app.permtracker/perm-tracker` (published Oct 3 2026, 7:48 AM
EDT; `registry.modelcontextprotocol.io/v0/servers?search=app.permtracker`). The name proves the domain: a TXT record on
the apex (`v=MCPv1; k=ecdsap384; p=...`, Cloudflare, comment "MCP Registry") carries the public half of an ECDSA
P-384 key whose private half is only at `~/.config/permtracker-mcp-registry/key.pem` (0600) on the owner's Mac, beside
the published `server.json`. No repository and no person are named. To publish a new version: bump `version` in that
`server.json` (each version's metadata is fixed once published), `mcp-publisher login dns --algorithm ecdsap384
--domain permtracker.app --private-key "$(openssl ec -in key.pem -noout -text | grep -A4 priv: | tail -n +2 | tr -d
' :\n')"`, then `mcp-publisher publish`. Never print the private key. Removing the TXT record blocks future logins,
not the published entry.

## Oct 3 2026 (afternoon): an outage we caused, two more prefixes, and every seasonal source

**The outage, 12:46 to 1:24 PM EDT.** Back-to-back LCA history loads (about 200,000 rows a quarter,
each row written into a dozen indexes) made sqld compact its replication log continuously: a
50,000-frame snapshot every 41 seconds, then a merge into a 4.2 GB full snapshot. sqld held both
CPUs, reads still answered in 0.2 s, and no write could take the lock. Every request that writes
waited, the app's slots filled, and about 9 visitors in 10 got the busy page. The watchdog checked
reads only, so it saw nothing. What changed:
- `permtracker-db.service` runs sqld with **`--max-log-size 4096`** (the default is 200 MB). That
  log exists for read replicas, which we don't run; at 4 GB it compacts about twenty times less often.
- **The watchdog takes and releases the write lock** every 2 minutes (`db_write_ok`, the
  `db_rw.jwt` token) and restarts the database after 3 failed checks, one restart per 30 minutes
  shared with the read check. Tested against a server that never answers and an error reply. An
  idle held lock is no test: sqld steals a write transaction idle for about 5 s.
- **History files load at `HISTORY_PAUSE_S` = 2 s between write requests** (0.35 s for DOL's newest
  file), chosen by `file_is_newest()`, so a back catalogue can never outrun the live site.
- A restart of a sqld killed mid-hang finds its log dirty and compacts about a million frames (12
  minutes at both CPUs, the site still up); a clean restart afterwards came back in 1 s.

**Two more prefixes on the counter, found in our own ledger.** 14 of 60 serials the miss ledger
had recorded as "no case" were H-2A job orders (`JO-A-300-`, Form ETA-790/790A), and one was a
CW-1 application (`C-500-`); DOL answers both. That makes 19. Three consequences:
- **Fixed-width code broke on a nine-character prefix.** `CASE_RE`, `[:6]`, `substr(case_number,
  1, 6)` and `caseNumber[12:]` all assumed one letter and three digits. `lib_flag_serials` has
  `SQL_PREFIX` / `SQL_DAY` / `SQL_SERIAL` (everything before the twelve-character day-and-serial
  tail), and `prefix_of` / `serial_of` everywhere else. A test proves a job-order hit is never
  also written down as a miss (it was, with `[12:]`).
- **The miss ledger records a prefix ERA, not a flag.** `asked_all` is NULL for the walk's original
  twelve, then 1 and 2 as prefixes were found (`PREFIX_ERAS`, `CURRENT_ERA`, `owed_after`). A miss
  from an older era is asked only the prefixes found since, and settles at the current era.
- **The site's shape rule accepts `JO-A` exactly**, nothing looser: `caseStatusVocabulary`,
  `caseNumberShape`, both rules in `turso/caseLookup.ts`, and the date decoder in `permCaseNumber`.
  `APPROVED` is a final seasonal status (a job order's decision; Python and TypeScript sets, pinned
  together), and `AVAILABLE FOR 9142A LINKING` pending.

**H-2A, H-2B and CW-1 disclosure files** load through `ingest_flag_disclosure.py` as programs
`h2a`, `h2b` and `cw1`, into ONE table, `seasonal_cases` (so the case search, lookups and employer pages
read it like any program's published table), with column names from DOL's
FY2026 Q3 record layouts. The files carry no VISA_CLASS (`visa_default` names it); the seasonal
columns are `workers_certified`, `begin_date` and `end_date` (the REQUESTED period, which every
application has) and `worksite_county`. CW-1 calls the employer `LEGAL_BUSINESS_NAME`. The guard
knows the "Piece Rate" unit, and its date floor is 2000 so the FY2008 history can load. The
workflow is now "FLAG disclosure ingest", with one concurrency queue per program, a run title naming
the file, and `dry_run`, `dump_header` and `accept_drift` inputs. FY2013's H-2A and H-2B files are
`.xls`, which the parser can't read.

**SeasonalJobs.dol.gov's feeds** (`ingest_seasonal_jobs.py`, table `seasonal_postings`, dataset
`seasonal-postings`): three zips a day of the H-2A and H-2B applications and H-2A job orders DOL
accepted in about the last three weeks, with what the live status service never returns: wage,
workers, work period and worksite. The first file DOL serves is Feb 25 2024 (Feb 24 answers 404),
reaching back to acceptances on Feb 6 2024; each file covers about three weeks, so a backfill takes
one file a week. Older seasonal cases are in the quarterly disclosure files (FY2008 on). No contact field, preparer, FEIN, street address or postcode is
read. The server runs it daily (`permtracker-uscis seasonal-jobs`, 8:20 AM ET).

**The defense, two fixes.** Its alert emails had all failed: Resend sits behind Cloudflare, which
answers Python's default User-Agent with 403 "error code: 1010"; it sends a named one now. And a
full app no longer counts when sqld has used more CPU than every website copy over a 3-second
sample (`database_bound`): at 12:02 PM our own load put Under Attack Mode in front of visitors for
31 minutes with nobody shown the busy page.

**Published seasonal cases join the live table.** `sync_published_live.py` feeds
`seasonal_case_status` from `pwd_cases` (P-400 and P-500) and `seasonal_cases`.

## Oct 4 2026: robots rules, a watchdog that knew too little, and limits from measurement

**A loader read a page USCIS asks bots not to.** www.uscis.gov's robots.txt disallows
`/tools/reports-and-studies/h-1b-employer-data-hub` (and, by prefix, every path under it), the
civil-surgeon export and `/sites/default/files/archive/`. `ingest_uscis_h1b_hub.py` read the hub
page every month to find its Tableau view. It now pins the view (`VIEW`, from the Oct 2 run's log;
the Tableau host has no robots.txt), takes the newest year from the default export, and the quarter
from USCIS's data page (`REPORTS_PAGE`, allowed), whose "Fiscal Year 2026: Quarter 3" heading agreed
with the hub's own sentence. **`lib_gov_data.fetch` asks each host's robots.txt first** (once per run)
and raises `RobotsDisallowed` before any request to a forbidden path; an unreadable file counts as no
rules (www.dol.gov answers 403 to robots.txt itself). An audit of every address our scripts name
against its host's rules found only the hub page (and a signed posting API, which robots rules
don't govern). `test_robots_guard.py` and the hub test's dry run (every network call stubbed) hold it.

**The watchdog restarted nginx for a full app.** Its nginx check asked for `/api/health` through
nginx, so the app's 503 "busy" reply during a deploy's warm-up failed three checks (Oct 3, 3:16 PM
EDT; nginx's access log shows three instant 503s) and it restarted nginx mid-deploy, dropping the
site for about 5 seconds. nginx now answers `location = /__pt/nginx-alive` itself (204, no limits),
the watchdog checks that, and while `health/deploying` is fresh it leaves the web copies and nginx
to the deploy. `scripts/oracle/test_watchdog.py` runs the real script under bash on Linux against
stand-ins for curl and systemctl; the old script fails both cases.

**The morning report grouped runs by title.** A workflow renamed on Oct 3 left its old title's last
failure reading "still failing" with no newer run under that title. Runs group by workflow file now,
named from GitHub's workflow list; it also made "FLAG disclosure ingest" match the data-workflow list,
which per-file titles never did.

**Staleness limits come from what the agency has done.** I-485 inventory: 160 days (USCIS posts each
month's count 20 to 96 days late and in batches; on Jun 3 2026 the newest anywhere was 152 days old).
DOL processing times: 30 days (the longest gap between DOL's dates we've kept is 22, Aug 31 to Sep 22).
Both limits warned on most mornings for sources doing nothing unusual. The stored rows were updated
on the server the same morning; our own ingests dying is the runs check's job, not these limits'.

## Oct 5 2026: who visits, measured three ways

Cloudflare, the server's nginx log and PostHog count different things; never quote one for another.

| | last 24 h to 1:56 AM EDT Oct 5 | what it counts |
|---|---|---|
| Cloudflare requests | 864,750 | everything at the edge, including what it blocks and serves from cache |
| reached the server | 381,620 | nginx's access log |
| Cloudflare "403" | 333,690 | its own browser check (custom rule 5 on `/perm-case-status?case=`), never seen by the server; a scraper on Chinese home broadband (AS4837, AS4134) |
| server "429" | 93,190 | our crawler limits: Meta's AI crawler 108k requests reached the server, AhrefsBot 60k, ClaudeBot 31.6k (216.73.216.32), SE Ranking 18k |
| PostHog visitors | 1,510 | anything that runs our JavaScript, the scraper's headless Chrome included (3,372 on Oct 2 alone) |

**Likely people** (PostHog, the scraper's labels left out: Windows Chrome 151 or 80 to 139; a phone or tablet, or
two or more pages): 356 in the last 24 hours, 4,553 in 7 days (6,436 counting one-page desktop visits), 11,784 in
30 days. Weekdays 700 to 900 a day, weekends 230 to 400. Last 7 days: 52% of visits view one page (a case lookup
often answers in one), median visit 40 s, 44% over a minute, 22% over 5 minutes, 3.3 pages per visit on average;
about 1 in 5 people seen earlier in the month came back on another day. This is an estimate, not a saved metric.

**Cloudflare's Security Insights, checked Oct 5:** "Users without MFA" is real (the owner's login; his to fix). The
rest are false or deliberate: HSTS (Cloudflare checks only its own switch; nginx already sends two years with
subdomains), security.txt (live), Turnstile (the "PERM Tracker auth forms" widget exists), Bot Fight Mode (leave it
off: Cloudflare's docs say custom rules can't skip it, so it would challenge the data jobs, the API, MCP and
one-click unsubscribe), AI crawlers (allowed on purpose). Cloudflare's GraphQL on the Free plan refuses
`firewallEventsAdaptiveGroups`; `firewallEventsAdaptive` (samples) works, and the rate budget empties fast.

**The defense put Under Attack Mode on at 2:07 PM EDT Oct 4 for 32 minutes** on "app full 3 minutes running" with
0 people shown the busy page. **Kept as it is (owner, Oct 5):** a full app for 3 minutes running still acts
without waiting for a person to be refused. A scraper never draws the busy page, so waiting for one would let it
hold the app until a real visitor had already been turned away.

## Oct 7 2026 (just after midnight): a scraper, a blind defense, and loading screens that move

**A scraper walked case numbers under one frozen browser label, and nothing stopped it.** From about
8:27 PM EDT Oct 6, 4,043 of 4,063 case lookups in 15 minutes came from 2,153 residential addresses
under `Windows ... Chrome/151.0.0.0`, both web copies sat at 90% CPU and the load average at 5.65 on
two CPUs. It passed Cloudflare's checks (the one-click check for that label and the browser check on
lookups were on throughout). Three defects let it run:
- **The defense was blind after every nightly log rotation.** `/var/log/permtracker-busy` was
  `root:permtracker 750`; nginx's workers run as `www-data`, couldn't reopen their files after the
  rotation ("Permission denied" at 00:23 Oct 3, 00:35 Oct 6, 00:27 Oct 7) and kept writing to the
  rotated `.1` files, so `permtracker-defend` read an empty `defend.log` (pageRequests 0) until a
  deploy restarted the workers. The folder is `751` now (12:56 AM EDT).
- **The defense had nowhere to put its rule.** Cloudflare's free plan allows 5 custom rules and 5 were
  used, so every `rule_on` answered HTTP 400 (logged to `health/repairs.log` from 8:20 PM Oct 6) and,
  because a failed `rule_on` leaves the mode off, it never escalated either. Rules 3 (Tencent) and 5
  (case lookups), both a managed challenge, are one rule now; 4 are used. Numbering since: 1 Meta
  lookups, 2 trusted traffic skips, 3 Windows Chrome 151 and 80-139 (one-click), 4 lookups or Tencent.
- **The defense counted crawlers' 503s as a full app.** nginx answers a crawler past its own small
  cap with the same 503 as a full app; once the defense could see again, ShapBot, Meta's crawler,
  AhrefsBot and Applebot made minutes "full" with 0 people shown the busy page, and it was ten
  minutes from putting every visitor behind Under Attack Mode. `full_minutes` leaves verified and
  named crawlers out of both counts now (`test_defend.py`, probed red against the old code; installed
  12:19 AM EDT).
- **nginx limits case lookups under that exact label to 30 a minute together** (`$pt_stale_label`,
  a regex key: a literal that long overflows `map_hash_bucket_size 64` and the first reload was
  refused; nginx kept its old rules and the site stayed up). Measured after: 436 of 585 of its lookups
  refused in two minutes and the busiest copy at 9% CPU. People reported Chrome 152 and 154 that night.
  `test_nginx_conf.py` holds the limit on both lookup pages, with two probes.

**Real visitors' load times were fine throughout** (PostHog `$web_vitals`, bots and the label left
out): three in four saw the main content within 1.0 to 1.4 s on desktop and 0.6 to 0.9 s on phones for
three weeks; Oct 6 desktop was the slowest day at 1.38 s.

**Loading screens sweep now** (owner's call, Oct 6: flat boxes read as a page that froze). Every
`.skeleton-pulse` carries a slow band (`--skeleton-sheen`, a tint of the foreground; `.skeleton-on-ink`
inside an inverted panel) that crosses it, rests and repeats; nothing blinks or breathes, and reduced
motion keeps the still ground. The case page's loading state is the answer's own shape now (the ink
answer card with its date and button, the estimate panel, the alert form, the record's two cards), each
card held to its measured height at 390, 768 and 1440 wide: 2,682 against 2,681 px on a phone and 1,651
against 1,649 on desktop. Tailwind's `animate-pulse` (an opacity pulse) is gone from it and the video
player.

## Oct 8 2026 (afternoon): faster tests, and a deploy that waits for them

**Three tests were a fifth of the suite's test time.** The daily budgets for browser push, milestone reports
and community timelines went to 1,000 a day on Sep 29, and each test filled its budget through the endpoint:
every call collects every attempt already in the window, so one fill read about 500,000 rows (72, 54 and 45 s
on the old Mac). `fillRateWindow` in `test-utils/convex.ts` seeds all but three attempts in one transaction; the
three tests now take under a second each and still throw when the endpoint charges a different budget (probed
by renaming each endpoint's budget: all three went red).

**The happy-dom projects pre-bundle their heaviest packages** (`deps.optimizer.client` in `vitest.config.ts`).
A components file starts in a fresh worker and loaded every package anew; `@phosphor-icons/react` alone is
about 1,500 modules. On a 29-file sample, runs interleaved A B B A: import 212 s to 30 s, wall 135 s to 63 s.
The whole components project passed with it, mocks of those packages included.

**Not taken: one shared environment across components files** (`isolate: false`). It halved that project
again (666 s to 316 s under the same load) and every file passed in that order but one timeout, but vitest 4
resets neither modules nor mocks between files without isolation (`run()` in its `base` chunk), so a file can
pass on another file's leftovers.

**CI runs the suite in three parts at once**, beside a job for the typecheck, pyflakes and the data script
tests. `Typecheck + Vitest`, the check branch protection requires, is a job that passes only when all four
did (`test.yml`).

**The deploy waits for the suite.** `oracle-deploy.yml` builds while the tests run, then polls the Tests run
for its exact commit and stops before touching the server unless it passed. Until Oct 8 a red suite still
deployed: `755f6817` and `3427ce10` went live with CI failing on pyflakes. A push to main gets a Tests group of
its own and is never cancelled, so every deploy has a run to wait for; a pull request's runs still cancel.

**`pnpm check`** (`scripts/check.sh`): both typecheckers, pyflakes, every data script test, and
`vitest run --changed origin/main`, then every test file that names a changed file (by basename, or by
repo path for names many files share). The second run exists because `--changed` follows imports only: on
Oct 8 a change to the Python ingest's `FINAL_STATUSES` passed `pnpm check` and turned CI red, because
`caseDiscovery.test.ts` reads that Python file as text. A gate that scans all of `src/` without naming a
file is still missed, so this is the quick first look; CI is the whole one.

**The old Mac swaps under the suite**: 8 GB with Chrome and several Claude sessions, so a full local run sat
at a load average of 50 to 80 with 2.8 GB in swap on Oct 8. Its local time says more about the memory than
about the tests. Measured anyway, the same machine, before and after: 1,336 s to 919 s wall, the import
phase 1,998 s to 545 s, test time 774 s to 672 s; 634 files and 9,026 tests passed.

## Oct 8 2026 (afternoon): every step timed, and a redeploy that deleted the live release

**What each step takes, measured Oct 8:**

| step | time |
|---|---|
| commit | under 1 s (no commit hook) |
| push | 11 s (the pre-push hook runs `tsgo`) |
| `pnpm check` | 2.2 min: typecheck 51 s, pyflakes 4 s, 73 script tests 47 s, affected vitest 27 s |
| `pnpm test:run` on the old Mac | 15.3 min (22.3 before the speed work), swapping |
| CI Tests | 2.2 min (about 8 before): three parts of ~3,000 tests each, 9,028 together |
| deploy: build | 3.8 min (compile 2.6 min, TypeScript 6 s with its build info kept from the last deploy, 45 s without; pages 54 s) |
| deploy: wait for tests | 1 to 2 s (the tests finish during the build) |
| deploy: server | 4.5 to 5 min to the switch, of which the warm-up is its whole 4-minute budget (881 pages, never all of them); deleting old releases after the switch runs in the background since Oct 8 (it took 7 more minutes once); the pages the push changed are warmed first (`warm-first.txt` from `gsc_queue.mjs --warm-list`, the same list the Cloudflare step drops) |
| push to live | 9.2 min (696bfbca), 9.7 to 11.2 before the TypeScript cache |
| Convex deploy | 42 s (`npx convex deploy --dry-run`, nothing changed) |

**Webpack's own cache can't be kept between deploys**: Next keys it on a config string that includes
the server-actions encryption key (`configVars` in `next/dist/build/webpack-config.js`), which it generates
fresh for every build, so a restored cache never matched (compile 2.6 min either way). A pinned key would
fix it, but its copy would then sit in the Actions cache, which a forked pull request's workflow can
restore from this public repo. Only `.next/cache/.tsbuildinfo` is kept; the 255 MB webpack entries were
deleted. The morning report prints the CI and deploy lines every day ("How long things take", `speed_lines` in
`daily_monitor.py`), and `pnpm check` prints its own.

**A second deploy of the same commit deleted most of the live release (2:19 PM EDT).** The release name
was the commit plus `GITHUB_RUN_ATTEMPT`, so a dispatched redeploy (sent to measure the compiler cache)
arrived as `14bbcd8ef65b-1`, the release green was serving, and the deploy's `rm -rf "$A/releases/$rel"`
emptied it before failing on the page cache the running copy was still writing. For two minutes the first
copy served from memory: nginx logged 31 errors (28 on `/sw.js`, 3 on a video thumbnail), no page errored.
`permtracker-deploy rollback` put traffic on blue at 2:21 PM; the damaged copy was stopped and its release
deleted, so a later rollback refuses instead of landing on it. Two fixes: the deploy refuses with exit 5 a
release id any slot runs from, first or second copy (`scripts/oracle/test_deploy_guard.py`, Linux only, run
on the server: green with the guard, six failures with it removed), and every run names its release
`<sha>-<run number>` (and `DEPLOYMENT_ID` likewise). The fixed script was installed by hand
(`/usr/local/sbin/permtracker-deploy`, after checking the installed copy matched the repo's).

## Oct 9 2026 (morning, later): the morning report, a waiting alert, the crash evidence

**The report's PostHog sections failed on one bad reply, and now try again.** PostHog's query endpoint
answered one bad reply on Oct 5 (browser errors) and Oct 9 (traffic); each section read "could not be
read (HTTPError)" for the day, and the same query answered minutes later. `http_json` in
`scripts/daily_monitor.py` retries a 429 or 5xx after 5 s and 15 s (or the server's Retry-After, up to
30 s), and `guarded()` names the HTTP status code in the report, never on stdout.

**Convex keeps 400 characters of each report line and cuts the rest wherever it falls.** `readReport`
in `convex/lib/dailyReportCompose.ts` bounds the untrusted payload; the scorecard's rival readings
(headline plus every point on one line) ran past it, and the email ended them mid-word. `section()` now
passes every line through `fit()`: the sentences that fit, then "More on the admin page." (whole words
and "..." when no sentence fits). `test_daily_monitor.py` holds `LINE_MAX` to the TypeScript cap. Each
fix was probed by breaking it; the retry probe made the test crash on the uncaught error instead of
printing FAIL, so the check now catches it and reports. **A probe's verdict is the exit code: a grep
for FAIL misses a test that crashed.**

**An outbox row that waits with no attempts and no error is the one-a-day rule.** A subscriber got
their own case's alert at 10:15 AM EDT Oct 8, so a Microsoft employer alert at 7:15 PM waited; the
7:30 PM run is the same Eastern day, so it went on the 7:30 AM run (Resend: delivered). Bundles run at
12:30, 18:00 and 23:30 UTC since Oct 31 2026 (7:30 AM, 1 PM and 6:30 PM EST; an hour later in EDT); case-status alerts always go at once.

**The "reading 'call'" evidence so far.** Since the capture went live (11:27 PM EDT Oct 8) one crash
was recorded: no duplicate chunk ids, no `chrome-extension:` script (only Ahrefs, Cloudflare Insights
and PostHog's own `/ingest/` bundles), and the live build's `dpl`. That argues against the extension
theory without ruling it out. The rate fell from about 0.4% of pageviews on Oct 8 to 1 in about 1,700
overnight, light traffic, so not called fixed. Normalise crashes by `$pageview` per hour before reading
a drop. The message lives in `properties.$exception_list` (`$exception_message` isn't a property here).

**Resellers find the MCP Registry listing.** An API marketplace asked (Oct 4, again Oct 9) to mirror
`/mcp` behind paid plans; declined Oct 9, because the API and MCP are free to use directly. Replies to
support mail go through `supportEmail:replyToEmail` (see the Resend line under Integrations).

## Oct 10 2026: the disk filled, and what now watches it

**What happened.** Next 16.3 (live Oct 7) writes rendered pages to `.next/server/route-cache/<KIND>/<hash>/$/`
instead of `.next/server/app`. `permtracker-prune` walked only the old folder, reported "0 pages", and every
release kept its cache; deploys deleting old releases hid the growth until a day without one. Free disk fell a
steady 3.5 GB an hour (PCP's archive, `pmval -a <archive> filesys.avail`): 87.6 GB at 3:10 AM EDT Oct 9, 0 at
about 5:20 AM Oct 10. The morning report read 50% on Oct 9 and 100% on Oct 10.

**Who it touched (5:20 to 8:27 AM EDT).** Pages kept serving: Cloudflare counted 38,000 to 48,000 successful
responses an hour and one 500; PostHog's pageviews held with no browser errors; busy replies rose to about 400 to
500 an hour (no page could be cached, so every visit rendered). The database refused writes: the 4:10 AM sweep's
1,189 status changes had landed at 5:27, but its walk, gap sweep, ten summary docs and rebuilds failed after, and
the run stayed green; the 5:40 AM wage-request sweep failed (`SQLITE_FULL`); the scorecard, backtests and seasonal
jobs failed; a lookup of a case we didn't hold couldn't charge its DOL budget, so it answered "couldn't check DOL"
(182 case-page views from 163 people in the window, most of them cases we hold). Reads that need temporary space
failed too (Sentry 52, `/perm-rfi-audit`), and Next kept the last good page. The watchdog, the defense and the
sampler all failed while writing state, and nginx couldn't write its log. Lost for good: nginx's log and the
health samples for those three hours. Nothing in the corpus.

**What changed.**
- `ROOTS` in `permtracker-prune` names both folders, and each slot's budget is split between its two copies
  (30 + 30 live, 3 + 3 standby); `test_prune.py`. The cap has 1 GB and 45 minutes.
- **`permtracker-alarm`** (every 5 minutes, memory in `/run`, never writes to disk): emails the owner at once
  for low or fast-falling disk, memory, failed units, a silent sampler, a stalled cap or a late backup, and fixes
  what it can first; `test_alarm.py`. Runbook: `scripts/oracle/README.md`.
- **`convex/serverWatch.ts`** (every 15 minutes, `SERVER_WATCH=on` on production only): the same server watched
  from outside, so a server that can't speak is still heard.
- The sampler records free disk and hours to full; the morning report fails under a day, warns under three.
- **A run that fails and carries on ends red**: the sweep when two doc writes or its own run row fail
  (`record_run` returns whether it landed), and the status-sweep and processing-times workflows when any step
  noted a failure in `$RUNNER_TEMP/pt-failed-steps`.
- The watchdog's counts live in `/run`; the defense survives a state file it can't save.

**After any Next upgrade, check where it writes rendered pages**: `find .next/server -newer server.js -name '*.meta' | head`.

**The same morning, after the fix (9:00 to 9:45 AM EDT).** Convex was deployed once the suite passed, and
`SERVER_WATCH=on` was set on production only; its first check read the live database's health report and found
nothing wrong. `PRAGMA quick_check` on the database file came back `ok` (938 s, `sudo sqlite3 -readonly` on
`/srv/permtracker/db/data.sqld/dbs/default/data`, the file sqld serves; reading it beside sqld is safe). The 9:13 AM
pending pass rewrote the ten summary docs the 4:10 AM run had lost (queue census, review stages, employers under
review, month detail, the sweep's date and the rest, all by 9:29) and walked to that day's filings (3 PERM, 79
wage-request and LCA); its new failure step ran and passed. Watched cases weren't checked from 6 to 8 AM, and the
9:00 check found nothing had moved, so no alert was missed. Sentry 52 was resolved with a note, and the alarm's test
email arrived at 8:56 AM.

**The disk is 150 GB of Oracle's free 200, on purpose** (owner's call, Sep 28 2026; he had forgotten it by Oct 10,
and the reasoning was only in a transcript): the free allowance covers every disk on the account and a boot disk is
at least 50 GB, so the 50 GB left is room for a second free server, for a rebuild with no downtime or to rescue this
one. A disk can grow while the server runs and never shrink. How to grow it, and when: `scripts/oracle/README.md`,
"the disk's size". **The alarms are email only** (owner, Oct 10: no phone push).

**Instruments that worked here:** the server's PCP archive for history the health samples lost
(`pmval -a /var/log/pcp/pmlogger/permtracker-web/<day> -t 1h filesys.avail`); Cloudflare's GraphQL
`httpRequests1hGroups` through the Cloudflare MCP for what visitors got hour by hour (it answers on the Free plan);
PostHog's pageviews and exceptions for what people saw. **Never `pkill -f <pattern>` inside an ssh `bash -c` that
holds the pattern**: it killed its own shell (ssh exit 255) while a `du` was being stopped.

## Oct 10 2026 (afternoon): the review, and what it changed

Audit 12, then a six-agent review of every commit since d7d0d5d0 (Aug 23). Ledger and reports are session scratch;
what follows is what stays true.

**A failed read is never an answer.** The rule behind most of the fixes, with where each one now lives:
- The all-programs search: each source read is caught on its own and named in `unread`; nothing read throws
  `SearchUnavailableError` (route 503); a partial answer is `no-store`. Case-number point reads report `unread` too.
- `debarmentsForSlug`, `warnForSlug`, `employerMatch`'s map read, the case lookup's history read and
  `wageLevelHistory` throw instead of returning empty, because their pages keep a render for up to 30 days and a
  failed regeneration keeps the last good one. `tableColumns` answers an empty set only for "no such table".
- The API's case answer throws (a 500 nobody is charged for) rather than 404 when a published half failed.
- `processing_times` and `estimator_backtest` are checked before use: a missing list becomes empty and is logged by name.

**Concurrency.** Two case-alert sweeps (the cron, the 5-minute check, a self-reschedule) used to send one change
twice: `claimAlertSend` stamps `sendingStatus`/`sendingAt` before rendering (15-minute expiry), `recordAlert` clears
it. Browser push claims by writing the new status first (`claimPush`, `unclaimPush` on a transient failure) and
reads open subscriptions page by page (it read the oldest 2,000 forever).

**The server door, and a sign-in limit that never ran.** `checkIpRateLimit` and `checkAuthRateLimit` were public
with a caller-supplied IP or email: anyone could spend another address's sign-in budget, blocklist an IP, or write
the `ip_strike` rows abuse detection takes as corroboration. Both count only calls carrying `API_SERVER_SECRET`
now (`convex/lib/serverDoor.ts`, shared with the webhook door). **And the per-IP check had never run for a
sign-in**: Convex Auth's middleware answers `/api/auth` itself before it calls the proxy's handler
(`convexAuthNextjsMiddleware` in `@convex-dev/auth/dist/nextjs/server/index.js`), and production held no
`ip_auth` row. `src/proxy.ts` now runs `refuseAuthPost` (`src/lib/auth/authGate.ts`) first: per IP, then per
email by the form's flow (`authAttemptFromBody`), skipping token refreshes, failing open. The three forms' browser
pre-checks are gone. `authGate.test.ts` drives the proxy with a stand-in that answers `/api/auth` the way the
real middleware does, so a check placed back inside the handler fails it.

**Email.** Opt-outs drop the subscription's queued retries (`emailRetries.refs`); account deletion drops all but
the deletion notice; a preference link for an address we hold nothing for sends nothing; inbound support
forwards have their own pool (`supportForward`, 30 a day; past it the mail is stored, the admin page lists it);
the bundle sender skips addresses already mailed today instead of stalling behind them; unconfirmed case-alert
sign-ups go after 30 days. **Mail anyone can set off stops at 55** (`PUBLIC_CEILING`, owner's call): confirmations,
preference and firm-claim links (`admitConfirmation`, the drain's `confirmationRoom`), the contact form and
support forwards (`sendOrQueue` with `priority: "public"`), so alerts always have the 30 between 55 and 85.
Kept as designed (owner, Sep 29 and Oct 10): queued confirmations skip their pool on replay, bounded by the day's
count and QUEUE_MAX; and the bundle's and digest's prefs link still opens the full list (a forward shows it).

**Exports count rows** (owner's call): Plus takes 20,000 export rows a day (`exportRowsPerDay`,
`src/lib/api/exportQuota.ts`, one `perm_docs` row a day); an export is sized to what's left and says so, refused
at zero (`export_daily_limit`), refused when the count can't be read, and `/v1/me` reports both.

**Ops that read green while broken.** The PERM sweep records `failed` and exits 1 when it checked nothing, and
`partial` when DOL stopped answering part way; the wage-request sweep mirrors the PERM tail rule; the live
rebuild says `partial` (was `mismatch`) and counts its facets; the watched-case check records `partial` on a
refusal and lets code defects crash; the alarm exits 1 when a due email didn't go; the page-cache cap counts
bytes it actually freed and records `.next/server`'s real size so the alarm sees a cache folder it can't read;
the defense rebuilds its state from Cloudflare when its file is unreadable; **the alarm counts the page
cache's headroom** (`cache_headroom` from the cap's report): a fall the cap will stop with 25 GB or more still free
raises nothing (it emailed "full in about 12 hours" at 11:39 AM EDT Oct 10 while the live cache refilled toward its
60 GB, which leaves about 36 GB), a blind cap or unknown headroom keeps the plain trend, and its emails say
"falling" or "rising" where they printed a signed rate; the cross-check skips clean when the
third party is down and marks the run on a real disagreement; a refused Cloudflare purge fails its step; the
dispatcher's duplicate guard compares the run's mode (`run-name` carries it); the morning report keeps STALLED,
MISSING, STALE, DRY and ZERO lines and fails a report with no timer list.

**The health check.** A failed newest run counts for 40 days (`RUN_FAILURE_WINDOW_DAYS`; monthly jobs' failures
had aged out in 3); `mismatch` is broken; a check that can't read its table fails unless the table doesn't exist;
a dataset whose `as_of` is its own fetch day going stale means our ingest stopped (the source has nothing to republish);
`employer_stages` is a watched doc. `main()` is tested to fail on each check alone.

**Smaller.** Webhook refusals carry a code (404 for a missing endpoint, 503 for our own misconfiguration, the old
wording read as the fallback); our-side webhook failures aren't charged as attempts; private-address checks block
6to4, IPv4-translated and Teredo forms; unknown API keys live in their own bounded cache and an address that
keeps guessing stops reaching Convex; push endpoints must be FCM, Mozilla, WNS or Apple (`convex/lib/pushHosts.ts`,
all 25 open subscriptions passed); the idle sign-out check reads the hook's 30 minutes (it said 15); one email
shape check (`convex/lib/emailShape.ts`), one program-of-a-number rule, one status anchor. Copy that said one
email a day, twice a day, every 12 hours, weekly backtest or Monday was corrected where it had stopped being true.

**Tests that couldn't fail.** Drift guards that passed when they couldn't read their file (case-number rules)
now read by working directory and fail if missing; a wrap-day assertion and the sandbox test lost their
"or" branches. New: the prune run, the alarm's cache drop, the watchdog's write lock, nginx reload detection,
the sealed-backup guard (the Linux ones run in CI and passed on the server), the scorecard's rival wins and ties,
budget-held alerts sent once the budget frees, the retry lease, `/v1/cases?live=1` scope, the server watch.

## Oct 12 2026: one scraper on 70,000 addresses, and what turns it away

**What filled the app.** From 8:11 PM EDT Oct 11 to 6:55 AM, 121,000 page requests: about 34% declared
crawlers, about 60% one scraper, real people a few percent (3% of the browser-looking addresses ever ran
the site's scripts). The scraper never reuses an address (about 70,000 in 11 hours, one to three pages
each, home, phone and cloud networks in the US, Vietnam, India, China and Turkey), rotates about 335
browser labels (half of them Mac Chrome 119 to 133), asks for employer pages 96% of the time and never
runs the site's scripts. A cold employer page takes about 15 reads, and at about 200 a minute that keeps
the app near full: a calm 4 AM window looked like the episodes. Three times in 12 hours (6:37 PM, 1:53 AM,
6:02 AM EDT) the app was full three minutes running and the defense put the whole site behind Under
Attack Mode for about 30 minutes. Per-address limits see one request per address, and no network or
label reached the defense's 30%.
- **Cloudflare rule 4 also checks Mac Chrome 119 to 133** (one click; owner's go). PostHog saw 87 visits on
  those versions in 14 days, one page each, 74 of 88 on employer pages: the same scraper. Probed live: Mac
  Chrome 126 and 133 answer 403 `cf-mitigated: challenge`, 118 and 154 answer 200.
- **The defense challenges one part of the site before the whole site** (`find_section` in
  `bin/permtracker-defend`): failing a network or label, a first path segment drawing 60% and 60+ of the
  page requests turned away gets the managed challenge on its own, and every other page stays open. Still
  in trouble 10 minutes later: Under Attack Mode as before. Never `/api`, `/embed` or an emailed-link
  route, and the value is checked against `/[a-z0-9-]*` before it goes into a Cloudflare expression.
- **nginx's defense log records `$request_uri`.** It logged `$uri`, which for a turned-away request is the
  busy page's `/503.html`: every alert's "mostly for" named `/503.html`, and no section could ever have
  been found. `test_nginx_conf.py` probes the format.

**Build files.** The deploy copies a release's build files into `shared/` without overwriting, so a font
or stylesheet whose name never changes kept the date it first arrived, and the three-week prune deletes
by date: 21 of the live release's 401 files dated from Sep 28 and were due to go on Oct 19 (nginx would
then have asked the app for them). `stamp_shared` in `bin/permtracker-deploy` dates every file a deploy
ships. Since Oct 10 every chunk's name changes per deploy (`chunkLoadingGlobal`), so `shared/` grows by a
full set each time: 607 MB on Oct 12, 269 MB of it in one day of 16 deploys, about 5 to 6 GB at that pace
under the three-week rule.

**The cron dispatcher waits out a busy site** (`bin/permtracker-cron`, `test_cron.py`): a 503, 429, 502,
504 or dropped connection is asked again after the wait the reply names (else 15, 30, 60 and 120 s), five
tries. At 6:00 AM the scraper had the app full, and the ingest-health dispatch failed and emailed the owner.

**Alert ratings are on** (`ALERT_RATING_ENABLED=1` on Convex production, owner, Oct 12): a case's final
alert carries the 1-to-5 row.

**Search Console's Oct 12 emails:** the duplicate-canonical pages were the Oct 5 merges (308s now; the
recheck was started), the alternate canonicals are `?q=` and `?ref=` links (correct), and two review-stage
URLs the census once linked answered 404 and redirect now (`next.config.ts`).

**Smaller:** the 404's brand link hides under the site header (`[body:has([data-site-header])_&]:hidden`);
the admin and security pages read in sentence case, and a security event of kind `rate_limit` reads
"Counted": every attempt is a row in the limits table, refused or let through.

## Oct 12 2026 (late morning): Oracle's disk copies, kept inside the free five

**Oracle billed us for disk copies on an Always Free account** (the any-spend alarm, $0.08 then about
$0.10, drawn from the trial's $300 credit, never the card). Oracle's own schedule
(`permtracker-daily-keep3`, daily, 3-day expiry) never deleted a copy once it expired: the Oct 4 copy
expired Oct 7 and was still held on Oct 12, nine were held, and Oracle bills every volume backup past
the five it marks free. The schedule is unassigned (the policy stays defined), and the owner deleted the
four billed copies.
- **Oracle marks a free copy with the system tag `orcl-cloud.free-tier-retained: "true"`**; the billed
  ones carried no system tags at all, so no tag means billed. Read through the API on Oct 12.
- **`permtracker-disk-copies`** (3:45 AM Eastern, `scripts/oracle/bin/`, `test_disk_copies.py`): deletes
  this disk's oldest copies until 3 remain, then makes one, so there are never more than 4 and a fifth
  free slot stays spare for a copy made by hand before a risky change. Deleting first means a new copy is
  never the sixth. It fails, so `permtracker-alarm` emails, when the new copy lacks the free tag (it waits
  10 minutes for the tag first) or more than 5 are held; a copy stuck six hours fails; one being made
  skips the night. `--dry-run` and `--list` change nothing.
- **The server signs in to Oracle as itself** (an instance principal): dynamic group `permtracker-server`
  (rule: the instance's ID) and policy `permtracker-disk-copies` (`manage boot-volume-backups`, `use
  volumes`; Oracle's policy reference lists `BOOT_VOLUME_BACKUP_CREATE` and `VOLUME_WRITE` for a copy).
  No key is stored. Granting account permissions is the owner's click: my safety check refused to type
  the rule, and the owner created both. Oracle's Python library lives in `/opt/permtracker-oci` (534 MB;
  Ubuntu 26.04 needed `python3-venv` for it); the disk's ID is in `/etc/permtracker/disk-copies.env`,
  kept off this public repo.
- **The morning report reads `backups/DISKCOPY_OK`** through `server_health.backup.diskCopy`: warns past
  30 hours or with no copy on record, fails past 54 hours, on a copy not marked free, or past 5 held.

## Oct 18 2026: the site goes live at night, and the parts that had to move with it

**Why.** Every deploy starts the page cache empty, and Googlebot and the AI search crawlers keep asking while it
refills, on two CPUs. On Oct 17 to 18, 8 of the 13 people shown the busy page came within an hour of a deploy, and
Saturday had 15 deploys. Owner's call, Oct 18: one a night.

**How it decides.** `scripts/deploy_plan.py`, run by `oracle-deploy.yml`'s "Decide whether this run builds and ships"
step (`test_deploy_plan.py`, probed by mutation):

| run | builds | ships |
|---|---|---|
| a push outside 1 to 5 AM Eastern | yes, so a broken build shows in the day | no ("held for the night run") |
| a push inside the window | yes | yes |
| `when=night` (the server's `permtracker-cron@dispatch-night-deploy`, 06:00 UTC) | only if site files changed since what's live | then yes |
| `when=now` (by hand: `gh workflow run oracle-deploy.yml -f when=now`) | yes | yes |

- **What's live comes from the server** (`ssh deploy@<host> status`, the active slot's release `<sha12>-<run>`), never
  from "the last successful run": a held push succeeds too. `PATHS` mirrors the workflow's `paths` list, held equal
  by the test. The diff uses `--no-renames`, so the blob-less checkout never fetches file contents.
- **Of `.github/`, only `oracle-deploy.yml` ships the site** (Oct 21 2026): the workflow filters with an ordered `paths`
  list, the last match winning (GitHub's rule), so a change to any other workflow or to `dependabot.yml` builds and
  ships nothing. Adding `dol-perm-files.yml` had shipped the site and emptied its page cache. `site_changes` in
  `scripts/deploy_plan.py` reads the list the same way.
- **Everything that read "a deploy run succeeded" as "it shipped" moved.** IndexNow's changed-pages send is a step in
  the deploy run (`indexnow.yml` is the manual full send only); the morning report counts a run as a deploy only when
  its deploy step ran, and lists "Pushes built and held for the night deploy" (`speed_lines`).
- **The night job is titled `Oracle build and deploy, night`** (`run-name`), so the dispatcher's duplicate guard can't
  take a push (titled by its commit) for it; `route.test.ts` holds the title and the input to the YAML.
- **The timer isn't `Persistent`**: a night missed while the server was down waits for the next night instead of
  shipping at midday.
- **The first night needed one-time triggers**, because the route the timer calls ships with the deploy that adds it:
  `permtracker-first-night-deploy` dispatched straight to GitHub at 06:00 UTC Oct 19 with the server's dispatch token,
  and `permtracker-night-deploy-enable` switched the permanent timer on at 06:01 (before the 06:30 reboot window, since
  a transient timer doesn't survive a reboot). Both are named `permtracker-*` so the alarm emails if either fails.
- **Convex still deploys once the suite is green**: it doesn't touch the page cache. When a Convex change needs the
  new site first, deploy it after the night run.

**Freshness stamps, the same day.** `et_today()` (`scripts/lib_db.py`) dates every stamp and sweep doc by the Eastern
day; the bulletin's direct read stamps on a night with nothing new; the entity load stamps `entities`; the full sweep
stamps both `perm-case-status-full` and `perm-case-status`; the Federal Register feed is capped at today; and
`check_nightly_builders` fails a nightly rebuild with no clean run in 3 days.

**Two shell traps that hit while building it** (both in `~/.claude/reference/machine-and-tools.md`): an unquoted
heredoc runs every backtick inside it (a note's `gh workflow run ... -f when=now` fired a deploy request GitHub refused
only because the input wasn't live yet), and zsh never splits `$var` into words, so `set -- $r` left a poll waiting forever.

## Oct 19 2026: the H-1B LCA filings move to a database of their own

**Why.** `permtracker-dbcache` holds the main database file in RAM (speed, and Oracle's idle rule), and it stops at
6 GB. The file passed that on Oct 9 (6.69 GB), so nothing has been locked since. `lca_cases` and its indexes are
2.75 GB of it; on their own server the main file is about 3.9 GB and fits again, for free.

**The rule, in both clients** (`src/lib/db/lcaRoute.ts`, `scripts/lib_db.py`, held to
`scripts/fixtures/lca_routing.json`): a statement naming `lca_cases` goes to `DATABASE_LCA_URL`, everything else to
`DATABASE_URL`, same tokens. Unset, everything goes to the main file, as before. A statement joining `lca_cases` to a
main-file table is refused by name once the LCA server is set (and in tests and dev always); a request mixing the two
is refused in Python.

**What the main file keeps:** `lca_case_numbers` (case number and received date, 3,754,961 rows, filled Oct 19), for
the three nightly reads that can't reach the other file: the gap sweep, the published-to-live sync and the employer
map's double-count guard. The loader writes it beside every batch of LCA rows, `scripts/lca_numbers.py` repairs it,
and the health check fails when its count differs from the LCA table's. A missing list stops the employer map
instead of skipping the live LCAs.

**Status:** step 1 (the code) is live once deployed and changes nothing while `DATABASE_LCA_URL` is unset. Step 2 (a
second sqld on 127.0.0.1:8082, a copy of the table, the tunnel host, the secrets) and step 3 (rename, then drop the
old table and compact the main file offline in the night window, then the RAM lock) are in `scripts/oracle/README.md`
once done.

## Oct 21 2026: where the server's time went

- **The instruments.** nginx's main log (`pt_main`) ends each line with `rt=` (nginx's time, a limit's wait included),
  `urt=` (the app's) and `nc=` (Next's cache answer). sqld's admin API on 127.0.0.1:9097 (key in
  `/etc/permtracker/db-admin.env`) keeps each statement's count, time and rows read; `sudo permtracker-db-stats`
  prints them. A live copy can be profiled: `kill -USR1 <pid>` opens its inspector on 127.0.0.1:9229, the DevTools
  Profiler samples it, `process._debugEnd()` closes it. `permtracker-perf` does all of it hourly
  (`perm_docs['server_perf']`, the morning report's "Page speed"); its reasons and thresholds are in its docstring.
- **The database was never the slow part.** Statements took milliseconds while the two copies ran the CPU near 100%.
- **75% of that CPU was `getAllPosts`** (`src/lib/content/index.ts`): every call read, parsed and word-counted every
  article (reading-time), and the `(site)` layout, the root 404 and `NotFoundBody` called it on every page build,
  because Next renders `not-found.tsx` into every page's tree. It reads once per process in production now.
- **What a server component hands a client component rides in every page.** Four copies of the article list (17 KB
  each) did. Anything a component needs only on interaction (search, a 404) loads when that happens:
  `/articles.json` through `src/lib/search/articleList.ts`, fetched at most once a visit.
- **Next pre-loads every visible link** and has no hover-only setting (`prefetch={false}` turns hover off too).
  `IntentLink` (`src/components/ui/intent-link.tsx`) arms pre-loading at the first hover, touch or focus; the header,
  footer, data rail and breadcrumbs use it, and `intent-link.test.tsx` keeps plain `next/link` out of them.
- **A read that does more than its caller needs runs as often as the page.** `getDisclosureStats` read 750 ranking
  rows for pages that used one figure; `getDisclosureSummary` is the document alone.
- **Before adding a read to a page, check what it costs per render**: `permtracker-db-stats --rows` after an hour.

## Oct 25 2026 (afternoon): Sentry drops Chrome for iPhone's own scripts too

Sentry 5E ("Maximum call stack size exceeded.", one iPhone visit on /signup, Chrome 155): every frame named an employer
page as its file (`app:///perm-employers/...`), at lines 193 to 229 of a 296-line page that hold only markup. That's
Chrome for iPhone's Translate or form script, which PostHog had dropped since Oct 16; Sentry's `beforeSend` in
`SentryClientInit.tsx` now drops it by the same rule (`sentryEventFromInjectedPageScript`: Chrome for iPhone, and every
frame a page document rather than a script, Sentry's `app:///` names included). An error with one frame in a `/_next/`
script still reports.
