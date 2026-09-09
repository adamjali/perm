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
- [ ] D1 OIG and OFLC enforcement notices in the policy feed
- [ ] D2 OEWS wage levels from the FLC Data Center: tool + levels on occupation pages
- [ ] D3 family-based cutoff history from the bulletin archive
- [ ] D4 layoffs against filings: WARN notices for the states with machine-readable data, matched to employer slugs (partial by design)
- [ ] D5 spillover arithmetic from State's Table V (needs the PDF saved by Adam once a year)

## E. Growth
- [ ] E1 embeddable badges (daily static SVG)
- [ ] E2 web push alerts for people without an account
- [ ] E3 user-reported milestones (I-140, I-485), own table, shown beside the record with counts
- [ ] E4 digest ON at a cap that keeps the worst day under Resend's free 100 (set at deploy)
- [ ] E5 auto-posts to X and LinkedIn (needs Adam's API keys; scaffold only)
- [ ] E6 translations of the situation guides (needs a reviewer; hreflang scaffold only)

## F. Close
- [ ] F1 full suite, clean build, rendered audits, Lighthouse control, phone shots
- [ ] F2 WAIT for "deploy"; then push, Convex deploy, GSC queue
