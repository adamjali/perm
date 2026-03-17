# GitHub Audit History

## Saved Policies
- dev-deps-patch: Auto-merge Dependabot dev dependency patch/minor updates
- prod-deps-patch: Merge production patch/minor after quality gate passes
- security-overrides: Add pnpm overrides for transitive vulnerabilities when upstream hasn't patched
- known-flaky-tests: toast.test.ts, page-context.test.tsx, useToolOrchestrator.test.ts — pass in isolation, flaky in suite
- unused-deps: Remove unused dependencies rather than upgrading them (e.g. shiki)

## Audit 4 - 2026-03-17
- **health_before:** 97%
- **health_after:** 97%
- **items_fixed:** 3
- **items_discussed:** 0
- **prs_merged:** 1 (PR #46), 3 set to auto-merge (#47, #49, #50), 1 closed (#48)
- **quality_issues_fixed:** 1 (test assertions for isProfessionalOccupation gate)
- **deployed:** yes (Convex + Vercel auto-deploy on push)
- **duration:** ~10 min

### Changes Made
- Removed unused `shiki` dependency (never imported anywhere in codebase)
- Added pnpm override `flatted>=3.4.0` (high severity DoS, dev-only transitive via eslint)
- Updated 7 recruitment method validation tests to set `isProfessionalOccupation: true` (required after schema gate change)
- PR #46 merged: @typescript/native-preview nightly bump
- PRs #47, #49, #50 set to auto-merge (dev + production patch/minor updates)
- PR #48 closed: shiki 3→4 major bump — dep removed instead

### Decisions
- shiki: removed entirely — listed in package.json but never imported. Saved as policy.
- flatted CVE: pnpm override (dev-only transitive, upstream eslint hasn't updated flat-cache)
- 2 Semgrep code scanning alerts (#73, #74): pnpm-lock.yaml supply chain findings — informational, no action
- page-context.test.tsx flaky: known issue per saved policy — passes in isolation

## Audit 3 - 2026-03-13
- **health_before:** 97%
- **health_after:** 97%
- **items_fixed:** 1
- **items_discussed:** 0
- **prs_merged:** 0
- **quality_issues_fixed:** 0
- **deployed:** yes (Convex + Vercel auto-deploy on push)
- **duration:** ~5 min

### Changes Made
- Deleted dead `public/sw-push.js` (78 lines) — push handlers consolidated into `src/app/sw.ts` since commit eba7b1e

### Decisions
- 30 Semgrep code scanning findings: all informational — no action needed
- Branch protection (enforce_admins, required_signatures): deferred
- Known flaky test (page-context.test.tsx): confirmed passes in isolation — no action

## Audit 2 - 2026-03-12
- **health_before:** 90%
- **health_after:** 97%
- **items_fixed:** 4
- **items_discussed:** 1
- **prs_merged:** 1 (PR #41), 4 set to auto-merge (#39→#42, #40→#43)
- **quality_issues_fixed:** 3 (off-by-one test assertions)
- **deployed:** yes (Convex + Vercel auto-deploy on push)
- **duration:** ~20 min

### Changes Made
- PR #41 merged: @typescript/native-preview nightly bump (dev-only)
- PRs #42, #43 set to auto-merge: production deps (incl. @convex-dev/auth security fix) + dev deps
- Fixed 3 test files with job order off-by-one assertions

### Decisions
- PR #39/42 (production deps): merge — user approved, includes @convex-dev/auth security fix
- PR #40/43 (dev deps): auto-merge — dev-only patches, low risk
- Branch protection (enforce_admins, required_signatures): deferred

## Archived Summaries
- 2026-03-07: health 72→95%, fixed 8 items, merged 2 PRs, added community files
