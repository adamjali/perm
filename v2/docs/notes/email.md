# Email, alerts, the digest and reviews

Resend's budgets and the send path, every alert kind and the daily bundle, preference links and one-click unsubscribe, the weekly digest, ratings and reviews, and the mail Worker's spam check.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## A refusal must not leave the trace of a success (2026-09-04)

All three subscribe mutations wrote the row FIRST and checked the global daily
confirmation budget SECOND. So a refusal still stamped `lastConfirmationSentAt`,
and `clearConfirmationCooldown` - which exists for exactly this - is only
reachable from inside `sendConfirmation`, which the refusal branch returns before
ever scheduling.

The orphan row was not the problem. **The retry was:**

1. Budget exhausted, user told "we're busy, try later". Row stamped anyway.
2. They retry a minute later.
3. The 10-minute per-address cooldown sees the stamp the REFUSED attempt left,
   absorbs the request, and answers with the **success** message.
4. They wait for a confirmation email that was never sent and never will be.

**Charge a budget BEFORE the side effect it guards, not after.** Fixed by moving
the check above the write rather than compensating below it: nothing written,
nothing stamped. `queueAlerts` and `bulletinAlerts` needed their cooldown hoisted
out of the `if (existing)` branch first so the check could sit between cooldown
and write, preserving the invariant that a cooldown-absorbed request never
consumes budget. If a guard genuinely must run late, its compensation belongs on
the same branch, never in a function that branch does not reach.

**The three daily budgets are NOT equal: caseAlerts 15, queueAlerts 18,
bulletinAlerts 6.** A test counting to a hardcoded 15 passed against caseAlerts
and silently never exhausted queueAlerts.
`convex/__tests__/subscribeBudgetOrder.test.ts` fills until the endpoint actually
refuses and THROWS if 40 calls do not exhaust it, so a vacuous pass is
impossible. Probed by reverting the reorder.

**A silent limit is disclosed STATICALLY or not at all.** The cooldown told the
user nothing and logged nothing. It is now stated in all three forms as fixed
text, never conditional: a reply that varied with state would let anyone type an
address and learn whether it is watching a case, which for immigration filings is
a real leak. That constraint forbids a *conditional* message, not a *static* one.

---

## One email system: three alert tables, one consent surface (2026-08-28)

Alert kinds: per-case status (`caseStatusAlerts`), queue-month milestones
(`dolQueueAlerts`, now with a `queue` field: perm / pwd-oews / pwd-nonoews),
and visa-bulletin movement (`bulletinAlerts`). They stay separate tables on
purpose - sweep state is per-subscription - with one surface over them:

- `/prefs` (Convex HTTP) is the magic-link preference center; the site page
  is `/email-preferences`. **OFF ONLY.** The token never expires, so it is
  never consent to START mail; turning on goes through the owning flow.
- `newsSubscribers` holds product-news consent for anonymous subscribers,
  staged by a checkbox and confirmed by the SAME double-opt-in click as the
  alert (the confirmation email names both). `syncContacts` counts confirmed
  news rows into its protected set - without that, its orphan removal
  deletes any non-user Resend contact on the next sync.
- Token purposes now include `bulletin-confirm`, `bulletin-unsubscribe`,
  `prefs`. Existing purposes must never be renamed (links live in inboxes).
- **The Resend 100/day arithmetic lives in convex/caseAlerts.ts and every
  new sending path must claim a line there before it ships.** Current worst
  case: 18+10+18+6+12+6 = 70/day, leaving 30 for auth mail.

## The weekly digest is built OFF, and the flag is the only switch (2026-09-08)

`convex/newsletter.ts` composes a Tuesday issue from the record the ingests
already hold (DOL's queue, the newest bulletin's final-action moves against
the month before, the week's Federal Register documents) and stores it as a
`newsletterIssues` row with status `preview`. **Nothing is sent unless the
deployment carries `NEWSLETTER_ENABLED=1`.** With it set, `sendBatch` mails
confirmed subscribers under `NEWSLETTER_DAILY_CAP` (default 30) charged
BEFORE each send through the shared rate-limit table, and reschedules itself
24 hours later for the rest, guarded on having made progress.

- **Consent is the alert forms' second checkbox**, staged by
  `stageNewsletterFor` and confirmed by the SAME click that confirms the
  alert. The preference center (`/prefs`, kind `newsletter`) turns it off;
  nothing can turn it on but the owning flow. The confirmation emails name
  the digest when it was ticked (an optional prop, because links already in
  inboxes predate it).
- **The composition is pure** (`convex/lib/newsletterCompose.ts`, tested) and
  the HTML (`src/emails/BulletinWeekly.tsx`) renders from the same object, so
  the two parts cannot disagree. A section with nothing to say is left out.
- **The admin panel shows the latest issue's text** and the list's staged and
  confirmed counts (`summarizeNewsletter` in `convex/lib/newsletterSummary.ts`,
  a plain helper: `adminSignals` reading it through `ctx.runQuery(internal.…)`
  closed a type cycle through `_generated/api` that typed the whole query
  `any` and surfaced as implicit-any errors in unrelated tests).
- **Proven on the dev deployment 2026-09-07, 11:59 PM ET, flag off:** one
  issue built from real data ("DOL at November 2025, 5 cutoffs moved in the
  September 2026 bulletin"), status `preview`, zero sends, and an independent
  Python recount of the two bulletin blobs agreed exactly (5 advanced, 25
  held, 0 back, of 30).
- **Flipping it on is a Resend decision first.** The ledger in
  `convex/caseAlerts.ts` puts the worst day at exactly 100 with the cap at 30,
  which is the free tier's whole allowance.

## Every emailed link is branded, and the guard nearly made them all 404

The preference-centre email pointed at the raw Convex deployment host, so a
subscriber got a link on a domain they had never heard of and an unstyled
plain-text page. Two halves:

- **`src/emails/EmailPreferencesLink.tsx`** is a real React Email template. The
  off-only rule sits ABOVE the button, because a person clicking through must
  read what the link can do before they act, not after.
- **`convex/lib/links.ts`** is the one place `SITE_URL` and `actionUrl` live
  (they had been copy-pasted into four modules), and `next.config.ts` rewrites
  `/prefs`, `/unsubscribe`, `/queue-alert/*`, `/case-alert/*` and
  `/bulletin-alert/*` onto the Convex site host.

**THE REWRITE IS GUARDED ON AN ENV VAR, AND THE OBVIOUS ONE IS NOT ON
PRODUCTION.** `NEXT_PUBLIC_CONVEX_SITE_URL` is not set in Vercel prod, so a
rewrite array guarded on it would have been silently empty and every branded
link in every email would have 404'd - with a green build and no error. It
derives the host instead:

```ts
const convexSite =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site");
```

**Check that a guarded config actually registers in the environment it ships
to.** `vercel env ls` before trusting a `?:` in `next.config.ts`, and remember
that env binds at DEPLOY time here.

## Branding a server-rendered page's URL moves every RELATIVE url on it (2026-09-10)

Adam clicked "turn off" on the preferences page and got our own DEAD END 404 at
`permtracker.app/prefs/update?token=...`. **Nothing was turned off** - the
request never reached Convex, and the page he landed on said the opposite of
what had happened.

The preferences page is server-rendered BY CONVEX, and its buttons are

```html
<form method="POST" action="/prefs/update?token=${t}">
```

**A relative action resolves against the host the page was served from.** While
the page lived on `giant-dragon-464.convex.site`, that POST went to
`giant-dragon-464.convex.site/prefs/update` and worked. Rewriting `/prefs` onto
permtracker.app moved the FORM'S TARGET onto permtracker.app too - and only
`/prefs` had a rewrite, so the POST fell through to Next.

**The screenshot alone identified it.** Convex's own failure page reads
"Invalid or expired preferences link"; Adam saw "DEAD END / PAGE NOT FOUND",
which is ours. A 404 in our styling means the request terminated at Next and
never reached Convex, so no write happened.

**Audited the surface instead of patching the hole.** A relative `action=` or
`href=` appears **exactly twice** in all Convex-rendered HTML, both pointing at
`/prefs/update`. Every other Convex route is reached by a client `fetch` that
builds an absolute `.convex.site` URL (`/contact`, `/milestone/report`,
`/milestone/summary`, `/prefs/request`, `/queue-alert/subscribe`), so none of
those were ever affected by the rebrand. `/resend-inbound` is deliberately left
off our domain: Resend is configured with the `.convex.site` URL and that
webhook must not depend on our domain or pass our firewall.

Fix is `{ source: "/prefs/:path*" }` beside the existing `/prefs`. The alert
families already had `:path*` wildcards; `/prefs` and `/unsubscribe` were
written as exact matches, and `/prefs` is the only one of those two with
sub-routes.

**Verified on the wire, because this is precisely the class a green test suite
misses**: `POST /prefs/update?token=junk` now answers Convex's 400 "Invalid or
expired preferences link" where it previously answered Next's 404, and
`/prefsnope` still 404s so the rewrite is specific rather than a catch-all.

`convex-relative-urls-rewritten.test.ts` gates the invariant: every relative
URL inside Convex-rendered HTML must have a rewrite behind it, with a control
asserting it found any targets at all. Probed three ways - removing the new
rewrite, adding a relative link to an unrewritten family, and routing Resend's
webhook through our domain - and a fourth probe was DISCARDED as a bad test,
because `/prefs/newthing` is legitimately covered by the wildcard.

**The general rule: rewriting a server-rendered page's URL is never a one-line
change.** It re-bases every relative URL that page emits.

## Who has actually been sent mail, and how to answer it (2026-09-14)

Two records, two windows. **Resend's `list-emails`** is the record of what left:
100 a page, newest first, five days took two pages; every row carries recipient,
subject, status and time. **The alert tables' own stamps** are the all-time
record per subscriber: `caseStatusAlerts.lastAlertSentAt` (+ `alertCount`),
`dolQueueAlerts.notifiedAt`, `bulletinAlerts.lastAlertSentAt`,
`newsletterIssues.sentCount`, and `userProfiles.reengagementNudgeSentAt` (keyed
by user id; join `users` for the address). Read them with

```bash
npx convex data caseStatusAlerts --prod --limit 5000 --format jsonl
```

which is read-only and needs no function. The two agreed exactly on the overlap
(6 status alerts in the window, 6 in the table).

Measured 2026-09-14: **147 sends in five days, all delivered**, Thu 42 / Fri 20 /
Sat 9 / Sun 11 / **Mon 65**, against the shared 100-a-day cap; Monday carries the
52 weekly summaries plus the 10 AM deadline reminders and the 7 AM/7 PM alert
sweeps, and the ledger's worst case of 70 held. All-time subscriber-facing sends:
**9 case-status alerts (every one CERTIFIED, 3 of them LCAs), 2 queue-month
alerts, 0 bulletin alerts (7 confirmed live, no bulletin has moved since), 0
digests (flag off, one preview issue)** against 83 / 17 / 8 / 17 subscriptions.
The LCA path is proven end to end in production: confirmed Sep 10, told of
certification Sep 14. One leak worth closing: the inbound webhook forwards spam
("casino leads for sale") to the owner's Gmail through the same Resend quota.

## Every email has a way out, and it is the right one for who gets it (2026-09-16)

Adam asked whether every email links to the preference page, "maybe prefilled
per email". The preference page (`/prefs?token=`) already IS the prefilled
version: the token is signed for one address, the page lists every alert that
address holds by name, and it is off-only. The gap was that only the digest
linked to it. Surveyed all 22 templates and their senders; the rule that came
out, gated by `src/emails/__tests__/footer-links.test.tsx`:

| who gets it | in the footer | header |
|---|---|---|
| subscriber mail, no account (case status, queue month, bulletin moved, the digest) | "Stop these alerts" (one click, per kind) AND "Email preferences" (the magic link, `focus=` on the row the email was about) | `List-Unsubscribe` + one-click |
| account mail about the user's own cases (deadline reminders and digest, RFI/RFE, status, auto-closure, weekly summary, nudge) | "Manage notification settings" into the signed-in Settings page, which already existed in the shared layout | the weekly summary and nudge carry one; the rest are transactional |
| confirmations, codes, resets, welcome, deletion | nothing: there is no subscription to manage yet | none |

**The token page must never be a door into an account.** It never expires and
anyone who sees the email can use it, which is acceptable for turning subscriber
mail off and unacceptable for account settings; the two stay separate on
purpose, and the test asserts account mail never carries `/prefs?token=`.

`EmailLayout` grew a `settingsLabel`; the three alert templates take an optional
`prefsUrl` (optional because mail already built by older callers must still
render) and show the preference link only when given. `convex/lib/prefsLink.ts`
builds the link and the one-click URL in one place; the senders pass
`focus=case:<id>` and so on, and `/prefs` marks that row. **`POST
/prefs/unsubscribe?token=&kind=`** is the one-click target for every
preference-center kind (RFC 8058: the client POSTs `List-Unsubscribe=One-Click`
and expects the address off, no page); GET renders a confirm button so a mail
gateway prefetching the link never unsubscribes anyone. The digest's
`List-Unsubscribe` header points there; it was the one subscriber email without
one.

**The digest says "same as last week" instead of restating a bulletin.** The
bulletin lands monthly and the issue goes weekly, so issues two and three of a
month used to report the same five moves as news. `buildIssue` reads the
previous issue's bulletin month (`previousBulletinMonth`) and sets
`bulletinRepeat`; the subject, the text and the HTML each say so in one line.

**Go-live plan for the digest, decided with Adam:** this batch deploys the fixes;
the Tuesday 9:00 AM ET cron (`weekly-bulletin-digest`) builds the Sep 22 issue
under the new composition; he reads it on `/admin` (or asks for it); if it
reads right, `NEWSLETTER_ENABLED=1` on prod Convex and the first real send is
Tue Sep 29, 9:00 AM ET, to the 11 confirmed subscribers. Three reminders carry
it: the due-check routine's self-retiring Check 4 (Sep 22 to 29), a calendar
event Tue Sep 22 9:30 AM ET, and the batch ledger.

## The digest names USCIS's quarter once, the week it lands (2026-09-22)

`buildIssue` reads the newest `uscis_form_quarters` quarter and
`pickUscisMedians` chooses one workbook line per form BY TITLE (I-140; the
employment-based I-485, 6.0 months in FY2026 Q3 where the busier family-based
line is 7.0; the adjustment-of-status I-765; the inside-the-US advance parole
I-131). `uscisRepeat` is set from the previous issue's `uscisQuarter`, the same
mechanism as `bulletinRepeat`, except a repeated quarter is SILENT rather than
restated: a bulletin is monthly and a "same as last week" line earns its place;
a workbook lands four times a year and twelve repeats would be noise. The
subject's cap drops the USCIS part before DOL's frontier and the bulletin.

- **React's SSR puts `<!-- -->` between adjacent text nodes**, so `{m.label},
  months` renders as two nodes and a test for the joined string fails. Render a
  label as one template literal, and assert the halves separately where a
  comment can legitimately sit.
- **A subject test has to leave room for the part it asserts.** The full
  fixture already fills the 78-character cap, so the USCIS part is dropped by
  design; the assertion runs on a fixture with room and separately checks the
  cap holds.

## Sep 26 2026: follow an employer, and one alert email a day

Adam, after the X post: capture the traffic, build off it, and *"i feel like we already have too much
emails as it is ... just merge everything in"*. He chose a daily bundle plus a digest block, and
triggers of "holds plus bulk decisions".

**Following an employer** (`convex/employerAlerts.ts`, the card on every `/perm-employers/<slug>`,
`#follow`): an email when DOL moves the employer's cases as a group. Two lists feed it, both written
by the sweep into `perm_docs['employer_stages']`:

- `holdMoves`: five or more of its cases on or off hold in one Eastern day (Sep 25).
- `decisionMoves`: a batch decided on one day, at least 10 cases, at least 5% of its queue that
  morning, AND at least 3 times its own average day over the window. **The third rule came from
  measuring:** the first two alone passed Amazon Dev Center on 42 and 44 certifications on consecutive
  days, its ordinary flow. With all three, 168 batches across 92 employers in the month, none more than
  six. Certified and denied are DOL's; withdrawn is the employer's, and the sentence says so.

`toldMoves` keys (`<date>|hold-on|<to>`, `<date>|decided|<to>`) are the change detector, seeded at
confirm time so a move already on the page is not news; `followingFrom` and a 3-day freshness window
back it up. **The employer's name in every email comes from our records**: the HTTP route looks the
slug up in `perm_entities` then `perm_live_only_index` and refuses a slug it does not hold, so the form
can never put a stranger's words in someone's inbox (probed: passing the body's name turns the test red).

**One alert email a day** (`convex/lib/alertDelivery.ts`, `convex/alertOutbox.ts`). Every alert kind
(case, queue, bulletin, employer) builds its full email and hands it to `deliverAlert`. An address
following exactly one live thing, not yet mailed today and with nothing waiting, gets it at once;
anything else waits in `alertOutbox`, and `sendBundles` (12:30, 18:00, 23:30 UTC since Oct 31 2026; 11:30 before) sends each address at
most one email per Eastern day: the stored email for one item, `DailyUpdate` for several, its
List-Unsubscribe a prefs one-click with the new `alerts` kind (every alert kind off, news and digests
kept). A queued item counts as delivered for the producer's own detector; the outbox retries 6 times,
then records `failed`. Every opt-out path drops what is still waiting for the rows it touched
(`dropQueued`). Sent rows keep only their summary and are pruned at 30 days.

**Budgets did not move.** Employer confirmations share the case confirmations' 15 a day and employer
alerts the case alerts' 18. Every limit lives once in `convex/lib/alertBudgets.ts`; a test holds that
table to the ledger in `convex/caseAlerts.ts` (75 a day). Each refusal is counted per pool per Eastern
day in `budgetRefusals`, which is the admin panel's "time to move off Resend's free plan" signal.

**The weekly digest** carries an "Employer-wide moves this week" block (holds first, then batches, six at
most), read from the same doc.

**The admin page is tabs now** (Overview, Alerts and email, Users, Weekly digest; the tab is in the URL
hash). New: every budget pool with 24-hour use and the week's refusals, the outbox (waiting, oldest wait,
emails vs alerts inside them, bundles, failures, drops), the latest 30 alerts, who follows which
employer, and the subscription lists searchable and collapsed to ten rows.

**Decided cases keep their daily re-check, and the measurement is why.** Adam's bar was "only if for
SURE not gunna lose anything". The event log (Aug 26 to Sep 25) shows "final" statuses moving: 105
WITHDRAWN cases went to CERTIFIED, 2,541 DENIED went to RECONSIDERATION APPEALS and 185 to BALCA, and 47
DENIED became CERTIFIED. Only CERTIFIED - EXPIRED (206,415 held, about 4,100 requests a night) never
moved, and thirty days of no moves is not proof: a slower tier would date any move it did make up to a
week late, in a log whose whole value is the day. Revisit once the log covers a year.

**Deployed Sat Sep 26, Convex first (about 2:05 AM EDT), then the site (`92387de5`).** Backward
compatibility was checked before either: the schema only adds four tables; no export, route, token
purpose or one-click kind was removed; the branch's parser read production's census doc (written
before decision batches existed) as 1,000 employers, 5 hold moves and an empty decision list; digest
issues built before the deploy have no employer block and render unchanged; the Convex routes answer
refusals correctly on production; and the employer sweep and the bundle sender were run once by hand
with nothing to send.

**The employer page's queue band was weeks stale, and the follow block made it visible (found
Sep 26, 2:20 AM).** `LiveQueueBand` reads `perm_entity_pending`, which only the full rebuild after a
disclosure load wrote, while the band prints the sweep's date. Adobe's page said 199 waiting (197 in
analyst review) directly above a follow block saying 218 pending, 216 on hold. `write_pending` now
refreshes the table in every `--live-recent-only` run, diffed with one normaliser on both sides
(`pending_norm`), and adds each employer whose queue moved to `changed-employer-slugs.json`, weighted
by how much moved. First run measured read-only: 5,982 of 59,318 rows to write, Adobe 8th of the
pages to expire. `test_live_recent.py` also ran three check groups AFTER its verdict, so their
failures printed FAIL and exited 0; every group now runs first, and both new checks were probed red.

**Fixed on production the same night, not at 4:10 AM.** A hand run of the builder would have
diffed tonight's run against a fresh table and expired nothing, leaving pages already rendered
with the stale band for 30 days. So `fdc797cb` was pushed (scripts only; Vercel skipped it) and
`case-status-direct.yml mode=discover` dispatched at 2:23 AM EDT, which runs the builder where
`REVALIDATE_SECRET` lives: 6,010 rows written, `{"revalidated":800}`, and Adobe's band read 218
waiting, 216 on hold, on the next request. The walk in the same run stored 207 PERM and 550
PWD/LCA filings.

**QA on production after the deploy:** glued text 0 across 82 pages (3 per template, control
found); SSR visibility 0 findings on 25 employer pages; the follow block on a published and a
live-only employer; 20 Follow links at 44px on the census page; an invalid address blocked by
the browser's own validation, so nothing was sent; no console errors on the employer page, the
census page or any of the four admin tabs; every one of the 365 public titles carries the brand
once (two legitimately name it: "About PERM Tracker", "Launch: PERM Tracker 2.0").

**Waiting for the next deploy (not worth a build and a cold ISR cache alone):** the admin title
reads "Admin Dashboard | PERM Tracker | PERM Tracker" (the page's title already carries the brand
the root template adds; since Feb 2); and "Latest alerts: No alert email in the last 7 days" is
true of the outbox only, which began recording at this deploy, so it should say so until the
week fills.

**One-click unsubscribe had been challenged since the firewall inversion (found Sep 26).** Every alert
email's `List-Unsubscribe` points at `permtracker.app/...`, and all six unsubscribe paths sit in rule
12's challenged set. Mail providers POST one-click from their own servers, which cannot pass a
browser challenge: measured, each POST got `429 challenge`, including links in mail already sent.
Firewall rule 13 bypasses exactly those POSTs (GETs stay challenged), after which the same probes
reach Convex and answer 400 on a junk token. Whether Gmail's unsubscribe servers had been passing as
verified bots before is unknown; the rule makes it not matter.

Two traps from building it:
- **convex-test runs scheduled functions in the background**, so a test that schedules fifteen
  confirmation emails has them land in the NEXT test's fetch stub (16 "sends" where 1 was expected).
  Filter the stub by what the test is about.
- **`npx convex codegen` uploads to the dev deployment**, crons included; the new sweeps run there too.

## Oct 5 2026 (evening): fewer alert emails, fewer scheduled jobs

Adam: *"constantly getting emails from perm tracker post hog sentry with errors and github too check all fix all"*.

- **PostHog's "New error type" alert (insight `JUT2jefy`) counts a type only once its SECOND distinct visit lands**,
  among types first seen in the last 7 days. It had emailed on every never-seen error, one-off browser-extension
  junk included: 5 emails that day, about 40 in 10 days; the new rule would have sent 3 since Oct 1, all real.
- **A grouping rule files webpack's missing-module crash as one issue** ("reading 'call'", and Firefox's "can't
  access property call"). Each deploy renames the runtime file, so it had become a new type, and an email, per build.
- **That crash is still open**: about 8 a day of roughly 4,400 pageviews, caught by the error screen, which reloads
  once and recovers. Ruled out with data: `failedRequests` is always empty (no file failed), most happen hours after
  a deploy (not a build switch), and 39% of all pageviews follow a Cloudflare check against 28% of crashes (not the
  check). PostHog can't decode its stack traces: it gets 403 fetching `/_next/static`, and no browser source maps ship.
- **The Federal data ingest no longer reads the visa bulletin.** Its step pulled the last 18 months from the Internet
  Archive, all of which the daily direct read from State already holds at a higher rank; it only ever failed.
- **The due-check routine is now "LLC Deadline Reminders"** (`trig_01U2UC9qeUvdft461DoV785m`, Mondays 9 AM EDT, no
  repo checkout): the rename to Asolys on Sunbiz (which refuses scripts), the annual report, the agent renewal. Its
  health, bulletin and limits-sheet checks were duplicates of the morning report and of ingests automated Sep 26.
- **Sentry 4T resolved** (an employer-list query deadline last seen Oct 3 during history loads; ~2 s now).
- **The email-ledger tests pin their clock to midday UTC** (`pinMidday` in `convex/__tests__/emailLedger.test.ts`).
  `setupSchedulerTests` starts the fake clock at the real time, and these tests count a UTC day and jump the clock
  minutes ahead: CI at 11:56 PM UTC crossed midnight mid-test and failed. Probed red by pinning to 11:57 PM UTC.
  Any test that jumps the clock over day-keyed logic needs the same pin.
- **`source-map-js` is pinned to >=1.2.2** (GHSA-68fv-2mgg-jv7q, high, event-loop DoS); Dependabot can't bump a
  transitive package, and 1.2.2 was under the 7-day release-age floor, so it is excluded by name until Oct 7 2026.
  `pnpm audit` still lists `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm): no patched version exists, and it is dev-only (lint,
  through `eslint-config-next`) with no untrusted glob patterns, so it is left.

## Oct 7 2026: alerts within minutes (owner's call: "faster and more often, as much as reasonable")

A certified user wrote that our email reached him after his attorney had heard; FLAG emails the
attorney the moment DOL decides. Before this change a watched case was asked about once an hour
(GitHub, dispatched at :25 and skipped while a sweep ran), and the email then waited for the
once-a-day bundle whenever the address followed more than one thing or had been mailed that day.

| what | before | now |
|---|---|---|
| watched cases against DOL | hourly, through GitHub | **every 5 minutes, Mon to Fri, 7 AM to 9 PM Eastern**; on the half hour otherwise (`permtracker-watched.timer` on the server) |
| the email for a status change | at once only for a one-subscription address not mailed that day | **always at once** (`IMMEDIATE_KINDS` in `convex/lib/alertDelivery.ts`); an older queued item about the same case is dropped |
| browser push | 7:20 AM and 7:20 PM ET | 30 s after the email sweep, whenever a watched case moved |
| DOL's processing times (site and queue-month alerts) | daily | **hourly at :05 and :10, Mon to Fri, 12 to 22 UTC** (quick pass of `processing-times-ingest.yml`; Convex `dol-processing-times-hourly`) |
| the visa bulletin read and its alert sweep | daily | **hourly in the same quick pass**; `bulletin-alerts-hourly` at :25 |
| pending PERM pass | 4:10 AM and 3:40 PM ET | **plus 10:40 AM ET on weekdays** (`case-status-midday`) |

**How the server reaches Convex without a deploy key.** Two routes in `convex/http.ts`, both behind
`WATCHED_CASES_SECRET` (Convex production env, and `/srv/permtracker/secrets/watched_cases_secret`,
mode 600): `GET /watched-cases` answers case numbers only, and `POST /watched-cases/sweep` schedules
the email and push sweeps. Unset means off (503), never open; the secret is compared as SHA-256
digests. `convex/__tests__/watchedRoutes.test.ts` holds all three answers, probed by opening the gate.
Convex's own Turso client stays read-only on purpose (`publicMirror.ts`): the server pulls the list,
Convex never writes the corpus.

**`scripts/check_watched_cases.py --from-convex --cadence --sweep`** is the job: `due()` decides which
5-minute runs go through (tested across a weekday, a weekend and the clock change), the writes are the
same conditional pair as before, and it records a run when something changed or failed and once an
hour, so `ingest_runs` gains about 24 rows a day, not 288. `check_watched` in the health check fails
past 3 hours without one. `watched-cases.yml` is kept as the hand-run fallback; nothing dispatches it.

**What it costs:** about 2 DOL requests per 5-minute run for the few hundred watched numbers (DOL's
batch is 50), against the roughly 10,000 the nightly sweep makes; Resend volume is unchanged, only
the timing. **What it can't do:** beat the attorney. DOL emails the filer the moment it decides; the
best we can do is a few minutes after.

## Oct 11 2026 (morning): everything that goes out, and server checks that tell the truth

**Every email, notification, toast and confirmation reads in one voice** (owner: "ANY and any and all notis
and anything that would go out"). Commit 5ce5781f.
- **24 email templates**: sentence-case subjects, previews and buttons, no emoji, shouting or exclamation
  marks. `src/emails/__tests__/email-voice.test.ts` renders every template and fails on any of them, and on
  a Convex subject in title case; probed red with each. **A template's sample props never cover every
  branch**: the weekly digest's empty message lives in `convex/lib/digestHelpers.ts`, which the gate can't see.
- **The deadline digest's subject and preview** come from `convex/lib/deadlineDigestWords.ts` ("1 PERM
  deadline needs your attention", "3 PERM deadlines need attention, 1 overdue"); its first version printed
  "1 PERM 1 deadline", caught by its test.
- **Times in emails are Eastern** (`emailStamp` in `convex/lib/time.ts`): Convex runs on UTC, and admin
  notices had printed UTC with no zone.
- **The demo account's deadline alerts stopped looping through support**: `shouldForwardInbound` drops mail
  from `notifications@` unless it was sent to `support@` on purpose (the contact form does exactly that,
  so a blanket own-sender rule would have silenced it; tested).
- **In-app text**: errors say "Couldn't save the case. Try again." (one form, with the article), successes
  drop "successfully", the chat's delete confirmations stop shouting, the reopen toast names the progress
  label (`formatProgressStatus`, never a raw key). **Rewrite user-facing strings only in their user-facing
  context** (`toast.*(`, `userMessage:`, the `caseWriteErrorMessage` fallback): a repo-wide `Failed to`
  replace also hit developer log lines and Sentry's filter for the browser's own "Failed to fetch".

**DOL's wage-request wait is read live** (`dolPwdNow`, `pwdSentence`, `pwdWaitPhrase` in `lib/dolNow.ts`;
`<DolNow show="pwd" | "pwdWait" | "pwdMonth" />`). Seven places typed "4 to 7 months"; on Sep 30 2026 DOL was
deciding PERM wage requests filed in June 2026, 3 to 4 months on (the wait is measured from the first and
the last day of DOL's month to its date). `no-typed-dol-average.test.ts` catches a typed wage-request range,
with a recruitment-period range as its must-not-match control. Article callouts take a live figure in
`stat=`, use Phosphor icons for their type, and their titles are sentence case.

**Server checks** (installed by hand, each server copy's sha checked against the repo):
- **`permtracker-health` lists units stopped after an error** (`stoppedUnits`): `Restart=always` with
  systemd's default start limit leaves a unit `inactive (Result: exit-code)`, which `systemctl --failed`
  misses. pmlogger sat like that from Oct 10 5:31 AM to Oct 11 8:58 AM EDT, so the PCP archive has a gap
  there. The PCP drop-in now restarts every 60 s with no start limit.
- **The database folder is judged by sqld's own rules**, not a ratio to the data file: snapshots are merged
  at twice the data, the log is compacted at 4.1 GB (`--max-log-size 4096`), so up to about 3x the data
  plus one log is normal. The morning report prints each part.
- **Swap warns only when it's moving** (pages a second from `/proc/vmstat`) or memory is short; idle swap
  is a line, not a warning.
- **The alarm's all-clear says what cleared** ("the disk is no longer on course to fill"), and the defense's
  emails open with their Eastern time.
- **The morning report scores wage-request dates per live method** (`pwd-day`, `pwd-queue`), leaving out
  retired ones (`RETIRED_METHODS`, held to `src/lib/scorecard/verdict.ts` by its test).

## Oct 24 2026: ratings that save on open, honest check dates, phones with a notch

**The alert rating saves on open** (`convex/alertRatings.ts`, `recordClick`; the GET in `convex/http.ts`). A box in a
case's last alert opens `/case-alert/rate?token&c&r=N`; the GET verifies the `alert-rating` token, requires a watch for
that address and case, saves the pick, then answers 303 to the review form (3, 4 or 5; `reviewLinkFor` seals the
address) or renders the "what went wrong" page (1 or 2). Every open and tap is kept in `alertRatings.clicks` (score,
time, `email` or `page`, the browser line cut to 300 characters, `scanner`), newest 20. An open is a scanner's when a
different score was opened within `BURST_MS` (60 s; every open in that minute is marked) or its browser line names a
fetcher (`SCANNER_BROWSER`, a missing line included); a page tap is always a person. `score` is the newest pick that
wasn't a scanner's and is absent on a row only a scanner opened; `ratingsSince` skips those. An address opening its
link in a loop stops writing after `CLICKS_PER_HOUR` (20) and still goes on to its page. The redirect target is fixed
(our own pages), so the link can't be turned into an open redirect. Admin > Reviews shows `alertRatings.forAdmin`
(admin only): each rating with the account name, the watch (signed up, confirmed, source, alerts sent, last status),
the newest review from that address and every open. The Privacy Policy names the browser line (Oct 24 2026).
`convex/__tests__/alertRatings.test.ts` probes the burst, the browser check, the loop cap (the oldest kept open must
survive, since the list is trimmed to 20 either way) and the watched-case check.

**Case alerts and confirmations read `fetched_at`** (`observedLabel` in `convex/caseAlerts.ts`): the millisecond stamp
the sweep writes when it first records a status, as an Eastern day, worded "DOL's record has shown this status since at
least <day>". Every program's live table has it. `last_checked_at` is a retired mirror's string stamp nothing has
written since Aug 27 2026; an alert for a case certified Oct 22 said "DOL last checked it on July 16". The test asserts
the sweep never reads `last_checked_at` again.

**Testing the alert emails end to end on production** (owner, Oct 24 2026). Sign the owner's own address up for a
real decided case with `npx convex run caseAlerts:subscribe '{"email":..,"caseNumber":..,"source":"owner-test"}'
--prod` (that sends the real confirmation); confirm with `caseAlerts:confirmByToken`, its `case-confirm` token signed
in a script that reads `UNSUBSCRIBE_SECRET` from `npx convex env get ... --prod` on stdin (never printed); set the
watch back one step with `caseAlerts:seedObserved` (status "ANALYST REVIEW"); run `caseAlerts:sweepCaseChanges` until
it sends: it reads 300 watches a run, oldest check first, and `seedObserved` stamps the row as just checked, so it
falls in a later run. Clean up with `testData:removeOwnerTest` (dry run first): watch, rating, congratulations note and
outbox row, and it refuses any watch whose source isn't "owner-test".

**Phones with a notch** (`src/app/layout.tsx` `viewportFit: "cover"`; globals.css "The device's own insets";
`src/app/__tests__/device-insets.test.ts`). The page runs under the notch, punch hole, rounded corners and home bar,
so the header, footer and bands fill the screen. Each wide content column (`mx-auto` with `container`, `max-w-2xl` to
`max-w-7xl`, or `max-w-[1200px]` to `[1440px]`, and no border of its own) takes a transparent border as wide as the
inset the device reports on that side: zero on a device without one, inside the column's width (border-box), so nothing
moves anywhere else. Margins were rejected because numeric margins change content-sized flex items, padding because it
overrides each column's own gutter. Edge controls add the inset in their own arbitrary values, written with
underscores (`right-[calc(1rem_+_env(safe-area-inset-right,0px))]`): the chat button and panel, back to top, the data
menu tab and drawer, the header's menu panel, side panels, the selection bar and the case form's save bar. Measured
with a simulated 59px notch (Chrome's `Emulation.setSafeAreaInsetsOverride` over a Playwright CDP session): logo 16
to 75px, no sideways scroll; upright phones identical to the live site. **Chrome on iPhone keeps every page inside the
safe area whatever the page says**: `AdjustInsetsForSafeArea` in `ios/web/web_state/ui/crw_web_view_content_view.mm`
widens the side insets to at least the safe area with no viewport-fit check (open bug crbug 40199143), so light side
strips stay there; owner: "it's fine just leave it". Safari runs edge to edge.

**Smaller:** asking for a star scrolls the stars up, and a resting mouse then filled them as if picked; a pointer
arriving in the 800 ms after that scroll is ignored (`hoverQuietUntil`). A test that keeps an element across a keyed
remount (the stars' row remounts to shake) holds a detached node: query again after it. Cloudflare served `/login` 65
minutes after the deploy that changed it (`age: 3898`, `cf-cache-status: UPDATING`): read those headers before calling
a fix missing. Ledger: `.planning/reviews-and-ratings-2026-10-24.md`.

**robots.txt never waits behind a limit** (`location = /robots.txt` in `scripts/oracle/nginx/permtracker.conf`,
installed 6:57 AM EDT Oct 24 2026, new workers confirmed). Next writes it at build as
`.next/server/app/robots.txt.body` (byte for byte what the route serves); nginx serves that file from the live
release with no limit and falls through to Next if a release lacks it. From the server's own log, Googlebot's
requests a day and the share refused with nginx's busy page (all 503s, mostly employer pages, the search engines' 12
slots full of slow renders before the Oct 21 speed fix): Oct 17 to 21 between 37,000 and 48,000 a day, 9% to 37%
refused, robots.txt refused 6 to 41 times a day; Oct 22 on, 0 refused, but Googlebot down to about 5,000 and then
3,700 a day. Google's own docs: while robots.txt answers 5xx "Google stops crawling the site" (up to 12 hours), and
the crawl capacity limit falls on 5xx and slow responses and rises when the site "responds consistently". Search
Console's Host status ("robots.txt fetch" and "Server connectivity": high fail rate) describes that week; read its
"Last updated" day before reading it as current. `test_nginx_conf.py` checks the location and probes both a limit
put back on it and the location removed.

## Oct 25 2026 (afternoon): a spam filter on our mail and the contact form

The owner's yes, Oct 25. Mail to an @permtracker.app address and contact-form messages are checked before they reach
the inbox; a message the check holds is stored and listed, never deleted unread or bounced.

- **The rules** (`convex/lib/spamCheck.ts`, pure): an upstream spam flag (+3), a web address typed into the name (+3),
  3 or more linked sites (+1, 8 or more +2), a push to a messaging app (+2), sales pitches (the first +2, the next two
  +1 each), a bulk unsubscribe header (+1), replies to another domain (+1), a shouting subject (+1). Held at 3.
  Pitch phrases only add weight, so nobody is held for writing in Chinese, Korean or Vietnamese. On the 130
  messages support@ had received (Feb 12 to Oct 23), the rules alone held 23 spam messages and no real one.
- **Cloudflare's AI is the second opinion** (Workers AI, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, JSON mode, about
  7 neurons a message): "spam" adds 2, "not_spam" takes off 1. It can't hold a message alone and can't rescue a
  strong hold. With it, 39 of the stored 152 (support@ and the other addresses) are held, no real person among
  them. The plain llama-3.1-8b-instruct was retired May 30 2026: the binding answered error 5028 and every
  opinion came back empty until the model changed, so `/classify` now reports the AI's error.
- **Always through**: a reply to a message we answered (its thread names a `supportEmails` row with `repliedAt`), a
  sender the owner let through, and the services we hold accounts with (`ACCOUNT_DOMAINS`: Oracle's account
  activation read like a renewal pitch). **Always held**: a sender the owner marked as spam. Medium's mail is filed
  as a notice (`notice`), still forwarded, kept off the admin list.
- **The mail Worker asks before it forwards** (`workers/mail/README.md`, "The spam check"): it reads a message up to
  256 KB, asks the AI and Convex `POST /inbound-email/verdict` with 4-second limits, and forwards unless the answer
  is a clear `hold`. Proved before upload with fake messages: Convex missing, failing or silent, the AI failing or
  absent, and a message too big to read all forward. Uploaded through the Cloudflare API with an `ai` binding.
- **The contact form carries Turnstile** (invisible for most, `action="contact"`, a new token after each send). A bad
  token is refused with a reason (`convex/lib/turnstileVerify.ts`); a missing one adds 2 and an outage 1, because a
  hold loses nothing. The message then goes through the same check (`contactForm.forward`).
- **Admin > Alerts and email, "Spam filter"**: held mail with why, Not spam (sends it on now through `sendOwnerMail`,
  reply going to the sender, and lets that sender through from then on), Delete; below, mail that got through with
  Spam (holds that sender from then on). Senders are keyed by address for free mail, by `@domain` otherwise
  (`mailSenderVerdicts`). Held mail is deleted 30 days after it was held (`pruneHeld`, from `retention.ts`), and the
  morning report lists what was held by subject and domain (never an address).
- **The Privacy Policy says so** (Section 9 and the contact form and Cloudflare entries, Last Updated Oct 25 2026),
  from Cloudflare's own Workers AI data-usage page: not kept after the request, not used for training.
- **Tests for it, and two traps they hit**: `convex/lib/spamCheck.test.ts` (spam and real messages in five languages),
  `convex/__tests__/inboundFilter.test.ts` (the route, held mail, Not spam, Delete, Spam, the clean-up, the contact
  form's hold and Turnstile refusal), `convex/lib/turnstileVerify.test.ts`, the Worker's helpers in
  `mailWorkerRules.test.ts`, and `mailWorkerEmail.test.ts`, which runs the Worker's real email handler on fake
  messages and holds that only a clear hold keeps one out; each was probed by breaking the rule it holds. convex-test swallows a scheduled
  action's throw: `sendReleased` died on a missing `AUTH_RESEND_KEY` and the test only saw nothing sent. And a
  `vi.fn` declared with no parameters types `mock.calls` as empty tuples (TS2493 in the typecheck, fine in vitest).
- **`publicMailReserve.test.ts` now filters the Worker stub's calls by URL**: the contact form asks `/classify` before
  it sends, so "called once" became two calls.
