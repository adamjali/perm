# GSC indexing priority list

**Run of 2026-09-15, 9:10 AM to 9:48 AM EDT: 11 accepted, the 12th refused.**
The cap was 11 for the third run running (Sep 5, Sep 14, Sep 15). The window
reopens at roughly **9:10 AM EDT on 2026-09-16**; do not start before then.

| # | URL | Google's verdict | enhancements | result |
|---|---|---|---|---|
| 1 | `/perm-by-state` | indexed | HTTPS, Datasets 1 valid | accepted |
| 2 | `/tools/green-card-timeline` | indexed | HTTPS | accepted |
| 3 | `/blog` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 4 | `/guides` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 5 | `/pwd-cases` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 6 | `/lca-cases` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 7 | `/perm-wages` | indexed | HTTPS, Datasets 1 valid | accepted |
| 8 | `/perm-attorneys` | indexed | HTTPS, Datasets 1 valid | accepted |
| 9 | `/perm-employers` | indexed | HTTPS, Datasets 1 valid | accepted |
| 10 | `/perm-cases` | indexed | HTTPS, Datasets 1 valid | accepted |
| 11 | `/perm-decision-activity` | indexed | HTTPS, Datasets 1 valid | accepted |
| 12 | `/visa-bulletin` | indexed | HTTPS, Breadcrumbs 1 valid | **Quota Exceeded** |

Every one of the twelve is indexed. Across the two runs, all 23 queued pages
are indexed and 22 have a fresh request in; only `/visa-bulletin` remains.

## Next run, in order

| # | URL | changed |
|---|---|---|
| 1 | `/visa-bulletin` | two table cells compressed; refused today |
| 2 | `/perm-employers/browse/a` | A-Z browse cap and per-kind note |
| 3 | `/perm-wages/browse/a` | A-Z browse cap and per-kind note |
| 4 | `/perm-attorneys/browse/a` | A-Z browse cap and per-kind note |
| 5 | `/perm-case-status` | stage-aware estimate lead, one answer |
| 6 | `/tools/perm-timeline-estimator` | queue-advance model leads, an actual day |
| 7 | `/perm-queue/2025-11` | the month DOL is adjudicating |
| 8 | `/for-attorneys` | SSR visibility fix |
| 9 | `/about` | new page, Sep 7 |
| 10 | `/changelog/corrections` | corrections log moved here |
| 11 | `/layoffs` | 176 glued cells fixed |

## Driving it on 2026-09-15: four measured facts

- **The `browser_batch` ceiling is about 50 seconds of waits, not "about two
  minutes."** A batch with 68 s of waits timed out and reported NOTHING, and so
  did a 75 s merged shape (request + poll + dismiss + next inspection). The 48 s
  shape (click, 28 s, zoom, 20 s, zoom, JS count) worked every time. When a
  batch times out, the request has usually landed: read the state (JS counts,
  a zoom) before touching anything.
- **A heavy page's live test runs past 48 s.** `/guides`, `/perm-wages`,
  `/perm-decision-activity` and `/visa-bulletin` were still "Testing" at the
  second zoom. Poll again in a fresh batch, never re-click.
- **The modal can paint a beat after the zoom.** `/perm-cases` read "no modal,
  requested 0" at 48 s and showed "Indexing requested" one call later. The
  durable reads are the innerText count and the button row flipping to
  "REQUEST AGAIN"; a single zoom is not a verdict either way.
- **The quota refusal can come AFTER the live test.** Yesterday it was
  immediate; today `/visa-bulletin` ran its live test for ~50 s and then
  answered "Quota Exceeded". So "still testing" does not mean "not refused".

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
