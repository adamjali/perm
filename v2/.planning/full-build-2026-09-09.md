# Full build, started Mon Sep 8 2026, 7:49 PM ET

Adam: "go for it all, hold deploy till done and qa'd." Everything free or inside
Vercel Pro's $20. Physics items stay out; the single risk score stays out;
forecasts only with a printed scorecard; crowdsourced only as labeled user
reports beside the record. Privacy floor on tiny stages removed by Adam.

Each batch: tests, both typecheckers, lint, visual check where it renders,
one commit, tick here. DEPLOY HELD until the whole list is ticked or marked
left off.

## A. Full lists and the stage filter
- [x] A1 `/api/stage-cases` (stage or month, JSON + CSV, allowlist, 6h edge cache) + tests
- [x] A2 stage pages: client browser (search, sort, filing-year facet, show all, CSV), compact static case-number list for the index, the two tiny stages listed, link into search prefilled
- [x] A3 queue-month pages: server-paged browser with search and sort over /api/perm-cases
- [x] A4 case search: `stage` filter, enable/disable follows the selection, live band answers, EXPLAIN + combinability tests
- [x] A5 PWD and LCA stage filters in case search (their live tables' own stage and employer indexes; a stage carries its program)

## B. Employer views
- [x] B1 employer anomaly view (`/perm-employers/under-review`, doc `employer_stages` written by the sweep, 1,000 employers, two rankings with a share floor of 25): employers by held, RFI'd and appealed share of pending, precomputed by the sweep, dated
- [x] B2 employer pipeline section (joined on the entity's merge key: the three files spell one employer three ways) on employer pages: PERM, PWD, LCA counts, wage gap, pending and held share
- [x] B3 DOL debarment list (OFLC PDF parsed with pdfplumber on the GitHub runner; WHD H-1B page; `/debarments`; notices on employer and firm pages; OFLC half seeded from the laptop, H-1B rows arrive with the first runner pass): ingest + page + flag on employer and firm pages

## C. Content and tools
- [x] C1 status dictionary: `/perm-case-statuses`, one hub with an anchor per DOL status (PERM from the case page's own meanings; 11 PWD and 5 LCA words new), the regulation or an admission, today's count, link from the case page's explainer (22f1c8f2)
- [x] C2 situation guides: RFI, denied, NORD, appeal ladder, layoffs, sponsor stopped filing (on hold already existed); one measured figure each, cards rendered, audit green (c54e794b)
- [x] C3 glossary: `/glossary`, 54 terms with cites and see-also links, DefinedTermSet, letter strip
- [x] C4 calculators: rfi-deadline, pwd-validity, h1b-six-year-limit, priority-date-retention, green-card-fees (G-1055 05/29/26); canonical logic + 16 tests; five tiles on /calculators (95d7c611)
- [x] C5 data notes: a blog post tagged `data-note`; first note on the 1,854 holds (1,831 Cognizant, filed Dec 17 2025 to Feb 13 2026; one case left hold in 14 days of observation), figures read from the event log and the live index Sep 8
- [x] C6 comparisons and checklists: PERM vs NIW, EB-2 vs EB-3, document checklist by stage (the recruitment checklist already existed); cards rendered; audit green
- [x] C7 prose on state and occupation pages: verified already present from the Sep 4 duplication work (every occupation page leads with its own figures, wage and days against the field, top state and employer; the state index prints each state's leaders and concentration with measured prose). Nothing further added; the duplication measure is chrome-excluded 5-grams against a built site
- [x] C8 corrections log: `/corrections`, 14 dated entries (what it said, what was true, what changed) from Aug 23 to Sep 7, never removed; linked from the rail's Reference group
- [x] C9 estimate scorecard: `/estimate-scorecard`, structured ledger + live status and first final-status transition from the event log; scores itself when DOL decides (1fa7e348)

## D. Data sources
- [x] D1 OFLC announcements in the policy feed: `scripts/ingest_oflc_news.py` parses OFLC's announcements page (31 notices of 2026, seeded from a browser capture on Sep 8; runs daily on the runner beside the debarment lists, since www.dol.gov refuses the laptop) into `policy_notices` as type 'OFLC announcement' with topic tags. DOL OIG left out: its site is a search page with no parseable report list and its foreign-labor audits are rare PDFs; noted in the script's docstring
- [x] D2 OEWS wage levels: the FLC Data Center redirects to flag.dol.gov's wage search, whose `/recaptcha/wageSearch` answers scripts (same open pattern as case status; 0.3 s). `/tools/wage-levels` + `/api/wage-levels` and `/api/wage-areas` (validated, 8 s timeout, cached a day / a week at the CDN), `WageLevelsTool` (state, DOL's areas, SOC, series), every occupation page links it with its SOC prefilled. 10 tests; verified in the browser (15-1252, Bakersfield, 2026 series: Level I $94,245 to Level IV $173,202)
- [ ] D3 family-based cutoff history from the bulletin archive
- [x] D4 WARN notices: `scripts/ingest_warn.py` reads California's EDD spreadsheet (192 notices Jun 26 to Sep 2 2026; 31 matched to a PERM sponsor by exact merge key), daily on the runner; `warn_notices` table, `/layoffs` page, a band on matched employer pages. Partial by design: Texas (challenge page), Washington (search form) and New York (HTML list) are not read and the page says so
- [ ] D5 spillover arithmetic from State's Table V (needs the PDF saved by Adam once a year)

## E. Growth
- [x] E1 badges: `/badge/<perm-queue|perm-days|pwd-queue>.svg`, static route regenerated daily from DOL's processing-times snapshot (no estimates; a missing figure renders 'no figure today'); `/badges` page with markdown and HTML snippets. AT DEPLOY: add a Firewall bypass for `/badge/*` so GitHub's camo proxy and other server-side fetchers are not challenged
- [x] E2 web push for people without an account: `caseStatusPushAlerts` (one browser, one case; ten cases per browser; 5/hour per address; 200/day global charged before the write), `/case-alert/push` and `/case-alert/push/stop` on Convex HTTP, `casePushAlertsSweep.sweep` (Node runtime, web-push, seeds silently, closes on 404/410 or a final status) at 11:20 and 23:20 UTC; `CasePushAlert` control under the email form. 6 convex tests. Probed on the dev deployment: subscribe 200, bad shape 400, stop closed 1. NEEDS `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in prod Convex env (already present for account push) and the SW, which serwist registers in production only
- [x] E3 user-reported milestones: `caseMilestones` table, `/milestone/report` (internal mutation, per-IP 6/hour, global 300/day charged before the write, one row per case+reporter+kind) and `/milestone/summary` on Convex HTTP; `CaseMilestones` section on every PERM case page, labelled unverified; 5 convex tests incl. the budget refusing at exactly 300
- [x] E4 digest ON at deploy: set on prod Convex `NEWSLETTER_ENABLED=1` and `NEWSLETTER_DAILY_CAP=15` (ledger in convex/caseAlerts.ts: 70 worst-case list mail + 15 = 85 of Resend's 100). Not set until the deploy step, per the hold
- [x] E5 auto-posts: scaffold only. `scripts/social_post.py` composes an X post (under 280) and a LinkedIn post from the processing-times snapshot and the newest two bulletins (queue month, average days, EB-2/EB-3 India and China cutoffs, cutoffs moved), prints by default, posts only with Adam's keys (X OAuth 1.0a user context, LinkedIn member token); `social-post.yml` is dispatch-only with no schedule. Base string tested against RFC 5849's worked example; the HTTP calls are untested until keys exist
- [x] E6 translations: scaffold only, `src/lib/i18n.ts` (LOCALES with one entry; `languageAlternates` returns nothing until a second locale exists; the test refuses a locale with no route directory). No machine translation of legal deadlines, by design; a reviewer's name goes in the frontmatter when one exists

## F. Close
- [ ] F1 full suite, clean build, rendered audits, Lighthouse control, phone shots
- [ ] F2 WAIT for "deploy"; then push, Convex deploy, GSC queue
