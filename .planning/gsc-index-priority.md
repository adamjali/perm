# GSC indexing priority list

**Run of 2026-10-11, 6:55 to 7:14 PM EDT: 11 accepted, the 12th refused (Quota Exceeded).** Order: the new
"Queue after the Oct 11 changes" section at the end of this file, top down. Each was inspected first; a page
crawled after its own change was skipped.

**Sitemap index not resubmitted:** last read Oct 10, 309,998 discovered against 311,540 live.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/perm-case-status` | indexed, last crawled Oct 9, 5:26 PM | 6:55 PM |
| 2 | `/case-search` | indexed, last crawled Oct 7, 9:35 PM | 6:57 PM |
| 3 | `/faq` | indexed, last crawled Oct 9, 5:26 PM | 6:58 PM |
| 4 | `/perm-processing-times` | indexed, last crawled Oct 8, 3:22 PM | 7:00 PM |
| 5 | `/perm-employers` | indexed, last crawled Oct 11, 7:57 AM (before the afternoon's list-page redesign) | 7:02 PM |
| 6 | `/perm-employers/google-llc` | indexed, last crawled Oct 9, 10:25 PM | 7:04 PM |
| 7 | `/perm-cases` | indexed, last crawled Oct 10, 5:12 PM | 7:05 PM |
| 8 | `/tools/green-card-line` | indexed, last crawled Oct 7, 9:44 PM | 7:07 PM |
| 9 | `/tools/eb2-vs-eb3` | indexed, last crawled Sep 27, 9:40 PM | 7:09 PM |
| 10 | `/tools/ead-extension` | indexed, last crawled Oct 4, 7:35 PM | 7:10 PM |
| 11 | `/tools/perm-deadline-calculator` | indexed, last crawled Oct 2, 1:06 PM | 7:12 PM |

Refused: `/tools` (indexed, last crawled Oct 8, 3:28 PM) at 7:14 PM; first in line next round. Inspected
only, crawled after their own change: `/press` (Oct 11, 6:51 AM) and `/` (Oct 11, 11:29 AM).

**Round of Oct 12, 3:35 PM EDT: no requests**, the window from the Oct 11 run reopens about 6:55 PM EDT. Sitemap: 311,578 live URLs; the index was last read Oct 10, under 3 days, so not resubmitted. Added the "Oct 12 (midday)" section at the end (`/terms`, `/privacy`).

**Round of Oct 12, 5:45 AM EDT: no requests** (the quota window from the Oct 11 run reopens about 6:55 PM EDT).
The page-indexing emails of 1:13 and 1:37 AM EDT named two new reasons, read on the report (dated Oct 8):
"Duplicate, Google chose different canonical than user" (5 pages, all spellings the Oct 5 merges folded; each now
answers 308 to its survivor, validation started Oct 12) and "Alternate page with proper canonical tag" (233, the
`?q=` search links and `?ref=producthunt`, which point at their clean page on purpose). The two
`/perm-rfi-audit/` stage URLs Google holds as 404s redirect from this commit. Sitemap index not resubmitted: last
read Oct 10, 310,921 discovered against 311,568 live.

**Queue for the next round** (slots free up from about 6:55 PM EDT Oct 12): first `/about` (rebuilt the night
of Oct 11; the page meant to carry the brand query), then the rest of the Oct 11 section from item 4's `/tools`
and items 5 to 8, then the "Oct 11 (night)" section at the end of this file. Inspect each; request only those
last crawled before the change.

**Previous run:** Oct 10, 5:39 to 5:59 PM EDT, 11 accepted (`/about`, `/developers`, `/api-terms`,
`/i140-awaiting-visa`, `/i485-by-field-office`, `/perm-employers/under-review`, `/perm-case-statuses`,
`/perm-rfi-audit`, `/tools/perm-timeline-calculator`, `/estimate-scorecard`, `/seasonal-cases`);
`/tools/green-card-line` refused.

---

**Sitemap index resubmitted 2026-10-03, about 9:13 PM EDT** (no request slot): the seventh child family, `seasonal-employer-1..7.xml` (32,388 employers whose only filings are H-2A, H-2B or CW-1), shipped in `1f09dab7`; the index's Last read was Sep 30. Re-check its Discovered pages against the live sum on the next round.

**Run of 2026-10-03, 3:55 to 4:15 AM EDT: 5 accepted, no refusal.** The first three emptied the
old queue; the last two are pages the Oct 1 and Oct 2 deploys changed (queue reopened below). The sitemap index needed no resubmission: Google counts 106,317 discovered
pages against 106,452 in the live children (135 apart; last read Sep 30).

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/es` | Discovered, never crawled | 3:55 AM |
| 2 | `/pt-br` | Discovered, never crawled | 3:57 AM |
| 3 | `/ko` | unknown to Google (it read "Discovered" on Oct 1) | 3:58 AM |
| 4 | `/perm-decision-activity` | indexed, last crawled Sep 30 (before the daily pulse and the record back to 2015) | 4:13 AM |
| 5 | `/visa-bulletin` | indexed, last crawled Sep 24 (before the October bulletin and the month strip back to 2005) | 4:15 AM |

Inspected only: `/perm-employers/the-wine-group-llc` (a live-only employer, first in
`live-employer-1.xml`): Discovered, never crawled, found through the sitemap, no referring page.
`/developers` and `/open-data` (both new Oct 2): already indexed, no request needed (`/open-data`
shows 2 valid Datasets). `/perm-employers/under-review`: indexed, recrawled Sep 27; skipped.

---

**Previous run:** 2026-10-01, 11:35 PM to 12:06 AM EDT (into Oct 2): 11 accepted, the 12th refused.
It ran after the evening deploy that rebuilt the attorney page and the homepage (commit
`d3a66f97`), so those two went first. The cap was 11 for the eleventh run running. The sitemap
index needed no resubmission: Google read it Sep 30 and counts 106,258 discovered pages against
106,300 in the live children. Accepted times are approximate (each to the minute the dialog showed).

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/for-attorneys` | indexed (rebuilt tonight: deadline hub hero, product tour) | ~11:36 PM |
| 2 | `/` | indexed (redesigned tonight) | ~11:38 PM |
| 3 | `/tools/i485-queue-position` | indexed (HTML changed Sep 30) | ~11:40 PM |
| 4 | `/perm-cases` | indexed (HTML changed Sep 30) | ~11:42 PM |
| 5 | `/pwd-cases` | indexed (HTML changed Sep 30) | ~11:45 PM |
| 6 | `/lca-cases` | indexed (HTML changed Sep 30) | ~11:47 PM |
| 7 | `/guides/perm-application-on-hold-meaning` | indexed, last crawled Sep 22 (before the Sep 25 rewrite) | ~11:50 PM |
| 8 | `/changelog/the-whole-field-three-ways` | indexed, last crawled Sep 3 | ~11:54 PM |
| 9 | `/changelog/live-data-and-two-doors` | indexed, last crawled Sep 2 | ~11:57 PM |
| 10 | `/changelog/march-2026-timeline-and-ux` | indexed, last crawled Sep 4 | ~12:00 AM |
| 11 | `/perm-case-statuses` | indexed, recrawled Sep 28, but restructured tonight | ~12:04 AM |
| 12 | `/es` | Discovered, never crawled; **refused, Quota Exceeded** | ~12:06 AM |

Inspected only: `/debarments` (recrawled Sep 21, 3:26 PM, after its request; skipped), `/vi`
(indexed), `/pt-br` and `/ko` (Discovered, never crawled; queued below).

---

**Earlier run:** 2026-09-30, 2:33 to 2:49 PM EDT: 11 accepted, the 12th refused. Automatic daily
rounds resumed the same afternoon (session timer, 3:07, 5:07 and 7:07 PM; see the Sep 30 queue
at the end of this file for what remains).

The cap was 11 for the tenth run running. The sitemap index was resubmitted first (about 2:31 PM,
"Sitemap submitted successfully"), because Google had last read it Sep 23 and never seen
`groups.xml` (4,156 pages). Every never-crawled page answered either "Discovered" or "unknown to
Google" (`/perm-industries` and all three group pages: no referring sitemap, which is the gap
the resubmission closes).

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/visa-bulletin/2026-10` | Discovered, never crawled | 2:33 PM |
| 2 | `/nvc-waiting-list` | Discovered, never crawled | 2:35 PM |
| 3 | `/perm-cities` | Discovered, never crawled | 2:36 PM |
| 4 | `/perm-industries` | unknown to Google | 2:38 PM |
| 5 | `/perm-countries` | Discovered, never crawled | 2:39 PM |
| 6 | `/perm-cities/new-york-ny` | unknown to Google | 2:40 PM |
| 7 | `/perm-industries/541511` | unknown to Google | 2:42 PM |
| 8 | `/perm-countries/india` | unknown to Google | 2:43 PM |
| 9 | `/tools/salary-explorer` | indexed (HTML changed Sep 30) | 2:45 PM |
| 10 | `/case-search` | indexed (HTML changed Sep 30) | 2:46 PM |
| 11 | `/lca-wages` | indexed (HTML changed Sep 30) | 2:48 PM |
| 12 | `/tools/i485-queue-position` | indexed; **refused, Quota Exceeded** | 2:49 PM |

---

**Earlier run:** 2026-09-27, 9:27 to 9:43 PM EDT: 11 accepted, the 12th refused.

The cap was 11 for the ninth run running. It ran after both of the evening's deploys (8:14 and
9:24 PM), so every page Google fetches now carries the history search, the breakdown pages'
links and the one-hour-cap fix. Nine of the eleven had never been crawled.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/perm-employers/under-review` | indexed, crawled Sep 21 | 9:27 PM |
| 2 | `/perm-employers/adobe-inc` | Discovered, **never crawled** | 9:29 PM |
| 3 | `/perm-employers/cognizant-technology-solutions-us-corporation` | indexed | 9:31 PM |
| 4 | `/tools/green-card-line` | Discovered, never crawled | 9:32 PM |
| 5 | `/guides/approved-i140-no-visa-number-eb2-india` | Discovered, never crawled | 9:33 PM |
| 6 | `/guides/eb3-other-workers` | Discovered, never crawled | 9:35 PM |
| 7 | `/tools/eb2-vs-eb3` | Discovered, never crawled | 9:36 PM |
| 8 | `/tools/which-green-card` | Discovered, never crawled | 9:37 PM |
| 9 | `/visa-bulletin/categories` | Discovered, never crawled | 9:39 PM |
| 10 | `/h1b-lottery-odds` | Discovered, never crawled | 9:40 PM |
| 11 | `/green-card-timelines` | Discovered, never crawled | 9:42 PM |
| 12 | `/nvc-waiting-list` | Discovered, never crawled | **Quota Exceeded**, 9:43 PM |

**Run of 2026-09-25, 3:41 to 4:01 PM EDT: 11 accepted, the 12th refused.**

**The cap was 11 for the EIGHTH consecutive run** (Sep 17, 19, 20, 21, 22, 23, 24, 25). The first
request was accepted at 3:41 PM, the same minute as yesterday's first. Every slot went to a page
whose title changed on Sep 21 (or that Google had never crawled); every indexed page on the list
was last crawled between Aug 17 and Sep 12.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/guides/employer-stopped-filing-perms` | indexed, crawled Sep 9 (refused on Sep 24) | 3:41 PM |
| 2 | `/guides/how-accurate-are-perm-estimates` | indexed, crawled Sep 8 | 3:43 PM |
| 3 | `/blog/perm-salary-data-by-occupation` | indexed, crawled **Aug 26** | 3:45 PM |
| 4 | `/blog/what-an-employers-perm-record-shows` | indexed, crawled Sep 3 | 3:46 PM |
| 5 | `/blog/what-law-firm-volume-tells-you` | indexed, crawled Sep 8 | 3:48 PM |
| 6 | `/blog/data-note-application-on-hold-september-2026` | indexed, crawled Sep 12 | 3:50 PM |
| 7 | `/blog/best-immigration-case-management-tools` | indexed, crawled **Aug 17** | 3:52 PM |
| 8 | `/changelog` | indexed, crawled Sep 11 | 3:54 PM |
| 9 | `/changelog/case-status-and-first-party-data` | indexed, crawled Sep 10 | 3:56 PM |
| 10 | `/changelog/every-case-every-sponsor` | Discovered, **never crawled** | 3:58 PM |
| 11 | `/changelog/law-firms-and-denial-rates` | indexed, crawled Sep 4 | 4:00 PM |
| 12 | `/changelog/the-whole-field-three-ways` | indexed, crawled Sep 3 | **Quota Exceeded**, 4:01 PM |

The six changelog posts that carry the short `seoTitle` added on Sep 21 are
`case-status-and-first-party-data`, `every-case-every-sponsor`, `law-firms-and-denial-rates`,
`live-data-and-two-doors`, `march-2026-timeline-and-ux` and `the-whole-field-three-ways`
(`git grep seoTitle -- v2/content/changelog`); the ledger had only said "its five posts".

**Run of 2026-09-24, 3:41 to 4:07 PM EDT: 11 accepted, the 12th refused.**

**The cap was 11 for the SEVENTH consecutive run** (Sep 17, 19, 20, 21, 22, 23, 24). The
timer's round started at 3:37 PM and the first request was accepted at 3:41 PM, 18 minutes
before 24 hours had passed since yesterday's first (3:59 PM), so the window is still not
"24 hours from the first request". Probe, don't predict.

**No lost clicks today.** Every REQUEST INDEXING click was preceded by a zoom of the button
and all twelve registered; every Dismiss was followed by a focus check on the search INPUT
before typing, and it held all thirteen times.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/guides/approved-i140-no-visa-number-eb2-india` | Discovered, not indexed (was **unknown** yesterday; now names `sitemap.xml`) | 3:41 PM |
| 2 | `/guides/ead-and-advance-parole-timelines` | Discovered, not indexed | 3:43 PM |
| 3 | `/visa-bulletin` | indexed, crawled **Sep 16**, before the Sep 22 month strip | 3:45 PM |
| 4 | `/terms` | indexed, crawled Sep 11, before the Florida LLC wording | 3:47 PM |
| 5 | `/about` | indexed, crawled Sep 16 | 3:49 PM |
| 6 | `/methodology` | indexed, crawled Sep 14 | 3:51 PM |
| 7 | `/glossary` | indexed, crawled Sep 14 | 3:53 PM |
| 8 | `/guides/how-dol-sets-a-prevailing-wage` | indexed, crawled Sep 3 (refused on Sep 22) | 3:59 PM |
| 9 | `/tools/priority-date-retention` | indexed, crawled Sep 9, title stale | 4:01 PM |
| 10 | `/guides/explore-perm-wages` | Discovered, **never crawled** | 4:03 PM |
| 11 | `/guides/waiting-on-your-green-card` | indexed, crawled Sep 3 | 4:06 PM |
| 12 | `/guides/employer-stopped-filing-perms` | indexed, crawled Sep 9 | **Quota Exceeded**, 4:07 PM |

**Inspected, no slot spent:**
- **The `/perm-queue/<month>` family is indexing on its own.** 2025-04, 2025-03, 2025-02 and
  2024-06 are all "URL is on Google"; 2025-03 was crawled Sep 19 with `/perm-queue` as the
  referring page. Four of four sampled, so the month family leaves the queue.
- `/tools/green-card-fees`: indexed, crawled **Sep 24, 1:47 AM**, after the title change.
- `/visa-bulletin/2026-08` and `2026-07` were not inspected: they were queued "until the hub
  is fixed", the hub has linked every month since the Sep 22 deploy, and `/visa-bulletin`
  itself was requested today.
- "Temporary processing error" under Sitemaps again, on `/visa-bulletin`,
  `/tools/green-card-fees` and `/tools/priority-date-retention`; still transient on Google's
  side and still not acted on.

**Run of 2026-09-23, 3:59 to 4:24 PM EDT: 11 accepted, the 12th refused.**

**Started by hand, not by the timer.** The session timers died at the context continuation
at 7:18 PM on Sep 22 (their last fire was 5:17 PM that day), so today's 3:07 PM fire never
happened. Found at 3:45 PM when Adam asked whether the timers were working; recreated
(`7 15,17,19 * * *`, job d001ea00) and this round run straight away. **The cap was 11 for
the SIXTH consecutive run** (Sep 17, 19, 20, 21, 22, 23).

**Every slot went to last night's deploy.** Nine of the eleven pages already read
"Discovered" through `sitemap.xml` less than 20 hours after the deploy, because they
landed in an EXISTING child (`pages.xml`), which Google re-reads on its own. Two were still
"unknown to Google, no referring sitemaps".

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/uscis-case-status` | **unknown to Google**, no referring sitemaps | 3:59 PM |
| 2 | `/uscis-processing-times` | Discovered, not indexed (`sitemap.xml`) | 4:02 PM |
| 3 | `/i485-by-field-office` | Discovered; the live test took about 2.5 minutes (564 KB page) | 4:05 PM |
| 4 | `/i140-awaiting-visa` | Discovered | 4:07 PM |
| 5 | `/privacy` | indexed, crawled **Sep 10**, so Google's copy predates section 18 | 4:09 PM |
| 6 | `/accessibility` | Discovered | 4:11 PM |
| 7 | `/guides/uscis-receipt-number` | Discovered | 4:13 PM |
| 8 | `/guides/i485-vs-i485j-supplement-j` | Discovered | 4:15 PM |
| 9 | `/guides/what-emma-told-you` | Discovered | 4:17 PM |
| 10 | `/guides/uscis-processing-times-median-vs-80-percent` | Discovered | 4:19 PM |
| 11 | `/guides/fastest-field-office-eb-i485` | Discovered | 4:22 PM |
| 12 | `/guides/approved-i140-no-visa-number-eb2-india` | **unknown to Google** | **Quota Exceeded**, 4:24 PM |

**Sitemap index resubmitted at 4:26 PM** (the Sep 22 queue asked for it "the same
afternoon" and it was missed). Search Console read it at once: Submitted and Last read both
Sep 23, 101,522 discovered pages, Success.

**The FIRST REQUEST INDEXING click of the round did not register**: no live test, count of
"Indexing requested" still 0, so no slot spent. A zoom of the button taken immediately
before the second click made it land, and every click after that was preceded by one.
Same cause as every other lost click in this ledger: the hidden automation tab does not
paint until something forces it.

**Not missed: the October 2026 visa bulletin.** The due-check could not settle it on Monday
(Internet Archive offline) and the Archive was offline again today, so it was checked at the
source in Adam's Chrome at 4:27 PM: travel.state.gov lists **Current: September 2026,
Upcoming: Coming Soon**. We hold September 2026.

**Run of 2026-09-22, 3:20 to 3:53 PM EDT: 11 accepted, the 12th refused.**

**The cap has now been 11 on FIVE consecutive runs** (Sep 17, 19, 20, 21, 22). Today's
first request was accepted at 3:20 PM against yesterday's 3:17 PM start; no earlier probe
was made. Rule unchanged: probe early, a refusal is free, stop at the wall.

**Slots went to the title-change queue** (134 titles rewritten Sep 21, 12:21 PM), plus two
pages Google had never seen. Inspect-first held again: every indexed page requested had a
last crawl between Sep 3 and Sep 12, so every one of those listings still carries the old
title.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/guides/what-an-lca-is` | Discovered, not indexed (was "unknown" yesterday; now names `sitemap.xml` and `/pwd-cases`) | 3:20 PM |
| 2 | `/guides/perm-rfi-issued-what-to-do` | indexed, crawled Sep 12, title stale | 3:28 PM |
| 3 | `/guides/perm-application-on-hold-meaning` | indexed, crawled Sep 3 | 3:30 PM |
| 4 | `/guides/perm-appeal-reconsideration-balca` | indexed, crawled Sep 10 | 3:31 PM |
| 5 | `/guides/how-the-visa-bulletin-works` | **unknown to Google**, "no referring sitemaps" | 3:33 PM |
| 6 | `/guides/find-a-dol-case-number-by-employer` | indexed, crawled Sep 3 | 3:37 PM |
| 7 | `/guides/check-perm-received-without-receipt` | indexed, crawled Sep 8 | 3:41 PM |
| 8 | `/visa-bulletin/2026-09` | **Discovered, never crawled** - the current month | 3:45 PM |
| 9 | `/tools/h1b-six-year-limit` | indexed, crawled Sep 9 | 3:47 PM |
| 10 | `/tools/pwd-validity` | indexed, crawled Sep 9 | 3:49 PM |
| 11 | `/guides/i693-medical-exam` | indexed, crawled Sep 8 | 3:51 PM |
| 12 | `/guides/how-dol-sets-a-prevailing-wage` | indexed, crawled Sep 3 | **Quota Exceeded**, 3:53 PM |
| - | `/perm-employers/ziggy-lsv-inc` (from `live-employer-1.xml`) | inspected only: **Discovered**, names `sitemap.xml` | no slot |

**THE LIVE-EMPLOYER SITEMAP FAMILY IS DISCOVERED, ONE DAY AFTER THE INDEX RESUBMIT.**
Yesterday every live-only page inspected read "unknown to Google, no referring sitemaps";
today a page sampled from `live-employer-1.xml` reads "Discovered - currently not indexed"
with `sitemap.xml` named. That is the signal the Sep 21 note said to wait for, and it cost
no slot. The 9/27 Pages report remains the scoreboard for the other 22,466.

**The guides index links every guide.** Measured: 45 guides in `pages.xml`, 45 distinct
guide hrefs on `/guides`, including both guides Google calls unknown. So `what-an-lca-is`
and `how-the-visa-bulletin-works` are not orphans; Google has simply not crawled them.
Closes the question left open on Sep 21.

**THE BULLETIN MONTH PAGES ARE A CHAIN, AND THE CURRENT MONTH HAD NEVER BEEN CRAWLED.**
`/visa-bulletin` links exactly ONE month page (the newest, `2026-09`); each month page links
only its previous and next month. So `2025-03` is eighteen hops from the hub, and all 97
month pages in `pages.xml` are reachable only by walking that list. Even the first hop had
not been taken: `/visa-bulletin/2026-09` was "Discovered, never crawled" on Sep 22. Same
family as the `/perm-queue/<month>` finding of Sep 16, one layer up: those were in no
sitemap, these are in the sitemap but link-deep. The fix shape is a month strip or archive
on the hub, the way `/perm-queue` lists its months. **Not done - a decision for Adam.**

**"Temporary processing error" for Sitemaps appeared on three pages today**
(`perm-rfi-issued-what-to-do`, `perm-application-on-hold-meaning`, `pwd-validity`) while the
rest named `sitemap.xml` cleanly. Second day running for the same string; still reads as
transient on Google's side and is still not acted on.

**A STRAY RETURN RE-SUBMITTED SLOT 7'S PAGE, AND IT COST NOTHING - BY LUCK.** After
Dismiss, the search-bar click did not register, so the Return meant for the bar went to the
still-focused REQUEST AGAIN button. Google answered "Oops! Something went wrong", and 11
were accepted afterwards, so no slot was consumed. The rest of the run split every
inspection into two batches: dismiss and focus, assert the active element is the INPUT,
then type. Codified in `v2/CLAUDE.md`.

## Queue after the Sep 22 run (written before the evening deploy; the deploy queue at the end of this file goes first, then this list in its order)

Inspect first; skip anything crawled after Sep 21, 12:21 PM (the title deploy).

1. `/guides/how-dol-sets-a-prevailing-wage` - refused today, crawled Sep 3
2. `/visa-bulletin/2026-08`, then `2026-07` - re-inspect `2026-09` first: if it converted
   inside 24 hours the way live-only employers did, the chain is worth requesting one hop
   at a time until the hub is fixed
3. `/tools/green-card-fees`, `/tools/priority-date-retention` - titles changed
4. `/guides/explore-perm-wages`, `/guides/waiting-on-your-green-card`,
   `/guides/employer-stopped-filing-perms`, `/guides/how-accurate-are-perm-estimates`
5. blog: `perm-salary-data-by-occupation`, `what-an-employers-perm-record-shows`,
   `what-law-firm-volume-tells-you`, `data-note-application-on-hold-september-2026`,
   `best-immigration-case-management-tools`
6. `/changelog` and its five posts, lowest value; and `/debarments`, `/perm-case-statuses`
   only if a re-inspection shows their Sep 21 request has not been crawled yet
7. one live-only employer sample, inspect only, to watch the family convert

**Run of 2026-09-21, 3:17 to 3:39 PM EDT: 11 accepted, the 12th refused.**

**The cap has now been 11 on four consecutive runs** (Sep 17, 19, 20, 21; only
Sep 18 differed at 8, and that run started at 11:56 AM). Rule unchanged: probe
early, a refusal is free, stop at the wall.

**EVERY SLOT WENT TO A PAGE WHOSE TITLE CHANGED THIS MORNING.** 134 static
pages had titles past ~60 characters and were rewritten and deployed at
12:21 PM; a new title reaches a searcher only when Google recrawls, so the
highest-value request today is a page that is ALREADY INDEXED and whose SERP
listing is now stale. That is the ledger's own "prefer a stale indexed page
over an unknown one", applied to a change we made rather than to one we
found.

| # | URL | Google's verdict | accepted (EDT) |
|---|---|---|---|
| 1 | `/perm-case-statuses` | indexed, title stale | 3:17 PM |
| 2 | `/debarments` | indexed, title stale | 3:20 PM |
| 3 | `/guides/eb2-vs-eb3-perm` | indexed, title stale | 3:21 PM |
| 4 | `/blog/what-is-perm-labor-certification` | indexed, title stale | 3:23 PM |
| 5 | `/guides/how-the-perm-queue-works` | indexed, title stale | 3:25 PM |
| 6 | `/guides/look-up-a-sponsor` | indexed, title stale | 3:27 PM |
| 7 | `/guides/perm-case-number-format` | indexed, title stale | 3:29 PM |
| 8 | `/guides/the-perm-deadlines-that-matter` | indexed, title stale | ~3:31 PM |
| 9 | `/guides/perm-denied-what-happens-next` | indexed, title stale | 3:33 PM |
| 10 | `/tools/rfi-deadline` | indexed, title stale | 3:35 PM |
| 11 | `/perm-employers/under-review` | indexed, title stale | 3:37 PM |
| 12 | `/guides/what-an-lca-is` | **unknown to Google** | **Quota Exceeded**, 3:39 PM |

**THE EXTENSION DISCONNECTED DURING SLOT 8 AND THE REQUEST HAD ALREADY
LANDED.** Every tool call failed with "Browser extension is not connected"
while the live test was running. `tabs_context_mcp` answered normally a moment
later, and re-reading the page showed "Indexing requested". This is the
documented not-a-failure case: read the durable state, never re-click, because
a duplicate costs a slot off an 11-slot day.

**A FINDING FOR THE NEXT RUN: `/guides/what-an-lca-is` is unknown to Google**
and reports "No referring sitemaps detected" even though it IS in `pages.xml`
(all 45 guides are, verified). It also has exactly ONE internal incoming link,
from `look-up-an-lca-by-number.mdx` - which is the population Ahrefs counted as
1,814 "only one dofollow incoming internal link". Worth checking whether the
guides index links every guide; a guide reachable from one sibling and nothing
else is the shape that does not get crawled. First slot next run.


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
7. **Every change reaches the queue.** After a deploy, and at the start of every
   round, run `node scripts/gsc_queue.mjs` from `v2/`: it lists the public pages
   changed since this file's last commit (new pages, pages whose own content
   changed, and one sample page per changed family; files shared by more than
   15 pages are left to the sitemap's lastmod). Add whatever it lists that the
   newest section doesn't already hold as a "Queue after the <date> deploy"
   section at the end, then work that section top down.
8. **Google should crawl what was deployed, not Cloudflare's day-old copy.** The
   deploy runs the same script with `--purge`, which drops Cloudflare's stored
   HTML of exactly those pages (needs the `CF_PURGE_TOKEN` repo secret). Until
   that token exists, purge by hand before requesting a page changed that day.

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

## Queue after the Sep 23 run (the timer probes from 3:07 PM EDT Sep 24; a refusal is free)

Inspect first; skip anything already on Google. Today's first request was accepted at
3:59 PM, later than usual because the timer had died, so tomorrow's 3:07 PM probe may be
refused; the 5:07 PM fire tries again.

1. `/guides/approved-i140-no-visa-number-eb2-india` (unknown to Google; refused at 12 today),
   `/guides/ead-and-advance-parole-timelines`
2. `/visa-bulletin` (the month strip is new; its recrawl is what exposes the 96 month pages)
3. `/terms`, `/about` (the Florida LLC wording), `/methodology` (two new entries), `/glossary`
4. left over from Sep 18: `/perm-queue/2025-04` and backwards
5. then the pre-deploy Sep 22 list above (the wage guide refused on Sep 22, the August and
   July bulletin pages, the two retitled tools), in its order

## Queue after the Sep 24 run (the timer probes from 3:07 PM EDT Sep 25; a refusal is free)

Inspect first; skip anything crawled after Sep 21, 12:21 PM (the title deploy).

1. `/guides/employer-stopped-filing-perms` (refused today, crawled Sep 9),
   `/guides/how-accurate-are-perm-estimates`
2. blog: `perm-salary-data-by-occupation`, `what-an-employers-perm-record-shows`,
   `what-law-firm-volume-tells-you`, `data-note-application-on-hold-september-2026`,
   `best-immigration-case-management-tools`
3. `/changelog` and its five posts, lowest value; `/debarments` and `/perm-case-statuses` only
   if a re-inspection shows their Sep 21 request has not been crawled yet
4. one live-only employer sample, inspect only, to watch the family convert
5. dropped today: the `/perm-queue/<month>` family (indexed on its own), `/tools/green-card-fees`
   (crawled Sep 24), and `/visa-bulletin/2026-08` and `2026-07` (reachable from the hub now)

## Queue after the Sep 25 run (the timer probes from 3:07 PM EDT Sep 26; a refusal is free)

Inspect first; skip anything crawled after Sep 21, 12:21 PM (the title deploy).

1. `/changelog/the-whole-field-three-ways` (refused today, crawled Sep 3),
   `/changelog/live-data-and-two-doors`, `/changelog/march-2026-timeline-and-ux`
2. `/debarments` and `/perm-case-statuses` only if a re-inspection shows their Sep 21 request
   has not been crawled yet
3. one live-only employer sample, inspect only, to watch the family convert
4. **then the queue is exhausted**: every page from the Sep 21 title deploy and the Sep 22
   deploy that this ledger listed has been requested. Before a run after this one, rebuild the
   queue (re-inspect a sample of the pages requested Sep 21 to 25 to see whether the recrawls
   landed, and check Search Console's Pages report for anything newly "Crawled, not indexed").

## Queue after the Sep 26 deploy (the timer probes from 3:07 PM EDT Sep 26; a refusal is free)

The Sep 26 deploy (`92387de5`, Ready 2:17 AM EDT) changed the pages the Adobe post sent
people to: every employer page gained a "Follow" block (its pending mix, its dated moves), and
the census page gained a status bar and a Follow link per row. Inspect first; request what was
crawled before 2:17 AM Sep 26.

1. `/perm-employers/under-review` (the page quoted on X to about 127,000 people)
2. `/perm-employers/adobe-inc`, then `/perm-employers/cognizant-technology-solutions-us-corporation`
3. `/guides/perm-application-on-hold-meaning` (inspect; its Sep 25 rewrite may already be crawled)
4. then the Sep 25 queue above, from its item 1

## Queue after the Sep 26 evening deploy (supersedes the two sections above)

No round ran on Sep 26 before the evening deploy: the owner held it so the slots go to the pages
as they ship tonight (years on the green card line, industry and city plus the year-by-year
record on every employer page, the reviewed translations). Inspect first; request what was
crawled before tonight's deploy.

1. `/perm-employers/under-review` (quoted on X to ~127,000 people on Sep 25)
2. `/perm-employers/adobe-inc`, `/perm-employers/cognizant-technology-solutions-us-corporation`
3. `/tools/green-card-line` (years now shown)
4. `/guides/approved-i140-no-visa-number-eb2-india`, `/guides/eb3-other-workers` (reworded)
5. New since the Sep 26 afternoon deploy, likely never crawled: `/tools/eb2-vs-eb3`,
   `/tools/which-green-card`, `/visa-bulletin/categories`, `/h1b-lottery-odds`,
   `/green-card-timelines`, `/nvc-waiting-list`
6. The three new breakdown hubs, never crawled: `/perm-cities`, `/perm-industries`,
   `/perm-countries`, then one busy page of each (`/perm-cities/new-york-ny`,
   `/perm-industries/541511`, `/perm-countries/india`; confirm each slug 200s first)
7. `/case-search` (history back to FY2016, worker and industry filters)
8. `/zh`, `/es`, `/pt-br`, `/ko`, `/vi`
9. `/guides/perm-application-on-hold-meaning`, then the Sep 25 queue from its item 1

## Queue after the Sep 27 run (the next round probes from 3:07 PM EDT Sep 28; a refusal is free)

1. `/nvc-waiting-list` (refused on Sep 27, never crawled)
2. The three breakdown hubs, never crawled: `/perm-cities`, `/perm-industries`, `/perm-countries`,
   then `/perm-cities/new-york-ny`, `/perm-industries/541511`, `/perm-countries/india` (all 200)
3. `/case-search` (history back to FY2016, worker and industry filters, fiscal-year seek)
4. `/zh`, `/es`, `/pt-br`, `/ko`, `/vi`
5. `/guides/perm-application-on-hold-meaning`, then the Sep 25 queue from its item 1

## Queue after the Sep 30 check (supersedes the Sep 27 queue; no round ran Sep 28 to 30)

Checked 2:10 to 2:25 PM EDT Sep 30. The session timers had expired (7 days); nothing was
requested Sep 28, 29 or 30, so the next round has a full day's quota.

**The move to the Oracle server did not hurt crawling.** Search Console's own reports can't show it
yet (Pages last updated 9/20, crawl stats 9/28, performance 13.5 hours behind and ending before the
5:53 PM Sep 28 switch), so the server's nginx logs are the record: Googlebot (66.249.*) made 4,065
requests from the switch to 2:08 PM Sep 30; 3,888 got 200/304, 153 got 404 (almost all old
`/_next/static` build files, expected after a rebuild), 23 got 5xx (all on Sep 29, the crawler-flood
day, none since), and none got 429 or 503. The weekend dip on the performance chart (Sep 26 to 27)
matches the Sep 19 to 20 weekend.

**Resubmit the sitemap index first (it costs no request slot).** Search Console last read it Sep 23
and counts 102,019 discovered pages; the live children hold 106,175. The difference, 4,156, is
exactly `groups.xml` (every `/perm-cities/`, `/perm-industries/` and `/perm-countries/` page), a
child added Sep 26 that Google has never seen. Same trap as Sep 21: a NEW child is found only when
the index is re-read.

Then request, in order (inspected Sep 30 where marked):

1. `/visa-bulletin/2026-10`: Discovered, never crawled (inspected). The October bulletin is what
   people are searching for this week. (`/visa-bulletin` itself is indexed.)
2. `/nvc-waiting-list`: Discovered, never crawled (inspected; third queue running).
3. `/perm-cities` (Discovered, no referring page seen, inspected), `/perm-industries`,
   `/perm-countries`
4. `/perm-cities/new-york-ny`, `/perm-industries/541511`, `/perm-countries/india`
5. `/tools/salary-explorer`, `/case-search`, `/lca-wages`, `/tools/i485-queue-position`: indexed,
   but since the Sep 30 loading pass their server HTML carries the whole tool (salary explorer
   6,204 words) where it carried a one-line "Loading…". Checked live: no page-level "Loading…".
6. Next day: `/perm-cases`, `/pwd-cases`, `/lca-cases` (same fix; each still loads its case table's
   rows in the browser, 1,100+ words around it are in the HTML), then
   `/guides/perm-application-on-hold-meaning`, then the Sep 25 queue from its item 1.

Dropped: the translations. `/zh` is indexed on its own (inspected); inspect `/es`, `/pt-br`, `/ko`
and `/vi` before spending a slot on any of them.

**Remaining after the Sep 30 run (the automatic round works this list, top first):**

1. `/tools/i485-queue-position` (refused Sep 30 on quota; indexed, HTML changed Sep 30)
2. `/perm-cases`, `/pwd-cases`, `/lca-cases` (indexed; HTML changed Sep 30)
3. `/guides/perm-application-on-hold-meaning`
4. The Sep 25 queue from its item 1 (inspect first; much of it may already be indexed)
5. `/es`, `/pt-br`, `/ko`, `/vi`: inspect only; request any that are not indexed

When every item above is either indexed or requested, the queue is EMPTY: say so here in one
line ("Queue empty as of <date>"), and the automatic round deletes its own timer.

## Queue after the Oct 1 run (the next round probes from about 11:35 PM EDT Oct 2; a refusal is free)

1. `/es`, `/pt-br`, `/ko`: Discovered, never crawled (inspected Oct 1). `/zh` and `/vi` are indexed.
2. One live-only employer page, inspect only, to watch that family convert.

After those the queue is empty: write "Queue empty as of <date>" here and the automatic round
deletes its own timer.

Queue was empty at 2026-10-03, 3:59 AM EDT, and reopened at 4:05 AM: the old list never held the
pages the Oct 1 and Oct 2 deploys changed. `/es`, `/pt-br` and `/ko` were requested; the
live-only employer page was inspected (Discovered, never crawled).

## Queue after the Oct 3 run (the next round probes from about 3:55 AM EDT Oct 4; a refusal is free)

Nearly every page changed Oct 1 and Oct 2 (the visual pass, bylines on every article), and ~11
requests a day cannot follow that: Google recrawls the rest on its own. The lever at scale is the
sitemap's `lastmod`, and 58 static pages in `src/lib/sitemap/build.ts` carry hand-typed dates that
never move (`/terms` says 2026-06-15 though it changed Oct 2). That fix ships with the next deploy.

1. `/terms`, `/privacy`, `/api-terms` (changed or new Oct 2): inspect; request any last crawled
   before Oct 2.
2. `/perm-processing-times`: inspect; request if last crawled before Oct 1.
3. `/visa-bulletin/2008-07`: inspect only, to see whether Google has found the 92 month pages
   from 2005 to 2014 through the sitemap and the hub.

After those the queue is empty: write "Queue empty as of <date>" here and the automatic round
deletes its own timer.

## Queue after the Oct 5 deploy (the batch: reference sources, visas issued, firm claims, the extension)

0. `/api-terms`: request once Settings, robots.txt shows a fetch after Oct 4, 9:21 PM EDT
   (carried over; until then the live test still reads "Blocked by robots.txt").

Generated by `node scripts/gsc_queue.mjs --since 2b015d12` (changes since 2026-10-04).

New pages (request):
1. `/extension`
2. `/visa-issuances`

Changed pages (inspect; request any last crawled before 2026-10-04):
3. `/`
4. `/methodology`
5. `/perm-cities`
6. `/perm-countries`
7. `/perm-industries`
8. `/privacy`
9. `/terms`
10. `/tools/wage-levels`

Changed page families (request the sample; the sitemap's lastmod carries the rest):
11. `/perm-attorneys/[slug]`: `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp`
12. `/perm-cities/[slug]`: `/perm-cities/new-york-ny`
13. `/perm-countries/[slug]`: `/perm-countries/india`
14. `/perm-industries/[slug]`: `/perm-industries/541511`
15. `/perm-wages/[slug]`: `/perm-wages/software-developers`
16. `/visa-bulletin/categories/[line]`: `/visa-bulletin/categories/eb2-india`, `/visa-bulletin/categories/eb3-india`

Site-wide changes, left to the sitemap's lastmod: `DataProvenance.tsx` (59 pages), `navigation.ts` (34 pages).

**Request `/tools/wage-levels` right after the two new pages**: until this deploy it showed last
year's DOL levels under this year's label, so its indexed copy is the one most worth replacing. The 2005 to 2014 bulletin months wait for the
Pages report: request them only if they're still Discovered a week from Oct 4.


## Queue after the Oct 5 afternoon changes (the identity merge and the retired-slug redirects)

Generated by `node scripts/gsc_queue.mjs --since 452c3281` (changes since 2026-10-05). `/extension` and the
law-firm sample are already in the section above; this adds the employer family.

1. `/perm-employers/[slug]`: `/perm-employers/google-llc` (sample; employer pages read the merged identity now,
   and 527 retired employer spellings and 107 retired firm spellings answer 308 to the page they merged into)

## Queue after the Oct 6 afternoon changes (the case page answers first; every door leads to a case)

Generated by `node scripts/gsc_queue.mjs --since ebae8a8e` (changes since 2026-10-06). Work the Oct 6 list at the
top first; these are the pages it doesn't hold. Most changed only in their ending (the case lookup that replaced
the sign-up button) or a next-step box, so request only those last crawled before Oct 6.

1. `/perm-case-status` (the answer card now names the estimated date)
2. `/perm-processing-times`
3. `/visa-bulletin`
4. `/tools/perm-timeline-calculator` (an email button and a case link under its answer)
5. `/perm-denial-risk`, `/perm-rfi-audit`
6. `/blog`, `/changelog`
7. `/tools/priority-date-calculator`, `/tools/pwd-calculator`

The employer, law-firm, wage and bulletin-line samples it lists are already queued above.

## Queue after the Oct 7 deploys (faster alerts, the structured-data pass)

Generated by `node scripts/gsc_queue.mjs --since 8cb2926c` (changes since 2026-10-06), then ordered by hand.
The structured-data change sits in a file every page reads, so the script leaves it to the sitemap's
lastmod; the homepage carries the most of it and goes first. `/blog`, `/changelog` and
`/perm-case-status` are already in the Oct 6 list above (their list markup changed again today).

1. `/` (the Organization gained description, other names, email and address; the app's category is one
   Google accepts now)
2. `/api-terms` (indexed while robots.txt blocked it; the rule was fixed Oct 4 and Google last crawled it
   Oct 2. Its Validate fix started Oct 7)
3. `/about` (the Organization's own page, by Google's placement rule)
4. `/calculators` (each tool's app category)
5. `/guides` (list entries are Google's list shape now)

Left out: `/terms`, `/privacy` and `/accessibility` read the same constants and render identically.
The two employer pages in the Server error (5xx) report, `/perm-employers/numinformatics-inc` and
`/perm-employers/locus-location-systems-llc`, are being re-crawled by their Validate fix (started Oct 7).

## Queue after the Oct 7 evening changes (estimates graded everywhere; every filter applies on every program)

Generated by `node scripts/gsc_queue.mjs --since c1489f88` (changes since 2026-10-07). `/` is in the section above.
Request these only once the 9:01 PM EDT deploy (`58973b9c`) is live, and only those last crawled before Oct 7.

1. `/perm-case-status` (passed-month cases dated by the measured rate; alert timing says every 5 minutes)
2. `/case-search` (industry and worksite city now filter every program, not only PERM)
3. `/estimate-scorecard` (every estimate graded or tested, the bulletin release day included)
4. `/tools/perm-timeline-calculator`, `/tools/green-card-line`, `/tools/i485-queue-position`, `/tools/eb2-vs-eb3`
5. `/seasonal-cases` (rejections and decided cases stop reading as waiting)
6. `/perm-cases`, `/pwd-cases`, `/lca-cases`, `/perm-employers`, `/for-attorneys`
7. `/perm-attorneys/[slug]` sample: `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp`

## Queue after the Oct 7 night changes (seasonal guides and chart, the green card line's years)

Request once the push after `7928533c` is live.

1. `/guides/h2a-case-status-and-timing` and `/guides/h2b-and-cw1-case-status-and-timing` (new; the sitemap carries them)
2. `/seasonal-cases` (decisions per day and each visa's outcomes)
3. `/tools/green-card-line`, `/tools/eb2-vs-eb3` (the years figure is back; it was blank Sep 26 to Oct 7)
4. `/perm-case-statuses` (definitions for archived job orders and the Board's decisions)

## Queue after the Oct 8 changes (RFI cases dated from their RFI day, a day for wage requests, the measured range)

1. `/perm-case-status` (an RFI case's date, the measured range, the bounded window)
2. `/tools/perm-timeline-calculator` (the measured range by distance)
3. `/estimate-scorecard` (RFI dates, subscribers' dates, the wage-request day graded)

## Queue after the Oct 8 evening changes (stage links only where a page exists, Board-affirmed denials final)

1. `/perm-employers/under-review` (busiest page of Oct 8: the PERM suspensions; a status row no longer links to a page that doesn't exist)
2. `/perm-case-statuses` (a definition for DENIED - BALCA AFFIRMED)
3. `/perm-rfi-audit` (the stage list shares the same link rule)

## Queue after the Oct 9 changes (H-1B employer rankings, live DOL figures, article tables restored)

Listed by `node scripts/gsc_queue.mjs --since b0905d9c`; the pages already in the Oct 8 sections are left there.

1. `/h1b-employers` (new: the 100 busiest H-1B employers by fiscal year) and a state sample, `/h1b-employers/california`
2. `/guides/ultimate-perm-guide-2026`, `/guides/complete-perm-filing-guide`, `/guides/three-180-day-clocks` (their comparison tables and step numbers had been missing since Feb 12; DOL's figures now read live)
3. `/faq` (DOL's average read live)
4. `/` (the homepage)
5. `/perm-case-status`
6. `/guides/check-perm-case-status`, `/guides/reading-the-perm-data`, `/blog/perm-audit-what-it-means`, `/blog/is-my-company-still-filing-perm`
7. `/developers`, `/api-terms` (scopes, sandbox keys, exports, live lookups, webhooks)
8. `/i140-awaiting-visa`, `/i485-by-field-office` (the Q&A reads live figures)
9. `/changelog/alerts-in-minutes-and-measured-estimates` (newest of the five new entries; the sitemap carries the rest)

## Queue after the Oct 10 changes (Sabrina's D.C. Bar record)

1. `/about` (her bar record on the card and in her Person node, live 4:10 AM; refused for quota at 4:18 AM)

## Queue after the Oct 10 afternoon changes (Audit 12: failed reads, export caps, corrected copy)

Listed by `node scripts/gsc_queue.mjs --since 9995b242`. Most of these changed in how a failed read is handled,
not in what a reader sees; request only those last crawled before Oct 10.

1. `/developers` (export rows a day, `/v1/me`'s new fields; also refused Oct 9)
2. `/`, `/perm-case-status`, `/case-search` (copy corrections; the case search names what it couldn't read)
3. `/perm-employers/google-llc`, `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp` (family samples)
4. `/perm-employers/under-review`, `/perm-case-statuses`, `/perm-rfi-audit`, `/perm-cases`, `/perm-queue`
5. `/perm-processing-times`, `/visa-bulletin`, `/visa-bulletin/categories/eb2-india`, `/visa-bulletin/categories/eb3-india`
6. `/perm-employers`, `/perm-attorneys`, `/perm-wages`, `/perm-by-state`, `/perm-denial-risk`, `/seasonal-cases`
7. `/tools`, `/tools/perm-timeline-calculator`, `/tools/green-card-timeline`, `/tools/i140-calculator`,
   `/tools/i140-trends`, `/tools/priority-date-calculator`, `/tools/pwd-calculator`

## Queue after the Oct 11 changes (the visual pass: list pages, charts, every article picture re-shot)

Listed by `node scripts/gsc_queue.mjs --since ea315e78`: 155 pages and 7 family samples, because nearly every
public page was redrawn on Oct 11. At about 11 requests a day, request the pages people land on first and leave
the rest to the sitemap's lastmod. Inspect each; request only those last crawled before Oct 11.

1. `/press` (new page)
2. `/`, `/perm-case-status`, `/case-search`, `/faq`
3. `/perm-processing-times`, `/perm-employers`, `/perm-employers/google-llc` (family sample), `/perm-cases`
4. `/tools/green-card-line`, `/tools/eb2-vs-eb3`, `/tools/ead-extension`, `/tools/perm-deadline-calculator`, `/tools`
5. `/visa-bulletin`, `/visa-bulletin/family`, `/visa-bulletin/categories/eb2-india`, `/perm-queue`, `/perm-decision-activity`
6. `/pwd-cases`, `/lca-cases`, `/perm-attorneys`, `/perm-wages`, `/perm-wages/software-developers`, `/perm-denial-risk`
7. `/perm-cities`, `/perm-industries`, `/perm-countries`, `/perm-cities/new-york-ny`, `/layoffs`, `/green-card-timelines`
8. `/guides`, `/blog`, `/guides/look-up-a-sponsor`, `/guides/where-your-filing-month-sits`, `/guides/the-data-pages-and-what-each-answers` (pictures re-shot)
9. Everything else on the script's list: the sitemap carries it.

## Queue after the Oct 11 (night) changes (About rebuilt, long lists folded, "did you mean" on every search)

Listed by `node scripts/gsc_queue.mjs` (since `b957239b`) at 11:40 PM EDT Oct 11; these were redrawn after the
6:55 PM run, so a crawl dated Oct 11 morning is still stale. In order:

1. `/about` (rebuilt: portrait, both halves as the app's pages, the sources flow, the dated record)
2. `/opt-employers` (23,693 px to 5,173: top 25 rows, the rest folded), `/estimate-scorecard` (readings folded)
3. `/visa-bulletin` (33 sentences to four chips), `/visa-bulletin/categories` (cells tinted by state)
4. `/calculators`, `/badges`, `/security`, `/api-terms`, `/tools/green-card-fees`
5. Everything else on the script's list: the sitemap's lastmod carries it. The 404 is noindex and never requested.

## Queue after the Oct 12 (early morning) changes

1. `/tools/i485-queue-position` (its limits box folds after the first)
2. `/for-attorneys` and `/about` carry re-shot app pictures (the dashboard and alerts pages lost a label); their
   HTML changed only in image sizes, so request them only if a slot is spare.

## Queue after the Oct 12 (midday) changes (Terms: deletion from Settings; Privacy: the analytics switch)

Listed by `node scripts/gsc_queue.mjs` (since `9a624740`) at 3:35 PM EDT Oct 12. Legal pages, low search value:
request only when a slot is spare after the Oct 11 sections.

1. `/terms`
2. `/privacy`

## Queue after the Oct 13 to 16 changes (the middle-ground redesign, live Oct 15 6:04 PM EDT, rounds 2 and 3 to 10:42 PM)

`node scripts/gsc_queue.mjs --since 7edd296d` lists 169 changed public pages: the redesign touched every
template. The sitemap's lastmod carries most of them; slots go to the pages most people land on, in order:

1. `/` (most visitors; the definition, the board's labels and the sections changed)
2. `/perm-case-status`
3. `/perm-processing-times`
4. `/faq`
5. `/about`
6. `/for-attorneys`
7. `/perm-case-statuses` (rebuilt: banners and colours per program)
8. `/perm-employers/google-llc` (the employer family's sample)
9. `/perm-queue`
10. `/visa-bulletin`
11. `/case-search`
12. `/perm-cases`
13. `/uscis-case-status`
14. `/guides`
15. `/changelog` (rebuilt as a compact list)
16. `/tools`
17. `/perm-employers`
18. `/perm-wages/software-developers`
19. `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp`
20. `/policy-changes`

### Round, Fri Oct 16 2026, 12:35 to 1:05 AM EDT

Requested (11, then "Quota Exceeded"): `/` (last crawl Oct 15 4:43 PM), `/perm-case-status` (Oct 11),
`/perm-processing-times` (Oct 15 4:49 PM), `/faq` (Oct 11), `/about` (Oct 9), `/for-attorneys` (Oct 6),
`/perm-case-statuses` (Oct 10), `/perm-employers/google-llc` (Oct 15 12:49 AM), `/visa-bulletin` (Oct 12),
`/case-search` (Oct 11), and `/perm-queue`, which turned out to be crawled Oct 15 11:38 PM, after the last change
(read the crawl date before every click). Skipped: `/perm-cases`, crawled Oct 15 11:38 PM. Refused at the quota:
`/uscis-case-status` (last crawl Sep 23). The sitemap index had last been read Oct 10; resubmitted.

Still to request, in order: `/` (FIRST: its description names both sides since Oct 16 7:29 PM EDT, and Google showed `/calculators` for "perm tracker" after its 4:40 PM crawl of the redesigned homepage; the 7:30 PM request met the quota), `/perm-rfi-audit` (owner, Oct 16 5:14 AM: the step-by-step RFI section is new), `/uscis-rfe-rates` (new Oct 16, 6:45 AM: never crawled, so it goes straight in), `/` again only if crawled before Oct 16 5:30 AM (the hero changed), `/uscis-case-status`, `/guides`, `/changelog`, `/tools`, `/perm-employers`,
`/perm-wages/software-developers`, `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp`, `/policy-changes`.

**Server error (5xx), checked Fri Oct 16, 6:00 AM EDT.** The "Some fixes failed" email (Oct 15, 8:35 AM) covered Oct 12
to 14, when the search-engine cap of 6 turned away up to 19% of Googlebot's requests (8,294 on Oct 13). The cap went to 12
at 3:09 PM Oct 15, and Search Console started validating again the same minute (its 3:08 and 3:09 PM emails), so don't
press Validate again. Since then: 157 Googlebot 503s, all between 10 and 11 PM EDT Oct 15, about 0.3% of its day.

## Queue after the Oct 16 to 17 night changes (a date on every page, 40 new articles, six retitles)

`node scripts/gsc_queue.mjs --since a86aa31f` lists 37 new published articles, 24 changed pages and the employer
family. Every page now shows "Updated <day>" and carries the same day as a WebPage `dateModified` and as its sitemap
lastmod, so the sitemap carries most of the rest. Live after the 1af8bb34 deploy (Oct 17, about 2:35 AM EDT). Work
this list top down, inspecting each first (a page crawled after Oct 17 2 AM EDT is skipped); then the Oct 13 to 16
section's "Still to request" list.

1. `/` (still first: its two-sided description from Oct 16, and the WebPage date)
2. `/perm-case-status` (retitled "PERM Case Status: Check and Track a Case")
3. `/blog/best-immigration-case-management-tools` (refreshed: what each tool says about PERM; AI answers cite it)
4. `/guides/employer-suspended-from-perm` (new; the Oct 8 suspensions, live hold counts)
5. `/guides/perm-certified-what-next` (new)
6. `/guides/when-does-the-visa-bulletin-come-out` (new; the November bulletin is due)
7. `/perm-processing-times` (retitled "PERM Processing Times 2026, Tracked Daily")
8. `/for-attorneys` (retitled "Free PERM Case Management App for Attorneys")
9. `/perm-employers/google-llc` (the employer family: "sponsors green cards" answer, Updated line)
10. `/guides/how-the-perm-queue-works` (retitled for "PERM analyst review", DOL's month read live)
11. `/blog/docketwise-alternatives-for-perm`
12. `/blog/immigration-software-pricing-2026`
13. `/guides/dol-average-vs-your-wait`
14. `/guides/priority-date-current-perm-pending`
15. `/guides/priority-date-retrogressed-after-filing`
16. `/guides/h1b-six-year-limit-with-perm-pending`
17. `/guides/i140-revoked-before-after-180-days`
18. `/guides/h1b-60-day-grace-period-proposal`
19. `/guides/ead-renewal-no-automatic-extension`
20. `/guides/eb2-india-forecasts-how-close`
21. `/guides/eta-9089-expiration-and-i140-deadline`
22. `/guides/how-long-perm-recruitment-stays-valid`
23. `/guides/perm-audit-response`
24. `/guides/green-card-sponsors-for-your-job`
25. `/guides/find-your-lca-without-the-number`
26. `/guides/opt-to-green-card-employers`
27. `/guides/i485-inventory-month-by-month`
28. `/guides/salary-high-enough-perm-h1b`
29. `/guides/perm-recruitment-failed-h1b-clock`
30. `/guides/perm-employer-questionnaire`
31. `/guides/perm-business-necessity`
32. `/guides/perm-layoff-rule-for-employers`
33. `/guides/perm-sunday-ads-additional-recruitment-steps`
34. `/guides/special-handling-university-teachers`
35. `/blog/docketwise-vs-inszoom-lollylaw-eimmigration`
36. `/blog/free-immigration-case-management-software`
37. `/blog/client-status-updates-without-the-email-load`
38. `/blog/vendor-data-security-questions`
39. `/blog/perm-attorney-fees-employer-must-pay`
40. `/blog/proposed-perm-rule-rin-1205-ac29`
41. `/blog/rule-changes-since-august-2026`
42. `/blog/perm-queue-october-2026`
43. `/blog/h1b-sponsors-layoff-notices-october-2026`
44. `/blog/opt-fee-proposal-2026`
45. `/blog/is-my-company-still-filing-perm` (refreshed)
46. `/guides/where-your-filing-month-sits` (DOL's figures read live)
47. `/guides/perm-appeal-reconsideration-balca` (refreshed with measured outcomes)
48. `/guides/three-180-day-clocks`, `/guides/perm-denied-what-happens-next`, `/guides/employer-layoffs-and-your-perm`,
    `/guides/eb2-vs-eb3-perm`, `/guides/track-a-prevailing-wage-request` (refreshed)
49. `/tools/perm-timeline-calculator`, `/pwd-cases`, `/lca-cases` (retitled)
50. `/glossary`, `/perm-attorneys`, `/perm-employers`, `/layoffs`, `/h1b-employers` (layout fixes, dates)

**Live since Oct 17, about 5:45 AM EDT** (owner's call: the attorney reviews them on the site):
`/guides/perm-recruitment-report-sample`, `/guides/perm-notice-of-filing-sample` and `/guides/perm-audit-file-index`.
Request them first in the next round, before #13.

### Round, Saturday Oct 17 2026 (about 2:50 to 3:22 AM EDT)

Worked the "Queue after the Oct 16 to 17 night changes" list top down; Google answered Quota Exceeded on #13.

Requested (last crawl before the request):
- `/perm-case-status` (Oct 16, 12:41 AM)
- `/blog/best-immigration-case-management-tools` (Sep 25, 3:53 PM)
- `/guides/employer-suspended-from-perm` (unknown to Google)
- `/guides/perm-certified-what-next` (unknown to Google)
- `/guides/when-does-the-visa-bulletin-come-out` (unknown to Google)
- `/perm-processing-times` (Oct 16, 12:43 AM)
- `/for-attorneys` (Oct 16, 12:47 AM)
- `/perm-employers/google-llc` (Oct 16, 12:51 AM)
- `/guides/how-the-perm-queue-works` (Sep 21, 3:26 PM)
- `/blog/docketwise-alternatives-for-perm` (unknown to Google)
- `/blog/immigration-software-pricing-2026` (unknown to Google)

Skipped: `/` (crawled Oct 16, 9:38 PM, after its Oct 16 description change; tonight it gained only the WebPage date
in its structured data, which the sitemap's lastmod carries).

Quota Exceeded on `/guides/dol-average-vs-your-wait` (unknown to Google, not requested).

Still to request: #13 to #50 of the list above, starting with `/guides/dol-average-vs-your-wait`, then the Oct 13 to 16
section's "Still to request" list.

Driving note: once the bar held focus (`activeElement` was INPUT) and the typed URL still didn't land, so Return
gave "Something went wrong". Read `document.activeElement.value` after typing and press Return only when it holds the URL.

## Queue after the Oct 18 deploys (2:50 and 4:14 AM EDT)

From `node scripts/gsc_queue.mjs --since b75fc2fa`, which lists 55 pages because shared code changed (month and
format helpers, entity links). Ordered by what a reader sees changed; the rest ride the sitemap's lastmod. Inspect
first and skip any page crawled after 4:14 AM EDT Oct 18. These go after the "Still to request" list above.

1. `/perm-recruitment` (new: where employers recruit, and when)
2. `/sponsor-finder` (search by job, wage and timing; phone cards; Schedule A note)
3. `/guides/green-card-sponsors-for-your-job` (the no-fee rule and the scam warning)
4. `/case-search` (job filter on employer and state searches fixed; the form lives in the address)
5. `/perm-wages/software-developers` (links to the finder and the case search; recruitment panels)
6. `/perm-employers/google-llc` (recruitment panels)
7. `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp` (recruitment panels)
8. `/guides/how-long-perm-recruitment-stays-valid` (live timing callout)
9. `/contact` (says it isn't an employer and points to the finder)
10. `/guides/perm-sunday-ads-additional-recruitment-steps` (one link)

### Round, Monday Oct 19 2026 (about 10:30 to 11:00 AM EDT)

Worked the Oct 18 list's served-markup changes first, then the three templates, then pages that changed after
their last crawl. Google answered Quota Exceeded on the 12th request.

Requested (last crawl before the request):
- `/sponsor-finder` (Oct 15, 11:38 PM)
- `/case-search` (Oct 16, 12:54 AM)
- `/guides/green-card-sponsors-for-your-job` (Oct 17, 7:46 AM)
- `/guides/how-long-perm-recruitment-stays-valid` (Oct 17, 7:46 AM)
- `/guides/perm-recruitment-report-sample` (Oct 17, 7:46 AM; changed 2:16 PM that day)
- `/guides/perm-notice-of-filing-sample` (Oct 17, 7:46 AM; changed 2:16 PM)
- `/guides/perm-audit-file-index` (Oct 17, 7:46 AM; changed 2:16 PM)
- `/perm-employers/google-llc` (Oct 17, 7:41 AM)
- `/perm-wages/software-developers` (Oct 14, 1:09 PM)
- `/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp` (Oct 14, 3:54 AM)
- `/guides/eta-9089-expiration-and-i140-deadline` (Oct 17, 7:46 AM; changed 2:42 PM)

Skipped, crawled after their last change: `/perm-recruitment` (Oct 18, 7:59 AM), `/guides/dol-average-vs-your-wait`
(Oct 17, 7:46 AM), `/guides/perm-audit-response` (Oct 18, 7:36 PM).

Quota Exceeded on `/guides/perm-employer-questionnaire` (Oct 17, 7:46 AM; changed 2:42 PM; not requested).

**Google crawled most of the Oct 16 to 17 articles on its own at Oct 17, 7:41 to 7:46 AM**, so "Still to request" is
now only the pages that changed after that crawl (commit times from `git log -1 -- content/<path>.mdx`): the Oct 17
afternoon citation pass and the Oct 18 link.

Still to request, in order:
1. `/guides/perm-employer-questionnaire`
2. `/guides/perm-business-necessity`
3. `/guides/perm-layoff-rule-for-employers`
4. `/guides/special-handling-university-teachers`
5. `/blog/docketwise-vs-inszoom-lollylaw-eimmigration`
6. `/blog/vendor-data-security-questions`
7. `/blog/perm-attorney-fees-employer-must-pay`
8. `/guides/perm-sunday-ads-additional-recruitment-steps` (changed Oct 18, 4:01 AM)
9. `/contact` (Oct 18 list)

Driving notes: never send a focus batch and a typing batch in parallel. When the first errored ("Couldn't determine
which page"), the second typed the URL into the open dialog's Dismiss button; no Return followed, so nothing ran.
That error hits about every other browser call this session and nothing in the batch runs; re-send the same batch.

## Queue after the Oct 19 night deploy (319340a2, about 2 AM EDT)

`node scripts/gsc_queue.mjs --since b4205031`: the month-tick fix on every chart (labels read as months). Low
priority, since nothing a searcher reads changed; the sitemap's lastmod carries them. Request only after the list
above, and only a page crawled before Oct 19, 2 AM EDT:
`/`, `/perm-case-status`, `/perm-cases`, `/perm-decision-activity`, `/perm-processing-times`, `/policy-changes`,
`/seasonal-cases`, `/tools`.

## Queue after the Oct 20 night deploy (08256222, about 2 AM EDT)

`node scripts/gsc_queue.mjs --since 319340a2`: the deadline calculator's dates can leave the page (copy, a calendar
file, save as a case), and three articles that link to it. All four changed Oct 19, 9:28 PM EDT and went live at 2 AM.
`/tools/perm-deadline-calculator`, `/blog/what-is-perm-labor-certification`, `/guides/manual-vs-automated-tracking`,
`/guides/ultimate-perm-guide-2026`.

### Round, Tuesday Oct 20 2026 (about 11:13 to 11:39 AM EDT)

Worked Monday's "Still to request" list, then the Oct 20 list. Google answered Quota Exceeded on the 12th request.

Requested (last crawl before the request):
- `/guides/perm-employer-questionnaire` (Oct 17, 7:46 AM; changed 2:42 PM that day)
- `/guides/perm-business-necessity` (Oct 17, 7:46 AM; that crawl got a server error, so the page wasn't indexed)
- `/guides/perm-layoff-rule-for-employers` (Oct 17, 7:46 AM; changed 2:42 PM)
- `/guides/special-handling-university-teachers` (Oct 17, 7:46 AM; changed 2:42 PM)
- `/blog/docketwise-vs-inszoom-lollylaw-eimmigration` (Oct 17, 7:46 AM; changed 2:42 PM)
- `/blog/vendor-data-security-questions` (Oct 17, 7:46 AM; changed 2:42 PM)
- `/blog/perm-attorney-fees-employer-must-pay` (Oct 17, 7:45 AM; changed 2:42 PM)
- `/guides/perm-sunday-ads-additional-recruitment-steps` (Oct 17, 7:46 AM; changed Oct 18, 4:01 AM)
- `/contact` (Oct 9, 7:55 PM; changed Oct 18, 2:37 AM)
- `/tools/perm-deadline-calculator` (Oct 11, 7:18 PM; changed Oct 19, live Oct 20)
- `/blog/what-is-perm-labor-certification` (Oct 7, 3:08 PM)

Skipped: none.

Quota Exceeded on `/guides/manual-vs-automated-tracking` (Aug 29, 3:50 PM; not requested).

Still to request, in order:
1. `/guides/manual-vs-automated-tracking`
2. `/guides/ultimate-perm-guide-2026`
3. The Oct 19 night-deploy list above (month ticks), only a page crawled before Oct 19, 2 AM EDT.

### Round, Wednesday Oct 21 2026 (about 11:12 AM to 11:24 AM EDT)

Worked Tuesday's "Still to request" list, then `node scripts/gsc_queue.mjs --since 08256222` (live at 2 AM and
10:39 AM today: /opt-employers under 2 MB, the article list out of every page, frame links pre-loading on intent, the
H-1B-only employer descriptions, translated pages declaring their language), then the Oct 19 month-tick list. Google
didn't answer Quota Exceeded.

Requested (last crawl before the request):
- `/opt-employers` (Oct 15, 11:38 PM; over Googlebot's 2 MB until 2 AM today)
- `/guides/manual-vs-automated-tracking` (Aug 29, 3:50 PM)
- `/guides/ultimate-perm-guide-2026` (Oct 10, 6:06 AM)
- `/perm-case-status` (Oct 17, 2:58 AM)
- `/policy-changes` (Sep 17, 12:54 PM)
- `/seasonal-cases` (Oct 15, 11:38 PM)

Skipped:
- `/` (crawled today 1:34 AM, and daily; today's change shrank its page data and left its text alone)
- `/perm-cases` (Oct 20, 12:14 AM), `/perm-decision-activity` (today 7:35 AM), `/perm-processing-times`
  (Oct 19, 4:48 PM), `/tools` (Oct 20, 3:46 PM): each crawled after the month-tick change
- The employer, law firm and job samples and the five translated pages: today's change to them touches no text
  Google indexes (the page data, the frame links, a language attribute set in the browser); the sitemap's lastmod
  carries them.

Still to request, in order:
1. Nothing queued. After the next deploy, run `node scripts/gsc_queue.mjs --since b11de4e4`.

## Queue after the Oct 21 inspection of every main page and article (and the Oct 22 night deploy, d9d0545b)

Every URL in `sitemaps/pages.xml` (689) was put to Search Console's URL Inspection API on Oct 21 2026, 11:30 AM to
1:00 PM EDT: 538 indexed. Not indexed: 87 visa bulletin months, 48 H-1B state pages and 3 bulletin category lines
(templated families, left to the sitemap by the owner's call), and the one-off pages below. Three guides answered
the API with an error and weren't checked (`/guides/look-up-a-law-firm`, `/guides/look-up-a-perm-case-by-number`,
`/guides/look-up-an-lca-by-number`): inspect them by hand first.

Still to request, in order (after the Oct 22 2 AM deploy for the first):
1. `/guides/getting-started` (rewritten Oct 21; the welcome email's link)
2. `/tools/i140-calculator` (unknown to Google)
3. `/tools/pwd-calculator` (discovered, not indexed)
4. `/guides/track-a-prevailing-wage-request` (unknown to Google)
5. `/blog/why-perm-cases-are-denied` (discovered, not indexed)
6. `/blog/what-dol-publishes-about-perm` (discovered, not indexed)
7. `/blog/how-perm-wage-data-is-published` (unknown to Google)
8. The three guides the API couldn't read, if they turn out not indexed
9. `/perm-attorneys/browse/u` (unknown to Google)
10. `/blog/free-immigration-case-management-software` and `/perm-wages/browse/v` (crawled Oct 17 and Oct 12, not
    indexed: a request rarely changes Google's mind; last)
11. After the deploy, `node scripts/gsc_queue.mjs --since b11de4e4` for anything else the Oct 21 changes touched.

## Queue after the Oct 21 afternoon deploy (55a9c3a7, shipped by hand that afternoon)

`node scripts/gsc_queue.mjs --since 540723a8` lists 13 pages. The three guides that gained DOL's own pages lead:
they say something new. The rest changed through shared parts (the films' copy, the phone fixes): inspect, and
request only those last crawled before Oct 21.

Still to request, in order (after the "Oct 21 inspection" list above):
1. `/guides/perm-denied-what-happens-next` (DOL's FAQ on the 30 calendar days, highlighted)
2. `/guides/perm-appeal-reconsideration-balca` (DOL's FAQ on asking for both at once)
3. `/guides/perm-rfi-issued-what-to-do` (DOL's case search answering RFI ISSUED)
4. `/for-attorneys` (re-cut film, re-taken app pictures)
5. `/guides/complete-perm-filing-guide` (a re-taken figure)
6. `/about`, `/blog`, `/changelog`, `/glossary`, `/guides`, `/policy-changes`, `/tools/ead-extension`,
   `/tools/perm-timeline-calculator`: inspect only; request any crawled before Oct 21

## Queue after the Oct 22 night deploy (42d8b433, about 2 AM EDT), and Search Console's Oct 22 emails

Merged order for the round of Thursday Oct 22 2026. It comes from `node scripts/gsc_queue.mjs --since 55a9c3a7`
(47 pages: the image-led bands, the guide drawings, the breadcrumb fix) and the two Oct 21 lists above. Pages
whose words changed lead; pages that changed only through shared parts follow, and get a request only when
crawled before Oct 21.

**The Oct 22 emails, read on the report (its footer says "Last update 10/15/26"):**
- "Server error (5xx)": validation started Oct 15 and failed Oct 17, on 235 URLs crawled Oct 6 to 17 (213
  employer pages, then law firms, cities and old `?q=` searches). They were the site's own busy replies during
  the crawl bursts. Googlebot got 503s on Oct 17 to 21 (4,128, 8,829, 3,604, 9,984, 6,152 a day), and none since
  5 PM EDT Oct 21, the deploy that cut the server's CPU. A sample of 20 answers 200 now. Re-starting "Validate
  fix" is the owner's call; it isn't part of a round.
  **Restarted on the owner's yes, Thursday Oct 22 2026, 9:02 AM EDT**: "Validation started 10/22/26", 235 pending,
  0 failed.
- "Blocked due to other 4xx issue": one URL, `/perm-employers/duk-j-corporation`, crawled Oct 17. It isn't in the
  origin's logs, so Cloudflare answered at the edge; it answers 200 now.
- Googlebot's crawl fell about tenfold after the 5xx bursts (about 4,500 an hour at the peak, 100 to 350 now).
  Expect it to recover over days as the pages answer cleanly.

Still to request, in order:
1. `/guides/getting-started` (rewritten Oct 21; the welcome email's link)
2. `/tools/i140-calculator` (unknown to Google on Oct 21)
3. `/tools/pwd-calculator` (discovered, not indexed)
4. `/guides/track-a-prevailing-wage-request` (unknown to Google; gained the wage-request line drawing)
5. `/guides/perm-denied-what-happens-next` (DOL's FAQ on the 30 calendar days)
6. `/guides/perm-appeal-reconsideration-balca` (DOL's FAQ on asking for both at once)
7. `/guides/perm-rfi-issued-what-to-do` (DOL's case search answering RFI ISSUED, and the RFI drawing)
8. `/for-attorneys` (the sideways tour of the app's pages)
9. `/calculators` (each calculator shown answering)
10. `/guides/the-perm-deadlines-that-matter` (the filing-window drawing)
11. `/guides/how-the-perm-queue-works` (the queue drawing)
12. `/developers` (the keyless lookup's real answer), `/security` (the headers the site sends), `/extension`
13. `/guides/file-perm-after-prevailing-wage-expires`, `/guides/three-180-day-clocks`,
    `/guides/how-the-visa-bulletin-works`, `/guides/read-your-priority-date-history` (each gained a drawing)
14. `/about` (the federal documents around the portrait)
15. `/blog/why-perm-cases-are-denied`, `/blog/what-dol-publishes-about-perm`, `/blog/how-perm-wage-data-is-published`
16. The three guides the inspection API couldn't read (`/guides/look-up-a-law-firm`,
    `/guides/look-up-a-perm-case-by-number`, `/guides/look-up-an-lca-by-number`), if not indexed
17. `/perm-employers/duk-j-corporation` (the one 4xx), `/perm-attorneys/browse/u`
18. **Only after the Oct 23 2 AM deploy** (5f705da3, which puts every article and entry back in the paged
    lists' HTML): `/guides`, `/blog`, `/debarments`. Asked earlier, Google would read lists that link only one page.
19. Inspect only; request any crawled before Oct 21: `/`, `/tools`, `/case-search`, `/visa-bulletin`,
    `/perm-employers`, `/perm-attorneys`, `/perm-wages`, `/perm-employers/under-review`, `/open-data`, `/badges`,
    `/press`, `/methodology`, then the data pages in the list above.
20. `/blog/free-immigration-case-management-software` and `/perm-wages/browse/v` (crawled and not indexed; last)

### Round, Thursday Oct 22 2026 (about 11:13 to 11:32 AM EDT)

Worked Thursday's merged list from the top. Live at the start: 42d8b433 (the 2 AM deploy). Nothing newer is live:
the header's Sign up button and the paged lists ship at 2 AM Friday. Google answered Quota Exceeded on the 12th
request.

Requested (last crawl before the request):
- `/guides/getting-started` (Oct 20, 8:42 PM; rewritten Oct 21)
- `/tools/i140-calculator` (unknown to Google)
- `/tools/pwd-calculator` (discovered, never crawled)
- `/guides/track-a-prevailing-wage-request` (discovered, never crawled)
- `/guides/perm-rfi-issued-what-to-do` (Oct 14, 8:26 PM)
- `/guides/the-perm-deadlines-that-matter` (Oct 2, 5:45 PM)
- `/guides/how-the-perm-queue-works` (Oct 17, 3:18 AM)
- `/developers` (Oct 10, 5:46 PM)
- `/security` (Oct 2, 10:23 PM)
- `/extension` (Oct 21, 12:53 PM)
- `/guides/file-perm-after-prevailing-wage-expires` (today 12:03 AM, two hours before its drawing went live)

Skipped, each crawled after its last change went live:
- `/guides/perm-denied-what-happens-next` (today 4:43 AM)
- `/guides/perm-appeal-reconsideration-balca` (today 12:26 AM; it last changed Oct 21 afternoon)
- `/for-attorneys` (today 8:31 AM)
- `/calculators` (today 9:57 AM)

Stopped at Quota Exceeded on `/guides/three-180-day-clocks` (last crawled Oct 9, 5:26 PM; not requested).

This window is 1280 wide, so the inspector's buttons sit left of the round's usual points: the Page indexing
chevron at (1204,451) and Request indexing at (1149,363). Take a screenshot first when a click lands outside the
frame.

Still to request, in order:
1. `/guides/three-180-day-clocks` (Oct 9; gained a drawing)
2. `/guides/how-the-visa-bulletin-works`, `/guides/read-your-priority-date-history` (each gained a drawing)
3. `/about` (the federal documents around the portrait)
4. `/blog/why-perm-cases-are-denied`, `/blog/what-dol-publishes-about-perm`, `/blog/how-perm-wage-data-is-published`
5. The three guides the inspection API couldn't read (`/guides/look-up-a-law-firm`,
   `/guides/look-up-a-perm-case-by-number`, `/guides/look-up-an-lca-by-number`), if not indexed
6. `/perm-employers/duk-j-corporation` (the one 4xx), `/perm-attorneys/browse/u`
7. **Only after the Oct 23 2 AM deploy** (5f705da3): `/guides`, `/blog`, `/debarments`. Then run
   `node scripts/gsc_queue.mjs --since 42d8b433` for anything else that deploy touches (the header's Sign up
   button changes every page by two words; leave those to the sitemap).
8. Inspect only; request any crawled before Oct 21: `/`, `/tools`, `/case-search`, `/visa-bulletin`,
   `/perm-employers`, `/perm-attorneys`, `/perm-wages`, `/perm-employers/under-review`, `/open-data`, `/badges`,
   `/press`, `/methodology`
9. `/blog/free-immigration-case-management-software` and `/perm-wages/browse/v` (crawled and not indexed; last)

## Queue after the Oct 23 night deploy (about 2 AM EDT), replacing Thursday's Still-to-request list

Written Thu Oct 22, 8:20 PM EDT. That deploy carries the paged lists (5f705da3), the header's Sign up button, the
USCIS processing-times date (038915da) and the homepage rating, now 4.7 from 3 reviews in the visible line and in the
homepage's rating markup (4b267329). Everything marked "after the deploy" waits until
`ssh permtracker 'sudo permtracker-deploy status'` shows 4b267329 or later live. This list replaces the Still to
request list in Thursday's round above; work it top down.

1. `/` after the deploy: its rating markup changed, and it's the brand query's page. Request if last crawled before
   the Oct 23 deploy.
2. `/guides/three-180-day-clocks` (last crawled Oct 9; gained a drawing).
3. `/guides`, `/blog`, `/debarments` after the deploy: paged now, with every article's link still in the HTML.
4. `/guides/how-the-visa-bulletin-works`, `/guides/read-your-priority-date-history` (each gained a drawing).
5. `/about` (the federal documents around the portrait).
6. `/blog/why-perm-cases-are-denied`, `/blog/what-dol-publishes-about-perm`, `/blog/how-perm-wage-data-is-published`.
7. The three guides the inspection API couldn't read (`/guides/look-up-a-law-firm`,
   `/guides/look-up-a-perm-case-by-number`, `/guides/look-up-an-lca-by-number`), if not indexed.
8. After the deploy, only if last crawled before it: `/for-attorneys`, `/changelog`, `/uscis-processing-times`,
   `/tools/green-card-timeline` (the USCIS date line).
9. `/perm-employers/duk-j-corporation` (the one 4xx), `/perm-attorneys/browse/u`.
10. Inspect only; request any crawled before Oct 21: `/tools`, `/case-search`, `/visa-bulletin`, `/perm-employers`,
    `/perm-attorneys`, `/perm-wages`, `/perm-employers/under-review`, `/open-data`, `/badges`, `/press`, `/methodology`.
11. `/blog/free-immigration-case-management-software` and `/perm-wages/browse/v` (crawled and not indexed; last).

After this list: `node scripts/gsc_queue.mjs --since 4b267329` for anything newer.

### Round, Friday Oct 23 2026 (about 11:13 to 11:29 AM EDT)

Worked the "Queue after the Oct 23 night deploy" list from the top. Live at the start: fc078734, switched at 2:10 AM
EDT, so every "after the deploy" item was open. `gsc_queue.mjs --since 4b267329` found no public page changed since.
Google answered Quota Exceeded on the 12th request.

Requested (last crawl before the request):
- `/` (Oct 22, 9:28 PM; the rating line and its markup went live at 2:10 AM)
- `/guides/three-180-day-clocks` (Oct 9, 5:26 PM)
- `/guides` (Oct 19, 5:56 PM)
- `/blog` (Oct 20, 7:50 PM)
- `/debarments` (today 1:15 AM, an hour before the paged list went live)
- `/guides/how-the-visa-bulletin-works` (Oct 8, 3:28 PM)
- `/guides/read-your-priority-date-history` (Sep 3, 6:25 AM)
- `/blog/why-perm-cases-are-denied` (discovered, never crawled)
- `/blog/what-dol-publishes-about-perm` (unknown to Google, though the sitemap lists it)
- `/blog/how-perm-wage-data-is-published` (unknown to Google, though the sitemap lists it)
- `/for-attorneys` (Oct 22, 8:31 AM)

Skipped:
- `/about`: crawled Oct 22, 10:00 PM, after its last change went live (the Oct 22 2 AM deploy).
- `/guides/look-up-a-law-firm`, `/guides/look-up-a-perm-case-by-number`, `/guides/look-up-an-lca-by-number`: all
  three indexed.

Stopped at Quota Exceeded on `/changelog` (last crawled Oct 19, 8:20 AM; not requested).

The window was 1440 wide today: the Page indexing chevron sat at (1316,450) and Request indexing at (1258,363) on an
indexed page, (1254,363) on one Google doesn't know.

Still to request, in order:
1. `/changelog` (Oct 19)
2. `/uscis-processing-times`, `/tools/green-card-timeline`, only if last crawled before the Oct 23 2:10 AM deploy
3. `/perm-employers/duk-j-corporation` (the one 4xx), `/perm-attorneys/browse/u`
4. Inspect only; request any crawled before Oct 21: `/tools`, `/case-search`, `/visa-bulletin`, `/perm-employers`,
   `/perm-attorneys`, `/perm-wages`, `/perm-employers/under-review`, `/open-data`, `/badges`, `/press`, `/methodology`
5. `/blog/free-immigration-case-management-software` and `/perm-wages/browse/v` (crawled and not indexed; last)

After this list: `node scripts/gsc_queue.mjs --since fc078734` for anything newer.

## Queue after the Oct 25 morning deploy (2e139f96, shipped by hand that morning)

Written Sun Oct 25, 9:30 AM EDT. That deploy carries the new `/perm-by-the-numbers` page and layoff notices from 40
states and DC (it read four). Everything here waits until `ssh permtracker 'sudo permtracker-deploy status'` shows
2e139f96 or later live. Work it top down; it replaces Friday's Still to request list, which follows at the end.

1. `/perm-by-the-numbers` (new; in pages.xml).
2. `/layoffs` (40 states and DC now; request if last crawled before Oct 25).
3. `/guides/employer-layoffs-and-your-perm`, `/guides/perm-layoff-rule-for-employers`,
   `/blog/h1b-sponsors-layoff-notices-october-2026` (they name the states read; request if crawled before Oct 25).
4. `/perm-employers/under-review` (its hold dates' wording moved into a shared helper; inspect only).
5. `/perm-employers/google-llc` (sample of the employer family: layoff notices from more states can reach any
   employer page; the sitemap's lastmod carries the rest).
6. `/changelog` (Oct 19)
7. `/uscis-processing-times`, `/tools/green-card-timeline`, only if last crawled before the Oct 23 2:10 AM deploy
8. `/perm-employers/duk-j-corporation` (the one 4xx), `/perm-attorneys/browse/u`
9. Inspect only; request any crawled before Oct 21: `/tools`, `/case-search`, `/visa-bulletin`, `/perm-employers`,
   `/perm-attorneys`, `/perm-wages`, `/open-data`, `/badges`, `/press`, `/methodology`
10. `/blog/free-immigration-case-management-software` and `/perm-wages/browse/v` (crawled and not indexed; last)

After this list: `node scripts/gsc_queue.mjs --since 2e139f96` for anything newer.

### Round, Sunday Oct 25 2026 (about 11:59 AM to 12:18 PM EDT)

Live at the start: 2e139f96 (shipped by hand that morning). Everything committed since (40dfcbd4, 9f618944 and the
sorter fixes) waits for the 2 AM run, so the pages it changes were held: the layoff page and the three layoff articles
(47 states and DC now), the four articles whose figures now carry their window, the homepage and `/perm-by-the-numbers`.
No quota stop: the list ran out first.

Requested (last crawl before the request):
- `/changelog` (Oct 19, 8:20 AM)
- `/uscis-processing-times` (Oct 20, 3:24 PM)
- `/tools/green-card-timeline` (Oct 22, 10:24 AM)
- `/perm-attorneys/browse/u` (unknown to Google)
- `/visa-bulletin` (Oct 18, 3:37 PM)
- `/badges` (Sep 14, 2:08 AM)
- `/press` (Oct 11, 6:51 AM)
- `/perm-wages/browse/v` (crawled, not indexed; Oct 12, before the A to Z pages were paged on Oct 21)

Skipped:
- `/perm-by-the-numbers`: indexed, crawled today 9:37 AM, after it went live.
- `/perm-employers/under-review`: crawled Oct 24, 6:56 AM; inspect only (shared wording moved).
- `/perm-employers/duk-j-corporation`: indexed now; its error has cleared.
- `/tools`, `/case-search`, `/perm-employers`, `/perm-attorneys`, `/perm-wages`, `/open-data`, `/methodology`: each
  crawled Oct 22 or later.
- `/blog/free-immigration-case-management-software`: crawled, not indexed, Oct 17, after its last change; asking again
  changes nothing.

## Queue after the Oct 25 afternoon deploy (198d7d2d, shipped by hand at about 1:05 PM EDT)

The owner asked for the deploy at once rather than at 2 AM, so 198d7d2d went live that afternoon. Work it top down;
the afternoon round below took the first three.

1. `/layoffs` (47 states and DC; the seven new states load in the 3 AM run, so request after about 4 AM).
2. `/guides/employer-layoffs-and-your-perm`, `/guides/perm-layoff-rule-for-employers`,
   `/blog/h1b-sponsors-layoff-notices-october-2026` (they name the states read).
3. `/blog/why-perm-cases-are-denied`, `/blog/what-an-employers-perm-record-shows`,
   `/blog/how-perm-wage-data-is-published`, `/guides/read-the-denial-and-audit-rates` (figures now dated).
4. `/` (the stage links' accessible names) and `/perm-by-the-numbers` (the sorter drawn true, 44px links); inspect,
   and request only if crawled before the deploy.
5. `/perm-employers/google-llc` (sample of the employer family: layoff notices from more states).
6. `/sponsor-finder`, `/perm-employers`, `/policy-changes` (placeholders shortened; inspect only).

After this list: `node scripts/gsc_queue.mjs --since 9f618944` for anything newer.

### Round, Sunday Oct 25 2026, afternoon (about 1:20 to 1:35 PM EDT)

Live: 198d7d2d (shipped by hand at about 1:05 PM). Google answered Quota Exceeded on the 12th request of the day.

Requested (last crawl before the request):
- `/guides/employer-layoffs-and-your-perm` (Oct 17, 6:26 PM)
- `/guides/perm-layoff-rule-for-employers` (Oct 22, 2:39 PM)
- `/blog/h1b-sponsors-layoff-notices-october-2026` (Oct 17, 7:46 AM)

Stopped at Quota Exceeded on `/blog/why-perm-cases-are-denied` (last crawled Oct 23, 11:29 AM; not requested).

Still to request, in order:
1. `/blog/why-perm-cases-are-denied`, `/blog/what-an-employers-perm-record-shows`,
   `/blog/how-perm-wage-data-is-published`, `/guides/read-the-denial-and-audit-rates`
2. `/layoffs`, once the five Archive states have loaded (the warning in the morning report names any still missing)
3. `/perm-employers/google-llc`
4. Inspect only: `/`, `/perm-by-the-numbers`, `/sponsor-finder`, `/perm-employers`, `/policy-changes`

After this list: `node scripts/gsc_queue.mjs --since 198d7d2d` for anything newer.


### Round, Monday Oct 26 2026 (about 11:15 to 11:20 AM EDT)

Live: c6ffffb4 (the Oct 26 2 AM run). Google answered Quota Exceeded on the first request: yesterday's requests ran
from about noon to 1:35 PM, so today's allowance frees in that window.

Requested: none. `/blog/why-perm-cases-are-denied` (last crawled Oct 23, 11:29 AM) was refused with Quota Exceeded.

Still to request, in order:
1. `/blog/why-perm-cases-are-denied`, `/blog/what-an-employers-perm-record-shows`,
   `/blog/how-perm-wage-data-is-published`, `/guides/read-the-denial-and-audit-rates`
2. `/for-attorneys` (the hero is one picture at every width), `/privacy` (the spam filter and Cloudflare's AI named),
   `/contact` (the form carries Turnstile)
3. `/layoffs`, once the Archive states have loaded (the morning report names any still missing)
4. `/perm-employers/google-llc`
5. Inspect only, and request only if crawled before Oct 25: `/`, `/perm-by-the-numbers`, `/sponsor-finder`,
   `/perm-employers`, `/policy-changes`, `/about`, `/calculators`, `/extension`, `/perm-processing-times`, `/tools`,
   `/visa-bulletin`, `/tools/perm-timeline-calculator`, `/tools/priority-date-calculator`, `/tools/pwd-calculator`,
   `/visa-bulletin/categories/eb2-india`, `/visa-bulletin/categories/eb3-india`

After this list: `node scripts/gsc_queue.mjs --since c6ffffb4` for anything newer.

### Round, Monday Oct 26 2026, afternoon (about 1:48 to 2:07 PM EDT)

Live: c6ffffb4. Google answered Quota Exceeded on the 12th request.

Requested (last crawl before the request):
- `/blog/why-perm-cases-are-denied` (Oct 23, 11:29 AM)
- `/blog/what-an-employers-perm-record-shows` (Oct 9, 11:02 PM)
- `/blog/how-perm-wage-data-is-published` (Oct 23, 11:29 AM)
- `/guides/read-the-denial-and-audit-rates` (Sep 3, 4:15 AM)
- `/for-attorneys` (Oct 23, 11:32 AM)
- `/privacy` (Oct 25, 9:35 PM; its change went live at 2 AM Oct 26)
- `/contact` (Oct 20, 11:35 AM)
- `/` (Oct 24, 11:58 PM)
- `/perm-by-the-numbers` (Oct 25, 9:37 AM)
- `/sponsor-finder` (Oct 15, 11:38 PM)
- `/policy-changes` (Oct 21, 11:24 AM)

Skipped, crawled after their last change: `/perm-employers/google-llc` (Oct 25, 11:56 PM), `/perm-employers`
(Oct 25, 8:09 PM), `/about` (Oct 25, 7:59 PM; it changed only through the window frame shipped at 2:38 PM).

Stopped at Quota Exceeded on `/calculators` (last crawled Oct 25, 1:19 PM; not requested).

Still to request, in order:
1. `/calculators`
2. `/layoffs`, once the Archive states have loaded (the morning report names any still missing)
3. Inspect, and request only if crawled before Oct 25, 2:38 PM: `/extension`, `/perm-processing-times`, `/tools`,
   `/visa-bulletin`, `/tools/perm-timeline-calculator`, `/tools/priority-date-calculator`, `/tools/pwd-calculator`,
   `/visa-bulletin/categories/eb2-india`, `/visa-bulletin/categories/eb3-india`

After this list: `node scripts/gsc_queue.mjs --since c6ffffb4` for anything newer. Today's requests ran 1:48 to
2:07 PM, so tomorrow's allowance frees in that window: the 10:41 AM round will likely meet Quota Exceeded first.

### Round, Tuesday Oct 27 2026, late morning (about 11:27 to 11:29 AM EDT)

Live: 6cba4fd3 (the 2 AM night deploy); e18aaf4e, the policy feed's new sources, was deploying. Google answered
Quota Exceeded on the first request, as yesterday's round expected: yesterday's requests ran 1:48 to 2:07 PM.

Requested: none. `/calculators` (last crawled Oct 25, 1:19 PM, before its 2:38 PM change) met Quota Exceeded.

Still to request, in order:
1. `/calculators`
2. `/policy-changes`, once e18aaf4e is live (`ssh permtracker 'sudo permtracker-deploy status'`): new sections (comment
   counts, "From the courts and BALCA", "In Congress") and the rule pipeline folded
3. `/layoffs`, once the Archive states have loaded (the morning report names any still missing)
4. Inspect, and request only if crawled before Oct 25, 2:38 PM: `/extension`, `/perm-processing-times`, `/tools`,
   `/visa-bulletin`, `/tools/perm-timeline-calculator`, `/tools/priority-date-calculator`, `/tools/pwd-calculator`,
   `/visa-bulletin/categories/eb2-india`, `/visa-bulletin/categories/eb3-india`
5. From `node scripts/gsc_queue.mjs --since c6ffffb4` (50 pages, most of them guides and posts whose header pictures
   were re-shot, live at 2 AM Oct 27): served markup first, `/about`, `/blog`, `/changelog`, `/guides`; then the
   articles, requesting only those last crawled before Oct 27, 2 AM. A picture-only change is the lowest priority.

The allowance frees about 1:48 PM, so the 1:07 PM round will likely meet Quota Exceeded again; the 3:07 PM round
should get the full allowance.

## Queue after the Oct 28 night deploys (5aa3b1a3 at about 1:25 AM, 6193037e at about 3:00 AM EDT)

From `node scripts/gsc_queue.mjs --since 568bed7c` (45 pages and families since Oct 27). Work top down.

1. New: `/today` and `/compare`.
2. `/tools/green-card-timeline` (now the planner: every step dated, fees, the inputs in the address).
3. `/perm-queue` (the wall on any day since Aug 30) and one month, `/perm-queue/2026-01` (its day-by-day calendar).
   Never request a `/perm-queue/<month>/<day>` page: they're noindex, out of the sitemap and behind robots.txt.
4. `/calculators`, `/tools` (grouped by step), `/perm-by-the-numbers`, `/`.
5. The three guides whose pictures or links changed: `/guides/three-180-day-clocks`, `/guides/ultimate-perm-guide-2026`,
   `/guides/eb2-vs-eb3-perm`.
6. Inspect only, request if last crawled before Oct 27: the rest of the list the script prints.

After this list: `node scripts/gsc_queue.mjs --since 6193037e` for anything newer.

## Queue after the Oct 28 afternoon release (abce2f44, live 4:43 PM EDT), replacing every list above

From `node scripts/gsc_queue.mjs --since d7f3de25` (136 pages and families). Ranked by the Search Console numbers
read the same day (3 months: "perm case status" 2,754 appearances at position 10.8, "perm update" 137 at 30.5,
"perm processing time" 40 at 36.8 with /perm-processing-times at 13.9). Inspect each first; request it when Google's
copy predates 4:43 PM EDT Oct 28. Cloudflare's copies were purged by the deploy (live pages read age 0 after it).

1. `/perm-case-status`: heading now "Check your PERM case status", site name "PERM case status".
2. `/perm-case-statuses`: title "What Each PERM Status Means" (it had been taking the lookup's search).
3. `/today`: title "Today's PERM Update: Where Every Step Stands", filed-and-decided in each step.
4. `/perm-processing-times`: first sentence is DOL's live month and average.
5. `/tools/green-card-timeline`: the planner rebuilt (every step a range, the bulletin wait two ways, costs).
6. `/blog/perm-processing-times-2026`: retitled for "How Long Does PERM Take in 2026?", live figures.
7. `/guides/waiting-on-your-green-card`: the journey hub, each step's length and fee now.
8. New: `/blog/eb2-vs-eb3-by-the-numbers`, `/editorial-standards`.
9. `/visa-bulletin`, `/perm-queue`, `/perm-queue/2026-01` (new tops).
10. `/`: review quotes kept out of the snippet (data-nosnippet), Bing's snippet fix.
11. `/es`, `/zh`, `/ko`, `/vi`, `/pt-br`: every step with its length and fee.
12. `/perm-by-the-numbers`, `/pwd-cases`, `/tools/i140-calculator`, `/tools/perm-timeline-calculator`, `/calculators`.
13. New changelog entries: `/changelog/the-whole-green-card-plan`, `/changelog/layoffs-rules-and-every-step-today`,
    `/changelog/search-by-job-and-the-recruitment-record`, `/changelog/a-clearer-site-and-did-you-mean`, and
    `/changelog/corrections`.
14. Inspect only: the rest of the script's list. About 100 guides and posts changed only in their section openings
    (the answer-first pass); the sitemap's lastmod carries those, so request one only when Google's copy is older than
    Oct 20.

Never request a `/perm-queue/<month>/<day>` page (noindex). After this list: `gsc_queue.mjs --since abce2f44`.

**Requested Wed Oct 28, 4:52 to 5:17 PM EDT (11, then Quota Exceeded):** `/perm-case-status` (Google's copy from
Oct 26), `/perm-case-statuses` (Oct 27), `/today` (Oct 28 1:37 AM), `/perm-processing-times` (Oct 27),
`/tools/green-card-timeline` (Oct 27; the first live test hung over three minutes, a second went through),
`/blog/perm-processing-times-2026` (Oct 20), `/guides/waiting-on-your-green-card` (Oct 1), `/blog/eb2-vs-eb3-by-the-numbers`
and `/editorial-standards` (both unknown to Google), `/visa-bulletin` (Oct 25), `/perm-queue` (Oct 24).
Refused: `/` (crawled Oct 28, 2:49 PM, before the release). Next round, about 5 PM Thu Oct 29: `/`, then item 9's
`/perm-queue/2026-01`, then items 11 onward.
