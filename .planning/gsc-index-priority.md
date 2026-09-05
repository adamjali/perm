# GSC indexing priority list

**Run completed 2026-09-05, 19:05-19:40 EDT. 11 requests submitted, 12th
refused.** See "What was submitted" below. Next window opens ~19:40 EDT on
2026-09-06 (rolling 24h from these requests).

## The quota is ~11/day, not 4

Corrected by running it to exhaustion. On 09-04 the run stopped after 4 and that
was recorded as the cap; it was not - the quota was simply already part-spent
that day. **A refused request costs nothing, so the way to learn the cap is to
keep going until it refuses**, not to infer it from where a previous run stopped.

The window is a **rolling 24 hours from the requests themselves**, settled by two
refused tests at 01:50 and 05:50 on 09-05 following requests at 12:07 on 09-04
(the second is past 03:00 EDT, which rules out a midnight-Pacific reset).

## What was submitted, 2026-09-05

| # | URL | state when requested |
|---|---|---|
| 1 | `/perm-processing-times` | indexed - recrawl for the Dataset `creator` fix |
| 2 | `/` | indexed - recrawl for the new JSON-LD description |
| 3 | `/case-search` | **indexed** (was NOT on 09-04; the 09-04 request worked) |
| 4 | `/faq` | indexed - impressions up 758% |
| 5 | `/perm-attorneys/browse/a` | **unknown to Google** (was "discovered" on 09-04 - went backwards) |
| 6 | `/for-attorneys` | indexed |
| 7 | `/tools/salary-explorer` | not indexed |
| 8 | `/pwd-cases` | indexed - recrawl for the new PageBasics copy |
| 9 | `/lca-cases` | indexed - recrawl for the new PageBasics copy |
| 10 | `/tools/i140-trends` | not indexed |
| 11 | `/tools/i485-queue-position` | indexed |
| 12 | `/perm-employers/browse/a` | **QUOTA EXCEEDED - not submitted** |

## Next run, in priority order

1. `/perm-employers/browse/a` - the one that hit the wall
2. `/perm-wages/browse/a`
3. More letter pages (`/b`, `/c`, ...). **These are the highest structural
   value**: each letter page links ~151 entity pages, so one indexed letter page
   exposes far more than one indexed entity page. And they are moving the WRONG
   way - `/perm-attorneys/browse/a` went from "discovered" to "unknown" in a day.
4. `/methodology`, `/perm-denial-risk`, `/perm-decision-activity` if letters run out.

## How to run it

1. `https://search.google.com/search-console`, property `sc-domain:permtracker.app`.
2. Paste into the **inspect bar at the top**. Do NOT construct an inspect URL -
   `/search-console/inspect?...&id=<url>` 404s; GSC uses an opaque id.
3. **The first click on the search bar after a page load does not register.**
   Click, type, and if the URL line does not change, do the whole thing again.
4. **Zoom the URL line and confirm the right page is loaded before clicking
   REQUEST INDEXING.** A silent navigation failure would otherwise re-request the
   previous URL and burn a slot.
5. REQUEST INDEXING sits at ~(1253-1261, 363). A live test runs first, 30-60s.
6. Stop at the red **"Quota Exceeded"** modal.

## Still open

`/perm-processing-times` showed **Datasets: 1 valid item - Non-critical issues
detected** at request time. That is the `creator` error and it is expected: the
fix went live ~01:00 on 09-05 and Google had not recrawled. Request #1 above is
what tells it to look. Once it recrawls, start the "Done fixing?" validation in
the Datasets report.
