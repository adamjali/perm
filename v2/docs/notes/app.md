# The signed-in app, the chat, the API and the extension

The case app (deadlines, the calendar, onboarding, imports), the AI chat, the free API and MCP server, webhooks, the SDKs and the Chrome extension.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## The auth pages, and the research behind them (2026-08-31)

`/signup` is a full-bleed, full-height **60/40 split** (pitch left, form right).
`/login` is a **bare centred card**. Both lost the hand-drawn SVG diagram they
carried and show a real product screenshot instead.

**The split is Adam's call, made twice, the second time after I argued against
it.** Keep the objection in view: `login-02` and `signup-02` in the shadcn block
library are verbatim *"A two column login page with a cover image"*, and of
seven auth pages readable live on 2026-08-31 - Vercel login **and** signup,
Resend, Cal.com, GitHub, Supabase, Railway - **none used a split screen**. Full
research, with sources and what could not be verified:
`~/.claude/explanations/20260831_auth_page_research/AUTH-PAGE-PATTERNS.md`.

**What keeps it from being the template is the left half's content**: the live
federal queue from the same `getProcessingTimes()` snapshot `/tools` uses,
dated. That is Railway's "All systems operational" idea. A fabricated
testimonial beside a form is the loudest documented template tell, so nothing
here is invented and the screenshot captions say "demo account".

Rules that came out of building it:
- **`revalidate = 86400`, not `force-static`** - the page prints a live figure.
- **A figure DOL did not publish is dropped, never rendered as a dash.**
- **The panel is dark in BOTH themes.** `bg-foreground text-background` is this
  site's inverted band (95 uses) and it flips to near-white in dark - right for
  a stat card, a white slab across 60% of a viewport. Light gets the ink, dark
  gets `--card`, and muted tones inside use **opacity on currentColor** because
  every `--background`-derived token inverts too.
- **`flex-col-reverse` below `lg`** puts the form first on a phone while source
  order stays pitch-then-form for the grid. No `order` utilities, one image.
- **`minmax(23rem, 2fr)`** on the form column: a fixed fraction of a 1024px
  screen falls under the card's own width.
- **`/login` kept its card**, which also matches the verified asymmetry: Vercel's
  `/login` carries no marketing and even inverts the method order.

**Form correctness, each against a primary source:**
- Sign-in's identifier is `autocomplete="username"`, not `email`. MDN pairs
  `username` with `current-password`; `email` + `new-password` is the sign-up
  pair.
- The verification field is **ONE input** with `autocomplete="one-time-code"`
  and `type="text"` (numeric strips leading zeros). **WCAG 2.2 SC 3.3.8 fails
  any authentication step forcing manual transcription**, so the six-box OTP
  component is an AA failure unless it distributes a paste.
- WCAG 2.2 SC 3.3.7 means step two shows the email rather than asking again.
- **Open, flagged not done:** web.dev says drop "confirm password" outright. It
  is contained to `SignupPageClient` and `ResetPasswordPageClient`.

## The sign-up fork: say who the product is for, before the form

Beneficiaries were signing up for an attorney case-management tool. `/signup`
now leads with `SignupAudienceFork`, a caution bar (repeating 45-degree tape,
an offset lime slab, a black warning tile breaking the top edge) carrying two
doors - `/perm-case-status` for someone waiting on their own case,
`/perm-queue` for the queue - each firing
`analytics.capture("signup_fork_taken", { door })` so the split is measured
rather than assumed.

The onboarding role step gained **"Waiting on my own case", listed FIRST**, and
`RoleStep` routes it to `/perm-case-status` instead of into the app.

**The paid beneficiary product is PARKED, deliberately.** This is signposting,
not a tier. Nothing here promises a plan, a price or a feature.
**Re-decided 2026-09-16 with numbers** (`../.planning/monetization-2026-09-16.md`):
no tier, no AdSense, no donation link until confirmed case-alert subscribers pass
~1,000 or monthly visitors pass ~30,000. The rival tracker's one $9.99 plan is roughly our
free product; the only paid delta is hourly checks on watched cases. AdSense never
goes on the data pages. The attorney app, per seat, is the half that can pay.

## Sep 29 2026: one set of deadline rules, off Vercel, backups off the machine

**Every surface asks the central deadline rules** (`convex/lib/perm/deadlines`). Before, five
surfaces each kept their own idea of "due", "overdue" and "done", and each had a test pinning its
own copy. The dashboard rebuilt half its list by hand and kept a filing window's OPENING in its
Overdue column after the window had opened, so a case card could read "Filing opens: 37 days
late". The calendar turned superseded PWD and ETA 9089 expiries red. The next-up box hid real
misses. Google Calendar sync kept a PWD expiry after the ETA 9089 was filed, never synced the
filing window's closing date (the settings page promised it), put the certification expiry and the
I-140 deadline on the same day, and stored two event types in one slot, so an event could be
orphaned and never deleted. Now:

- `buildDeadlineInput(caseLike)` turns any case shape into the rules' input (stored window dates
  win; computed ones fill gaps). `extractActiveDeadlines` drops a filing window's opening once it
  has passed. `extractReminderDeadlines` is the list both reminder emails use (all but the opening).
- Google Calendar events come from the same list (`calendarEventExtractor.ts`), one slot per event
  type (`EVENT_TYPE_TO_SLOT`), and `slotsForPreference` finds every slot a toggle's events use,
  retired slots included, so turning "Recruitment deadlines" off deletes all five of its kinds
  (it deleted one). New slots `eta9089_filing` and `filing_window_closes`; `eta9089_expiration`
  and `recruitment_end` are retired but kept so stored ids still get deleted. A test holds
  `CALENDAR_EVENT_SLOTS` to the schema and the mutation.
- Per-step recruitment deadlines exist once the PWD expiry is known, before recruitment starts
  (that is the rule's documented behaviour), so reminders now include "Start job order by" and
  friends the way the dashboard always did.
- `src/lib/__tests__/deadline-agreement.test.ts` puts eleven saved-case states through the
  dashboard, calendar, next-up box and auto-close and fails when any disagrees with the rules.

**Known gap, left alone on purpose:** the I-140 deadline needs a stored `eta9089ExpirationDate`.
The form's cascade fills it from the certification date; an import may not. Filling it inside the
rules would change what auto-close acts on, so it waits for its own decision. **Closed the same
day on the owner's call; see "The ETA 9089 expiration is certification + 179" below.**

**Words.** Notification titles and messages come from one phrase table (`DEADLINE_PHRASES` in
`convex/lib/notificationHelpers.ts`): "PWD expires in 7 days", "First Sunday ad due tomorrow",
"ETA 9089 filing window closed". Labels, closure titles, digest rows, calendar event titles and
account email subjects are sentence case, and nothing shouts ("CASE CLOSED:", "OVERDUE"). The
weekly digest's status map used keys that do not exist (`eta_9089`, six progress states), so it
printed raw keys; it reads the real ones now. The single-deadline reminder email was dead since
Aug 24 and is deleted.

**Off Vercel.** BotID, `@vercel/functions` (the client IP is `x-real-ip`, which nginx sets from
Cloudflare's own header and overwrites), `vercel.json`, `vercel-ignore.sh` and the Vercel hosts in
the CSP are gone. `'unsafe-eval'` is in the policy in development only; the built client has two
`Function(` calls and neither needs it (zod's probe, now skipped with `jitless`, and a global
lookup that never runs in a browser). The cron dispatcher's clock is the server's systemd timers,
and the dispatch test holds `scripts/oracle/systemd/permtracker-cron@*.timer` to `jobs.ts`.
IndexNow runs after each successful Oracle deploy (it waited for Vercel's deployment events). The
State Department probe, the Mac's launchd jobs and `residential_job.sh` are gone (the server runs
the USCIS fetches). nginx serves noindex to any hostname but permtracker.app.

**Backups.** `permtracker-backup` uploads the nightly dump to R2 bucket `permtracker-backups`
(15-day expiry, 7-day lock, a Cloudflare budget alert at $1) and checks the size;
`permtracker-restore-test` (2nd of each month) downloads it and loads it into SQLite, counting
tables and rows. First run Sep 29: 165,258,822 bytes up; 44 tables and 6,511,438 rows restored.
rclone 1.60 re-reads an upload by version id, which R2 answers 501, so uploads use `--s3-no-head`.
The key in `/etc/permtracker/r2.env` is an account-wide admin key by the owner's choice; a bucket-
scoped Object Read & Write key is the better swap, same file format. The morning report's Turso
bill section is retired.

### The ETA 9089 expiration is certification + 179, and every certified case has one

**+179, not +180, is the owner's call (Sep 29 2026).** 20 CFR 656.30(b)(1) says the I-140 must be
filed "within 180 calendar days of the date the Department of Labor granted the certification";
DOL counts the grant day as day 1, so the "valid through" date it prints is certification + 179.
Users had been typing +179 while the app filled +180, a day after DOL's date. This rests on the
users' own entries, not on a DOL document stating the arithmetic. One constant carries it,
`ETA9089_EXPIRATION_DAYS = 179` in `convex/lib/perm/constants.ts` (`I140_FILING_DAYS` is an
alias), and auto-close's old `ETA9089_VALIDITY_DAYS = 180` copy and the date picker's literal 180
now point at it. Public copy that says "within 180 days" states the regulation and stays.

- **Every certified case carries an expiration.** `resolveEta9089ExpirationDate` fills a missing
  one on create, update and import (`convex/cases.ts`); a date the user entered is kept.
- **V-I140-02** allows filing on or before the stored expiration, or the computed one when none
  is stored.
- **The import preview says so** (`filledExpirations` from `parseCaseImportFile`): which cases got
  a date, and a red box when an open case with no I-140 already has a past date, because deadline
  enforcement would close it.
- **Saved +180 dates moved once** by `migrations:moveEta9089ExpirationTo179` (exact +180 only,
  `updatedAt` untouched, Google Calendar resync scheduled for live cases; dry-run first).

### The cases page: one Import / export menu, short cards on phones, a lower chat bubble

- **Import / export** replaces the Import button: import JSON, or export the cases the list shows
  (every page of the filtered set, via `listFilteredIds` then `listByIds`) as CSV or JSON. Select
  mode keeps its own export of the selected cases.
- **Phone cards start short**: the next deadline shows, and a 44px row opens the dates and notes
  (`md:hidden`; desktop keeps hover and pin). A pinned card starts open. The row's count comes
  from `countShownDates`, which skips `created` and `updated`: counting them put "Show dates (2)"
  on empty cases, and the "nothing recorded, no band" guard in `ExpandedContent` never fired.
- **The chat bubble sits in the corner** (16px on phones, 24px from `md`) and rises over a bottom
  bar. Its fixed `bottom-20` put it 80px up on every page, and on the case form it still sat on
  the 92px save bar's Save button. Bars publish their height as `--bottom-bar-h` through
  `usePublishBottomBar` (the case form's save bar and the select-mode bar; the tallest wins, and it
  clears when the last unmounts). The bubble dropped from `z-[60]` to `z-40`, because it was drawn
  over open dialogs' backdrops.
- **The automation tab hid a transition again**: the bubble read 90px after the select bar left,
  until a screenshot forced a paint; then 16px. Measure a transitioned value after a paint.

### The self-hosted database caps a reply, and the full sweep's read is 85 MB

**The first full case-status sweep after the move off Turso died at 4:10 AM Sep 29** on
`Response is too large` (`RESPONSE_TOO_LARGE`). It reads every case in one query: 426,112
rows, about 34 MB of text and roughly 85 MB as Hrana JSON, against sqld's default 10 MB
reply cap; the pending sweep's 93,230 rows (about 18 MB) is over it too. Turso had served
both. `permtracker-db.service` now starts sqld with `--max-response-size 256MB
--max-total-response-size 1GB` (installed and restarted 9:03 AM EDT; the site answered
throughout), and the day's sweep was re-dispatched. **After any move of the database, run
each nightly job once by hand before trusting the timers**: the health check caught this,
but only after a lost night.

### A bulletin landing now refreshes its pages the same day

The bulletin pages sit on a one-day window and the read runs at 3 AM, so the October 2026
bulletin (on State's host by about 8 AM EDT Sep 29) would have shown September until the next
morning, the day the bulletin-alert emails link to it. `ingest_visa_bulletin.py --direct`
writes `bulletin_changed=true` to `$GITHUB_OUTPUT` when it stores a month, and
`processing-times-ingest.yml` then POSTs `/api/revalidate-bulletin`: every page that reads the
bulletin (`BULLETIN_PAGES`), plus all month and category-line pages by pattern. **A pattern is
the page's FILE path, route groups included**: Next tags a page `/(site)/(public)/visa-bulletin/
[month]/page`, and `revalidatePath("/visa-bulletin/[month]", "page")` matches nothing, silently.
The test checks each pattern against a real `page.tsx` and re-derives the reader list from the
app tree. October 2026 was checked cell by cell against State's PDF: both employment charts match.

### The one-time Google Calendar resync (Sep 29, 8:26 AM EDT)

`googleCalendarActions:syncCaseCalendarEvents` for the 33 cases holding events (3 accounts):
49 deleted, 2 created, 0 failed. The old rules had kept a PWD expiry after the ETA 9089 was
filed and a separate certification-expiry event; the current ones keep neither, and past dates
are never created. One account's Google access had already been withdrawn (`invalid_grant`), so
the sync marked it disconnected and its 7 old events stay on that calendar: nothing can delete
them without access. The disconnect notifies nobody; it records an error, which reaches the
admin email and Sentry.

## Oct 1 2026 (evening): the app's real pages as pictures, and what drawing them found

**The attorney page shows the signed-in app's real pages, drawn from a recorded sample firm.**
`convex/__tests__/tourFixtures.test.ts` builds a firm of eight sample cases through the real
mutations (`cases.create` with the form's cascade, `cases.update`, the conversation mutations),
replays the reminder job for 35 days so the inbox has a history, and records every query the
pages make into `src/components/tour/tour-fixtures.json` (clock pinned to 2026-10-01). A fake
`ConvexReactClient` (`src/components/tour/fakeConvex.tsx`) answers the app's pages from that file
in Storybook ("Tour/App pages"), so the real components render with no sign-in.
`scripts/tour_shots.py` crops and encodes the captures (light, dark, phone) into
`public/images/for-attorneys/` and writes `src/components/marketing/tourShots.ts` with each file's
real size; `tourShots.test.ts` holds the sizes to the files.
- Re-record: `UPDATE_TOUR_FIXTURES=1 pnpm exec vitest run tourFixtures --project convex -u`
  (`node:fs` is blocked in `convex/`, so the file is written by `toMatchFileSnapshot`).
- Capture the stories at scale 2 with the clock fixed and reduced motion, one browser, then run
  the script on the folder. Storybook themes by a class on `<html>` its decorator rewrites, so a
  dark capture has to hold the class with a MutationObserver.
- The guides' and the sign-up page's app pictures come from the same captures now; the Feb 2026
  screenshots they used showed a filing window's opening as overdue, a defect fixed Sep 29.

**Building the sample firm found four real defects, each fixed:**
- **`cases.create` dropped the job description.** The form sent it and the insert never wrote it
  (since before the move to derived validators). `convex/cases.test.ts` "Nothing a case is given
  is dropped" holds create and import to it.
- **An export read back through Import lost nine fields**: the wage amount and level (the screen
  never sent them), the audit date, the I-140 category, premium processing and service center,
  the recruitment notes, tags and the status override; the job description was never exported.
  `src/lib/import/importArgs.ts` is now the one place an imported case becomes the mutation's
  arguments, and `importArgs.test.ts` exports a fully filled case, imports it and fails on any
  field that doesn't survive (probed by removing two). Import also caps text lengths like create.
- **The recruitment card read "EXPIRED" on a filed case**: `determineStatus` now answers `filed`
  first when the ETA 9089 is in (inside or outside the window, said plainly).
- **Notification titles in title case** ("Job Description Updated") and the FAQ's claim of CSV
  import (import is JSON only) were corrected.
- **"Select all" and "export what's shown" searched differently from the list**: substring over a
  different field set, so a typo the list's fuzzy search forgave selected nothing. `listFilteredIds`
  now runs the list's own `filterBySearch`; a test compares the two queries over three searches.
- **The chat confirmation card's endless shimmer sweep** is gone (the no-pulse rule); its status
  label already says it's waiting.

**Bulletin release day: "at least 0 ... may well be up" was live.** `BulletinRelease` now gives
three answers: none out this early (probably not out yet), under half (may be up, most came
later), half or more (may well be up).

**Social cards hold no live figure.** The home card had frozen "13 months" from the old homepage;
it shows the case lookup now. The attorney card shows the deadline hub, the contact card no longer
offers the GitHub templates removed Sep 7, and the bulletin card lost its stale "last 84". Cards
are re-rendered with `scripts/make-page-cards.mjs`, whose `crop` is `[x, y, width, height]` in
capture pixels, not corners.

**Emails' footer links carry no separators**: each link is a padded inline block that never
breaks inside, so a phone wraps between links at a 44px pitch with nothing dangling.

**Server loads, Oct 1 (run before the deploy, from a copy of the scripts, as the app user):**
ICE's SEVP top-employer lists (1,604 rows), the H-1B lottery FOIA release FY2021 to FY2024
(171,588 employer-year rows) and USCIS's H-1B Employer Data Hub FY2009 to FY2026 (1,067,558 rows).
From FY2022 the FOIA file says `ELIGIBLE` where FY2021 said `CREATED` (registered, not selected);
FY2024's selected count is 9 under USCIS's table (188,391 against 188,400) while every other total
matches exactly, so that one gap is allowed by name (`KNOWN_SELECTED_GAP`) and recorded in the doc.

## Oct 2 2026 (afternoon): the free API and the MCP server

Phase 1 and 2 of the developer platform plan (Claude Doc "PERM Tracker Developer Platform Plan"), with the owner's
Oct 2 call: one paid plan first (Plus, about $5 a month or $50 a year), charged once Stripe exists. Everything here
is free today.

**Where things live.**

| piece | file |
|---|---|
| key format (`pt_live_` + 32 + a 6-character CRC32 checksum; the first 8 random characters are the public id) | `convex/lib/apiKeyFormat.ts` |
| plans and their limits | `convex/lib/apiPlans.ts` |
| keys and accounts (`apiKeys`, `apiAccounts`); make, list, revoke, verify, `setPlan` by hand | `convex/apiKeys.ts` |
| who's calling (Bearer or X-API-Key; checksum first, then Convex by hash, cached 60 s) | `src/lib/api/auth.ts` |
| counting and limits (minute in memory; day and month in `api_usage`, written every 5 s) | `src/lib/api/usage.ts` |
| the reads both doors answer with | `src/lib/api/reads.ts` |
| the /v1 wrapper (order: key shape, key, minute, allowance, read, count) | `src/lib/api/route.ts` |
| the spec, the docs' endpoint and tool lists | `src/lib/api/openapi.ts` |
| the MCP tools | `src/lib/api/mcp.ts`, served by `src/app/mcp/route.ts` |
| Settings > API keys, and its usage route | `src/components/settings/ApiKeysSection.tsx`, `src/app/api/developer/usage/route.ts` |

**A key is made in a Convex action**, because queries and mutations can't use cryptographic randomness. Only the
SHA-256 is stored; the key is shown once. `verify` is a public query by hash: only a key's holder can compute the
hash, and the answer carries no user id. A revoked key keeps its row so a call can be told "revoked"; a key whose
account is being deleted stops at once (verify checks `deletedAt`), and `purgeAllUserData` removes keys and the
API account.

**Counting never blocks an answer.** A failed write keeps the counts and retries; a failed read counts as zero.
The site runs as two copies, so between re-reads (30 s) an account can go a few calls past its allowance, never
far. A call is counted when it did its work (an answer or a 404); a 400, a refusal and a 500 are not. `api_usage`
holds the account's random id and the key's public id only, and the nightly prune drops rows after 400 days.

**The MCP server needs no key**: Claude's custom connectors can't send a header. Calls without one share a pool of
300 a minute per copy (and nginx hashes `/mcp` to one copy, so that's the site's). A key gets its plan's limits.
`createMcpHandler` (`@modelcontextprotocol/server` 2.1) serves 2025-era clients statelessly over SSE and 2026-07-28
clients as JSON. nginx gives `/mcp` its own in-flight cap (48) instead of the app's 64, unbuffered, because a
notification stream can stay open for hours and must not hold a render slot; the app allows 8 such streams a copy.
`/v1` calls together hold at most 24 of the app's 64 slots. Cloudflare's custom rule 2 (trusted traffic skips its
checks) also covers `/v1` and `/mcp` since Oct 2 2026: a browser check or Under Attack Mode would refuse every
program calling them, and the app already limits them.

**Nothing in the API asks DOL live.** A case we don't hold answers 404 with a link to the case page, which can.
Plus is meant to add live lookups (plan phase 5).

**Instruments.** `scripts/oracle/test_nginx_conf.py` holds the two locations (three new probes). The spec test
holds every path in `ENDPOINTS` to a route file under `src/app/v1` and every tool in `MCP_TOOLS` to a
`registerTool` call. Smoke-tested locally against production data through the tunnel (`ssh -L 18080:...`, the
read-only token): all six tools answered, including a PERM and a wage-request case filed that day.

**Not built yet** (plan phases 3 and on): OAuth sign-in for assistants, billing, webhooks, exports, live lookups,
directory listings. *(The admin Developers tab, the morning report's API lines, the CLI, both packages and the
Claude Code plugin were built Oct 8; see "Oct 8 2026: the Node and Python packages".)*

## Oct 5 2026: a Chrome extension and a keyless employer lookup

- `GET /v1/lookup/employer?name=` (no key; `src/lib/api/employerLookup.ts`, `keyless.ts`): an exact published PERM
  employer, then a page `employer_page_map` ties the name's program key to, then a labelled possible match, else "no
  record". 60 calls a minute per address, 1,200 for all keyless callers per copy; CORS for permtracker.app and
  `chrome-extension://` only. `programKey` in TypeScript is held to Python's by the shared identity fixture.
- **A small exact match gives way to a much busier namesake** (`SMALL_EXACT`, `BUSIER_BY`, `BUSY_FLOOR`). Job sites
  print the brand, and DOL's files hold a 1-case "AMAZON" and a 4-case "Deloitte LLP" beside the companies people mean,
  so "Amazon" answered with 1 published case. An exact match under 30 published cases is set aside for the busiest
  possible match with 10 times its cases and 100 in all, answered as "possible". Known gaps left alone: "Infosys"
  and "Walmart" land on the right PERM sponsor with 0 LCAs, because the LCA files spell those employers differently.
- The extension is `v2/extension/` (own tsconfigs, tests in the `unit` project), built by `pnpm build:extension` into
  a store zip; `STORE.md` has the listing text. The developer account exists (fee paid Oct 5); **the listing is on hold
  until the LLC's rename, EIN and bank account** (owner, Oct 5). A trader's name, address, phone and email show on the
  listing to everyone, so it goes up as the organization with the registered agent's address and the business line.
  The store URL then goes in `CHROME_STORE_URL` on `/extension`. Chrome blocks every extension from the store's
  pages, so the store's forms are the owner's clicks.

## Oct 8 2026: the Node and Python packages, the CLI, the Claude Code plugin, API use on the admin page

Plan phases 3 and 4, everything but billing (which waits for the LLC's rename). **Nothing is published**:
npm, PyPI, a public plugin repository and directory listings are outward-facing and each needs the owner's
yes, from the persona's accounts.

- **`sdk/`** is the npm package `permtracker` (MIT, no dependencies, Node 18+): `PermTracker` with one method
  per `/v1` route, every answer `{ data, meta, usage }` (usage from the RateLimit and X-Calls headers), a
  refusal thrown as `PermTrackerError` with the API's code, message and `retryAfter`; and `npx permtracker`,
  the CLI (`login` saves the key to `~/.config/permtracker/config.json`, mode 600). `pnpm build:sdk` writes
  `sdk/dist` (git-ignored); `typecheck:sdk` is part of `pnpm typecheck`; its tests run in `unit`.
- **`sdk-python/`** is the same client and CLI for Python (`permtracker` on PyPI once published), standard
  library only; `scripts/test_sdk_python.py` tests both against a fake transport, and CI runs it with the
  other script tests. The CLI's plain listing matches the Node CLI's, held by the test.
- **`claude-plugin/`** is a Claude Code plugin (`plugin.json`, a one-plugin `marketplace.json`, `/case` and
  `/when` commands) that adds the MCP server at `https://permtracker.app/mcp`. Its key is optional
  (`userConfig.api_key`, sensitive); left empty the plugin sends a bare `Bearer`, which `presentedKey` reads as
  no key, so the call takes the shared keyless pool instead of failing as a malformed key
  (`src/lib/api/__tests__/auth.test.ts`). `claude plugin validate` passed.
- **Admin > Developers** (`convex/adminDevelopers.ts`, `DevelopersPanel.tsx`): every API account with its
  plan, keys and calls, and calls a day for 30 days split into keyed, MCP and the extension's lookup. Counts
  live in the public-data database under random ids; the action joins them to accounts for the admin alone.
- **The morning report** has "The API and assistants": yesterday's keyed calls and accounts, keyless calls by
  bucket, and the week (`api_lines`, tested).

Still to build, none of it billing: OAuth sign-in for assistants and the signed-in MCP tools (four options
against the 2026-07-28 spec in `.planning/`), bulk snapshots, and `/developers` pages for the CLI, the packages
and the plugin once they're published. *(Sandbox keys, scopes and expiry, live lookups, exports and webhooks
shipped Oct 9; see "Oct 9 2026 (night): scopes, webhooks and the paywall switch".)*

## Oct 9 2026 (night): scopes, webhooks and the paywall switch

The developer platform's next phase (merged 2:40 AM EDT, `38365d4f`; Convex deployed first, about 5 AM,
then the site). Everything is free today: **`PAYWALL_ENFORCED` is unset on Convex, so every account gets
Plus** (owner, Oct 8: "pay wall coming soon, can be free for now").

| piece | where |
|---|---|
| plans, scopes, the paywall decision (`entitlement`, read in Convex only, so flipping it needs no site deploy) | `convex/lib/apiPlans.ts` |
| keys with scopes (`read`, `export`, `live_lookup`, `webhooks`, `cases_read`; `cases_write` reserved), lifetimes, rotation, last-used | `convex/apiKeys.ts`, `src/lib/api/auth.ts` |
| a revoked or rotated key stops at once on both web copies (Convex POSTs its public id) | `src/app/api/revalidate-api-key/route.ts` |
| sandbox keys (`pt_test_`): fixed sample answers, case numbers on day 000, which DOL never issues | `src/lib/api/sandbox.ts` |
| `/v1/me`, exports past one page (CSV or JSON, capped by plan), live DOL lookups (200 a day on Plus, 20,000 for all accounts) | `src/app/v1/`, `src/lib/api/exports.ts`, `live.ts` |
| signed webhooks, Standard Webhooks headers (`webhook-id`, `webhook-timestamp`, `webhook-signature`), retried for 24 hours, never to a private, loopback or link-local address | `convex/lib/webhookSign.ts`, `convex/webhookDelivery.ts` |
| events: `case.status_changed`, `employer.moved` (from the account's watches), and the feeds `bulletin.published`, `queue.moved`, `processing_times.updated` | `convex/webhooks.ts`, `webhookSweeps.ts` (crons at :05 and :17 past 7 AM and 7 PM EDT; deliveries every 10 minutes) |
| Settings > Webhooks, the admin Developers tab (keys by scope, webhook health, live lookups), the SDKs' signature check | `WebhooksSection.tsx`, `DevelopersPanel.tsx`, `sdk/`, `sdk-python/` |

- **The webhook functions answer the site's server only.** A key's holder can compute its hash, so the hash alone
  would let them call Convex directly past `/v1`'s limits and counting; every call also carries
  `API_SERVER_SECRET` (16+ characters, the same value in `/srv/permtracker/app/env/production.env` and on Convex
  prod, piped from the server file and compared by sha256 prefix, never printed). Unset means shut.
- **A review found 11 defects before the merge**, the worst a watch sweep that rescheduled itself forever once
  300 watches existed; all fixed, and two real deliveries worked on the DEV deployment.
- **Known gap left:** a webhook host can change its DNS answer between our address check and the fetch.
- Plus is meant to be about $5 a month or $50 a year once billing exists (rename, EIN, bank, Stripe first).

## Oct 12 2026 (afternoon): the chat's models had retired, a notice named the wrong limit, a sitemap 404

**The assistant failed every reply from about 11:40 AM EDT** (Sentry 4K and 4J, production): three of
its five models no longer existed (Gemini 2.0 Flash answered 404, OpenRouter's free GLM 4.5 Air 404,
Groq's Llama 3.3 70B gone from Groq's list), Gemini 2.5 Flash had spent its free day, and Mistral
answered 429. Each provider's own model list was read, then every candidate was put through a
two-step tool call with this SDK and the production keys piped from the server (never printed):

| | |
|---|---|
| answered the tool call | Gemini 2.5 Flash (on days with quota), Gemini 3.5 Flash Lite (1.4 s), Gemini 3.8 Flash (14 s, a small free allowance), GPT-OSS 120B on Groq, Nemotron 3 Super free on OpenRouter |
| refused | Mistral: `x-ratelimit-limit-req-minute: 0`, the account itself; Cerebras: 402, its free tier needs billing; Gemini 2.5 Flash Lite answered without calling the tool |

- **The chain is six**: Gemini 2.5 Flash, Gemini 3.5 Flash Lite, Gemini 3.8 Flash, GPT-OSS 120B (Groq,
  capped at 5,000 estimated input tokens and 2,000 output: Groq's free 8,000 tokens a minute counts both),
  Mistral Small (kept for when the account is restored), Nemotron 3 Super. Gemini's free tier counts per
  model, so three Gemini models are three daily allowances.
- **A retired model is reported on first sight** (`reportModelGone`, `ai.fallback.modelGone`, once per
  process per model): a 404, a 402 or "unavailable for free". Before, a dead model hid behind any later
  model that answered, and Sentry heard only when all of them failed.
- **The summarizer** extracts facts with GPT-OSS 20B on Groq (structured output checked) and writes prose
  with Gemini 3.5 Flash Lite, then GPT-OSS 120B. Its Cerebras and Mistral models were dead too.
  `@ai-sdk/cerebras` is removed.
- **`SUPPORTED_MODELS` is held to the chain** (`CHAT_MODEL_NAMES`), and a test names the retired ids.
- **Check a provider's own model list before trusting a model id**: Google's
  `v1beta/models`, Groq's and Cerebras's `/v1/models`, OpenRouter's `/api/v1/models` (`:free` plus
  `tools` in `supported_parameters`). Groq and Cerebras refuse Python's default User-Agent (403).

**The "today's 40 are used" email** (11:47 AM EDT) fired for the site's daily count. The queue-alert
pool wasn't the limit: Resend had sent 59 by then (Monday's 29 weekly case summaries at 11 AM, about 13 admin notices),
past the 55 sign-up emails may use, while the pool had sent none. `adminNoticeWords` now names the limit
that held: "Sign-up emails wait until 8:00 PM EDT: the site has sent 59 of Resend's 100 today", or the
pool's own wording when the pool is full. The one waiting request goes at 8 PM EDT.

**A sitemap file past the last chunk answered 500** (Sentry 54): someone asked for `employer-16.xml`
while the index lists 15 (70,985 employers, ranks dense, checked read-only). A window that comes back
empty is now checked against the family's count: past the last listed chunk it's a 404
(`ChunkNotListed`), still a loud failure when the chunk is listed or the count can't be read.

## Oct 12 2026 (evening): the chat checks a change before it shows it, and an approval runs once

A user told the chat their ETA 9089 was filed; it said the case was updated to "ETA 9089 filed". `cases.update`
recomputes the stage from the dates unless it was set by hand, so the stage stayed at recruitment, and the
chat reported the fields it had sent. They then got two cards for one change (both ran), and deleted the case to
start over, losing its recruitment record and wage. `convex/caseRestore.ts` put those back from the change log's copy.
An audit of the whole chat followed; what it changed:

- **One module makes every write, both modes** (`src/lib/ai/caseActions.ts`). `prepareAction` turns a request into
  the mutation's exact arguments and checks them against the case as it is now: the PERM rules
  (`cases.previewUpdate` / `previewCreate`, which share `planCaseUpdate` / `planCaseCreate` with the mutations, so
  they can't disagree), and the stage the dates give. A stage the dates don't support answers `needsInfo` with the
  date to ask for (`dateNeededFor`) and changes nothing; `setStageByHand` is the explicit way round it. `runAction`
  runs the stored arguments and reads the case back: the result's `message`, `saved`, `notSaved` and `stage` are
  what the data holds, never what was sent.
- **Lists are changed, never replaced**: add and remove recruitment methods, an RFI or RFE and its answer date, a
  note and note status changes, tags. `clearFields` empties a field. The wage is annual dollars (it was described
  as cents and sent as a BigInt, as were the applicant count and two settings). Date-range recruitment methods are
  stored the way the form stores them (`date` empty, `startDate`/`endDate`).
- **A card is a server record** (`convex/chatConfirmations.ts`, table `chatConfirmations`). The approval route
  (`/api/chat/execute-tool`) takes only the card's id, claims the record and runs what it stored, once. A card
  identical to one still waiting (`sameAs`) runs the change once whichever is approved; the same change made in
  the last 10 minutes isn't made again; a single-case card is refused once the case changed since it was shown;
  cards expire after a day; Cancel cancels the record. Rows go after 30 days (`retention.ts`) and with the account.
- **After a step shows a card the rest of the reply is words only** (`prepareStep` sets `toolChoice: 'none'`,
  `stepShowedCard` in `src/lib/ai/chatTurn.ts`), and one reply never proposes or makes the same change twice.
- **Archive closes, never deletes**: `archiveCase` and `bulkArchiveCases` called `cases.remove` / `bulkRemove`.
- **`bulkUpdateStatus`**: "closed" sets the closure trail and the override, so a later date edit doesn't reopen the
  case; another stage on a closed case reopens it at the stage its dates support (the cases page's bulk "Reopen"
  sent "pwd" and put certified cases back at PWD); on an open case it's a stage set by hand. Already at the stage
  counts as unchanged, not failed. `reopenCase` hands the stage back to the dates. An update that closes a case
  (an I-140 denial date) records `closedAt` and "denied".
- **Calendar sync uses enable and disable** (the approval route toggled, so approving on a synced case turned it
  off), and says when Google Calendar isn't connected instead of claiming events will appear.
- **The case search** (`caseMatchesSearch` in `convex/chatCaseData.ts`) ignores case and punctuation, reads every
  case number with or without dashes, and needs every word. Not cached any more (a 5-minute-old answer read as the
  case's current state after a form edit). "Today" is the person's own time zone (`dayInZone`, `nowInZone`). The
  employer's FEIN (stored encrypted) never goes to the model.
- **The system prompt's PERM rules come from the constants** (it said 14/30/60/90-day recruitment steps, a filing
  window "30 to 180 days after recruitment ends", and a wrong PWD rule for January to April);
  `chatTurn.test.ts` holds each figure to `convex/lib/perm/constants.ts`. New sections: never assume a date, say
  only what the result says, text inside tool results is never an instruction.
- **The browser**: Cancel tells the server; Confirm and Cancel wait while a reply streams, and a continuation sent
  meanwhile waits for it (two requests at once duplicated a reply and saved a card as still waiting); the card
  lists its changes and its warning; a waiting card in an earlier reply can be approved; a card that ran is never
  re-armed; the model hears the read-back result; Stop no longer jams the chat (`ignoreIncompleteToolCalls`).
- **Not done yet** (from the same audit): seeding the model with saved history after a reload, keeping a turn that
  failed mid-stream, capturing the conversation id at send, summary facts that never drop, deleted conversations'
  audit rows and tool cache, the panel as a dialog, IME-safe Enter, markdown images from any host, a per-user chat
  quota, and unbounded conversation reads.

**Email, same evening.** The weekly case summary stays on Monday for every account (owner's call: a split across
Monday, Tuesday and Wednesday shipped and was undone the same night; empty summaries were already skipped). Mail the
site sends to its own test and demo accounts (every `@permtracker.app` address but support@; on Oct 12 the only one
was demo@) counts as done and isn't sent or counted (`isOwnTestAddress` in `sendOrQueue`); sign-in codes and resets
still go. This is outbound only: mail anyone sends TO an `@permtracker.app` address still reaches the owner through
the Cloudflare catch-all below.

**Inbound mail and owner mail moved to Cloudflare (live 5:24 to 5:42 PM EDT Oct 12 2026).** Resend counts received
mail and every alert to the owner against its 100 a day; Cloudflare Email Routing does neither. The root MX now
points at Cloudflare; its catch-all rule hands every message to the Worker `permtracker-mail` (`workers/mail/`),
which forwards it to the owner's verified Gmail and posts it to Convex `POST /inbound-email` (stored in
`supportEmails` as before, one row per Message-ID). Owner mail (`convex/lib/ownerMail.ts`: admin notices, the
morning report; the server's alarm and defense) posts to the Worker's `/owner`, whose send binding can only reach
the owner, with Resend as the fallback. The Worker's two keys sit in its KV store, set once from the Mac by
`POST /provision` so they never passed through the Cloudflare API in plain text; rotation and the DNS records are
in `workers/mail/README.md`. Proven by a test message to support@ from the press mailbox (stored, "forwarded",
accented text intact), a direct `/owner` send, and an admin notice from Convex with no fallback logged.
`postal-mime` bundled to 74 KB (an HTML entity table), too big to upload cleanly, so `mime.mjs` reads the text.

## Oct 12 2026 (night): the rest of the chat audit

The client half of the chat audit, after the incident fixes above. Each item was a defect a person could hit:

- **After a reload the model saw none of the conversation.** The AI SDK holds only this session's messages, so
  "yes, update it" in a reopened chat had nothing to refer to. The newest 20 saved turns (`HISTORY_FOR_MODEL` in
  `src/lib/ai/chatTurn.ts`) ride every request as `history` (`historyForModel` in `useChatWithPersistence`, saved
  tool calls as `[Earlier action ...]` lines the prompt calls a record); the route checks them (`savedTurns`) and
  puts them ahead of the session's own. The summary rides every compaction level now (L0 and L1 had dropped it),
  and the route fits the context whether or not a summary exists.
- **A turn that failed or was stopped after an action ran is saved**, marked `incomplete` (shown as stopped), so
  the action is on record. Try again after such a turn sends a continuation naming what ran instead of
  regenerating (which had let the model run a `createCase` twice); the panel says the actions already ran.
- **A reply belongs to the conversation it was asked in** (`requestConversationRef`, set at send): switching
  mid-stream had saved the reply and its cards into the new conversation. A switch also stops the stream.
- **One new conversation however fast the second send** (`sendingRef`), and a failed create puts the words back
  with the reason. The error copy no longer claims "your message is saved".
- **Per-account quota** (`convex/chatQuota.ts`: 60 turns an hour, burst 20, 400 a day), beside the per-address
  limit; the route answers 429 with the wait and fails open. **Stop aborts the model calls** (`abortSignal`), and
  the fallback stops on an abort instead of trying every model and reporting "all models failed".
- **Storage is bounded** (`convex/lib/chatLimits.ts`): 400 messages a conversation (the route answers 409 with a
  sentence, `createUserMessage` refuses), 8,000 characters typed (the composer counts toward it), replies and tool
  parts clipped with a note, every message read capped, the history list the newest 200 (it says so), `getMostRecent`
  one index read (`by_user_and_updated`), and saving messages rate-limited (`chatMessageWrite`).
- **Summaries**: open actions are replaced each cycle (merged, they only grew), dates are keyed by case, every
  fact category keeps its newest entries (`FACT_CAPS`), and a run that outlived its lock can't overwrite a newer
  summary or move one back (`lockToken`, the count only moves forward).
- **Deleting a conversation leaves nothing**: its cached tool answers go too, the audit row holds counts only (it
  had kept the title and summary for good), and delete-all runs in batches past one transaction.
- **Accessibility**: the panel is a labelled dialog that Escape closes, focus goes to the message box on a desk
  (the panel on a phone) and back to the bubble on close; the history panel is a Radix dialog with button rows;
  Enter during a Chinese, Korean or Vietnamese composition doesn't send; Confirm moves focus to the outcome; mode
  buttons are 44px on a phone and locked while a reply runs; motion respects reduced-motion settings.
- **Rendering and privacy**: an image in a reply is a link and never loads (quoted text could have sent details to
  any address), numbered lists are numbered again, the chat is `ph-no-capture`, and the search error logs no longer
  carry the query.

**The onboarding sample case is quiet** (owner, Oct 12 2026: no emails, no notifications). Every reader that feeds a
reminder, an RFI or RFE alert, the weekly summary (deadlines, updates, case count) or auto-closure skips `isSample`
cases (`scheduledJobs.ts`, `deadlineEnforcement.ts`); `notifications.createNotification` returns null for one,
whoever calls it, and no status email can go without a notification; it's never closed for a missed deadline; and it
puts no events in Google Calendar (`getCaseForCalendarSync`, `listForSync`; new samples start with calendar sync off).
`convex/__tests__/sampleCaseQuiet.test.ts` sets a real case with the same dates beside it each time.

**A weekly newsletter with nothing new isn't sent** (`issueHasNews` in `convex/lib/newsletterCompose.ts`): DOL's month
and average where the last issue left them, the bulletin and USCIS's quarter already reported, no Federal Register
document and no employer move that week. The issue is still built and stored, marked `skipped`; a rebuild judges it
again.

**The weekly case summary goes only in a week something changed** (owner, Oct 12 2026): a case updated, or a deadline
passed, in the last 7 days (`weekHadChange`, `summaryWorthSending` in `convex/lib/digestHelpers.ts`). Bookkeeping
isn't a change: Google Calendar sync no longer bumps a case's `updatedAt` when it stores event ids.

**One switch, `EMAIL_DAILY_LIMIT`, puts every saving back** (`convex/lib/emailAllowance.ts`; owner, Oct 12 2026: "if
we ever pay for ... enough emails these should all go back to the most helpful"). Unset or 100 and below is Resend's
free plan and everything above holds. Set on Convex to a paid plan's daily figure, read on every call, no deploy: the
weekly summary goes every week to everyone with an active case, the newsletter every week, the day's ceilings become
the same shares of the new figure (`dailyCeilings()`: 100%, 85%, 55%), and every pool (`windowFor`), every per-sweep
alert batch and the newsletter's daily cap grow by the same factor (`scaled`). Kept either way, because they're
about what helps people: one alert email a day with status changes at once, deadline reminders gathered into one
email, nothing for progress-only edits, the 10-email cap on a bulk stage change, the inactivity pause, the sample
case and test accounts quiet, quiet hours. `emailAllowance.test.ts` holds each.

**Every email to one of the owner's own inboxes goes through the mail Worker** (Oct 12 2026):
`sendOrQueue` sends a single-recipient email addressed to `SECURITY_ALERT_EMAIL` or any address in
`OWNER_INBOXES` (comma-separated, Convex env) through `viaWorker` (`convex/lib/ownerWorker.ts`), Resend only when the
Worker can't take it. That covers the site's own mail to the owner's user accounts (alerts, the weekly summary,
deadline reminders), the firm-review notice (it had gone to a second inbox through Resend) and the contact form,
which is now filed in `supportEmails` and sent to the owner with the visitor as reply-to; on the Resend fallback it
keeps the `public` ceiling. The Worker's `/owner` takes `to` and `replyTo` and answers 403 for any address that isn't
`OWNER_EMAIL` or listed in its `OWNER_ADDRESSES` binding, and its send binding allows only Cloudflare-verified
destinations, so a second inbox needs Cloudflare's verification click first. **The owner's inboxes on Oct 12 2026**: the main Gmail (`SECURITY_ALERT_EMAIL`, the Worker's
`OWNER_EMAIL`) plus the Yahoo, the second Gmail and Sabrina's Gmail (`OWNER_INBOXES`, `OWNER_ADDRESSES`), all four verified in
Cloudflare (up to 200 a account, each one click). Nothing the site sends goes to an @permtracker.app address: mail
TO those arrives through the catch-all, and the site's own test accounts are skipped. Swapping the main address is
three places, in `workers/mail/README.md`, "Changing the owner's address". **Sign-in codes stay on Resend**
(`ResendOTP`): Convex Auth sends them itself, and a code has to arrive. Bulk mail (several recipients) stays on Resend.

**Chrome's own "network error" is a dropped request** and the error screen reloads for it like "Failed to fetch"
(`RELOAD_CURABLE` in `src/components/error/recovery.ts`; Sentry 56).

## Oct 19 2026: the deadline calculator's dates leave the page

Firms that keep cases in plain Salesforce have support staff work the PERM dates out by hand and type them in.
The public calculator now hands them over three ways, and the last is the funnel into the app.

- **Copy all dates** and **Add to calendar** (`src/lib/deadlineExport.ts`): plain text with any warning first, and
  an RFC 5545 file (CRLF, 75-octet folding, all-day events, a reminder a week before each, a UID built from the dates
  entered). The calendar button waits while a warning shows; the copy carries the warning.
- **Save as a case** (`SaveDatesAsCase`, hidden in embeds): the dates travel in the address (`?calc=`) and in
  localStorage for 14 days (`src/lib/carriedCase.ts`). A new account's setup wizard saves its first case with them;
  sign-in, and the proxy for someone already signed in, go to `/cases/new?calc=`, which arrives filled; the
  dashboard's `CarriedCaseCard` catches anyone who got lost. Only the wage determination and its expiration are
  filled: the calculator never says which recruitment step came first, so the steps go in the recruitment notes.
  Nothing is saved without the employer, the job and the person.
- **The setup wizard no longer asks for a stage.** `cases.create` works the stage out from the dates and ignored the
  picker unless `progressStatusOverride` was set. Pinning the pick by hand would have left a stage that stops following
  the dates with nothing on the case page saying so, so the buttons are gone and a line says the stage follows the
  dates (owner: "whatever is best"). The case form's own auto-status switch is unchanged.

## Oct 19 2026 (night): an ETA 9089 denial, its 30 days, and three case-page fixes

- **A denied ETA 9089 has its own path** (`convex/lib/perm/calculators/denialReview.ts`, the one place): the date on
  DOL's Final Determination letter (`eta9089DenialDate`), then within 30 calendar days ONE of reconsideration by the
  Certifying Officer (`eta9089ReconsiderationDate`) or BALCA review (`eta9089BalcaRequestDate`); if reconsideration
  upholds the denial (`eta9089ReconsiderationDeniedDate`, the notice's date), BALCA review within 30 days of that
  notice. Sources, read Oct 19: 20 CFR 656.24(g)(1) and 656.26(a)(2)(i) on eCFR; DOL's PERM FAQ Round 14 (May 13 2019)
  for "calendar days", "treated as a Request for Reconsideration" when both are asked, and the 30 days after an upheld
  denial (the regulation names no period for that step); FLAG's user guide and release notes for where it's filed.
  No primary source moves a weekend deadline (BALCA said FLAG "is always available"), so the date never moves.
  DOL's 2009 appeals FAQ, still linked, says the opposite of Round 14 on forwarding: Round 14 and FLAG's "Continue to
  BALCA" button are current practice.
- Two central deadlines, `denial_review_due` and `balca_request_due` (DOL's clock, FLAG), reach every surface the
  others do: dashboard, cards, calendar slots under the ETA 9089 switch, reminders, notifications. Stage: ETA 9089,
  working while a request is owed, under review once one is pending; a certification after a denial is a reversal and
  wins. A missed request leaves the deadline overdue and the case open: no auto-close (a closure reason would need a
  schema change, and the dates can't tell a missed deadline from a request not yet recorded). Validator V-DEN-01 to 04.
- **The day count is letter date + 30** (counted like the RFI's 30), not + 29 the way DOL prints a certification's
  expiry. The attorney confirmed + 30 on Thursday Oct 22 2026, 7:31 AM EDT. Whether a weekend or holiday last day
  moves forward is still unanswered, so the date never moves.
- **"Next up" opened its quick-edit box for none of nine steps** after the Oct 11 sentence-case rename; `ACTION_CONFIG`
  is typed by `NextActionName` now. A step can save on either of several outcomes (`optional` fields: a certification
  or a denial).
- **Fields in one form row sit on one line**: `FormField` puts the hint under the input and holds the label row's height.
- **Progress chips have their own soft fills** (filed green, working yellow, RFI or RFE red, waiting for intake blue,
  under review purple, `--soft-purple`), contrast-tested in both themes and on the folder.
- **`useInactivityTimeout.test.ts` replaced `window.localStorage` and never put it back**, so in the shared `unit`
  pool every later file's storage stored nothing (the carried-dates test read null). It restores the real one now.

## Oct 21 2026 (afternoon): the getting-started guide, and three copies that dropped fields

**A copy of a case that names its fields one by one is where a field goes missing.** Three such copies sat between the
cases table and the central deadline rules, each with its own gaps, and each surface still passed its own tests because
those tests fed it the full case:

| copy | left out | what people saw |
|---|---|---|
| `toPermCaseData` (dashboard, case list, cards) | the PWD determination date, the four ETA 9089 denial dates | a passed PWD as overdue on a case whose recruitment began inside it (8 live cases, 7 accounts, measured); no denial-review deadline at all |
| the calendar page's mapping, and `caseDeadlineDates` behind the calendar and timeline queries | the professional flag, the additional steps, the stored windows, the notice of filing start, the denial dates | a professional case's filing window from the wrong step; no denial deadline |
| `getCaseForCalendarSync` (Google Calendar) | the determination date, the denial dates | a PWD expiry event that no longer binds; no denial event (none in production yet) |

All three pass the whole case now: `toPermCaseData` spreads it, `calendarCaseRow` and `calendarSyncCase` in
`convex/lib/caseDates.ts` build what the calendar query and the sync query send, and `toCalendarCaseData`
(`src/lib/calendar/fromQuery.ts`) passes the calendar row through. `deadline-agreement.test.ts` gained eight situations
(recruitment begun inside and before the determination, a professional job's window, four denial states and a
reversal), a reminders check, and checks of the calendar page and Google sync made from what their own queries send;
`convex/__tests__/recentRulesEndToEnd.test.ts` drives the real reminder job, dashboard query, auto-close and sync query.
Each was probed: the old code fails exactly the checks it should. Production check: no synced case held a stale PWD
event and no case has a denial, so nothing needed a resync.

**The case page's window cards** (`computeWindowStatus`): the ETA 9089 and Recruitment tabs passed only their dates, so a
case filed inside its window read "Expired, 82 days past expiration". They pass the filing now ("ETA 9089 filed Apr 2,
2026", no day count), and the Recruitment tab reads "Begun" once recruitment began inside the PWD (`pwdBearingFromCase`).

**`.prose-article img` is unlayered**, so `not-prose` doesn't stop it: every ScreenshotFigure picture had a 1.5em margin
inside its frame. It skips `.not-prose img` now (`article-figure-frame.test.ts`).

**The guide clips and pictures.** `scripts/record_tour_videos.mjs` records `app-tour` (dashboard, cases, a case, the
calendar, joined from `segments`) and `case-page` (each tab) beside the five older clips. Re-record the tour fixtures
first when the app's data shape changes (`UPDATE_TOUR_FIXTURES=1 pnpm exec vitest run tourFixtures --project convex -u`;
Juniper now has three notes). The article capture hides `.fixed`, which caught the chat panel mid-animation and made a
blank figure: its recipe forces opacity and transform. **Look at every clip's frames and every figure** before shipping:
a 2 KB WebP was a blank picture, and the case-page clip is what showed the "Expired" defect.
