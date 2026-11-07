# Security, legal, rivals and the business

Security audits, licensing and the legal name, the rival trackers and what was measured about them.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## The rival's whole API is public, and its data is a quarter stale (2026-08-24)

the rival tracker is the namesake competitor. Every endpoint under
Their whole `/api/*` surface answers unauthenticated - all stats, the 321,725-row
case browser, the risk estimator, and the "PRO" decision predictor - so the
product is readable end to end without touching anything gated.

Two facts that reframe the rivalry, both measured:
- **`/api/stats/data-freshness` returns `oflc_through: 2026-03-31`.** Ours runs
  through 2026-06-30. They hold more history; we hold fresher data.
- **`/api/flags` shows `risk_estimator: false`, `i485_queue: false`,
  `daily_decisions: false`** - three features built and switched off in prod.

**Their moat WAS per-case FLAG scanning - and it is gone as of 2026-08-27, because DOL serves that same lookup directly (above).** The live
pending backlog (39 months, ~99k pending), daily decision counts, and the RFI
funnel all come from scanning individual case numbers on flag.dol.gov. Every
other thing they ship runs off the same quarterly XLSX we already ingest -
which is why the tier-one gaps closed in a day.

**Their formulas, decoded:** risk score is
`3.00 + Σ weight×(subsetRate − 3.00)` (SOC 0.50, state 0.20, wage 0.15, five
booleans sharing 0.15/N); predictor is `queue_position ÷ pace`, pace from the
last 28 days split weekday/weekend, walked forward business-day-aware.

**Where we deliberately diverge:** they roll their denial factors into one
letter-graded score. We publish the measured rates and refuse the blend,
because the factors are not independent and one number would read as
precision the data cannot support. `/perm-denial-risk` says that on the page,
above the bars.

Full teardown and the remaining gap list:
`~/.claude/explanations/20260619_perm_competitor_teardown/the rival teardown doc`
plus the 2026-08-24 live delta in the auto-memory
`the rival tracker-gap-closure.md`.

## A second rival site, re-measured Sep 7 2026

Full doc set: kept outside this public repository, like the other teardowns. The
short version: on PERM this site is decisively better (live status of every
pending case, DOL's frontier, an estimator that withholds immature cohorts;
theirs tells a March-2026 filer the case was decided in eight days and its new
"alphabet patterns" report zero pending, because it reads disclosure files
only). On the bulletin and the I-485 inventory both sites hold the same federal
tables; they divide the count by a supply guess to make a forecast, we print
the count and the measured pace, and their India queue position is a quarter of
USCIS's published sum with no stated method. They are ahead on LCA salary
tooling (explorer facets, percentiles, compare-your-offer, sponsor discovery)
and on content cadence with printed corrections. Everything worth closing can
be built from `lca_cases`, `perm_cases` and the bulletin archive in about a
week; a weekly digest is blocked by the Resend 100/day cap, not by code.

## What is licensed, and what cannot be (2026-09-10)

Three different things, and conflating them is what makes a data site's legal
page wrong:

| thing | status |
|---|---|
| DOL's and State's underlying figures | **17 U.S.C. §105**: no copyright in a work of the United States Government. Nobody can license them, us included |
| our COMPILATION of them | **Feist, 499 U.S. 340**: "facts are not copyrightable"; a compilation earns thin protection through "selection, coordination, or arrangement" |
| our code, prose, design | ordinary copyright, `LICENSE` at the repo root, all rights reserved |

So `/terms` §6 states the two layers separately, §4 names bulk extraction of
the compilation as the thing not permitted, and the party is **Asolys LLC,
doing business as PERM Tracker** (renamed from PERM Tracker LLC Oct 8 2026) in the Terms' opening and operator line; its other
clauses say PERM Tracker or "us" (Oct 31 2026). `structuredData.ts` points
every Dataset's `license` at that anchor.

**GitHub showing "other" for the licence means nothing legally.** Their
`licensee` library could not match our custom text against a known SPDX
licence, so it labels it `other`. It is not a defect and not a warning.

## the rival tracker is NOT off, I read the wrong endpoint (2026-09-13)

I recorded the rival tracker as five to nine MONTHS later than everyone else and wrote
that into the ledger. That was my error, and the owner caught it by remembering
they had measured ~39 days earlier in the same session.

the rival tracker publishes TWO models and I took the wrong one:

| endpoint | what it answers |
|---|---|
| `/api/estimate?filing_date=` | a risk GRADE plus percentiles over decided cases (`p50` 468 days) |
| `/api/watchlist/predict?filing_date=` or `?case_number=` | **the decision predictor** |

Reading `filed + p50` off the first is how a competitor ends up looking absurd,
and it looked entirely plausible in isolation because a percentile over decided
cases really is that large - it carries the audit tail, which is the same defect
that made DOL's published average the wrong anchor for us.

**Their real model is the same shape as ours, and their numbers are close to
ours.** From `/api/watchlist/predict`:

```
queue_position 15,866   effective_queue 14,238
pace { weekday_avg 804, weekend_avg 243, overall_avg 644, data_days 28 }
prediction { estimated_date 2026-10-02, early 2026-10-01, late 2026-10-12 }
```

Their pace against ours: **644 vs 625 overall, 804 vs 789 weekday, 243 vs 213
weekend.** Three independent measurements of DOL's rate - theirs, ours, and
the rival dashboard's published daily volume - now agree inside a few percent. That is
the strongest evidence the rate is right that any of us has.

**On the date, the rival tracker usually runs EARLIER than us - but "we are the latest
of the three" is an overstatement I made from four cases and it is wrong.**
Over the fuller six-case bakeoff the latest date was the rival dashboard's 3 times,
ours twice and the rival tracker's once. What IS supported: the rival tracker ran earlier than
us in 5 of those 6, and in all 4 of the ledger cases. Mean gaps there were
|ours - the rival dashboard| 5.5 days and |ours - the rival tracker| 11.8 days.

**Being later is not being wrong, and being earlier is not being right.** In
that same bakeoff the rival tracker printed a date for a case five months past the
frontier where we refused, and the rival dashboard printed a date **in the past**. None
of the three has been scored against an outcome under the current model.

**The difference is cases-ahead, and it is worth investigating rather than
celebrating.** Ours 18,308 against their 15,866. Comparing month by month, the
gap is NOT a uniform offset:

- their `month_queue` **stops at 2025-12** and that final month is half our
  size (7,535 against 14,891, while November is 15,270 against 15,034). The
  response is truncated at the frontier, so their count cannot include the rest
  of the filing month - which for a mid-December filer means their queue
  position is an undercount by construction;
- but we also hold **more old pending than they do** - 501 against 96 for June
  2025, 403 against 182 for July. Fifteen-month-old cases we still call pending
  and they do not. Either they have decided them and we have not swept them, or
  we hold rows they never had. **That inflates our queue position and pushes
  every date later, and it is the thing to check next.**

`predictionLedger.test.ts` now carries a wrong-endpoint detector: any recorded
rival anchor more than 270 days from ours fails. That bound is far wider than
any genuine disagreement (the three sit within about three weeks today), so it
fires on a model mix-up rather than on a rival being wrong.


### Why our queue is bigger, measured - and why it is NOT being changed yet

Two candidates, and only one survived checking.

**Not staleness.** Eight of our June-2025 rows that we still call pending were
asked of DOL live: **8 of 8 matched exactly**. They are real, current, and
almost all `RECONSIDERATION APPEALS` or `RFI ISSUED`.

**The live difference is what "pending" counts.** Of 96,615 pending cases,
**5,675 (5.9%) are not in filing order at all**:

    ANALYST REVIEW           90,940   94.1%   <- the ordinary queue
    RECONSIDERATION APPEALS   2,413    2.5%
    APPLICATION ON HOLD       1,854    1.9%
    RFI ISSUED                  901    0.9%
    BALCA APPEALS               373    0.4%
    NORD ISSUED                 120    0.1%

the rival tracker discounts 10.3% between `queue_position` and `effective_queue`, which
is plainly the same idea. And there is an internal inconsistency in ours worth
naming: `estimateByPace` REFUSES to date a case in one of those statuses - it
says the case is not in filing order - while `casesAheadOfDay` happily counts
those same cases as competition for everyone else.

**It is still not changed, and the reason is a measurement that cuts the other
way.** Of the RFI exits we have observed, **91% (327/359) return to ANALYST
REVIEW** rather than to a decision. Those cases come back and do consume
analyst capacity later, so excluding them outright would undercount. Whether
they re-enter at their filing position or behind it is not something we know.

So the choice is genuinely uncertain, and the ledger is the instrument that
settles it rather than an argument. The four predictions recorded on
2026-09-13 include the full pending count. **If all four land late, the count
is too big and the side-queue should come out; if they scatter, it is noise.**
Tuning the queue downward now because two rivals sit earlier would be fitting
to competitors rather than to outcomes, which is the thing this repo keeps
learning not to do.

## No third-party tracker is named on any public surface (2026-09-18)

Adam: *"just say third party"*, then *"fully scrub from all public stuff so even
claude md and such"*. One live page named a rival (the `/perm-rfi-audit`
provenance strip); the **public** repo named two across 46 files. Both are now
zero, verified by a 354-page production sweep and a repo-wide grep.

**The site and the repo have to agree, and that is what made the repo pass
load-bearing.** `scripts/ingest_rfi_funnel.py` carried the rival's watchlist endpoint as a
hardcoded `BASE`. Saying "a third party" on the
page while the public repo identifies them in ten seconds reads as concealment,
which is worse than naming them outright.

**The RFI figures did not move**, and that was the gate: 3,824 ever issued,
3,213 in the frozen base, 2,151 base resolved, 2,155 total, 33-day median,
byte-identical before and after. Only the attribution wording changed, to
"third-party aggregate of DOL FLAG case statuses, frozen at first observation
and never re-read".

**The visible string lived in the DATABASE, not in code.** It was
`data_freshness.source` for dataset `rfi-funnel`, so the site-facing half was a
one-row `UPDATE` needing no deploy. Whenever a provenance line looks wrong,
check `data_freshness` before grepping `src/`.

**SCRUB THE WRITER, NOT JUST THE VALUE.** `ingest_visa_bulletin.py` wrote the
name into `data_freshness` on *every* run, so the next bulletin ingest would
have put it straight back. A value-only scrub would have silently expired.

**What looked dead and was not.** `isMirror` on `/tools/priority-date-calculator`
matches zero rows today, and its own comment says it exists so the count
"cannot drift when the ingest changes". It is an integrity counter, not dead
code; it now tests for `"mirror"` rather than a provider name. **Read the call
sites before deleting on a data-level "never fires".**

**Migration, measured first.** 48 of 164,157 `perm_case_events.source` rows
carried the old mirror label and **no production code matched that literal** -
only `test_observed_decisions.py` did, and its `MIRROR` constant must stay
byte-identical to the column. Now
`"retired mirror (third party; underlying: flag.dol.gov case status)"`.

**The cross-check survives, its endpoint moved.** `cross_check_sources.py` reads
`CROSS_CHECK_API` (a GitHub Actions secret, wired into
`processing-times-ingest.yml`) and **skips clean when unset**, so a missing
optional check can never fail a run or redden the health check. Its own UA has
identified us to them daily for months: the scrub removes the name from OUR
surfaces, it does not hide the activity from them.

**Deleted** (nothing dispatches or health-checks them, verified):
`mirror_case_status.py`, its one-off backfill, `ingest_rfi_funnel.py`,
`.github/workflows/case-status-mirror.yml`. The competitive teardowns moved out
of the repo to `~/.claude/explanations/20260918_competitive_docs/` - genericising
a teardown makes it worthless, so it leaves rather than gets rewritten. Prediction
ledger labels are `rival-a` / `rival-b`; `capture_rival_predictions.mjs` (deleted Oct 1 2026; the scorecard cron replaced it) took
`RIVAL_A_API` / `RIVAL_B_API` from the environment. **Git history is deliberately
untouched** (22 commits still contain the names).

### Two claims measurement showed were wrong

**"Our half overtakes theirs in ~74 days" was wrong** and is corrected above: it
conflated RFIs ever ISSUED (611 watched in 23 days) with RESOLUTIONS, which are
the denominator the approval rate is built on. **The frozen base holds 2,151
resolved and ours holds 4** - our share of the published rate is **0.19%** and
moves slowly, because an RFI takes months to resolve.

**And `RfiOutcomes` claimed that share "grows every day".** It does not; it grew
four times in 23 days. Corrected in the same paragraph.

## The security audit, and what it found (2026-09-18)

Asked "is anything public that shouldn't be". Method worth repeating: GitHub
secret-scanning alerts (`gh api repos/<o>/<r>/secret-scanning/alerts`), the fork
list, a scan of every tracked file for secret-SHAPED values, a live probe of
`/admin`, `/api/*`, `/.env`, `/.git/config` and source maps, and a sweep of every
URL in `sitemaps/pages.xml`.

**Clean:** no secret ever committed (only `.env.example` in the whole history),
zero secret-scanning alerts, **zero forks**, `/admin` redirects with a 15-byte
body, `.env`/`.git`/source maps all 404, and every `NEXT_PUBLIC_*` is a value
meant to be public (PostHog project key, Sentry DSN, Turnstile *site* key, VAPID
*public* key).

**Two structural facts worth knowing.** `giant-dragon-464.convex.site` answers
directly and **bypasses all twelve Vercel firewall rules** - the bot challenge
and the rate limits protect none of the Convex HTTP routes. They carry their own
budgets and cooldowns, so this is defence-in-depth working as designed, but it is
the one door the WAF does not cover. And `authRateLimit.checkAuthRateLimit` /
`checkIpRateLimit` are publicly callable by design, so a caller can deliberately
burn a specific email's or IP's login-attempt budget. Low severity, no data
exposure, but it is a thing that can be done.

**THE PUBLIC-FUNCTION AUDIT WAS MOSTLY THE AUDIT, AGAIN.** A first pass grepping
for `getCurrentUserId|requireAdmin|getUserIdentity` reported **24 public mutations
with no auth guard**. Twenty of those were the grep missing this repo's real
helpers - `verifyOwnership`, `requireProfile`, `getAuthUserId`, `resolveCallerEmail`.
The true count is **three, all unauthenticated by design** (two pre-login rate
limiters and Turnstile verification) plus `sendTestPush`, which is guarded through
`getCurrentUserPushProfile`. Never report a guard audit without first checking the
vocabulary against the codebase's own helpers.

## The legal entity is a Florida LLC, and its name is one constant (2026-09-22)

PERM Tracker LLC was filed in Florida on Sep 22 2026 through Northwest Registered
Agent (manager-managed; the manager is the attorney named on the About page; no
members listed publicly). Three surfaces bind or describe it and they had drifted:
the Terms named the LLC under the laws of the District of Columbia, the About page
named no entity, the Organization node had no `legalName`. All three read
`LEGAL_NAME` / `LEGAL_FORM` from `src/lib/constants/about.ts` now, the Terms say
Florida, and `legal-name.test.ts` holds them together.

**`.planning/` is tracked in a PUBLIC repo.** The operating agreement names the
owner, so it lives in the owner's Documents folder, never here, and the plan that
references it (`.planning/llc-and-uscis-plan.md`) says "the owner". Same rule as the
persona: a real name in a committed file is a real name in public history forever.

## Oct 12 2026 (midday): a 20-point legal checklist, the Terms, and an analytics switch

Checked against a 20-item "don't get sued" list from a video, item by item in the code and live
settings. Done already: privacy, terms, cookie section, form consents (double opt-in, unticked news
boxes), data kept small, third parties listed (PostHog's `session_recording_opt_in` read false, so
replay is off as the Terms say), no dark patterns, real reviews (5.0 from 2 on Senja, shown at the
`MIN_REVIEWS_TO_ADVERTISE` of 2), claims audits, alt text (every image), contrast, business details,
18+ in the Terms and under-13 in the Privacy Policy, unsubscribe links, licensed fonts and credited
pictures, self-serve deletion. Not applicable yet: refund and cancellation terms, needed before Plus
charges anyone.
- **The Terms said an account is deleted "by contacting us"**; Settings deletes it after a 30-day grace
  period, as the Privacy Policy said. Fixed; both legal pages read Last Updated October 12, 2026.
- **Signed-in users can switch usage analytics off** (Settings > Support, `AnalyticsToggle`):
  `userProfiles.analyticsOff`, `users.setAnalyticsOff`, and `users.isPostHogExcluded` is true for it,
  so `LoginTracker` turns the browser off through the staff path (`analytics.optOut`, dropped in
  `before_send`) on every browser the account signs in on. The switch acts on its own browser before
  the save and rolls back if the save fails; under GPC it shows off and disabled.
  `AnalyticsToggle.test.tsx`, `convex/__tests__/analyticsOff.test.ts` (probed by removing the check).
- **Click text is masked (owner's call, Oct 12 2026, 11:51 PM EDT)** by `scrubClickEvent`
  (`src/lib/analyticsRedact.ts`, called in before_send): a click in the signed-in app sends no element text or
  attributes (tag, classes, position and link stay), and no click anywhere carries a case number, USCIS receipt
  number or email address; a link to a case lookup had carried its case number in the elements chain's href.
  posthog-js's own `mask_all_text` wasn't used: the SDK copies it into the click recorder through an internal
  refresh, so flipping it per page can't be trusted. `APP_SEGMENTS` is held to `src/app/(authenticated)` by test.
