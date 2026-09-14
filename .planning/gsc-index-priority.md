# GSC indexing priority list

**Run of 2026-09-14, 1:44 AM to 2:12 AM EDT: 11 accepted, the 12th refused.**
The cap today was 11, the same as 2026-09-05. The rolling window reopens at
roughly **1:45 AM EDT on 2026-09-15**; do not start before then.

What each inspection SAID before the request, which is the part worth keeping:

| # | URL | Google's verdict | last crawl | enhancements | result |
|---|---|---|---|---|---|
| 1 | `/perm-case-statuses` | indexed | Sep 9, 2:32 PM | HTTPS | accepted |
| 2 | `/glossary` | indexed | Sep 9, 2:33 PM | HTTPS | accepted |
| 3 | `/perm-rfi-audit` | indexed; referring page `/perm-queue/2024-07` | Sep 7, 2:15 AM | HTTPS | accepted |
| 4 | `/case-search` | indexed | not captured | HTTPS, **Breadcrumbs 1 valid** | accepted |
| 5 | `/perm-queue` | indexed | not captured | HTTPS, **Datasets 1 valid** | accepted |
| 6 | `/perm-denial-risk` | indexed | not captured | HTTPS, **Datasets 1 valid** (none on Aug 31, so it has been re-crawled since) | accepted |
| 7 | `/lca-wages` | indexed | not captured | HTTPS | accepted |
| 8 | `/badges` | indexed | not captured | HTTPS | accepted |
| 9 | `/methodology` | indexed | not captured | HTTPS, Breadcrumbs 1 valid | accepted |
| 10 | `/debarments` | indexed | not captured | HTTPS | accepted |
| 11 | `/calculators` | indexed | not captured | HTTPS | accepted |
| 12 | `/perm-by-state` | indexed | not captured | HTTPS, Datasets 1 valid | **Quota Exceeded** |

Every one of the twelve is indexed, every one carries the sitemap, and the
only referring page Google reported was on `/perm-rfi-audit`. Every accepted
request read "URL was added to a priority crawl queue".

## Next run, in order (all verified 200 / one H1 / canonical self / no noindex)

| # | URL | changed |
|---|---|---|
| 1 | `/perm-by-state` | h1->h3 fixed; refused today |
| 2 | `/tools/green-card-timeline` | duplicate heading and level skip fixed |
| 3 | `/blog` | card heading level |
| 4 | `/guides` | card heading level |
| 5 | `/pwd-cases` | Q&A layer collapsed, -29% visible |
| 6 | `/lca-cases` | Q&A layer collapsed, -27% visible |
| 7 | `/perm-wages` | Q&A layer collapsed |
| 8 | `/perm-attorneys` | Q&A layer collapsed |
| 9 | `/perm-employers` | Q&A layer collapsed |
| 10 | `/perm-cases` | Q&A layer collapsed |
| 11 | `/perm-decision-activity` | Q&A layer collapsed |
| 12 | `/visa-bulletin` | two table cells compressed |

Then the letter pages, per the leverage argument below.

## Driving it on 2026-09-14: two findings that reverse earlier notes

- **The REQUEST INDEXING button fires on a COORDINATE click at (1254, 363)
  and NOT on a `find` ref click.** Two ref clicks on #2 did nothing
  (`Indexing requested` count 0, verified by innerText before re-clicking,
  because a duplicate costs a slot); the coordinate click fired it at once.
  Earlier notes said the reverse. Read the artefact, not the note.
- **The Page-indexing chevron click at 2 to 3 s after the 15 s screenshot
  usually misses**, so last-crawl was captured on #1 to #3 only. It is not
  gating; the verdict and enhancements are on the first screen.
- What did hold: type, wait 2 s, ZOOM the bar, and only then Return; a changed
  `id=` in the tab URL proves the navigation; poll the modal at 28 s and 48 s
  with a zoom, never with `wait` alone; the wall is a red "Quota Exceeded"
  modal, and the innerText count of it is the stop signal.

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
