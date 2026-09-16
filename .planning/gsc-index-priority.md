# GSC indexing priority list

**Run of 2026-09-16, 11:55 AM to 12:38 PM EDT: 11 accepted, the 12th refused.** The
cap was 11 for the FOURTH run running (Sep 5, 14, 15, 16); treat it as the number.
Window reopens about **11:55 AM EDT on 2026-09-17**. Order today: `/` and `/faq` first, because the homepage was
rebuilt for the brand query the night before, then the Sep 15 leftovers.

| # | URL | Google's verdict | enhancements | result |
|---|---|---|---|---|
| 1 | `/` | indexed | HTTPS, Review snippets 1 valid | accepted |
| 2 | `/faq` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 3 | `/visa-bulletin` | indexed | HTTPS, Breadcrumbs 1 valid | accepted (refused yesterday) |
| 4 | `/perm-employers/browse/a` | indexed | HTTPS | accepted |
| 5 | `/perm-wages/browse/a` | indexed | HTTPS | accepted |
| 6 | `/perm-attorneys/browse/a` | indexed | HTTPS | accepted |
| 7 | `/perm-case-status` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 8 | `/tools/perm-timeline-calculator` | indexed | HTTPS | accepted |
| 9 | `/perm-queue/2025-11` | **unknown to Google**, no referring sitemap, no referring page | none | accepted |
| 10 | `/for-attorneys` | indexed | HTTPS (video: none indexed) | accepted (modal painted late; read by count) |
| 11 | `/about` | indexed | HTTPS, Breadcrumbs 1 valid | accepted |
| 12 | `/changelog/corrections` | indexed | HTTPS, Breadcrumbs 1 valid | **Quota Exceeded** after a ~70 s live test |

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
