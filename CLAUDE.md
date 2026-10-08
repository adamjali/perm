# CLAUDE.md - PERM Tracker

**Status:** Production | **Version:** 2.0.0 | **Last Updated:** 2026-10-04

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
| Design System | [v2/docs/DESIGN_SYSTEM.md](v2/docs/DESIGN_SYSTEM.md) |
| Animation Catalog | [v2/docs/ANIMATION_STORYBOARD.md](v2/docs/ANIMATION_STORYBOARD.md) |
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

Push to main triggers auto-deploy:
- **Vercel:** Frontend rebuild
- **Convex:** `npx convex deploy -y` (manual, from `v2/`)

### Project Names (avoid confusion)

| Service | Name | Notes |
|---------|------|-------|
| GitHub repo | `perm` | See remote origin |
| Local folder | `perm-tracker/v2/` | All code lives in `v2/` |
| Vercel project | `perm` | Deploys from `v2/`, hosts `permtracker.app` |
| Convex prod | See `.env.local` | `npx convex deploy -y` from `v2/` |
| Convex dev | See `.env.local` | `npx convex dev` from `v2/` |

**Always run commands from `v2/` directory.** Claude is always launched from `v2/`. Vercel CLI is linked to project "perm" via `v2/.vercel/project.json`.

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

