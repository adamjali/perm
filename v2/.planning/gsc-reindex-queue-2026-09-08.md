# GSC reindex queue, deploy of Sep 8 2026 (1:43 AM ET)

Status: **2 of 11 submitted** (8:05 and 8:07 AM ET Sep 8). At 2:05 AM the
first request answered "Quota Exceeded"; at 8:05 AM two went through, then
`/policy-changes` (twice) and `/visa-bulletin` answered "Oops! Something went
wrong. We had a problem submitting your indexing request" after the live
test, which is how GSC refuses once the rolling quota is spent again. The quota is a rolling 24 hours from when it was
spent, so it reopens around the hour of the last requests made on Sep 7.
Work the list top-down; tick each line with the time. GSC showed
`/lca-wages` as "URL is unknown to Google" (never crawled), which is the
state every new page starts in.

Priority order (new pages first, then the pages whose copy changed):

1. [x] https://permtracker.app/lca-wages (8:05 AM ET, "Indexing requested")
2. [x] https://permtracker.app/tools/compare-my-offer (8:07 AM ET, "Indexing requested")
3. [ ] https://permtracker.app/policy-changes (refused twice at 8:10 AM ET, retry first)
4. [ ] https://permtracker.app/visa-bulletin (refused at 8:13 AM ET)
5. [ ] https://permtracker.app/visa-bulletin/2026-09
6. [ ] https://permtracker.app/guides/i693-medical-exam
7. [ ] https://permtracker.app/perm-employers/compare
8. [ ] https://permtracker.app/
9. [ ] https://permtracker.app/about
10. [ ] https://permtracker.app/perm-processing-times
11. [ ] https://permtracker.app/perm-employers

Second day, if the quota allows: /visa-bulletin/2026-08, /pwd-cases,
/lca-cases (their descriptions and cards changed), /for-attorneys.

IndexNow already told Bing about all of these on the deploy (the workflow
ran green at 1:44 AM ET).

## Added Sep 9 2026 (the full build), in priority order, after the nine above

Request top-down, ~11 a day. Each is a new URL; none is indexed yet.

12. https://permtracker.app/tools/wage-levels
13. https://permtracker.app/perm-case-statuses
14. https://permtracker.app/guides/perm-rfi-issued-what-to-do
15. https://permtracker.app/guides/perm-denied-what-happens-next
16. https://permtracker.app/guides/employer-layoffs-and-your-perm
17. https://permtracker.app/tools/green-card-fees
18. https://permtracker.app/tools/h1b-six-year-limit
19. https://permtracker.app/guides/perm-vs-niw
20. https://permtracker.app/guides/eb2-vs-eb3-perm
21. https://permtracker.app/visa-bulletin/family
22. https://permtracker.app/tools/priority-date-retention
23. https://permtracker.app/tools/rfi-deadline
24. https://permtracker.app/tools/pwd-validity
25. https://permtracker.app/glossary
26. https://permtracker.app/guides/perm-appeal-reconsideration-balca
27. https://permtracker.app/guides/perm-nord-issued-meaning
28. https://permtracker.app/guides/employer-stopped-filing-perms
29. https://permtracker.app/guides/perm-document-checklist
30. https://permtracker.app/layoffs
31. https://permtracker.app/blog/data-note-application-on-hold-september-2026
32. https://permtracker.app/estimate-scorecard
33. https://permtracker.app/corrections
34. https://permtracker.app/badges
35. https://permtracker.app/visa-bulletin  (the spillover section, Sep 9)
36. https://permtracker.app/visa-bulletin/family  (family charts through September 2026, Sep 9)
37. https://permtracker.app/layoffs  (four states, Sep 9)
38. https://permtracker.app/tools/green-card-fees  (fixed labels and heading, Sep 9)
