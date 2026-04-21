# GitHub Audit History

## Saved Policies
<!-- Persistent rules applied automatically on future audits -->
- **@types/node**: pin to v24 — matches `engines.node: 24.x` (Vercel Node 24 runtime). Dependabot ignores major bumps.
- **Dependabot security PRs for `next`**: auto-merge after local verification (config ignores non-security next bumps)
- **lucide-react v1+ brand icons**: inline SVGs in place (Github, Twitter, Linkedin) — no external icon package
- **next/og dynamic icon route**: avoid — exceeds 1 MB Edge Function limit. Use static `src/app/icon.png` instead
- **pnpm update --latest**: do NOT run blindly — bumps TypeScript/Vite/etc to majors. Prefer `pnpm update` (respects caret) + manual major review

## Audit 2 — 2026-04-21
- **health_before:** 2 Dependabot alerts (1 critical protobufjs RCE, 1 medium dompurify) + 4 code-scanning alerts + 5 open Dependabot PRs + 3 Sentry build deprecations + Next.js middleware→proxy deprecation
- **health_after:** Clean — CVEs patched, build emits zero warnings, all 5 PRs resolved, production deployed
- **items_fixed:** 7 (bulk deps, sentry config migration, sentry.client.config.ts deletion, middleware→proxy rename, @types/node policy update, docs/SECURITY.md reference)
- **items_discussed:** 2 (merge strategy, middleware→proxy rename)
- **prs_merged:** 0 (all 5 PRs closed as superseded by commit 2db97e0)
- **quality_issues_fixed:** 3 Sentry deprecations + 1 Next.js deprecation
- **deployed:** yes (commit 2db97e0, Convex giant-dragon-464 deployed, Vercel production Ready 4m)
- **duration:** ~50 min

### Changes Made
- **Security**: protobufjs 7.5.4→7.5.5 (CVE-2026-41242 critical, RCE via type field injection); dompurify 3.3.3→3.4.1 (FORBID_TAGS bypass + prototype pollution fixes)
- **Production deps (patch/minor)**: @ai-sdk/google 3.0.62→64, @ai-sdk/react 3.0.160→170, @auth/core 0.41.1→2, @openrouter/ai-sdk-provider 2.5.1→2.8.0, @react-email/render 2.0.6→7, @remotion/* 4.0.448→450, @sentry/nextjs 10.48→10.49, ai 6.0.158→168, gsap 3.14.2→3.15.0, next 16.2.3→16.2.4, posthog-js 1.367→1.369.5, posthog-node 5.29.2→4, react-hook-form 7.72.1→7.73.1, resend 6.10→6.12.2, svix 1.90→1.91.1
- **Dev deps (patch)**: @axe-core/react 4.11.1→2, @chromatic-com/storybook 5.1.1→2, @next/bundle-analyzer 16.2.3→4, @tailwindcss/postcss 4.2.2→4, axe-core 4.11.2→3, convex-test 0.0.47→49, eslint 10.2.0→1, eslint-config-next 16.2.3→4, happy-dom 20.8.9→20.9.0, tailwindcss 4.2.2→4, typescript 6.0.2→3, vite 8.0.8→9, vitest 4.1.4→5, @vitest/* 4.1.4→5
- **Sentry deprecation fix**: `disableLogger: true` → `webpack.treeshake.removeDebugLogging: true`; `automaticVercelMonitors: true` → `webpack.automaticVercelMonitors: true` (next.config.ts)
- **Sentry file cleanup**: deleted empty `sentry.client.config.ts` (client Sentry is lazy-loaded via `SentryClientInit` component; empty file was triggering rename-to-instrumentation-client.ts deprecation)
- **Next.js 16 migration**: renamed `src/middleware.ts` → `src/proxy.ts` (middleware file convention deprecated — API-compatible, Convex Auth middleware unchanged, build tag now shows "ƒ Proxy (Middleware)")
- **Docs**: updated `docs/SECURITY.md` middleware → proxy reference
- **Policy fix**: @types/node policy v22 → v24 (stale; package.json uses `engines.node: 24.x` and `@types/node: ^24.12.2`)

### Decisions
- **Merge strategy**: Bulk `pnpm update` + close PRs as superseded (same as Audit 1) — user chose "your rec, want all". Avoids rebase-chain across 5 PRs, atomic verification, matches caret ranges Dependabot would have produced.
- **middleware → proxy rename**: Discussed — user chose "Rename and verify". Zero-warning build confirms API compatibility; Convex Auth `convexAuthNextjsMiddleware` works unchanged in proxy.ts.
- **sentry.client.config.ts deletion**: Safer than renaming content to instrumentation-client.ts (which contains PostHog init). Matches intentional lazy-load pattern already documented.
- **pnpm overrides**: Kept existing overrides (lodash, brace-expansion, picomatch, dompurify, yaml) — they resolve transitive deps and remain active.

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
