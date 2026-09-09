# Search Console reindex queue — rebuilt 2026-09-09, 2:15 PM ET

Rebuilt after the batch went live. The old queue (2026-09-08) is superseded:
it was written before the deploy and mixed already-indexed pages with ones
that did not exist yet.

**Quota is about 11 requests per rolling 24 hours**, counted from each
request, so it reopens at the hour it was spent rather than at midnight.
Work strictly top-down and stop when Google refuses; a refusal is the
measurement, not a failure.

**Ranking rule.** A page Google has never crawled gains far more from a
manual request than one already indexed, so every genuinely new page comes
first, ordered by how much search demand its subject actually has. Changed
pages follow. Entity templates (`/perm-employers/<slug>` and its siblings,
about 13,700 URLs) are deliberately absent: they are a crawl-budget
question, not something 11 requests a day can move.

Every URL below was checked live on 2026-09-09 before being queued: HTTP
200, no `noindex`, and a self-referencing canonical.

## Tier 1 — new pages, highest search demand first

1. [x] https://permtracker.app/tools/green-card-fees  — requested 2026-09-09
2. [x] https://permtracker.app/perm-case-statuses  — requested 2026-09-09
3. [x] https://permtracker.app/tools/h1b-six-year-limit  — requested 2026-09-09
4. [x] https://permtracker.app/glossary  — requested 2026-09-09
5. [x] https://permtracker.app/tools/rfi-deadline  — requested 2026-09-09
6. [x] https://permtracker.app/tools/pwd-validity  — requested 2026-09-09
7. [x] https://permtracker.app/tools/priority-date-retention  — requested 2026-09-09
8. [x] https://permtracker.app/tools/wage-levels  — requested 2026-09-09
9. [x] https://permtracker.app/layoffs  — requested 2026-09-09
10. [x] https://permtracker.app/visa-bulletin/family  — requested 2026-09-09
11. [x] https://permtracker.app/perm-employers/under-review  — requested 2026-09-09

## Tier 2 — new, narrower demand

12. [ ] https://permtracker.app/estimate-scorecard
13. ~~https://permtracker.app/corrections~~ — page retired 2026-09-09, folded into `/changelog#corrections` and 301'd. Never requested, so no quota was spent on it.
14. [ ] https://permtracker.app/debarments
15. [ ] https://permtracker.app/badges

## Tier 3 — already indexed, materially changed today

16. [ ] https://permtracker.app/visa-bulletin  (gained the spillover section)
17. [ ] https://permtracker.app/calculators  (five new tiles)
18. [ ] https://permtracker.app/perm-cases
19. [ ] https://permtracker.app/tools/salary-explorer
20. [ ] https://permtracker.app/policy-changes  (refused twice on Sep 8, retry)

## How a request is verified

The button on the LIVE TEST tab reverts to "REQUEST INDEXING" after a
SUCCESSFUL request, so its appearance proves nothing and re-clicking spends
another unit of the quota. Confirm on the GOOGLE INDEX tab, which reads
"Indexing requested", or by counting that phrase in the page text.

## Run log

### 2026-09-09, finished 2:37 PM EDT — 11 requested, 12th refused

All eleven Tier 1 URLs were inspected and requested one at a time, each
confirmed by the durable artefact rather than by the button: the GOOGLE
INDEX tab reading "Indexing requested / REQUEST AGAIN". Every one came back
"URL is unknown to Google" beforehand, which is the population a manual
request actually helps.

The twelfth attempt was refused: **"Quota Exceeded - Sorry, we couldn't
process this request because you've exceeded your daily quota. Please try
submitting this again tomorrow."** So today's ceiling was exactly 11, which
matches the ~11 per rolling 24 hours recorded earlier and settles it for a
second time. The refusal is the measurement; it is why the run went to the
wall instead of stopping at a guessed number.

Two things worth keeping for the next run:

- **The extension reported "disconnected mid-operation" on URL 10 for a
  click that had already landed.** The state was read rather than the click
  retried, and the page showed "Indexing requested". Retrying would have
  spent a second unit on a page that already had one.
- **A dismiss needs to be confirmed gone before the next click.** Two
  seconds was not enough once: the search-bar click hit the modal backdrop,
  the typed URL never reached the field, and the Return re-fired REQUEST
  AGAIN on the previous page. That stray request is what drew the quota
  refusal, so it cost nothing, but the rhythm should be dismiss, screenshot
  to confirm the dialog is gone, then click.

**Resume tomorrow at #12** (`/estimate-scorecard`), then the rest of Tier 2
and Tier 3. Nothing in Tier 1 needs re-requesting.
