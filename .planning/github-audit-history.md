# GitHub Audit History

## Saved Policies
<!-- Persistent rules applied automatically on future audits -->
- **@types/node**: pin to v24 — matches `engines.node: 24.x` (Vercel Node 24 runtime). Dependabot ignores major bumps.
- **Dependabot security PRs for `next`**: auto-merge after local verification (config ignores non-security next bumps)
- **lucide-react v1+ brand icons**: inline SVGs in place (Github, Twitter, Linkedin) — no external icon package
- **next/og dynamic icon route**: avoid — exceeds 1 MB Edge Function limit. Use static `src/app/icon.png` instead
- **pnpm update --latest**: do NOT run blindly — bumps TypeScript/Vite/etc to majors. Prefer `pnpm update` (respects caret) + manual major review

## Current Audit
- **started:** 2026-04-21
- **status:** IN_PROGRESS
- **checkpoint:** Phase 1 — Audit

## Audit 1 — 2026-04-11
- **health_before:** 27 vulnerabilities (10 high, 15 moderate, 2 low) + 9 stale Dependabot PRs + 1 critical CVE
- **health_after:** Clean — all actionable updates applied, PRs resolved, production deployed
- **items_fixed:** 13+ (bulk dependency updates)
- **items_discussed:** 0 (autonomous per user's delete-happy policy)
- **prs_merged:** 0 (all 9 PRs closed as superseded by manual bulk update)
- **quality_issues_fixed:** 3 (lucide brand icons, next type cache, Edge Function size)
- **deployed:** yes (commit 0eae6c6, Vercel production Ready)

### Changes Made
- **Security CVE**: next 16.1.5 → 16.2.3 (GHSA-q4gf-8mx6-v5v3, HIGH — DoS via RSC in App Router)
- **Major bumps (verified safe)**: @vercel/analytics 1→2, @vercel/speed-insights 1→2 (license changes only)
- **All production deps**: @ai-sdk/* (cerebras/google/groq/mistral/react), ai 6.0.116→6.0.158, @sentry/nextjs 10.43→10.48, react 19.2.4→19.2.5, @react-email/*, @remotion/*, posthog-js, posthog-node, react-hook-form, resend, svix, @openrouter/ai-sdk-provider
- **Dev deps**: Playwright 1.58→1.59, Storybook 10.2→10.3, eslint 9→10, jsdom 26→29, vite 7→8, vitest 4.1→4.1.4, typescript 5.9→6.0, @vitejs/plugin-react 5→6
- **lucide-react 0.577 → 1.8**: brand icons removed; inlined SVGs for Github/Twitter/Linkedin in Footer.tsx and contact/page.tsx
- **pnpm overrides for transitive CVEs**: lodash→4.18.1, brace-expansion ≥4.0.1, picomatch ≥4.0.2, dompurify ≥3.2.4, yaml ≥2.6.1
- **Rolled back**: @types/node 25.6.0 → 22.19.17 (user pins to Node 22 runtime)
- **Dynamic icon route removed**: src/app/icon.tsx → src/app/icon.png (static, 2.8KB) — was bloating Edge Function to 1.13 MB

### Decisions
- **Dependabot PRs #54-66 (9 PRs)**: closed as superseded by manual bulk update in commit 18bcfb0 — conflict risk with earlier cleanup commit + easier to verify atomically
- **TypeScript 6, Vite 8**: kept despite major bumps — typecheck + 1952 tests + prod build all passing
- **Issue template**: not added — repo is solo-maintained, community profile still 100% without it
