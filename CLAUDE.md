# CLAUDE.md - PERM Tracker

**Status:** Production | **Version:** 2.0.0 | **Last Updated:** 2026-10-18

> The codebase-map table below is a dated snapshot (2026-02-21) and its counts
> have drifted: the suite is now **634 files / 9,026 tests across 5 vitest
> projects** (2026-10-08), not the 151 files / 3 projects TESTING.md records. Treat those
> docs as orientation, and `v2/CLAUDE.md` plus `pnpm test:run` as current.

## Production URLs

- **Frontend:** https://permtracker.app
- **Convex Dashboard:** https://dashboard.convex.dev

## Documentation

| Topic | File |
|-------|------|
| **Developer Guide (PRIMARY)** | [v2/CLAUDE.md](v2/CLAUDE.md) |
| **API Reference** | [v2/docs/API.md](v2/docs/API.md) |
| Design System (look, motion, gates) | [v2/docs/DESIGN_SYSTEM.md](v2/docs/DESIGN_SYSTEM.md) |
| PERM Workflow (canonical) | [perm_flow.md](perm_flow.md) |
| Testing Guide | [v2/TEST_README.md](v2/TEST_README.md) |
| **Codebase Map (7 docs)** | [.planning/codebase/](.planning/codebase/) |
| Planning & Roadmap | [.planning/](.planning/) |

**See [v2/CLAUDE.md](v2/CLAUDE.md) for Quick Start, commands, patterns, and all developer docs.**

---

## Codebase Map

Deep-dive documentation in `.planning/codebase/` (3,856 lines, last updated 2026-02-21). **Read these before making significant changes.**

| Document | Lines | What It Covers | When To Read |
|----------|-------|----------------|--------------|
| [STACK.md](.planning/codebase/STACK.md) | 279 | All dependencies with versions, config files inventory, runtime details, CI/CD, pnpm overrides, version compatibility notes | Adding/upgrading dependencies, debugging build issues |
| [INTEGRATIONS.md](.planning/codebase/INTEGRATIONS.md) | 459 | Every external API (AI, email, push, calendar, search, Sentry), env vars inventory, webhook flows, auth providers, sequence diagrams | Working with external services, adding integrations, env var questions |
| [ARCHITECTURE.md](.planning/codebase/ARCHITECTURE.md) | 595 | System architecture with Mermaid diagrams, data flows (case CRUD, auth, AI chat, notifications), state management, API layer, database tables, dependency graph | Understanding how systems connect, planning new features, debugging data flow |
| [STRUCTURE.md](.planning/codebase/STRUCTURE.md) | 720 | Every directory and file with descriptions, naming conventions, import patterns, barrel exports, module boundaries, where to add new code | Finding files, understanding organization, adding new features |
| [CONVENTIONS.md](.planning/codebase/CONVENTIONS.md) | 580 | TypeScript patterns, React patterns, Convex patterns, error handling, date protocol, form patterns, CSS/styling, naming rules, anti-patterns with examples | Writing new code, code review, understanding project patterns |
| [TESTING.md](.planning/codebase/TESTING.md) | 800 | All 151 test files listed, Vitest config (3 projects), test utilities inventory, mocking patterns, coverage setup, flaky tests, factory patterns | Writing tests, debugging test failures, understanding test infrastructure |
| [CONCERNS.md](.planning/codebase/CONCERNS.md) | 423 | Risk matrix, tech debt (SWC bug, disabled React Compiler), dead code audit, security concerns, performance bottlenecks, dependency vulnerabilities, prioritized recommendations | Before refactoring, sprint planning, addressing tech debt |

---

## GSD Workflow

Uses GSD (`~/gsd-adam`). Config: quality profile, all gates ON, auto_advance OFF, branching none.
v1.0 (10 phases) + v2.0 (22 phases) shipped. Post-v2 features ongoing.
Key: `/gsd:feature`, `/gsd:quick`, `/gsd:map-codebase`, `/gsd:help`

---

## Deployment

The site runs on an Oracle server behind Cloudflare (since Sep 28 2026; runbook
[`v2/scripts/oracle/README.md`](v2/scripts/oracle/README.md)). Vercel is retired.

- **Site:** a push to `main` runs `Oracle build and deploy`. It builds at once, and
  goes live only in the 1 to 5 AM Eastern window (the server's 2 AM run ships main
  when the site changed; `gh workflow run oracle-deploy.yml -f when=now` for an
  urgent fix). Every deploy empties the page cache, so they're batched.
- **Convex:** `npx convex deploy -y` from `v2/`, by hand, once GitHub's suite is green.

### Project Names (avoid confusion)

| Service | Name | Notes |
|---------|------|-------|
| GitHub repo | `perm` | See remote origin |
| Local folder | `perm-tracker/v2/` | All code lives in `v2/` |
| Oracle server | `ssh permtracker` | the site, the database (sqld), nginx, the timers |
| Cloudflare | `permtracker.app` zone | DNS, the tunnel `permtracker-oracle`, R2 backups, the mail Worker |
| Convex prod | See `.env.local` | `npx convex deploy -y` from `v2/` |
| Convex dev | See `.env.local` | `npx convex dev` from `v2/` |

**Always run commands from `v2/` directory.** Claude is always launched from `v2/`.

---

## Resources

- **Convex:** https://docs.convex.dev
- **DOL PERM:** https://flag.dol.gov/programs/perm
- **20 CFR 656.40:** https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.40



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

## SEO: JSX glues adjacent element text (2026-08-23)

`<A/>` newline `<B/>` in JSX renders with **zero characters between them**, so
`Blog` + `Tutorials` reads as `BlogTutorials` to anything that walks the DOM.
Google's snippet extraction is textContent-shaped and ignores CSS layout — proven
the same day, when it printed the identical defect verbatim in a sibling site's
search listing. permtracker.app had **624 joins across its 11 public pages**; they are
**fixed and gated**. Re-verified live 2026-08-27: 44 pages scanned from the
sitemap, **0 glued pairs**, and the sweep prints a control string so a blind
run cannot read as a pass. Full recipe, scope and verification loop:
[`v2/CLAUDE.md`](v2/CLAUDE.md), section "Glued JSX text".

**The source-level gate is not the authoritative one** - it cannot see
`.map()` output, custom components, `motion.*`, or conditionals. Run
`scripts/audit_glued_text.py` against rendered pages.


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
| USCIS case status by receipt number | **USCIS** Case Status API (OAuth), on demand per lookup | built and dark until USCIS grants API access to PERM Tracker LLC; plan in `.planning/llc-and-uscis-plan.md` |
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

## Sep 23 2026, in four lines

Each is detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under its date.

- **BotID runs only in the signed-in app**, where the one route it guards (`POST /api/chat`)
  lives. Public pages don't load it: the Vercel firewall guards the site, and each public
  endpoint charges its own budget.
- **Live-only employer URLs carry their own sitemap date**: the newest `fetched_at` among the
  employer's cases, an Eastern date, where every URL used to say "today".
- **New York's WARN notices are keyed without the dashboard's `Index` column** (a position that
  shifts as notices post), the snapshot is pruned, and each notice's site shows on employer
  pages and `/layoffs`.
- **Nothing may follow a script's `__main__` guard.** A nightly refresh defined below one failed
  silently for sixteen days; `scripts/test_main_guard.py` enforces the rule in CI.

## Sep 25 2026, in four lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 25 2026".

- **The employer census reads the slug from both tables**, because an appeal is a decided case; it had split
  seven employers across two rows and shown one at 100% where the truth was 31%.
- **Every surface names who acted**: on hold, RFI and NORD are DOL's; an appeal is the employer's.
- **Holds are dated from the site's own record**, with a feed of the days DOL moved an employer's cases in
  bulk, and the on-hold guide renders its counts live.
- **Firewall rule 5 wants a secret value**; its header's mere presence had been a public bypass.

## Sep 26 2026, in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 26 2026".

- **Anyone can follow an employer** and hear when DOL moves its cases as a group: bulk holds and
  releases, and decision batches well above that employer's own pace.
- **One alert email per person per day**: several updates wait in an outbox and go out as one.
- **No budget moved**; every limit lives in `convex/lib/alertBudgets.ts` and refusals are counted.
- **The admin page is four tabs**, with the budgets, the outbox and employer follows on it.
- **One-click unsubscribe POSTs bypass the firewall** (rule 13); they had been answered with a
  429 challenge, mail already sent included. Decided cases keep their daily re-check: "final"
  statuses were measured moving.

## Sep 28 2026, in four lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 28 2026".

- **Heavy salary selections are precomputed** in `wage_views` (5,000+ filings), in the SQL's own arithmetic.
- **Firewall rule 14 lets sign-in POSTs through**: flagged browsers were being challenged mid-sign-in.
- **A morning report is emailed daily** (health, runs, site, bills, traffic, errors) and a routine reviews it.
- **The entity load swaps tables in one transaction**, so no page reads a half-built table.

## Sep 29 2026, in twenty-two lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 29 2026".

- **The site runs on the Oracle server behind Cloudflare since Sep 28, 5:53 PM EDT.** Vercel and Turso
  are no longer in the path: every Vercel/Turso section in these notes above is history.
- **Every surface reads the central deadline rules**: dashboard, case cards, calendar, next-up box,
  reminder emails and Google Calendar sync. `deadline-agreement.test.ts` holds them together.
- **Notifications and emails are in sentence case**, built from one phrase table.
- **BotID, the Vercel IP helper, `vercel.json` and the Mac's launchd jobs are gone**; the server's
  systemd timers are the clock, and a test holds them to `jobs.ts`.
- **Nightly backups go to Cloudflare R2** (15-day expiry, 7-day lock) and a monthly restore test
  loads the copy; the morning report judges both.
- **The ETA 9089 expiration is certification + 179** (the date DOL prints), filled in on create,
  update and import; saved +180 dates were moved once.
- **The cases page has one Import / export menu**, phone cards open their dates on a tap, and the
  chat bubble sits in the corner above any bottom bar.
- **The database allows 256 MB replies**: sqld's 10 MB default killed the first full sweep after the
  move (its read is about 85 MB). Run each nightly job once by hand after moving the database.
- **A new visa bulletin refreshes its pages the day it's stored** (`/api/revalidate-bulletin`).
- **Every resource has a ceiling** ("Sep 29 2026: every resource has a ceiling" in v2/CLAUDE.md): crawlers
  60 pages a minute each and 120 together, 64 requests in the app at once, a page-cache cap, memory and
  CPU priorities with the database protected, time limits on every job, a Sentry budget.
- **nginx serves images and build files from disk**: it had been refused the folder (57,604 errors a
  day), and images counted against visitors' page limits. The service worker precaches two icons, not 18.5 MB.
- **Convex and the server's secrets are backed up nightly, sealed**, to R2; only the owner's Mac holds
  the key that opens them (`~/.config/permtracker-backup/`). Keep a second copy of that key.
- **The server is the only scheduled USCIS runner** (GitHub was refused six times of six), and the I-140
  quarter lives in `perm_docs['uscis_i140']`.
- **Every limit was set from a measurement, on the lax side** ("Sep 29 2026 (afternoon)" in v2/CLAUDE.md): background
  pre-loads never count as case lookups, people are slowed before refused, search looks at 5,000 filings, and
  Google and Bing sit outside the shared crawler pool.
- **nginx keeps its old rules when it refuses a reload, and systemctl says success**; the deploy counts a reload only
  when new workers appear. Rename a rate-limit zone rather than change its key.
- **The idle sign-out is 30 minutes** (OWASP ASVS 4.0.3 requirement 3.3.2, Level 2), and the compliance docs say so.
- **No limit is silent** (evening, detail in v2/CLAUDE.md): a lookup DOL couldn't settle, a capped list, a stale
  doc and a rate limit each say what happened and when to try again.
- **Nothing grows forever**: a nightly prune on the sweep and a daily Convex retention job; audit logs are kept on purpose.
- **The dev deployment's crons were the Sep 29 "[System Error]" emails** (still on Turso); `ADMIN_ERROR_EMAILS=off` there.
- **No email is refused and lost**: Resend's 100 a day is guarded once by the real count (list mail stops at 85,
  codes keep 15), every send goes through `sendOrQueue` and a fixable failure waits in `emailRetries`; the pools
  were raised (case confirmations 15 to 60, sign-in codes 40 to 80). The Sep 28 hit was real demand, not abuse.

## Sep 30 2026, in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 30 2026: one picture per load".

- **A loading.tsx renders the page's own loading component**; prerendered pages have none, and nothing
  above the fold animates in on mount (the keyed page transition is gone).
- **Public data tools render whole on the server** (`SearchParamsBoundary`); tables keep their rows while
  the next page loads (`usePublicQuery().previous`).
- **Signed-in pages stay warm**: `WarmAppQueries` in the app layout, and 5-minute reuse of visited pages.
- **The home curtain** is server markup first in `<body>`, lifts at DOMContentLoaded over the page; the
  header is one line from 400px up (desktop nav from 1280px).
- **Measured on production after deploy**, and the first build failed on a `loading.tsx` URL read: Next
  prerenders loading files, and only a build catches it; there is no local build, so watch the deploy's Build step.

## Sep 30 2026 (morning), in three lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 30 2026 (morning)".

- **Both timelines share one set of parts**: a sticky name column above everything that scrolls, 44px
  months on a phone, dates too close to tell apart in one square with a count, the key above the grid.
- **The morning report ranks only still-failing workflows**; one that failed and passed again is history.
- **Every loading.tsx is rendered the way Next's build renders it**, in a test, so a URL read outside
  Suspense fails locally instead of failing the deploy.

## Sep 30 2026 (midday), in four lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 30 2026 (midday)".

- **motion 13 and svix 2 are in**; svix is bundled into Convex, so its bump needed a Convex deploy.
- **`pnpm audit` found five advisories Dependabot hadn't**; the override floors are capped at their majors.
- **Timeline dates too close to tell apart share one numbered square**, kept inside the grid's edges,
  with the colour key above the grid.
- **IndexNow retries a server error, and the SSR audit judges inline styles only.**

## Sep 30 2026 (night), in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Sep 30 2026 (night)".

- **Anonymous visitors have a country again**, read from Cloudflare's edge; cookie-free mode had dropped it since Sep 28.
- **The header no longer loops on phones**: its height reservation resets on width changes only, with a 20 px scroll band.
- **The morning report reads browser errors and likely people**, not only Sentry and raw visitors.
- **Turnstile's automatic refresh is no longer counted as a failed check.**
- **The Security and Privacy pages and the compliance docs name Oracle and Cloudflare**, not Vercel.

## Oct 1 2026, in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 1 2026".

- **FLAG also serves H-2A, H-2B and H-2B wage cases from the same counter.** The walk and the gap sweep
  ask all twelve prefixes, they're stored in `seasonal_case_status`, and a run of them can no longer
  read as DOL's edge and stall the walk. Case lookups, embeds and alerts answer them too.
- **Entity links go only to pages that exist**; 132 404s in three days came from the decision feed.
- **A public `[param]` route needs `generateStaticParams`** or its `revalidate` is ignored.
- **The deploy renders the core pages and 300 busiest employers before it switches.**
- **`/perm-decision-activity` read a deleted source** and showed June as "the last 28 days".
- **The daily pulse** leads the homepage's data and the activity page; each sweep expires those pages.


## Oct 1 2026, in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 1 2026".

- **One list of every email** (`convex/lib/mailKinds.ts`) drives the emailed preferences page and Settings alike.
- **One breadcrumb bar on every public page**, named from the menus; never two BreadcrumbLists on a page.
- **Every chart shows detail on hover or tap**; public text is 14px; long notes are cut or folded.
- **Switching a calendar type off now removes its events**; the cleanup had never been wired to the settings page.
- **A large cleanup**: dead files, unused Convex functions and packages, retired mirrors, consolidated scripts.

## Oct 1 2026 (evening), in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 1 2026 (evening)".

- **The attorney page shows the app's real pages**, drawn in Storybook from a recorded sample firm.
- **Creating a case kept no job description, and Import lost nine exported fields**; both fixed and held by tests.
- **A filed case's recruitment card no longer reads "EXPIRED".**
- **The bulletin page no longer says "at least 0 ... may well be up"** on release-watch days.
- **Social cards hold no live figure**; the H-1B lottery, Employer Data Hub and SEVP data are loaded on the server.


## Oct 2 2026, in ten lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 2 2026".

- **The live site runs as two copies, one per CPU**; nginx splits pages between them and mirrors refresh calls to both.
- **Case lookups from everyone together hold at most 24 of the app's 64 slots**, so a scraper walking numbers can't fill it.
- **Analytics goes from nginx straight to PostHog**; the relay through Next was the MaxListeners warning flood.
- **Every error screen records what it caught** and reloads once by itself when a fresh load cures it.
- **The morning report counts people shown a "busy" page**, the signal for a bigger server.
- **Articles carry team bylines and their real updated dates**; every page asks for large image previews.
- **Meta's AI crawler reads at 30 pages a minute**, a third of other crawlers; it was the biggest load that wasn't a person.
- **Tencent Cloud (AS132203) must pass a Cloudflare browser check**; a scraper there filled the app at 2:42 AM EDT.
- **Email links go from nginx straight to the backend**, never stored (Cloudflare had kept them 2 hours), never framed.
- **A repeat click on a confirmation link says you're already on the list** instead of calling it invalid.

## Oct 2 2026 (morning), in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 2 2026 (morning)".

- **`/open-data`: the visa bulletin archive and DOL's processing-times readings** as CSV and JSON under CC BY 4.0.
- **The bulletin archive reaches June 2005** (237 bulletins, 20 months missing); paces stay measured from Oct 2014.
- **DOL's decisions per day reach October 2015**, from both case tables (`build_daily_decisions.py`).
- **An automatic defense** challenges whoever is turning people away, then Under Attack Mode, then stands down.
- **Onboarding's dates match the sample case**, and a new account is welcomed, not welcomed back.

## Oct 2 2026 (afternoon), in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 2 2026 (afternoon)".

- **A free JSON API at `/v1`** (keys from Settings > API keys) and **an MCP server at `/mcp`** (no key needed), both on `src/lib/api/`.
- **One shared read per answer**: an endpoint and its assistant tool call the same function; the scorecard and the API share `permEstimate.ts`.
- **Keys are hashed in Convex; calls are counted in the public-data database** under a random account id, never a user id.
- **Free plan: 10 calls a minute, 300 a day, 3,000 a month** (`convex/lib/apiPlans.ts`); Plus exists for comped accounts until billing.
- **`/developers` and `/api-terms`** document it; the Terms carve API use out of the no-scripts rule.

## Oct 3 2026, in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 3 2026".

- **The search pages work on Chrome 109 again**: no `AbortSignal.any` in browser code.
- **Sitemap dates come from git** (`scripts/page_dates.mjs`), and the deploy fetches the history to write them.
- **The nightly bulletin read only looks forward**; old history stays with the backfill.
- **DOL's pages refresh when any of its figures moves**, and every reading is kept (`processing_time_readings`).
- **The defense acts at 5 people shown busy in 10 minutes**, and Under Attack Mode waits 3 hours after any episode.
- **API entity answers carry their dates and the live queue**; caught errors record which requests failed.

## Oct 3 2026 (afternoon), in seven lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 3 2026 (afternoon)".

- **A 38-minute outage (12:46 to 1:24 PM EDT) was our own history loads**: sqld compacted its replication log until writes stalled. It runs with `--max-log-size 4096` now, history files load at a 2-second pace, and the watchdog takes the write lock every 2 minutes.
- **The counter has 19 prefixes**: `JO-A-300-` (H-2A job orders) and `C-500-` (CW-1 applications) were found in our own "no case" ledger; the ledger records which prefix era a miss covered.
- **DOL's H-2A, H-2B and CW-1 disclosure files** load like PW and LCA into one table, `seasonal_cases` (visa on each row; the workflow is "FLAG disclosure ingest").
- **SeasonalJobs.dol.gov's daily feeds** (accepted H-2A and H-2B applications and job orders, with wage and worksite) load into `seasonal_postings` on the server at 8:20 AM ET.
- **The defense's alert emails had all failed** (Cloudflare refuses Python's default User-Agent); and a full app no longer counts when the database, not traffic, is using the CPU.
- **Case-number shape rules accept `JO-A`** exactly, in all four copies and the date decoder.
- **Published H-2A, H-2B and CW-1 cases sync into the live table** like every other program's.

## Oct 3 2026 (evening), in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 3 2026 (evening)".

- **DOL's published H-2A, H-2B and CW-1 record reaches every surface**: the case lookup (decision, wage, workers, period, worksite), the all-programs search and its CSV, employer pages and the API.
- **Pending H-2A, H-2B and CW-1 applications show when DOL usually decides**, measured from its certifications (`seasonal_timing`).
- **A later decision wins whatever order DOL's files load in**: the writer upserts, and the load check counts the rows a newer file kept.
- **H-2A, H-2B and CW-1 reach October 2024; LCA reaches FY2020 Q2.** LCA FY2020 Q1 is held back by the load guard (yearly salaries under weekly and monthly units).
- **A summary written before a backfill stays stale until the next pass**; the seasonal one was rebuilt by hand.

## Oct 3 2026 (night), in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 3 2026 (night)".

- **Every employer that files only H-2A, H-2B or CW-1 has a page** (32,388), from `seasonal_employer_index`, built nightly. *(Superseded Oct 4: `employer_other_index` covers every employer with no PERM record.)*
- **They're all in the sitemap** as a fifth family, `seasonal-employer-N.xml`, and the case search links them. *(Renamed `other-employer-N.xml` on Oct 4; the old name still resolves.)*
- **Employer pages that aren't published PERM sponsors carry their own breadcrumb list**, ending in the employer's name.
- **Source lines name every dataset in words**; they had printed raw ids such as "h2a-disclosure:".
- **A wage that can't be pay for its unit** ($100,000 "per month") is shown as DOL printed it with a note, and left out of every average and median (`looksYearly`).
- **The case search's wage bounds and wage sort compare yearly figures**; they had compared DOL's raw amount across units.

## Oct 4 2026, in four lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 4 2026".

- **The shared fetcher honors robots.txt**; the H-1B Data Hub loader no longer reads the page USCIS asks bots not to.
- **The watchdog checks nginx's own `/__pt/nginx-alive`** and leaves web copies and nginx alone during a deploy.
- **The morning report groups runs by workflow file**, so a rename can't leave a fake "still failing".
- **I-485 and DOL processing-times limits come from measured agency delays** (160 and 30 days).

## Oct 4 2026 (midday), in nine lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 4 2026 (midday)".

- **One page per employer by name identity, across every program** (`employer_page_map`): rows reached a page by a name prefix, so Intel's counted 8,219 LCAs of three other firms.
- **About 182,000 employers with no PERM record have a page** (`employer_other_index`, ranks kept across builds; sitemap family `other-employer-N.xml`).
- **Law firms likewise** (`firm_page_map`); a firm page shows its H-1B LCAs, wage requests and the employers it filed for.
- **Each PERM sponsor's record is ranked part by part, with no single score** (`sponsor_index`); `/sponsor-finder` filters it.
- **City pages show H-1B LCAs, and a city with H-1B alone gets a page** (`lca_cities`); occupation pages show the job's LCAs.
- **The LCA file's prevailing wage and its source are read** and backfilled over every quarter; `/lca-wage-sources` and the case search's `wsrc` filter.
- **`/tools/ead-extension`**, and employer compare's switching panel states the regulations; it had the 180-day rule wrong.
- **Saved receipts on the USCIS lookup (in the browser only), who's waiting on the timelines board, and the civil-surgeon search linked.**
- **`sr-only` goes on a wrapper, never on a `<table>`**: a table can't shrink, and the pulse ran past a phone's edge.

## Oct 4 2026 (evening), in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 4 2026 (evening)".

- **A form's submit reads its boxes, not only React's copy** (`src/lib/forms/formText.ts`): Chrome for iOS left the copy empty while the box showed a name, and Search did nothing twenty times.
- **No search button answers a press with silence**: too short a name, an empty case box and an unreadable month each say so.
- **The /perm-cases month boxes lost a pattern no month could match** (a reader reported it): Firefox couldn't search with a month at all.
- **The defense's alert says what filled the app**, so "0 people" no longer reads as a false alarm.
- **robots.txt's `/api` blocked `/api-terms`** (a prefix); an allow rule re-opens it, and a test checks every public page.

## Oct 5 2026, in fourteen lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under the five "Oct 5 2026" sections.

- **Occupation pages show what O*NET says the job is, BLS market pay with DOL's four levels where it's filed, BLS's outlook, and DOL's levels year by year.**
- **City pages say which county, metro and DOL wage area they're in**, from Census's files, and BEA's price level (key installed Oct 5; 51 states, 387 metros, to 2024).
- **The wage-level tool keeps every DOL wage year since 2021-22**, both tables, from DOL's own files.
- **`/visa-issuances`**: State's monthly issuances since March 2017, each month checked against State's own total.
- **A law firm can claim its page**, verified by the email domains DOL's files tie to it.
- **A firm's own words wait for the admin's review** before they show (`pending` on `firmProfiles`); one email a day and the morning report say what waits.
- **A Chrome extension** shows a posting's employer record through the keyless `/v1/lookup/employer`.
- **One employer, whatever the spelling**: "Limited" and "Incorporated" are form words, and names that differ only in spacing are one company (Rule D); the build publishes its aliases so every join finds the page.
- **DOL's live wage search names a series by the June that closes it**; the tool had shown last year's levels since Sep 9 (`dolSearchYear`).
- **DOL levels labelled "Annual Wage", and unlabelled ones of $5,000 or more, are already yearly** (`toYearly`); never multiply them by 2,080.
- **A source line is a readable name, never a bare URL**: one pushed two pages sideways on a phone.
- **The deploy drops Cloudflare's copies of the pages a push changed** (`gsc_queue.mjs --purge`), once `CF_PURGE_TOKEN` exists.
- **Testing Library's cleanup runs from `vitest.setup.ts`**: the shared `unit` worker had left one test's render in the next.
- **Who visits** (Oct 5): about 350 to 900 likely people a day, 4,553 a week, 11,784 a month; Cloudflare's 865k requests are mostly blocked scrapers and crawlers.

## Oct 6 2026, in thirteen lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 6 2026".

- **Titles and descriptions say what people search, plainly**: chosen from 3 months of Search Console queries, no hype. The homepage title's Nov 7 freeze was lifted by the owner.
- **Employer descriptions lead with the cases still waiting** ("has 218 PERM cases waiting with DOL, 216 of them on hold"), from `perm_entity_pending`.
- **Industry titles are never cut mid-word** and carry the NAICS code, which is how people search them.
- **The case-status dictionary opens with a case lookup**: most of its visitors searched "perm case status" for their own case.
- **/faq opens with the case lookup and four tool tiles**: it takes much of the brand search, and its visitors go to those pages next. The case number box links
  to the employer search for anyone without their number.
- **A layoff notice no longer lands on a tiny namesake**: "Amazon" had matched a one-filing "AMAZON"; the lookup's namesake rule now applies.
- **The case page's answer card names the estimated date** with an "Email me changes" button; the record cards moved below the alert form.
- **Every account says who it's for** (practice, own case, other, no role) on the admin page and in the morning report (`convex/lib/audience.ts`).
- **"Waiting on my own case" leads onboarding** and watches the case on the account's own address in one step (`caseAlerts.watchMyCase`).
- **A case's last alert asks for a 1-to-5 rating**; the box opens `/case-alert/rate`, and only the tap there records it (`convex/alertRatings.ts`).
- **Every entry page leads to a case**: `CaseNextStep` (case-number box) under the header of employer and law firm pages, on month pages, and at the end of every article.
- **Every article had ended with a sign-up button**, sending people waiting on their own case into the attorney app; it leads with the case lookup now.
- **The funnel is counted**: `case_lookup_submitted` and `alert_signup` events in PostHog (no address is sent).

## Oct 7 2026, in twenty lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 7 2026".

- **The automatic defense was blind after every nightly log rotation** (nginx's workers couldn't reopen files in a 750 folder), had no free Cloudflare rule slot, and counted crawlers' 503s as a full app; all three fixed.
- **Case lookups under the frozen Windows Chrome 151 label get 30 a minute together** in nginx: a scraper on 2,153 addresses passed Cloudflare's checks under it.
- **Cloudflare's rules 3 and 5 are one rule now**, so the defense's own rule has a slot (4 of the free plan's 5 used).
- **Loading screens sweep** (owner's call), and the case page's loading state is the answer's own shape at its measured heights.
- **Alerts within minutes**: watched cases are asked about every 5 minutes on weekday working hours (the server, not GitHub), a status change is always emailed at once, and DOL's processing times and the visa bulletin are read hourly through the weekday.
- **The structured data was checked against Google's own rules**: the Organization carries every field we can fill, the app category is one Google accepts, list pages use Google's list shape.
- **The data rail's groups have icons and page counts**, and collapsed it's a strip of the group icons that opens the rail at the group chosen.
- **The scorecard reads as sentences** (`scorecard/verdict.ts`): who's closer, whether the split could be luck, what grading only decided cases hides, and a grade; the morning report quotes the stored sentences.
- **A case DOL's queue has passed is dated by the measured rate** DOL finishes those cases (the backtest: 6 days typical against 29 for DOL's average), and every range quotes its measured coverage (29% of 8,023), never a typed figure.
- **NOR ISSUED is a rejection, and an "In process" H-2A/H-2B/CW-1 case DOL's file has decided is finished**: 3,155 rows had read as pending. The sweep is the one writer of the flag; DOL's status word is never rewritten.
- **The case search applied only the decided range to wage-request, LCA and seasonal files** on a firm, state or occupation search; every filter applies now, and industry and city search every program's file (backfilled tonight for 13 LCA quarters and all three wage-request files).
- **Every estimate is graded or tested**: H-2A, H-2B and CW-1 recorded once each in its first week, a weekly seasonal backtest (H-2B now reads the same season a year earlier; pooled held 21%), a weekly bulletin backtest of "months until current" (a year out: typically 8 months off, 1 time in 4 within a quarter, printed beside the figure), and alarms in the morning email.
- **Wage-request, LCA and seasonal results offer browser push and an alert on a number not found yet**, like PERM; law firm pages carry H-2A, H-2B and CW-1 work; CW-1 is in the glossary.
- **The change feed and decided days read H-2A, H-2B and CW-1**, and the visa bulletin's release day is recorded before each bulletin and graded on the day the site first holds it.
- **Next 16.3.8** (six advisories, two of them about self-hosted caching and the image optimizer); 16.4.0 is out and not taken.
- **Admin alert lists say when each person signed up and confirmed**, and paged lists bring their new rows into view.
- **Every employer page shows DOL's debarment and layoff notices**, the live-only and no-PERM pages too; WARN notices link 485 of 3,168 now (276 before).
- **The local suite runs vitest only; CI also runs the 70 Python script tests**, and one reads `changes.ts`: run them before pushing a file a Python test reads.

## Oct 7 2026 (night), in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 7 2026 (night)".

- **A case alert keeps watching for a year after DOL decides** (an appeal or a reversal is emailed; a certification lapsing isn't), then retires; the 41 rows retired the old way are back on watch.
- **Every DOL status is classified** (ARCHIVED job orders and the Board's decisions are final; 741 rows healed), and the health check warns on any new one.
- **The green card line's years figure is back**: the stored Table V year predated the per-country parser; a held year missing a field is read again.
- **Priority dates: our pace beat dividing by yearly visas** on the 9 USCIS reports held (66 to 8 at 3 months, 42 to 3 at 6), not yet settled.
- **The PERM range held 29% because it's narrow and late**; 7 days either side of the date held 77%. Widening it is the owner's call.
- **H-2A, H-2B and CW-1 decisions per day** chart on `/seasonal-cases`, with two guides; the case browsers fit a 320 screen.

## Oct 8 2026, in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 8 2026".

- **The PERM range is measured by distance, every night, and never wider than 60 days**: near the front the date 6 days early to 13 late, judged at two weeks; farther out the pace rule, bounded, says it's untested. Two clocks run the test; nothing falls back on age.
- **Wage requests get a day**: requests in process filed earlier over DOL's measured exits (typically 2 days off on its first test); the month is the fallback.
- **Each subscriber's date is recorded once** (`watched`), never put to a rival, counts only in public.
- **An RFI case is dated from its own RFI day**: the 30-day window, then a median 4 days (1,021 RFIs followed); the slow end is the attorney's two weeks until measured. NORD is never expanded.
- **The filing chart lost to the pace** as an early signal (3.0 months against 2.7 on 4,152 readers).
- **H-2B applications in DOL's assignment groups are dated by their group** (`ingest_h2b_groups.py`): typically 5 days off on January 2026, against 25 for the season method.

## Oct 8 2026 (afternoon), in seven lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under the two "Oct 8 2026" afternoon sections.

- **The deploy waits for the full test suite** for its exact commit (`oracle-deploy.yml` builds meanwhile); a red suite had deployed twice that day.
- **CI runs the suite in three parts at once**; `Typecheck + Vitest` is now the job that passes only when every part did.
- **Tests got faster**: three budget tests from 171 s to under 2 s (`fillRateWindow`), and the happy-dom projects pre-bundle their heaviest packages (a sample: 135 s to 63 s).
- **`pnpm check`** is the quick look before a push: typecheckers, pyflakes, data script tests, and the vitest tests affected since `origin/main`.
- **A Node package and CLI, a Python package, a Claude Code plugin and an admin Developers tab** are built, none published: npm, PyPI and listings wait for the owner.
- **Every step is timed** (commit 1 s, push 11 s, `pnpm check` 2.2 min, CI 2.2 min, push to live about 10 min) and the morning report prints the CI and deploy figures daily.
- **A redeploy of the same commit deleted the live release's folder** (2:19 PM EDT, 31 errors, rolled back at 2:21): the deploy now refuses a release id a slot runs from, and each run names its own.


## Oct 8 2026 (night), in seven lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 8 2026 (night)".

- **The head-to-head settles a waiting case once today passes the midpoint of the two dates**, gives each side a floor, and splits by kind: in DOL's line we beat all three rivals; Rival A's lead is cases the queue had passed, where it answers "today".
- **The nightly backtest scores "today" beside our rate** on passed cases; retired methods say so in every reading.
- **"reading 'call'" hits about 3% of real desktop Chrome and Edge sessions**, at load, inside a prefetched route's chunk, never on the headless scraper; the chunk graph is complete. Each event now records duplicate chunk pushes and foreign scripts (a browser extension sharing `webpackChunk_N_E` is the suspect).
- **Employers under review leads with DOL's newest move**; the case page draws the line ahead by month; data pages carry one line offering the free alert.
- **A filing month leads with its share decided** and reads `perm_docs['month_detail']` (decisions per day, where DOL has reached, the initials grid), written after every sweep.
- **The MCP door gets about 1,800 requests a day, almost all directory and uptime bots** found through the MCP Registry; 3 to 30 real tool calls a day.
- **The lookup challenge stops the scraper label completely** (1 of 2,148 addresses through) and costs a real visitor about 2 to 3 s; whether to loosen it is the owner's call.

## Oct 9 2026, in fourteen lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under the four "Oct 9 2026" sections.

- **`/h1b-employers` and a page per state rank the 100 busiest H-1B employers each fiscal year** two ways: DOL's certified LCAs (FY2020 on, by worksite) and USCIS's approvals (FY2009 on, by petitioner), from `h1b_employer_ranks`, rebuilt after each LCA load and Data Hub read.
- **A state view shows only the ranked source's figures**: the two sources mean different things by state.
- **Layoff notices moved to Denials and audits** in the data rail, which had run out of height.
- **USCIS's abbreviated names now reach employer pages** ("SVCS", "TECH SOLNS", "UNIV"): 413,406 H-1B approvals that sat on no record, Tata's and Cognizant's among them.
- **A page left open refreshes its figures when the reader comes back** after 30 minutes (`RefreshWhenStale`, public layout and embeds): a phone showed Oct 2's homepage on Oct 9 while the server, Cloudflare, the browser cache and the service worker all held Oct 8.
- **DOL's average and queue month are never typed into prose**: `<DolNow />` in articles, `lib/dolNow.ts` on the FAQ, and `no-typed-dol-average.test.ts` fails on a typed one (seven places said "372 days as of August 2026"; DOL said 336).
- **next-mdx-remote 6 strips JavaScript expressions by default** (`blockJS`), so every `rows={[...]}` table and step number was missing from 47 articles since Feb 12; the site's own MDX sets `blockJS: false` and keeps `blockDangerousJS`.
- **The data pages' Q&A takes live figures** (`PageBasics figures=`); typed counts there had drifted (437,496 LCAs against 3,754,961 held).
- **The changelog runs to Oct 9** in five new entries, and older ones are in sentence case with one category scheme.
- **nginx answers PHP and WordPress paths with its own 404** (a scanner's POST made Next answer 500), and PostHog drops errors from a wallet's or an app's in-app bridge.
- **The developer platform's next phase is live, and free**: key scopes, sandbox keys, exports, live lookups and signed webhooks; `PAYWALL_ENFORCED` is unset, so every account gets Plus, and the webhook functions answer only the site's server (`API_SERVER_SECRET`).
- **The morning report tries PostHog again after a busy reply and ends long lines at a sentence**: two one-off errors had blanked a section for the day, and Convex keeps only 400 characters of each line.
- **An outbox row waiting with no attempts is the one-alert-a-day rule at work**: it goes on the first bundle run of the next Eastern day.
- **Replies to support mail go through `supportEmail:replyToEmail`** (threaded, counted, marked replied), never from the Gmail it's forwarded to.

## Oct 10 2026, in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 10 2026".

- **The disk filled (about 5:20 to 8:27 AM EDT)**: Next 16.3 writes pages to `.next/server/route-cache`, which the page-cache cap couldn't see; pages kept serving, the database refused writes, nothing in the corpus was lost.
- **`permtracker-alarm` emails the owner within 5 minutes** for disk, memory, failed jobs, a silent sampler, a stalled cap or a late backup, and fixes the disk first; it never writes to the disk it watches.
- **Convex watches the server from outside** every 15 minutes (`serverWatch`), so a server that can't report is still heard.
- **A run that fails and carries on ends red**: two failed doc writes or a lost run row, or any step noting a failure.
- **Each slot's page-cache budget is split between its two copies**; at 60 GB a folder the live slot alone could take 120 of 145 GB.
- **The disk is 150 GB of Oracle's free 200 on purpose** (owner, Sep 28): the rest is room for a second free server, and a disk never shrinks. The alarms are email only.

## Oct 10 2026 (afternoon), in ten lines

Audit 12 and a full review of everything since Aug 23; detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 10 2026 (afternoon)".

- **A failed read is never "no record"**: the case search names what it couldn't read and answers 503 when it read nothing; debarment, layoff, history, wage-history and identity-map reads throw so a page keeps its last good render.
- **Two sweeps at once can't send one change twice**: case alerts and browser push claim a send first.
- **Public Convex functions that take an IP or an email to count answer the site's server only** (`convex/lib/serverDoor.ts`), and the per-IP sign-in limit runs at last: Convex Auth had answered `/api/auth` before it.
- **Mail anyone can set off stops at 55 of the 85**, so alerts keep 30; **API exports count rows**, 20,000 a day on Plus.
- **Opting out drops queued retries too**, and a held alert bundle no longer stalls the addresses behind it.
- **The health check reads a failed run for 40 days**, counts `mismatch`, fails on unreadable tables, and calls a stale self-dated dataset our ingest stopping.
- **The PERM and wage-request sweeps go red on checking nothing**, as the watched-case check, the alarm and the cross-check now do.
- **The disk alarm counts what the page-cache cap still allows**: a cache refilling toward its budget isn't the disk filling (it emailed a false "full in 12 hours" on Oct 10).
- **Push endpoints must be browser push services**, unknown API keys can't flush the real keys' cache, and webhook failures on our side aren't charged to the developer.

## Oct 10 2026 (night), in four lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 10 2026 (night)".

- **The "reading 'call'" crash was old navigation data in the browser**: nginx passed Next's year-long
  `stale-while-revalidate` to browsers, and Next loads the chunks a response names before checking its deployment.
- **Browsers now get `public, max-age=0, must-revalidate`** for shareable responses (nginx); Cloudflare's own copy is unchanged.
- **Each deployment's scripts register in their own list** (`chunkLoadingGlobal`), so files from another build can't touch the live page.
- **Cloudflare does store navigation data** (`?_rsc=` answers MISS, then HIT); the Oct 5 note saying BYPASS had measured a redirect.


## Oct 11 2026 (early morning), in seven lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 11 2026 (early morning)".

- **The films' posters show the product again**: the Oct 7 re-cut had left both as the same logo slide with no Play control; `scripts/make-film-posters.mjs` rebuilds them from the films' frames.
- **Data pages: the alert offer is a lime "Watch my case" tab in the breadcrumb bar** (a bell square on phones), and the rail's toggle is an icon inside the rail; the box above every heading and the tab hanging off the rail are gone (owner: "weird and awk").
- **The homepage queue tape fills in once** when it first scrolls into view (`TapeReveal`): drawn filled on the server, armed only below the fold, off under reduced motion.
- **The glossary opens with a map of its terms** along the six stops to a green card (`glossaryStages.ts`, every term placed once by test).
- **Status meanings and the RFI page show each count as the row's number**, with a bar (status page) or its own date (RFI glossary); methodology draws its six readings as bars; the RFI page draws 325 vs 336 days.
- **/press and the firm's-site section stay as they were** (owner's call, after a redesign he undid), with two bug fixes kept and today's real hold count in the newspaper specimen.
- **Tonight's before/after boards** are on the Design canvas "PERM Tracker page redesigns"; prose share per page is on the dashboard "PERM Tracker redesign tracker".

## Oct 11 2026, in five lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 11 2026".

- **Guides and blog posts are filed by topic** (`src/lib/content/topics.ts`), listed one section per topic, titles in sentence case.
- **Every article picture and recording is its own and credited**: 84 headers, 81 inline figures and 5 app recordings, made by scripts from recorded sources; a test fails on any repeat.
- **Breadcrumbs name detail pages and end on an article's title**; legal pages share one frame; data pages start at one left edge.
- **Statuses come from DOL directly, I-203 is the E-3 LCA**: two wrong claims corrected on the site and in alert emails.
- **Hovered lime text uses the lime ink in light mode** (it was 2.05:1 on paper across 151 files).


## Oct 11 2026 (morning), in four lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 11 2026 (morning)".

- **Every email, notification, toast and confirmation reads in one voice**, gated by `email-voice.test.ts`; times in emails are Eastern.
- **DOL's wage-request wait is read live** in articles (`<DolNow show="pwd" />`); the typed "4 to 7 months" is gone and gated.
- **The health check lists units stopped after an error**, judges the database folder by sqld's own rules, and warns on swap only when it moves.
- **The demo account's alerts no longer loop through the support forward**; the contact form still reaches support.

## Oct 11 2026 (afternoon), in six lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 11 2026 (afternoon)".

- **Employer pages come in named parts**: a profile header (main job, worksite, industry, what changed as tags, the case box beside the name), a sticky bar of seven parts, one heading each (`ProfileHeader`, `Chapter`, `ChapterNav`).
- **A 70,000-view X thread quoted our Microsoft and TCS LCA lists**; DOL's live service matched 10 of 10, and 100 of 100 sampled held Microsoft cases.
- **Every pending-filing list names DOL's case-status service inside its own box** (`FromDolLive`), so a screenshot carries its source; no copy says "DOL's daily check".
- **The small calculators show the answer's shape before any input**: date tools draw a ruler (`DateRuler`), wage levels a ladder, offers a strip, lottery odds the level chart; the lookup embed shows the case-number diagram and DOL's figures.
- **`pnpm check` misses gates that scan the whole tree** (glued text, grid tracks): two pushes went red on them. Run `pnpm exec vitest run src/app/__tests__` before pushing a new component.
- **Chrome repeats the page top past 16,384 px in a full-page capture**: capture long phone pages in viewport steps.

## Oct 11 2026 (evening), in eight lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 11 2026 (evening)".

- **List pages open with their answer**: `IndexHeader`/`IndexSearch` (figures beside a search box that lands in the table filtered) on employers, firms, wages, PERM cases, wage requests and LCAs; occupation pages get the employer page's named parts.
- **IndexNow is told what changed, not all 311,450 URLs every deploy**: `gsc_queue.mjs --indexnow-list` after a deploy, the moved employer pages after the nightly sweep; a manual run still sends everything.
- **`gsc_queue.mjs` had dropped every changed article missing from `known-routes.json`** (44 of 55 guides); articles count by their file now.
- **Article pictures are re-shot when the page they picture changes**, and `article-pictures.test.ts` checks each figure's stated aspect ratio against its file (seven were off).
- **A screenshot captioned as live is a claim**: the on-hold guide's Sep 3 stage counts said "updated daily" under a live table with other numbers; removed.
- **Charts replaced long row lists**: decisions per month and quarterly outcomes as columns, state wages as ranges, the bulletin archive as a calendar, layoffs by publishing state (not by month: the states' windows differ).
- **Article cards lie on their side on a phone** (/guides 25,443 to 12,368 px).
- **The dev server's Turbopack cache filled the disk again** (5.9 GB, 36 MB free): stop it and `rm -rf .next/dev/cache` between long QA runs.
- **Bulk captures of production helped trip Under Attack Mode** (6:37 PM EDT): 795 page loads in 45 minutes from one Mac beside a challenged crawler. Capture the dev server instead.

## Oct 11 2026 (night), in eight lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 11 2026 (night)".

- **"Did you mean" wherever a search can come up empty**: one matcher (`src/lib/fuzzy.ts`: typos by word length, swapped letters, spacing, whole words first), and `/api/suggest` over every employer, law firm and occupation name.
- **Equally close names give way to the busier one**: "amazn" means Amazon, not a two-filing "AmazngCleaning".
- **The 404 reads the address that missed** (a mistyped page or article, or a missing employer, firm or occupation turned into a search of that family) and has For attorneys and Search every filing doors.
- **A 2.6 MB read starved inside a busy web process** (20 s+ where the database took 0.19 s): big loads go in small windows with the event loop let go between them, and a search never waits out a first load.
- **About is rebuilt** around the person, both halves as the app's real pages, the sources as a flow, the dated record, and one contact band; "nothing is modeled or crowd-sourced" was false and is gone.
- **Long lists fold**: OPT employers (23,693 to 5,173 px), the scorecard's readings, 33 identical bulletin sentences as four chips.
- **A table cell's fill can say its state**: the bulletin matrix tints Current and Unavailable, with a key.
- **The dev capture scripts live in `node_modules/.cache/qa/`**: `top-shot.mjs`, `dark-shot.mjs`, `embed-shot.mjs`, `load-shot.mjs` (for pages that never go network-idle).

## Oct 12 2026, in twenty lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 12 2026".

- **One scraper was about 60% of page requests**: about 70,000 addresses, 335 browser labels, employer pages 96% of the time, never running the site's scripts; it set off Under Attack Mode three times in 12 hours.
- **Cloudflare rule 4 checks Mac Chrome 119 to 133 too**, and **the defense challenges one overloaded part of the site before the whole site**; nginx's defense log records the path a visitor asked for (`$request_uri`), where it had recorded the busy page's own `/503.html`.
- **The build-file prune no longer takes files the live site still uses**: each deploy dates the files it ships.
- **The cron dispatcher waits out a busy site** instead of failing on the first 503.
- **Alert ratings are on**: a case's final alert asks for 1 to 5.
- **Oracle's disk copies stay inside the free five**: Oracle's schedule (`permtracker-daily-keep3`, re-attached Oct 13)
  makes one a night, and `permtracker-disk-copies` (3:45 AM ET) checks it's there and free, deletes down to 3 (billed
  first) and re-attaches the schedule if it's ever detached; the one copy the job made itself was billed. The server's
  Oracle identity holds `manage all-resources in tenancy` since Oct 13 (owner's call).
- **The Terms say Settings deletes an account** (30-day grace), as the Privacy Policy did; they had said "by contacting us".
- **Signed-in users can switch usage analytics off** in Settings > Support; the account's browsers then send PostHog nothing.
- **The assistant's models had retired** (Gemini 2.0 Flash, Groq's Llama 3.3, OpenRouter's free GLM; Mistral and Cerebras refuse
  free requests): the chain is six models checked live on Oct 12, and a retired model now reaches Sentry the first time it fails.
- **The budget email names the limit that held**: the site's 55 sign-up emails a day, or the pool's own count.
- **A sitemap file past the last one answers 404**, not a 500 that pages Sentry.
- **The chat's changes are checked before they're shown and approved once** (`src/lib/ai/caseActions.ts`,
  `convex/chatConfirmations.ts`): a stage the dates don't support asks for the date; a card runs the change the server
  stored, once; the result is read back from the case. Archive closes and never deletes.
- **Closing sets the override and the closure trail; reopening hands the stage back to the dates**, from the cases page too.
- **The weekly case summary stays on Monday for every account** (owner's call, Oct 12: a split across three days was tried and
  undone), **and goes only in a week something changed**: a case updated or a deadline passed in the last 7 days.
- **One switch puts every email saving back**: `EMAIL_DAILY_LIMIT` on Convex above 100 (a paid plan's daily figure) sends
  the weekly summary and newsletter every week and scales every ceiling, pool and batch (`convex/lib/emailAllowance.ts`).
- **The sample case sends nothing**: no reminder, alert, status email, auto-closure or calendar event; and a weekly
  newsletter with nothing new since the last issue is stored as `skipped`, not sent.
- **The site's own test accounts get no notification mail** (`isOwnTestAddress`: every `@permtracker.app` address but support@).
- **Inbound mail and alerts to the owner go through Cloudflare, free** (`workers/mail/`): the root MX is Cloudflare's,
  a Worker forwards and stores every message, and owner mail falls back to Resend only if the Worker fails. Any email
  addressed to one of the owner's inboxes (`SECURITY_ALERT_EMAIL`, `OWNER_INBOXES`) goes through the Worker, the
  contact form included; sign-in codes are the one exception.
- **After a reload the chat sends the newest saved turns with each question**, and an interrupted turn whose action ran
  is saved and never re-run by Try again (`useChatWithPersistence`, `src/lib/ai/chatTurn.ts`).
- **The chat has a per-account quota and bounded storage** (`convex/chatQuota.ts`, `convex/lib/chatLimits.ts`), its
  panels are real dialogs, and a deleted conversation leaves no words in the audit log.


## Oct 13 2026, in four lines

- **The homepage board and the daily pulse lead with DOL's last working day** (`isDolWorkday` in `src/lib/pulseStats.ts`):
  on Columbus Day the board read "Decided Oct 12: 11", and a weekend did the same every Monday morning. A holiday after
  it is named ("Monday, Oct 12 was Columbus Day, a federal holiday: DOL was closed"), and no holiday counts toward a typical day.
- **Sign-ups may use 70 of Resend's 100 a day, alerts keep 15 above that** (`ALERT_RESERVE` 30 to 15 in
  `convex/lib/emailLimits.ts`, owner's call 5:17 PM EDT): sign-up confirmations had waited until 8 PM two days running,
  and each night's leftovers spent the next morning's room. Sign-in codes keep the last 15.
- **"Maximum update depth exceeded" (#185) comes from pressing Back several times quickly.** React renders a Back
  transition synchronously, its 50-commit counter overflows, and whichever update lands next throws (the header's scroll
  listener 7 of 9 times, Next's router once, the scroll bar once). The header now touches React only when the bar
  changes and `ScrollProgress` draws without state; Next's router can still be the one that throws.
- **Next 16.4.0** (owner's call, to test the router side of #185): its Back button now goes through React's popstate
  path (vercel/next.js #99612, read in the installed code), page caches still go to `.next/server/route-cache`, and the
  whole suite passed (9,686 tests). `eslint-config-next` moved to 16.4.0 with one resolver exempted from pnpm's trust
  check by name (`.planning/VERSION-DECISIONS.md`). Whether #185 stops is a count to read in PostHog over the next week.

## Oct 14 2026: the calm redesign, in eight lines

Branch `calm/phase-1`. The rules, parts and gates are in [`v2/docs/DESIGN_SYSTEM.md`](v2/docs/DESIGN_SYSTEM.md).

- **One flat page, plain type, one lime for the main action**: no particles, dots, grain, progress bars, curtain, hard
  shadows, hover lifts, all-caps labels or self-running motion. `calm-system.test.ts` fails the moment one comes back,
  and checks every text token against every surface in both themes.
- **`--border` only groups; `--input` outlines controls and draws value marks** (3:1). The old border was ink, so marks
  drawn in it vanished when it lightened; medians, ticks and split points use `bg-input` or ink.
- **One header search and one palette** for the public site; **⌘K in the app** searches the account's own cases through
  `cases.listFiltered`, the cases page's own matcher. `/case-search` shows the employer, firm and job pages a name can
  mean beside its filings (`NameGroups`), and a firm's page opens it with `?firm=`.
- **Case results are short cards on a phone** (Find a case, the PERM, wage-request and live browsers): a 1,200px table
  had shown a phone the case number and nothing else.
- **The database code is no longer named after Turso**: `src/lib/db/`, `scripts/lib_db.py`, and `DATABASE_URL` /
  `DATABASE_AUTH_TOKEN` / `DATABASE_RW_AUTH_TOKEN`, each falling back to the `TURSO_*` name production still carries.
  **When this ships, reinstall `/usr/local/bin/permtracker-uscis` from `scripts/oracle/bin/`**: the installed copy
  imports `lib_turso`, which is gone, and its "record ok" step would fail. (Done at go-live, Oct 15 2026.)
- **One list of month names and one way to write a date** (`convex/lib/months.ts`): fifteen copies wrote "September 11,
  2026" their own way, some through `toLocaleDateString` without a time zone (the next day east of UTC+12).
- **Every link uses `.link`**, every choice row `choiceVariants`, every hatch `bg-hatch`; corners are square except
  what's round by nature (dots, spinners, the switch).
- **The Storybook adapter is patched for Next 16.4** until a fixed release clears the release floor (`.planning/VERSION-DECISIONS.md`).

## Oct 15 2026: the calm redesign, accessibility and pictures, in nine lines

Branch `calm/phase-1`, not live. Detail in [`v2/docs/DESIGN_SYSTEM.md`](v2/docs/DESIGN_SYSTEM.md).

- **`scripts/audit_axe.mjs`** runs axe-core to WCAG 2.2 AA over rendered pages, both themes, 1440 and 390, and exits 1
  on anything serious (`@axe-core/playwright`, a dev dependency, owner's yes Oct 14). Run it against the dev server.
- **A table that scrolls sideways is a `ScrollBox`** (a named region with a tab stop) unless it holds a link or button;
  a wide chart passes its scroll box's classes to `ChartTips` as `scroll`. `scroll-boxes.test.ts` holds it.
- **Nothing pressable sits inside a `<summary>`** (`no-controls-in-summary.test.ts`): a count that links goes inside the entry.
- **A chart's `<svg>` with hover marks is `role="group"`**, never `role="img"`, which hides what's inside it.
- **Text on a status or stage fill is black in both themes** (the fills lighten in dark mode), white on the slate fill.
- **Social cards are drawn from `scripts/page-cards.json`**; `capture-card-shots.mjs` frames each from its H1, or from
  the heading a card names in `from` when the H1 carries a live figure.
- **The app's pictures are measured, not cut by pixel**: `scripts/capture-tour.mjs` writes each crop from the page's own
  headings into `crops.json`, and `tour_shots.py` encodes from it. Storybook's dark theme is set by `&globals=theme:dark`.
- **The text and heading audits skip hidden, inert and aria-hidden subtrees**: the header's closed Data menu had added
  250 to 430 "visible" words a page, and a dev server's hidden streamed copy doubled every heading on 60 pages.
- **The case page's card titles are `h2` headings**, and its name wraps the buttons below it on a phone (it had broken
  one letter a line).

## Oct 15 2026: the estimates on DOL's days, and two changes the data turned down

Branch `calm/middle`, not live. Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 15 2026: the estimates".

- **Our morning sweep reads DOL's decisions the day after DOL makes them** (20,803 of 22,425 wage-request
  decisions in a month were first seen 5 to 6 AM): `decided_on` in `scripts/lib_holidays.py` (seen before noon
  Eastern is the day before) and `decidedOnFromSeen` in `src/lib/scorecard/score.ts`, held equal.
- **The wage-request day counts the days DOL works** (`estimatePwdDay`, model `pwd-workday`; `pwd-day` retired):
  typically right on the day with no lean on both start days tested, where the calendar walk ran about 2 days late.
- **H-2A is counted from filing when the first day is more than 75 days out or too close for the usual lead**,
  and a passed typical day reads "any day now" (and is recorded as today).
- **Tested and not changed:** recent windows for H-2A, H-2B and CW-1 (no gain; H-2B much worse), and the
  passed-queue rate's window (14 days stays; its small lean changes sign week to week).

## Oct 15 2026 (evening): the middle-ground redesign is live

- **Live at 6:04 PM EDT** (fe78aab2, owner's yes): main fast-forwarded from `calm/middle`, Convex deployed once
  main's suite was green, the USCIS runner reinstalled at `/usr/local/bin/permtracker-uscis`. The record and what's
  left: `.planning/calm-go-live.md`.
- **Checked before the switch, on the dev server against production data:** headings over 169 pages, run-together
  words over 119 (0), visibility one page per template (82); every finding traced to the audits, which were fixed.
  A full-sitemap visibility walk on the dev server takes hours (30 s a page); one page per template is the unit.
- **The case-number links in employer filings lists are 44px on a phone** (`CASE_ROW`, `CASE_ROW_LINK` in
  `src/components/entities/caseRows.ts`); they measured 20px live.


## Oct 16 2026, in nine lines

- **`/uscis-rfe-rates`**: USCIS's quarterly I-129 request-for-evidence files (spreadsheets, a CSV and older PDFs), every
  visa by month since October 2014 (`scripts/ingest_uscis_rfe.py`, table `uscis_i129_rfe`, doc `uscis_rfe_summary`).
  Each file must add up to its own totals or nothing is written; the server's quarterly USCIS job reloads the newest
  file, and `--history` reloads every year (run once Oct 16: 1,362 rows, FY2015 to FY2026 Q3).
- **The RFI page says what happens next, step by step** (`stage_stats.rfiPath`, written by the sweep; `src/lib/stageMoves.ts`):
  the RFIs our sweep watched DOL issue, how they ended, and where every review stage leads.
- **A page the browser has translated keeps working** (`src/lib/translateSafeDom.ts`, before hydration): Chrome's and
  Safari's Translate move text nodes React holds, and React's next update threw NotFoundError (5 visits in a month, all
  in other languages). Each time the guard steps in it's counted once a page (`dom_guard_stepped_in`).
- **Chrome for iPhone files its own scripts' errors under the page's address**, at lines past the page's end (a 130-line
  page, frames at lines 192 to 495): check the served HTML's length before blaming our code (`fromInjectedPageScript`).
- **React #419 on the case page follows a Cloudflare challenge** (`__cf_chl_tk` in the referrer, 5 in 44,880 post-challenge
  views) and the page still renders; left alone.
- **Onboarding's writes retry twice** (`retryBriefly`, 1.2 s and 3 s): Sentry 57 failed twice in a row during a token refresh.
- **A case folder lifts and two sheets rise out of it on hover** (`.manila-papers`, a pointer that can hover only; under
  reduced motion the sheets just show). A new component: run `pnpm exec vitest run src/app/__tests__` before pushing,
  because `pnpm check` skips the whole-tree gates; the glued-text gate stopped the first deploy (the suite gate held).
- **resend 6.32.1, svix 2.8.0, tailwind-merge 3.7.0, zod 4.6.5** (Convex deployed with them; Resend still returns `{error}`,
  Svix still refuses an unsigned or forged webhook with 401, checked live).
- **A scrolling chart can open at its newest end** (`ChartTips startAtEnd`): a 141-month chart opened at FY2015 on a phone.

## Oct 17 2026, in sixteen lines

- **The PWD expiry limits a case only while recruitment hasn't begun inside it** (20 CFR 656.40(c) as BALCA read it in
  Karl Storz, en banc 2011, and MPHASIS, 2015; the attorney confirmed): `pwdBearing` and `pwdStepLimit` in
  `convex/lib/perm/dates/pwdValidity.ts` are the one place. Production windows were recomputed (`filingWindowRecompute`).
- **The 180 days count a professional job's additional steps** (656.17(e)(1)(ii)); the notice of filing counts by its own
  rule, 656.10(d)(3)(iv), and can't be the first recruitment step.
- **Nothing pushes an iPhone's page sideways**: iOS Safari pans past `overflow-x: hidden` on `html`, so `body` clips
  (`overflow: clip visible`, which keeps sticky working) and selects never pass their box (`@layer base`, or it beats
  every utility). `no-sideways-pan.test.ts` holds both. Measure each element's own box: Chrome reports no overflow.
- **Every public page says when it last changed, the same day everywhere** (`src/lib/pageDates.ts`): the sitemap's
  lastmod, "Updated <day>" at the end of the breadcrumb line and a WebPage `dateModified` all read `pageDate`. The public
  layout reads the data days once (`getDateSources`); employer pages, bulletin months and the H-1B rankings date
  themselves and render their own bar, as articles do. `audit_all_pages.py` checks a page's three dates agree.
- **Entity, group and bulletin-month lastmods take the template's day when it's newer** than their data, and the
  homepage, the queue, the review stages, activity and under-review pages follow the sweep, whose figures they print.
  **A template's day is set by hand** (`TEMPLATE_DAY` in `src/lib/pageDates.ts`): move it only when a change alters
  what every page it serves says. Git's day would re-date ~78,000 employer URLs on any shared-component commit.
- **Googlebot crawls 25,000 to 45,000 pages a day since Oct 13** (about 3,500 before) and meets the 12-at-once search
  limit: 15 to 19% refused on its busiest days, which is Search Console's "Server error (5xx)". Each deploy starts
  the page cache empty, and Oct 16 to 17 had ten between 10:35 PM and 3:12 AM. Batch deploys at night.
- **Employer pages answer "does it sponsor green cards"** from the year's filings (`sponsorSentence`), and say nothing
  when the year holds none: that isn't proof an employer won't sponsor.
- **40 new articles and 10 refreshed**, each with its own picture; three practice templates went live the same morning
  for the attorney to review on the site (owner's call). A capture can be fitted whole (`"fit": "contain"`); capture data pages at 1000 wide
  so the rail stays out.
- **The disk filled mid-session** (the dev server's Turbopack cache, 6 GB): an edit written then silently didn't land,
  and `.next/dev/prerender-manifest.json` was left corrupt (every page then 500s on JSON.parse; delete it). After a
  full disk, re-check every edit made around it.
- **The pre-push hook typechecks the working tree**, uncommitted edits included: an unfinished edit blocks pushing a
  finished commit.
- **A person's name can be withheld at their request, in one command** (owner's decision per request, no rule):
  `python3 scripts/withhold.py add "slug|name|label|cases"`; the runbook, legal notes and reply template are in
  `v2/docs/PRIVACY_REMOVALS.md`. The list lives only in `WITHHELD_EMPLOYERS` (server production.env, mirrored to a
  GitHub secret), never in this public repo: every read (`rows()`) drops what names it, a live answer shows a
  neutral label, and every deploy clears Cloudflare's copies of the pages it was on.
- **Every 404 shows the site's header and footer.** Next renders a 404 inside the root layout alone, so production served
  bare 404s; the root `not-found.tsx` draws them itself, and `(site)/not-found.tsx` answers a public page's `notFound()`
  inside the site's own (the dev server renders that case in-layout, production didn't). `NotFoundBody` is shared.
- **A support reply greets by first name** (`convex/lib/replyName.ts`, from the sender's display name; it had greeted
  "Hi jane.doe,"). Pass `supportEmail:replyToEmail` the message alone: the email adds the greeting and the sign-off.
- **Articles written for attorneys cite in Bluebook form** (the attorney's call, Oct 17): "20 C.F.R. § 656.10(d) (2025)" on
  first cite, § and §§ after, "72 Fed. Reg. 27,904, 27,920 (May 17, 2007)", BALCA cases with docket, date and pin cite. Pages
  for people waiting on their own case stay plain. `attorney-citations.test.ts` holds the rule; quoted regulation text is exempt.
- **A sample document is a ```document fence**: it wraps to its box (it had filled the left half), and each section cite
  stays on one line (`citationRuns`).

## Oct 18 2026: search by job, and one source for each search rule

Ledger: [`.planning/search-unification-2026-10-18.md`](.planning/search-unification-2026-10-18.md).

- **Find a sponsor searches by job** (`sponsor_jobs`, keyed soc, state, slug, where "" means every job or every state),
  built by `scripts/build_sponsor_index.py` with the employer page's own figures and floors (`MIN_DECIDED_FOR_RATE` 30,
  `MIN_DECIDED_FOR_MEDIAN` 10, in `src/lib/entityPayload.ts`). A search lands on `#answer`; a Schedule A job
  (`isScheduleA`, `src/lib/socCode.ts`) says why DOL's files hold few of its cases. Phones get a card per sponsor.
- **One SOC rule** (`socGroup`, `SOC_GROUP_SQL`, `socGroupClause`): an employer or state search filtered by job had bound
  `15-1252.00` against the seven-character group and matched nothing.
- **One pay-period table** (`scripts/data/pay_periods.json`) builds the yearly-wage SQL in TypeScript and Python, held to
  `scripts/fixtures/annual_wage_sql.txt`; every wage filter and sort compares `comparableWage`, never DOL's raw amount.
- **One name resolver** (`nameCandidates`, `occupationChoices`) for the case search and the finder, alternatives by slug;
  a whole word, plural included, beats letters opening a longer word ("nurse" had meant a farm job in a nursery).
- **/case-search keeps its whole form in the address**, and every link into it goes through `caseSearchHref`.
- **Sectors** (`SECTOR_GROUPS`), **search text limits** (`src/lib/search/limits.ts`) and **`PWD_VISA_CLASS`** are one
  constant each.
- **DOL's recruitment record** (Form 9089 Section H, new form only) loads as unindexed `perm_cases` columns
  (`scripts/lib_recruitment.py`, `scripts/data/recruitment_steps.json`); employer, law firm and occupation pages show the
  newspapers, additional steps and lead time (`RecruitmentMix`), and `build_recruitment.py` writes
  `perm_docs['recruitment_summary']` after each disclosure load. **Loaded Oct 18, 3:16 AM EDT**: 276,788 cases carry the
  record. **`/perm-recruitment`** shows it nationally (timing against the 30-to-180-day window, steps, notice, newspapers
  by state); the health check watches the doc at 100 days.
- **`BarRows` gives every row's figure one width**, so every bar's track is the same length and bars compare.
- **Every share of a count goes through `formatShareOf`**, which never prints a clean 0% or 100% the counts don't have.
- **The sponsor guide states the no-fee rule** (20 CFR 656.12(b)) and USCIS's scam warning; there is no job board.
- **Month and fiscal-year arithmetic lives in `convex/lib/months.ts`** (`ISO_MONTH_RE`, `shiftMonth`, `monthIndex`,
  `fiscalYearOf`, `fiscalYearSpan`); entity links in `entityHref`; LIKE in `src/lib/db/like.ts`; missing values sort
  last through `compareNullsLast`; a table's columns come from `tableColumns` (`PRAGMA table_info`). Don't write a copy.
- **The decided-day feed answers 503 with a reason when a read fails**; it had shown a failed read as a day DOL
  decided nothing.
- **The site goes live once a night** (owner's call): a push outside 1 to 5 AM Eastern builds and stops, the server's
  2 AM run ships main when the site changed (`scripts/deploy_plan.py`), and `gh workflow run oracle-deploy.yml -f when=now`
  ships at once. Every deploy empties the page cache: 8 of 13 people shown "busy" on Oct 17 to 18 came within an hour of one.

## Oct 18 2026 (afternoon): every date checked, and what would survive losing the server

- **A source's date is checked at the source before it's called wrong.** The dashboard's "as of October 5" was DOL's
  own stamp (DOL's page read "PERM Processing Times (as of 10/05/2026)" on Oct 18); State's newest issuance month
  really is February 2026. A page's "Updated" day is the git day of its inputs, so a shared-helper refactor moves many.
- **Every freshness stamp moves when its data does, on the Eastern day** (`et_today()` in `scripts/lib_db.py`; GitHub's
  runners are on UTC, which is tomorrow after 8 PM Eastern). The bulletin's daily read had returned before stamping on a
  quiet night (every bulletin page said "via Internet Archive" from Oct 5); the entity load stamps the row entity pages
  print (nothing had since Aug 26); the 4:10 AM sweep stamps the row the pages print as well as its own; the Federal
  Register feed is never dated past today.
- **The health check fails when a nightly rebuild has no clean run in 3 days** (`check_nightly_builders`: the sponsor
  index, the employer map, cities, the live remainder, straggler rates, the published-to-live sync).
- **A month tick reads "Jun ’25" through `monthTick`**: "Jun 25" reads as June 25.
- **Errors from browser extensions are dropped** (`fromBrowserExtension` in `src/lib/exceptionNoise.ts`: chrome, moz and
  Safari extension URLs; the morning report's new error was PayPal Honey's Safari extension), and `fromExtensionMessage`
  drops Mobile Safari's stackless ones by their words (the extension messaging API, which the site never calls, and one
  iPhone extension's `self.smartRules`; it set off the 1:27 AM EDT Oct 19 alert).
- **Server load, Oct 18:** about 142,000 requests a day reach the server, roughly 1 in 10 from people. Googlebot is 19%,
  the AI search crawlers 35% (OpenAI 16k, Perplexity 10k, Apple 8.7k), and browser-looking requests 45%, mostly the
  scraper on about 7,000 addresses. CPU is the limit (2 CPUs is Oracle's free cap for the whole account, read on
  Oracle's page); memory and disk aren't. Read the busy-page count against deploy times before calling the server small.
- **If the server were lost, nothing but up to a day of the public database goes with it**, checked Oct 18: every
  installed script, unit, drop-in and nginx file matched the repo byte for byte, and the owner's key opened that night's
  sealed server and Convex copies. R2 holds a steady ~6.2 of its free 10 GB (15 nightly copies and 3 monthly of each
  kind), growing only as the database dump grows. The rebuild itself is still unrehearsed.
- **The morning report's three Oct 19 warnings, read and fixed.** A Sunday is judged against earlier Sundays
  (`usual_prior`; it had read as "48% of the usual day"); a page slow on its first request is timed again and
  warns only if slow twice (`slow_verdict`); and busy-page people are listed by hour (`busyHours` from
  `permtracker-health`) and set against deploy switches, so the warning says whether a deploy or traffic did it.
  On Oct 18 it was traffic, Sunday 4 to 7 PM (PerplexityBot about 180 a minute, partly unverified, plus two
  scraper labels), none near a deploy. **The database RAM lock had been off since Oct 9** (the data file passed
  its 6 GB cap) and nothing said so; the report does now (`ram_lock_line`).
- **Perplexity's crawler reads at 30 pages a minute** (owner's call, Oct 19 2026, like Meta's on Oct 2), matched by
  name whether Cloudflare verified it or not (`pt_perplexity`); Perplexity-User, which fetches for a person's
  question, is left alone. Proved on the server: 16 requests passed, then 429; a browser kept getting 200.


## Oct 20 2026, in nine lines

- **Crawlers skip searches with a name in the address** (`/case-search?`, `/lca-cases?`, `/pwd-cases?` in robots.txt):
  about 18,000 came from Applebot, ClaudeBot and PerplexityBot in 16 hours while visitors met timeouts. Each names the
  bare page as canonical, so none could be indexed; the bare pages stay open.
- **The main database's old LCA copy is `lca_cases_retired`** since 10:26 AM EDT; the offline compaction runs at about
  2:43 AM Oct 21 (`permtracker-db-compact`).
- **The compaction's busy check counts services, not timers**: a job's timer reads "active waiting" all day, and the
  check had refused on fourteen of them; its dry run caught it.
- **Most of what browsers ask the server for is pre-loads**, not pages: 9,397 of 10,791 requests from 12:55 to 1:30 PM
  EDT, each link a reader can see. nginx lets pre-loads together hold 16 of the app's 64 slots (`pt_prefetch_conn`); a
  refused one costs the reader nothing.
- **The defense ignores pre-loads and analytics beacons, and never challenges a browser label whose browsers run the
  site's scripts** (`PEOPLE_BEACON_SHARE`): it had challenged Windows Chrome 155, about half of all real page views.
- **ClaudeBot and Applebot read at 30 pages a minute each** (`pt_slowcrawl`, owner's call), like Meta's and Perplexity's.
- **The disk alarm holds once it fires** until free space is 5 GB and 6 hours clear of its line (`permtracker-alarm`,
  `DISK_CLEAR_MARGIN_*`): it had emailed "filling" and "back to normal" seven times each overnight as the page cache
  rose and fell around one threshold.
- **Two daytime deploys (the urgent robots change, then a privacy removal) each emptied the page cache** and left the
  afternoon at capacity. `withhold.py` redeploys at once: unless a request is urgent, run it after midnight Eastern.
  While Under Attack Mode is on, outside checks see Cloudflare's 403; check the origin from the server
  (`curl -H "Host: permtracker.app" http://127.0.0.1:8081/...`).
- **Sign-in's Cloudflare check is advisory**: the login page's Turnstile is interaction-only and the server requires a
  pass only to create a password account (`requireSignupPass`); sign-in is held by the per-address and per-email
  limits in `src/proxy.ts`.


## Oct 21 2026, in eight lines

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 21 2026".

- **75% of the web copies' CPU was rereading the articles**: the site's layout and both 404 pages called `getAllPosts`,
  and Next renders the 404 page into every page it builds. It's read once per process now; a cold employer page went
  from 2.8 s to 0.34 s typical (8 s to 0.56 s at the slow end) and a cached answer from about 1 s to 16 ms.
- **Measure with a profile before reading code**: `kill -USR1` on a copy opens its inspector, `permtracker-perf` does it
  hourly and names the hot code from the source maps; nothing else had named the cause.
- **Each page carried four 17 KB copies of the article list** (layout and 404s); `/articles.json` loads when search opens.
- **The page's frame pre-loads on intent** (`IntentLink`): pre-loads were 29% of requests, 20 to 40 per employer view.
- **The database reports its own costliest statements** (admin API on 127.0.0.1:9097, `permtracker-db-stats`); the
  main log carries `rt=`, `urt=`, `nc=`; Cloudflare holds employer, firm and job HTML a day (stale-while-revalidate).
- **Of `.github/`, only `oracle-deploy.yml` ships the site**: an ordered `paths` list, the last match winning.
- **Googlebot's 42% refusals (11 PM to 2 AM EDT Oct 20) were slow builds**, not deploys or limits.

## Oct 21 2026 (afternoon): the getting-started guide, and three copies that dropped fields

Detailed in [`v2/CLAUDE.md`](v2/CLAUDE.md) under "Oct 21 2026 (afternoon)".

- **The dashboard, the case list and the cards showed a passed PWD as overdue on cases still free to file** (8 live cases,
  7 accounts): `toPermCaseData` copied fields by name and left out the determination date and the four denial dates.
  The calendar page and Google Calendar sync had their own copies with their own gaps. All three pass the whole case now
  (`calendarCaseRow`, `calendarSyncCase` in `convex/lib/caseDates.ts`), and `deadline-agreement.test.ts` checks the
  calendar and sync through what their own queries send. Reminders, auto-close and the assistant were already right.
- **A filed case's ETA 9089 and Recruitment tabs read "Expired"** in red: they now say what was filed and when.
- **Every article picture sat in an empty band**: `.prose-article img` gave figure pictures a margin inside their frame.
- **The getting-started guide (the welcome email's link) is rewritten against the app**, with a real tour and a case-page
  clip; the five guide clips, 31 app pictures and 15 article figures were re-recorded from the current app.

## Oct 21 2026 (evening): the films re-cut, and real pictures as claims

The picture rules are in [`v2/docs/DESIGN_SYSTEM.md`](v2/docs/DESIGN_SYSTEM.md), section "Pictures".

- **Both explainer films are re-cut** (`src/lib/constants/films.ts`; sources in `~/money/video/hyperframes/permtracker-campaign`).
  No caption sits on the picture: the attorney film's windows were raised clear of the lowest band. The waiting film's
  chart no longer shows an empty window: its wipe starts as the window lands. The posters are rebuilt from the new cuts
  (`node scripts/make-film-posters.mjs`, whose frame and crop still fit). Before a final encode, look at a frame every
  three seconds and at every scene change.
- **A guide can show the agency's own page with the quoted words highlighted.** An `article-figures.json` pdf entry takes
  `mark` (a phrase or a list): a lime tint multiplied under the words, so the print stays black, and the lime ink under
  them (5.45:1 on white). A phrase that isn't on the page fails the build. First use: DOL's PERM FAQ Round 14 in the
  denial and appeal guides.
- **The capture script can press a key and click** (`fill.press`, `click` in `scripts/capture_article_heroes.mjs`), so a
  figure can show an agency's own search answering. First use: DOL's case search answering RFI ISSUED for a real case, in
  the RFI guide.
- **The app's pictures were re-taken** (`capture-tour.mjs`, `tour_shots.py`, then the 15 Storybook article figures).
  Only the dashboard, its deadline hub and the calendar changed, and one figure's stated shape with them. The old
  pictures, the app-tour, case, cases and calendar clips and five article headers cropped from them still showed two
  PWD expiries that stopped binding on Oct 17 (recruitment began inside the PWD): all were re-made from the corrected
  sample firm. After re-recording the tour fixtures, re-take every picture, clip and header made from them.
- **Isometric drawings** (the `anatomy` and `anatomy-asset` skills) go only where `.planning/anatomy-figures-plan.md`
  says, and each waits for the owner's yes before it ships. The first, the filing window as a measuring bench
  (`<FilingWindowFigure />` in `the-perm-deadlines-that-matter`), is a client component on the kit in
  `src/components/iso/` (geometry and SVG strings, no card or CSS from the skill), its dates from
  `calculateFilingWindow`. By the owner's call it sweeps by itself, scroll pushes it and dragging moves it (no slider or
  keys); under reduced motion it holds still. `next/dynamic` loads it only on articles that use it.
- **The second, DOL's line as a roller conveyor** (`<QueueFigure />` in `how-the-perm-queue-works`), reads today's line,
  DOL's pace and its published month with the queue month pages' own readers (`getLiveBacklog`, `getDecisionPace`,
  `getEstimatorData`, `getSweepCoverage`) and runs them forward as a time-lapse. The lime month reaches the front on the
  day `estimateByPace` gives and ends on `monthEndDate`'s day, the month page's "The line reaches this month's end";
  tests hold both. It shows nothing when the pace, DOL's month or a fresh sweep is missing.
- **Four more moving drawings and eighteen still pictures, all on the owner's go (5:05 PM EDT: "take initiative for
  all").** Moving, each with a Pause button: a wage determination's validity (`<PwdValidityFigure />`, from `pwdBearing` and
  `calculateFilingWindow`), two of the three 180-day clocks (`<I140ClocksFigure />`, from
  `calculatePriorityDateRetention`), an RFI as a siding (`<RfiFigure />`, from the measured RFI clock and `estimateRfiCase`)
  and a bulletin cutoff as a gate (`<BulletinFigure />`, EB-2 India's real cutoffs from the archive). Still: a spot per
  guide and blog topic, the homepage's two halves, the attorney security section, two app empty states, the 404 and
  `/developers` (`SpotPicture`).
- **DOL's wage-request line is a conveyor too** (`<PwdQueueFigure />` in `track-a-prevailing-wage-request`, the PERM
  conveyor's parts in `src/components/figures/pwd-queue/`), run at DOL's measured pace from `pwd_day_queue`.
- **A guide with a data drawing refreshes when its data moves**: the sweep, DOL and bulletin routes list each such guide
  by path, and `src/app/api/__tests__/figure-guides-refresh.test.ts` maps every async figure to its routes and fails a
  guide left off one. A new data figure needs an entry there.
- **The Chrome Web Store and Product Hunt images are built** (`extension/store/build.mjs`, from the live site); the
  listing still waits on the LLC rename, because a store listing shows the legal name, address and phone to everyone.
- **A priority date on the cutoff day isn't current.** State prints "earlier than the final action date" on every chart;
  `estimatePriorityDate` had counted the day itself (`daysFromCutoff > 0` now, with a test).
- **Ten class strings glued two class names into one** (`"... border" + (on ? "bg-primary" ...)` made `borderbg-primary`):
  the bulletin hub's months had no border or fill, sortable headers lost their alignment and focus ring.
  `no-glued-class-concat.test.ts` reads the operand after every `+`, ternaries over several lines included.
- **Links inside an article's `not-prose` components keep their own classes**: an unlayered `color: inherit` escape had
  put the lime article button's label at 1.82:1 in dark mode on 10 articles.
- **The board says its own count and window** ("Measured from October 2014 to October 2026, 13 of the 27 queues..."): it
  had typed "most" over the June 2005 archive.
- **The calendar calls the certification's expiry the "I-140 deadline"**, in the I-140 colour, like the dashboard
  and the case card (it said "ETA expires" in ETA 9089 orange). The calendar pictures and clips were re-taken.
- **Two dark-mode contrast failures fixed**, found by axe on the guide pages: the "Guide" badge on article cards (black on
  near-black) and the count on the pressed topic button (grey on lime, 3.03:1).

## Oct 21 2026 (night): drawings beside the text, pictures that turn, and pages instead of endless lists

Built on branch `preview/image-led`; the owner saw the four previews and kept all of them (10:19 PM EDT), so they go to `main`.

- **A moving drawing sits beside the text, with no box** (owner: "smaller on the side ... not main thing full width",
  "naked on the screen not in container"): `src/components/figures/frame.ts` floats it right at a third of the
  column from 1024px, the long description folds under "What this shows", and `globals.css` (`.figure-side`) keeps
  a heading or a boxed block from running under it. Each drawing sits at the top of the section it explains.
- **A readout never contradicts the page beside it**: when a conveyor's front tray is older than DOL's published
  month it says "DOL is finishing December 2025's last cases", not "the front tray is December 2025".
- **Something inside each small picture answers the mouse** (owner: tilting the whole picture was "so corny").
  `SpotMotion` (one listener in SharedProviders) swaps a picture near the pointer for its own SVG and moves the parts
  `scripts/spot-pictures/build.mjs` marks: the compass needle and vault wheel point at it, the nearest day, window, coin
  stack, fruit, bar, tab or key turns lime, the signpost arm aims, the stamp lifts, the bell presses, the folder slides.
  Mouse only, motion allowed; the still file otherwise. Each file's style is scoped to its root id so a copy in the page
  restyles nothing (`spot-motion.test.ts`). Three that repeated were redrawn: the green card (was a ticket dispenser),
  data notes as an uneven bar chart (was a second card drawer), and a round vault door (was a third grid of doors).
- **Pages, not endless lists** (owner: "pagination not endless scroll"): `Pagination` (numbers, gaps, the page in
  the address) on the guides and blog lists (12 a page, the topic in the address too), the shared table
  (`FilterableStatTable`), debarments (25 per program), the day's decided cases (50); `ListPages` pages the A to Z
  lists while keeping every link in the HTML; notifications page Newer and Older with the server's cursor.
- **`--site-header-max-h` no longer exists** (since Oct 14 the header publishes `--site-header-h`, a fixed 64px);
  four new files and the data rail's sticky offset used it and fell back to 72px. The notes in v2/CLAUDE.md that
  describe the two variables are history.
- **The owner kept all four previews** ("PERFECT THANK YOU KEEP ALL"; the attorney page's ribbon stage: "BEAUTIFUL keep
  going more like that"). The stage's band is shared now (`src/components/scroll/StageBand.tsx`), so another page can
  take the same shape: the calculators page is the next.
- **A value a scroll stage writes every frame is a registered, non-inherited CSS variable, written on the element that
  reads it** (`@property` block at the top of `globals.css`). An inherited variable written on a section restyles the
  whole section every frame: the guides page's card stack spent 1,110 ms of style work over one scroll (measured A B B A
  with a Chrome trace, `node_modules/.cache/qa/scroll-perf.mjs`), 76 ms after, and jerky frames fell from 9 to 1 in 100.
  `useScrollStage` runs once per frame and skips frames where the place hasn't moved; it no longer writes `--progress`.
- **Topic cards take the height the pinned frame leaves** (`--card-h`, at most 600px) and drop the blurb under 840px of
  screen height and the third article under 700px, so the "All N guides" button always has room under it
  (`node_modules/.cache/qa/card-fit.mjs` checks every card at nine sizes).
- **A picture a script fetches is fetched with `cache: "no-cache"`**: `force-cache` handed back files kept from before the
  pictures had moving parts, and they never reacted.
