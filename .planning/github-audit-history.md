# GitHub Audit History

## Saved Policies
- dev-deps-patch: Auto-merge Dependabot dev dependency patch/minor updates
- prod-deps-patch: Merge production patch/minor after quality gate passes
- security-overrides: Add pnpm overrides for transitive vulnerabilities when upstream hasn't patched

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
