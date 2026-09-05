# GSC indexing priority list

**Written 2026-09-05. Quota is 4 requests/day on a ROLLING 24 HOURS**, not a
midnight reset: four were spent at 12:07 EDT on 2026-09-04, so the next window
opens around **12:07 EDT on 2026-09-05**. Nothing could be requested overnight.

## Read this before spending any of it

Three findings from 2026-09-04 change what these requests are worth:

1. **Google is working the queue on its own.** `perm-attorneys/alma-law-pllc`
   went from "Discovered - currently not indexed" to **indexed** in ~11 hours
   with nobody requesting it.
2. **Prominence does not predict the order.** That obscure firm indexed while
   `akin-gump-strauss-hauer-feld-llp`, a household name, did not. So the
   big-name-vs-obscure experiment is dead; do not spend quota proving it.
3. **The Pages report is batched and stale** (its footer read "Last update:
   8/27/26" while being read on 09-04). URL Inspection is live. **When they
   disagree, the live one wins.**

So the highest-value request is no longer "jump an unindexed page up the queue".
It is **"tell Google a page it already indexed has materially changed"**, because
that is the thing Google has no other fast way to learn.

## Tier 1 - request these first (4 = one day's quota)

| # | URL | why now |
|---|---|---|
| 1 | `/perm-processing-times` | The Dataset `creator` type was fixed after Search Console flagged it on 09-02. This is the one page that carried the error, and a recrawl is how the "Done fixing?" validation clears. |
| 2 | `/` | Its JSON-LD description changed tonight to name all three programs and the no-case-number path. GSC also reports homepage clicks **down 66%**, so it is the page most worth re-reading. |
| 3 | `/case-search` | The most distinctive capability on the site (one employer across PERM + PWD + LCA) and it was missing from `llms.txt` entirely until tonight. |
| 4 | `/faq` | Impressions **up 758%** per GSC. Feeding momentum on a page already climbing beats pushing one that is flat. |

## Tier 2 - the next day, if Tier 1 looks healthy

| # | URL | why |
|---|---|---|
| 5 | `/for-attorneys` | Carries the whole attorney pitch; one of the two audiences. |
| 6 | `/perm-attorneys/browse/a` | A letter page, still never crawled. These are the crawl path to ~13,600 entity pages, so one indexed letter page is worth more than one indexed entity page. |
| 7 | `/tools/salary-explorer` | Real calculator, newly added to `llms.txt`. |
| 8 | `/pwd-cases` or `/lca-cases` | Only if still not reflecting the new `PageBasics` copy. Both were requested on 09-04, so give them time first. |

## How to run it

1. `https://search.google.com/search-console`, property `sc-domain:permtracker.app`.
2. Paste the URL into the **inspect bar at the top**. Do NOT construct an inspect
   URL by hand - `/search-console/inspect?...&id=<url>` 404s; GSC uses an opaque
   id.
3. **Zoom the URL line and confirm which page is loaded before clicking
   anything.** A navigation silently failed on 09-04 and the next click would
   have re-requested the previous URL and burned a slot.
4. Click REQUEST INDEXING. It works both by element `ref` and at coordinate
   (1253-1261, 363). A live test runs first and takes a minute or two.
5. Quota exhaustion shows as a red **"Quota Exceeded"** modal. Stop there.

## Where this was left off

**2026-09-05, 01:50 EDT: nothing requested. Quota TESTED and still exhausted.**
Not inferred - `/perm-processing-times` was inspected (it is indexed) and REQUEST
INDEXING was clicked, which returned the red "Quota Exceeded" modal. A refused
request costs nothing, so testing beats reasoning about the reset time.

That also narrows the reset window: still exhausted at **01:50 EDT**, from
requests made at **12:07 EDT the previous day**. That is 13.7 hours, which rules
out any reset earlier than 01:50 and is consistent with either a rolling 24 hours
(opens ~12:07) or a midnight-Pacific reset (opens 03:00 EDT). **Try again after
03:00 EDT; if refused, it is the rolling window and noon is the time.**

Tier 1 is untouched and ready. Inspections are free and unlimited
- re-inspect before requesting, because some of these may have indexed on their
own in the meantime, which changes the request from "index this" to "recrawl
this" and is still worth doing for 1-3.

Previously requested on 2026-09-04 (all succeeded): `/pwd-cases`, `/lca-cases`,
`/case-search`, `/perm-employers/browse`. A fifth (`/perm-attorneys/browse`) hit
the quota wall.


## One thing to check on the next pass

`/perm-processing-times` still shows **Datasets: 1 valid item detected -
Non-critical issues detected** in its inspection panel. That is the `creator`
error, and it is expected: the fix deployed at ~01:00 EDT on 09-05 and Google has
not recrawled since. Requesting indexing on that URL (Tier 1 #1) is what tells it
to look. The "Done fixing?" validation in the Datasets report can then be started.
