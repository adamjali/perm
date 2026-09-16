# Monetization: parked with a trigger (decided 2026-09-16, 1:31 PM EDT)

Adam's call after the analysis below: **nothing now.** No beneficiary paid tier, no
AdSense, no donation link. Revisit on a NUMBER, not a date. This file is the record so
the question is not re-derived from scratch next time.

## The trigger (my thresholds, not measured ones)

Revisit a beneficiary paid tier when EITHER:
- confirmed case-alert subscribers pass **~1,000** (today 83), read with
  `npx convex data caseStatusAlerts --prod --limit 5000 --format jsonl`, or
- monthly visitors pass **~30,000** (today 8,502 per 30 days, PostHog web overview,
  test accounts filtered).

## What was measured, 2026-09-16

**permtrack.app's paid product, from its own JS bundle** (`/assets/index-*.js`):
price map `tracker: $4.99, daily: $9.99`, but only ONE plan renders on the subscribe
page: "Daily", $9.99 a month, 3-day free trial, no charge until day 4, Stripe checkout
behind `/api/subscribe/checkout`. Features verbatim: case status checked every hour
9 AM to 6 PM ET Mon to Fri; instant email when DOL updates the case; daily digest with
queue position and estimated review date; cohort progress and employer approval rate;
auto-cancels when the case is certified or denied. Their `/pricing` and `/pro` both
redirect to the homepage. They also run a "Help keep PermTrack free" modal (Telegram
channel `t.me/permtrack`, `buymeacoffee.com/permtrack`). permupdate: no paid tier found.

**Their $9.99 list is roughly our free product.** Live lookup that asks DOL, free case
alerts, queue position and estimate on the case page, employer approval rate on the
entity page. The only paid delta is the HOURLY cadence (ours: 4:10 AM full sweep,
3:40 PM pending sweep, plus a live ask on every lookup) and the auto-cancel.

**Our audience:** 30 days: 8,502 visitors, 51,788 pageviews, 12,172 sessions,
5 min 51 s average session, 35.7% bounce. Lists: 83 case alerts, 17 queue, 8 bulletin,
20 news, 181 app profiles. **Cost:** Vercel run-rate about $110/month this cycle,
driven by deploys, not visitors.

**AdSense (Google's own help pages, via researcher):** no traffic, page-count or
domain-age minimum; original content that meets the publisher policies; legal and
financial are "sensitive" categories, which lowers fill and RPM rather than blocking
approval. RPM figures in circulation ($30-60 "finance niche") come from ad-tech blogs
and are unaudited; plan on $5-15. Arithmetic at today's views: **$260 to $780 a month.**
What it would cost: CSP must admit Google's ad domains (today: Sentry, Senja, Ahrefs,
Cloudflare only), an `ads.txt` (404 today), a privacy-policy change, a consent layer
for EEA traffic, page weight against a 20 ms TTFB, and the brand ("Federal data only",
robots.txt blocks eleven SEO scrapers). Most inventory is entity pages that are
three-quarters boilerplate. If ever: blog and guides only, never the data pages.

**Stripe:** the restricted-businesses list names bail bonds, bankruptcy attorneys and
law firms collecting upfront fees; immigration data software is not named. KYC is
Adam's real identity on Stripe's private side; PERM Tracker LLC is the party in the
Terms already.

**Willingness to pay:** no evidence found (Reddit unreachable to the researcher; nothing
quotable elsewhere). permtrack charging proves somebody pays, not how many.

**The site's own promise, in three places:** "Optional paid features may come later;
the data, the lookup, the calculators and the core deadline tracking stay free" and
"No credit card and no case limit." Anything paid must be ADDITIVE to that.

## The verdicts

| option | verdict | why |
|---|---|---|
| beneficiary paid tier | **later, on the trigger** | 10% of 83 at $4.99 is ~$40/month; the cost is Stripe/tax/refund/support surface, not the build |
| AdSense | **not now; never on data pages** | covers hosting, costs the brand the site trades on; entity pages are weak inventory |
| attorney app, per-seat | **the one that pays** | exists, 181 profiles, firms already pay for case management; solo tier stays free per the promise |
| Buy Me a Coffee link | optional, tiny yield | needs an account under the persona: identity approval gate first |
| attorney referral slot | not "just a button" | fee-sharing with non-lawyers barred under ABA Model Rule 5.4 in most states; with one attorney named on /about it reads as her ad, so it is her call too |

**If the tier is ever built, it is:** an hourly pending pass over WATCHED cases only
(~83 DOL requests an hour today, trivial against the budget), same-hour email or push,
auto-cancel on decision. The sweep code exists; the new part is billing.

**Timing note that applied on the day:** homepage mid-recovery on the brand query (title
frozen to 2026-11-07), digest off, firewall just inverted. Changing what pages are FOR
while Google re-reads them is the wrong week.
