# Parity build, started Mon Sep 7 2026, 9:58 PM ET (deploy HELD until Adam says so)

Adam: "go for it all full once all done tested qa and looks good visually and no
issues, hold off on deploy". Save tokens: no agents, do it in batches, commit each.
Rules: public data only, no login/pay, no CAPTCHA defeat, polite rates, precomputed
docs not live GROUP BYs, every ingest gets fingerprint + health line + budget,
no silent failures, no crowding, internal links both ways, SEO kit per page.

## Batches (tick as committed)
- [x] 1 Rail: CTA under Overview, 40px rows, sticky only when it fits; drawer re-checked
- [x] 2 Sign-up ~52/48, wider form; About + Contact full width two-column
- [x] 3 Bulletin (Aug+Sep 2026 set-asides need a human-saved page): this-month table with deltas; EB-5 set-aside rows in ingest; EB-5 in tools
- [x] 4 LCA salary explorer (facets, percentiles from nightly docs) + compare your offer
- [x] 5 Employer (industry facet skipped: no NAICS in the tables) facets (state, active 12mo, industry/NAICS) + side-by-side compare
- [x] 6 Supply scenario on the I-485 tool (Table V and the FY limit page are unreachable by script and not archived; no issuance anchors yet)
- [x] 7 Policy-changes feed (Federal Register API, DOL/USCIS notices)
- [x] 8 I-693 guide (finder NOT built: the locator form 403s a scripted search from a residential IP)
- [x] 9 Digest built, flag OFF (`NEWSLETTER_ENABLED=1` to send, cap `NEWSLETTER_DAILY_CAP` default 30); checkbox on both alert forms, confirmed by the alert's own click; `/prefs` kind `newsletter`; Tuesday cron stores a preview the admin panel shows. Proven on dev 11:59 PM ET Sep 7: real issue built, 0 sends, bulletin moves recounted independently 5/25/0 of 30
- [x] 10 Homepage dated numbers row: `RecordStrip` under About, five figures from `perm_docs` point reads (no table counts), each with the date its own doc carries; a figure with no date is withheld; checked at 390 and 1280
- [x] 11 SEO kit: cards for the 4 new pages (+ compare page added to the sitemap, images on all four entries), llms.txt and the palette already carry them via the rail map, footer links to /visa-bulletin and /lca-wages, registration gate repaired (it had crashed on the deleted DataNav since Aug 30). NOT done: live keyword checks in GSC/Bing/Ahrefs (browser-driven, skipped to save tokens; titles follow the query shapes measured Sep 3). Lighthouse + rendered audits run in 12 on the production build
- [~] 12 Suites green by project (unit+isolated 3,160; components 2,174; convex 1,121; ssr 11); production build 2x green (5.2 and 4.3 min); rendered glued-text 0/68, page audit 0 findings after the description fixes (needs the third build to re-verify), visibility + link audits pending on a server at port 3000 (the local sitemap's host); Lighthouse pending; then WAIT for "deploy"

## Notes / measurements
