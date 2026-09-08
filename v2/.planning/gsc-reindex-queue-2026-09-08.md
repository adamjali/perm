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
