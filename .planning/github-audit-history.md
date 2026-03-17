# GitHub Audit History

## Saved Policies
- dev-deps-patch: Auto-merge Dependabot dev dependency patch/minor updates
- prod-deps-patch: Merge production patch/minor after quality gate passes
- security-overrides: Add pnpm overrides for transitive vulnerabilities when upstream hasn't patched
- known-flaky-tests: toast.test.ts, page-context.test.tsx, useToolOrchestrator.test.ts — pass in isolation, flaky in suite

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
- 30 Semgrep code scanning findings: all informational (console.log format strings, test RegExp, intentional dangerouslySetInnerHTML) — no action needed
- Branch protection (enforce_admins, required_signatures): deferred — consistent with prior audits
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
- Fixed 3 test files with job order off-by-one assertions (inclusive counting: posting date = day 1)
  - `cascade.test.ts`: 5 date assertions corrected
  - `useDateFieldValidation.test.ts`: boundary test + hint assertion fixed
  - `useFormCalculations.test.ts`: expected date corrected

### Decisions
- PR #39/42 (production deps): merge — user approved, includes @convex-dev/auth security fix
- PR #40/43 (dev deps): auto-merge — dev-only patches, low risk
- Branch protection (enforce_admins, required_signatures): deferred — info-only

## Audit 1 - 2026-03-07
- **health_before:** 72%
- **health_after:** 95%
- **items_fixed:** 8
- **items_discussed:** 2
- **prs_merged:** 2 (+ 1 closed after manual update)
- **quality_issues_fixed:** 0
- **deployed:** yes (Convex + Vercel)
- **duration:** ~15min

### Changes Made
- CodeQL workflow: removed non-existent `develop` branch from triggers
- Merged PR #35: 9 dev deps (Storybook 10.2.13, @types/node 22.19.13)
- Merged PR #36: @typescript/native-preview 7.0.0-dev.20260302.1
- Closed PR #37: applied 23 production dep updates manually (AI SDK, Sentry, Remotion, PostHog, Motion, etc.)
- Added pnpm overrides: minimatch >=10.2.3, rollup >=4.59.0, serialize-javascript >=7.0.3
- dompurify fixed to 3.3.2 via posthog-js update
- Added CONTRIBUTING.md
- Added CODE_OF_CONDUCT.md

### Decisions
- Production deps: merge all patch/minor — saved as policy
- Community files: add both (user chose this)
- Sentry deprecation warnings: deferred — upstream issue, not actionable until next Sentry major
