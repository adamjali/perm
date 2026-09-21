# GSC indexing priority list

**Run of 2026-09-20, 3:18 to 3:42 PM EDT: 11 accepted, the 12th refused.**

**The cap was 11 for the THIRD run running** (8 on Sep 18, 11 on the 17th, 19th and 20th).
Today's first request was accepted at 3:18 PM against yesterday's 3:03 PM start, so the
window had already reopened - and a probe at **1:29 PM was refused**, which brackets the
opening between 1:29 and 3:18 PM. Still no model worth writing down: probe early, a
refusal is free, stop at the wall.

**FIVE PAGES WERE SKIPPED WITHOUT SPENDING A SLOT, because inspecting is free and they
were already current.** That is the whole argument for inspect-before-request: a fifth of
today's candidates needed nothing.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/perm-queue/2024-06` | Discovered, currently not indexed | 3:18 PM |
| 2 | `/perm-queue/2024-05` | Discovered | 3:20 PM |
| 3 | `/perm-queue/2024-04` | Discovered | 3:22 PM |
| 4 | `/perm-queue/2024-03` | Discovered | 3:23 PM |
| 5 | `/perm-queue/2024-02` | Discovered | 3:25 PM |
| 6 | `/perm-queue/2023-12` | Discovered | 3:27 PM |
| 7 | `/perm-queue/2023-11` | Discovered | 3:29 PM |
| 8 | `/perm-queue/2023-10` | Discovered | 3:31 PM |
| 9 | `/perm-employers/regency-unlimited-inc` | **unknown to Google** | 3:32 PM |
| 10 | `/perm-employers/elite-prep-academy-a-nj-nonprofit-corporation` | unknown | 3:34 PM |
| 11 | `/perm-employers/dimash-llc` | unknown | 3:40 PM |
| 12 | `/perm-employers/sonoma-family-meal` | unknown | **Quota Exceeded**, 3:42 PM |
| - | `/perm-queue/2024-01` | **INDEXED already** - skipped | - |
| - | `/perm-queue/2026-01` | **INDEXED already** - skipped | - |
| - | `/glossary` | indexed, crawled **Sep 14 1:53 AM** - after the collapse shipped, so current | - |
| - | `/perm-case-statuses` | indexed, crawled **Sep 14 1:46 AM** - current | - |
| - | `/policy-changes` | indexed, crawled **Sep 17 12:54 PM** - after the Sep 16 rebuild, current | - |

**THE MONTH-PAGE SITEMAP FAMILY IS WORKING ON ITS OWN.** `/perm-queue/2026-01` and
`/perm-queue/2024-01` are indexed with nobody requesting them, and the ledger's older note
calling 2026-01 a page "Google has never seen" is now stale. Every 2024 and 2023 month
named both `sitemap.xml` and the `/perm-queue` hub as its discovery source. The family
was added to the sitemap on Sep 16; that is a four-day turnaround from advertised to
partly indexed.

**THE LIVE-EMPLOYER SITEMAP FAMILY IS NOT DISCOVERED YET.** All four live-only employer
pages inspected today read **"No referring sitemaps detected"** and **"URL is unknown to
Google"**, three days after `live-employer-1.xml` shipped on Sep 17. That is the opposite
of the month pages and worth watching rather than explaining - the two families were added
one day apart. Nothing to do about it: requesting four of 22,311 by hand is sampling, and
the 9/27 Pages report is the scoreboard.

One oddity, noted not acted on: `/perm-case-statuses` reported its sitemap as **"Temporary
processing error"** while every other page named `sitemap.xml` cleanly. Almost certainly
transient on Google's side; re-read it next run before treating it as a defect.

## The sitemap index was resubmitted on 2026-09-21, and that was the real blocker

Google's "Sitemaps read" list held **19 of the 24 children**. The five
`live-employer-*.xml` files, shipped Sep 17, were absent - so all **22,467**
live-only employer pages were invisible to Google no matter how many were
requested by hand. The proof was arithmetic: GSC's "Total discovered pages"
read **78,954**, which is EXACTLY the sum of the 19 children it lists.

The index's own "Last read" had been stuck at **Sep 11**. Google re-fetches
children it already knows on its own schedule, but discovers a NEW child only
by re-reading the index. Resubmitting `https://permtracker.app/sitemap.xml`
(the FULL URL - a Domain property rejects a bare path as "Invalid sitemap
address") moved Last read to **Sep 21**.

**This is why the two families behaved so differently.** Month pages were added
to an EXISTING child, `pages.xml`, and indexed themselves within days with
nobody requesting them. Live-only employers were a new child and did nothing.

**So hand-requesting live-only employer pages is no longer the lever** - four
were spent on them on Sep 20, and the sitemap now does that work for all
22,467. Re-read the Sitemaps drilldown in a few days: the five children
appearing with a Last read date is the signal, and the 9/27 Pages report is the
scoreboard. Spend slots on pages that CHANGED instead.

## Queue after the Sep 20 run

The `/perm-queue/<month>` family is **DONE** - every month from 2023-10 (the earliest with
data) through the present is either requested or already indexed. Do not re-walk it.

1. live-only employer pages, sampled from `sitemaps/live-employer-*.xml`. This is now the
   only large unindexed population (22,311), and a request converts within 24 hours
   (proved Sep 18 to 19). Sampling, not testing - do not try to walk it by hand.
2. any page whose content materially changed since its last crawl. Inspect first: three of
   today's five skips were pages that had changed and been recrawled already.
3. nothing else is pending. If 1 and 2 are dry, spend nothing rather than re-requesting.


**THE LIVE-ONLY EMPLOYER PAGES WORK. Both spot checks requested yesterday as "unknown to
Google" came back INDEXED today, inside 24 hours** - `vision-infotek` and
`ace-ny-sales-inc`. That answers the open question from the "everything" decision of
Sep 17: Google does take these thin, live-only pages when asked. Neither needed a slot
today. The 9/27 Pages report is still the scoreboard for the other 22,311.

**The cap moved again: 11 today against 8 yesterday**, and the only visible difference is
that today started at 3:03 PM rather than 11:59 AM. Starting later seems to buy a fuller
allowance, which is the opposite of an intuition worth acting on - the rule stays PROBE,
DO NOT PREDICT.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/perm-rfi-audit` | indexed; recrawl to displace the stale provenance line | 3:03 PM |
| 2 | `/perm-queue/2025-04` | **unknown** (was "Discovered" yesterday - it flips both ways) | 3:06 PM |
| 3 | `/perm-queue/2025-03` | unknown | 3:10 PM |
| 4 | `/perm-queue/2025-02` | unknown | 3:14 PM |
| 5 | `/perm-queue/2025-01` | Discovered, currently not indexed | 3:17 PM |
| 6 | `/perm-queue/2024-12` | Discovered | 3:22 PM |
| 7 | `/perm-queue/2024-11` | Discovered | 3:25 PM |
| 8 | `/perm-queue/2024-10` | Discovered | 3:28 PM |
| 9 | `/perm-queue/2024-09` | Discovered | 3:32 PM |
| 10 | `/perm-queue/2024-08` | Discovered (referrer is `/perm-queue/2024-07`, not the hub) | 3:35 PM |
| 11 | `/perm-queue/2024-07` | Discovered | 3:39 PM |
| 12 | `/perm-queue/2024-06` | Discovered | **Quota Exceeded**, 3:42 PM |
| - | `/perm-employers/vision-infotek` | **INDEXED** (requested 09-18) - skipped, no slot | - |
| - | `/perm-employers/ace-ny-sales-inc` | **INDEXED** (requested 09-18) - skipped, no slot | - |

**Every 2024 month page is "Discovered - currently not indexed" and names both
`sitemap.xml` and the `/perm-queue` hub**, so Google has read the sitemap for the older
half of the family and is declining to spend a crawl. The 2025 months nearer the present
are the ones still "unknown". That is the reverse of what the sitemap-propagation theory
predicted and is worth watching rather than explaining.


## Next run, in order

| # | URL | changed |
|---|---|---|
| 1 | `/changelog/corrections` | refused today |
| 2 | `/layoffs` | 176 glued cells fixed |
| 3 | `/perm-queue/2025-12`, `/perm-queue/2026-01` | month pages Google has never seen (see the sitemap finding); one or two per day until the sitemap lists them |
| 4 | `/tools/salary-explorer` | precomputed doc, faster page |
| 5 | `/lca-wages` | precomputed doc |
| 6 | `/glossary`, `/perm-case-statuses` | re-request after Sep 14 only if their crawl date has not moved | (the last two spill to the next
window if the cap is 11 again).

## Finding: the ~39 `/perm-queue/<month>` pages are in NO sitemap (2026-09-16)

`/perm-queue/2025-11`, the month DOL is adjudicating, is "URL is unknown to
Google". It is indexable (no robots meta served; `MIRROR_COMPLETE` is true) and
linked from `/perm-queue`'s month strip, but `src/lib/sitemap/build.ts` lists
only `/perm-queue` itself. The month pages are generated (`generateStaticParams`)
and never advertised. Fix, separately from this run: list them from the same
month source the route uses, the way the stage pages are listed from
`reviewStages()`, so the sitemap and the router cannot disagree.

## Driving it on 2026-09-16

- **Never `tabs_close_mcp` inside a batch that also acts on a sibling tab.** The
  batch fails "not in the same group", and if it was the group's last tab the
  whole group is destroyed with the GSC state in it. Close tabs in their own call.
- **A domain the extension refuses inside a batch can pass standalone**: a
  batch reports the first refused item and stops, so a just-granted permission
  reads as still refused. Retry `navigate` on its own before asking for a grant.
- **The viewport is 756px tall this session (was 812)**, so the Dismiss button
  sits at (939, 450), not (938, 478). Read it with `getBoundingClientRect`
  instead of a memorised coordinate; the request button at (1261, 363) is
  unchanged because it sits above the fold in both.
- **Type only after a screenshot on a SETTLED page**: the first attempt typed
  into a still-loading page and the text was silently lost (the zoom showed an
  empty bar). The screenshot between the click and the type is what forces
  the paint.

---


**Next window opens ~7:40 PM EDT on 2026-09-06.** The quota is ~11/day on a
**rolling 24 hours from the requests themselves**, so it reopens at the hour it
was spent. All 11 were used at 7:40 PM on 09-05.

## Spend it on letter pages. Here is why.

The instinct is to request whatever changed. Resist it, for a measured reason.

**The orphan audit passed perfectly** (2026-09-05): all **13,579** entity pages
are linked from the A-Z letter pages, sets matching exactly - 9,646/9,646
employers, 2,919/2,919 attorneys, 1,014/1,014 occupations. Measured with 78
fetches rather than 13,579, because the letter pages are the only internal path,
so covering all 78 is complete rather than a sample.

**And Google still cannot use any of it, because the letter pages themselves are
uncrawled.** `/perm-attorneys/browse/a` reads **"URL is unknown to Google"**, and
it went BACKWARDS from "discovered - currently not indexed" in a single day.
`amy-link-pa` did the same.

So: 13,579 correctly-linked pages behind a door Google has not opened. **One
crawled letter page exposes ~151 entity pages.** No other request comes close to
that leverage, and the layer is actively degrading rather than merely waiting.

## Next run, in order

| # | URL | why |
|---|---|---|
| 1 | `/perm-employers/browse/a` | hit the quota wall on 09-05 |
| 2 | `/perm-wages/browse/a` | third kind, never requested |
| 3-11 | `/perm-attorneys/browse/{b,c,d,...}`, then employers, then wages | ~151 entities exposed each |

Prefer the letters with the most entities behind them (a, b, c, m, s are usually
densest) over completing one kind alphabetically.

## What was requested on 2026-09-05 (all 11 succeeded)

`/perm-processing-times` - `/` - `/case-search` - `/faq` -
`/perm-attorneys/browse/a` - `/for-attorneys` - `/tools/salary-explorer` -
`/pwd-cases` - `/lca-cases` - `/tools/i140-trends` - `/tools/i485-queue-position`

The 12th, `/perm-employers/browse/a`, was refused.

**One caveat on those 11.** They were requested at 7:40 PM, and the footer
whitespace fix deployed after ~10:15 PM. If Google's priority crawl reached them in
between, it read the pre-fix footer. Not worth re-requesting: the change is three
characters in nav text, the SERP was already clean, and Google recrawls indexed
pages on its own.

## What changed on 2026-09-05 and is now live

- `llms.txt` and the site-wide JSON-LD `description` corrected: both said "check
  any PERM case number" when the site takes G-, P- and I- numbers and will also
  find a case by employer name. Both are covered by the 11 above.
- Dataset `creator` fixed from `GovernmentOrganization` to `Organization`.
  Google matches `@type` literally and does not walk the schema.org hierarchy,
  so the more precise type was the rejected one. **Validation STARTED 2026-09-05**
  and is now running - nothing further to do but watch it.

  Where the button lives, because the report path is not guessable: left sidebar
  -> **Enhancements -> Datasets** (real URL `/search-console/r/datasets`; a
  hand-built `/search-console/structured-data/dataset` 404s). Invalid/Valid at
  the top will read 0/9 - the `creator` issue is NON-CRITICAL so it sits further
  down under **"Improve item appearance"**. Click the issue row, and the detail
  page carries **"Done fixing?  VALIDATE FIX"** on its right. Google then
  recrawls the affected items itself; the row goes Not Started -> Started ->
  Passed, typically over days.
- Four pages added to `llms.txt` (`/case-search`, salary-explorer, i140-trends,
  i485-queue-position).
- Three footer glue points fixed. Site-wide but low value; no request needed.

## How to run it

1. `https://search.google.com/search-console`, property `sc-domain:permtracker.app`.
2. Paste into the **inspect bar at the top**. Do NOT construct an inspect URL -
   GSC uses an opaque id and a hand-built one 404s.
3. **The first click on the search bar after a page load never registers.** If
   the URL line does not change, do the whole sequence again.
4. **Zoom the URL line and confirm the right page is loaded before clicking
   REQUEST INDEXING**, or a silently failed navigation re-requests the previous
   page and burns a slot.
5. REQUEST INDEXING sits at ~(1253-1261, 363). A live test runs first, 30-60s.
6. **Keep going until the red "Quota Exceeded" modal.** A refused request costs
   nothing, so the cap is learned by hitting it - that is how the recorded cap
   was corrected from 4 to ~11.

## Closed, do not re-litigate

- **Glued text.** The fleet handoff reported 167 joins. Ground truth is 317, and
  it is not a defect: permtracker measures **34.7 per 1k words against
  react.dev's 171.9 and stripe.com's 182.9**. It is a property of adjacent block
  elements. The class that actually damaged a SERP - one phrase split across
  inline siblings - is **zero** here, zero on Tampa Trucks, and now zero on NEFL
  (its brand lockup reads "North East Florida Junk Removal" again). The live
  SERP is clean.
- **Orphans.** Zero across all 13,579 generated pages.
- **Canonical without a trailing slash.** Leave it. RFC 3986 makes an empty path
  equivalent to `/`, and the homepage is indexed, which settles it empirically.

## Queue after the Sep 18 run (probe from ~11:30 AM EDT Sep 19, earlier is free)

Inspect first; skip anything already on Google.

0. **`/perm-rfi-audit` FIRST.** Its indexed copy still carries the old provenance line
   naming a third-party tracker; the live page was changed 2026-09-18 and no longer
   does. Google's cached copy of pages like this is what fed an AI Mode answer claiming
   this site "mirrors" a rival's data infrastructure, so displacing the stale text is
   worth more than adding a page Google has never seen. Same argument applies to any
   month page whose last crawl predates 2026-08-27.
1. `/perm-queue/2025-04` (refused today), then `2025-03`, `2025-02`, `2025-01`
2. two more pages from `sitemaps/live-employer-1.xml`, if the family is still undiscovered
3. `/perm-queue/2024-12` and backwards while slots last
4. `/glossary`, `/perm-case-statuses`: only if their last crawl predates Sep 14
