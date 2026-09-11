# Search Console reindex queue — rebuilt 2026-09-11, 5:30 AM ET

Rebuilt after the 10-commit batch went live on 2026-09-10 evening (Convex
deployed, Vercel Ready, `pnpm audit:pages` 0 findings across 50 templates).
Supersedes `gsc-reindex-queue-2026-09-09.md`, whose 11 requested items are
recorded below so quota is not spent asking twice.

**Quota is about 11 requests per rolling 24 hours**, counted from each
request, so it reopens at the hour it was spent rather than at midnight. Work
strictly top-down and stop when Google refuses; a refusal is the measurement,
not a failure.

**Ranking rule, and it changed this round.** The old rule was "new pages
first". The sharper question is what Google is currently serving WRONG, and
this batch has a measured instance of that: on 2026-09-10 the SERP for the
brand query printed `/guides/getting-started`'s pre-audit description — "from
creating your first case to mastering deadlines... and the AI assistant" —
from MDX frontmatter whose body had already been corrected in September. A
page whose live snippet is demonstrably wrong outranks a page that is merely
new, because the wrong one is costing something today.

Second rule: a page requested within the last 48 hours is DEMOTED, not
repeated. Six of the description fixes below were requested on 09-09, before
their descriptions changed, so a re-request is defensible but worth less than
a page Google has never been asked about. They sit in Tier 5.

**Verified live 2026-09-11 before queueing**: all 20 return HTTP 200, carry no
`noindex`, and have a self-referencing canonical. Entity templates
(~78,600 URLs) are deliberately absent — that is a crawl-budget question, and
19,931 of them already sit in "Discovered, currently not indexed". Eleven
requests a day cannot move it.

## Tier 1 — Google is serving demonstrably wrong copy

1. [x] https://permtracker.app/guides/getting-started  — requested 2026-09-11  — the SERP defect; frontmatter description + seoDescription rewritten

## Tier 2 — genuinely new, never crawled

2. [x] https://permtracker.app/changelog/corrections  — requested 2026-09-11  — new page 2026-09-10, the corrections log as one changelog entry

## Tier 3 — changed in this batch, never requested

3. [x] https://permtracker.app/tools/perm-timeline-calculator  — requested 2026-09-11  — rebuilt: one headline answer, models behind a disclosure, optional employer-initial input, day-level anchor
4. [x] https://permtracker.app/badges  — requested 2026-09-11  — description was 251 chars (SERP-truncated), now 146
5. [x] https://permtracker.app/tools/compare-my-offer  — requested 2026-09-11  — description 174 -> 152
6. [x] https://permtracker.app/terms  — requested 2026-09-11  — description rewritten; §4 bulk-extraction and §6 two-layer data licence
7. [x] https://permtracker.app/debarments  — requested 2026-09-11  — three-state fix: a bar that has not started no longer reads "(ended)"
8. [x] https://permtracker.app/changelog  — requested 2026-09-11  — corrections folded in as one entry; `/corrections` now 308s here

## Tier 4 — carried from the 09-09 queue, never requested

9.  [x] https://permtracker.app/estimate-scorecard  — requested 2026-09-11
10. [x] https://permtracker.app/calculators  — requested 2026-09-11  (five new tiles)
11. [~] https://permtracker.app/perm-cases  — REFUSED 2026-09-11, quota exceeded. First in line tomorrow.
12. [ ] https://permtracker.app/tools/salary-explorer
13. [ ] https://permtracker.app/visa-bulletin  (gained the spillover section)
14. [ ] https://permtracker.app/policy-changes  (refused twice on Sep 8 — retry only if quota is plentiful)

## Tier 5 — requested 2026-09-09, description changed AFTER

Only if quota remains. Google may already hold a recrawl for these; the
change since is a shorter meta description, which is real but small.

15. [ ] https://permtracker.app/tools/green-card-fees  (193 -> 153)
16. [ ] https://permtracker.app/tools/wage-levels  (171 -> 152)
17. [ ] https://permtracker.app/tools/pwd-validity  (176 -> 151)
18. [ ] https://permtracker.app/tools/rfi-deadline  (170 -> 147)
19. [ ] https://permtracker.app/tools/priority-date-retention  (181 -> 149)
20. [ ] https://permtracker.app/visa-bulletin/family  (220 -> 153)

## Already requested 2026-09-09 — do not repeat

/tools/green-card-fees · /perm-case-statuses · /tools/h1b-six-year-limit ·
/glossary · /tools/rfi-deadline · /tools/pwd-validity ·
/tools/priority-date-retention · /tools/wage-levels · /layoffs ·
/visa-bulletin/family · /perm-employers/under-review

## Driving the inspector — what this cost to learn

- **The first search-bar click after a page load never registers.** Click,
  screenshot, then click again.
- **`type` immediately followed by `Return` silently loses the text.** Leave
  about 2 seconds between them.
- **Verify by a durable artefact, never the control's appearance.** On the
  LIVE TEST tab the button reverts to "REQUEST INDEXING" after a SUCCESSFUL
  request; only the GOOGLE INDEX tab shows "Indexing requested", and the
  confirmation toast fades before a screenshot usually catches it. Reading the
  button once cost a unit of an 11/day quota.
  `(document.body.innerText.match(/Indexing requested/g)||[]).length`
- **`browser_batch` is the difference between 130 calls and 18.** One batch
  per URL: Dismiss, screenshot, click the field, type, Return, wait 18, click
  the chevron, screenshot. The screenshot after Dismiss is mandatory — it
  forces the paint the automation tab otherwise never does.
- **A batch longer than about two minutes times out as a whole and reports
  nothing.** The shape above is near the ceiling.
- **GSC's deep link `inspect?id=<url>` 404s.** Use the search bar.


## Run log — 2026-09-11, 5:30 to 6:20 AM ET

**10 requests landed, the 11th was refused.** Every one verified by the durable
artefact ("URL was added to a priority crawl queue" plus a non-zero
`Indexing requested` count), never by the button, which reverts to REQUEST
INDEXING after a successful request on this tab.

| # | URL | state before | result |
|---|---|---|---|
| 1 | /guides/getting-started | indexed, stale description | requested |
| 2 | /changelog/corrections | **unknown to Google**, never crawled | requested |
| 3 | /tools/perm-timeline-calculator | indexed | requested |
| 4 | /badges | indexed | requested (second attempt, see below) |
| 5 | /tools/compare-my-offer | indexed | requested |
| 6 | /terms | indexed | requested |
| 7 | /debarments | indexed | requested |
| 8 | /changelog | indexed | requested |
| 9 | /estimate-scorecard | indexed | requested |
| 10 | /calculators | indexed | requested |
| 11 | /perm-cases | indexed | **Quota Exceeded** |

**The quota was 10 today, not 11.** It is a rolling 24 hours from each request,
so the first slots reopen around 5:30 AM ET tomorrow. `/perm-cases` is first in
line, then Tier 4 and Tier 5.

**A batch that times out can leave a request UNSENT while reporting nothing.**
Combining two URLs into one batch exceeded the ~2 minute ceiling; the tool
returned an error, and most of the actions had in fact executed. Re-inspecting
`/badges` showed REQUEST INDEXING rather than REQUEST AGAIN, so that request had
never landed and was re-sent. **After any batch error, re-inspect and read the
button before moving on** - assuming it went through would have silently lost
it. One URL per batch pair is the safe shape.

**Two things worth noting from the inspections themselves:**
- `/changelog/corrections` reported "No referring sitemaps detected" and
  "Last crawl N/A" - expected for a page added the day before, and exactly the
  case where a manual request is worth most.
- `/perm-cases` reported **"Datasets - 1 valid item detected"**, which confirms
  the `license` field added on 2026-09-10 parses cleanly. That was the Search
  Console warning that started the licensing work.
