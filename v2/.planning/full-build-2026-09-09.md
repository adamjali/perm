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
- [ ] B1 employer anomaly view: employers by held, RFI'd and appealed share of pending, precomputed by the sweep, dated
- [ ] B2 employer pipeline section on employer pages: PERM, PWD, LCA counts, wage gap, pending and held share
- [ ] B3 DOL debarment list: ingest + page + flag on employer and firm pages

## C. Content and tools
- [ ] C1 status dictionary: one page per DOL status with the measured wait and the cohort link
- [ ] C2 situation guides: on hold, RFI, denied, NORD, appeal, employer layoffs, employer stopped filing
- [ ] C3 glossary page with DefinedTerm schema
- [ ] C4 calculators: H-1B max-out vs PERM 365-day rule, RFI response deadline, PWD validity, priority date retention and porting, total government fees
- [ ] C5 data notes content type + first note (the September holds, from our own record)
- [ ] C6 comparisons and checklists: PERM vs NIW, EB-2 vs EB-3, recruitment checklist, document list
- [ ] C7 prose on state and occupation pages from the record
- [ ] C8 corrections log page
- [ ] C9 estimate scorecard page from the prediction ledger

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
