# GitHub Audit History

## Saved Policies
<!-- Persistent rules applied automatically on future audits -->
- **@types/node**: pin to v24 — matches `engines.node: 24.x` (Vercel Node 24 runtime). Dependabot ignores major bumps.
- **Dependabot security PRs for `next`**: auto-merge after local verification (config ignores non-security next bumps)
- **lucide-react v1+ brand icons**: inline SVGs in place (Github, Twitter, Linkedin) — no external icon package
- **next/og dynamic icon route**: avoid — exceeds 1 MB Edge Function limit. Use static `src/app/icon.png` instead
- **pnpm update --latest**: do NOT run blindly — bumps TypeScript/Vite/etc to majors. Prefer `pnpm update` (respects caret) + manual major review
- **Transitive CVE fixes**: `pnpm update` (caret) first; for stubborn transitive vulns add `pnpm.overrides` (e.g. postcss, ws, brace-expansion) then re-`pnpm audit` to confirm clean
- **Semgrep lockfile noise**: lockfiles excluded from Semgrep code rules via `.semgrepignore` (Dependabot covers lockfile CVEs) — do not re-enable code-scanning on lockfiles
- **Dependabot grouped PRs**: close as superseded after a verified bulk `pnpm update` (established across audits 1–3)
- **claude-review CI auth**: uses `CLAUDE_CODE_OAUTH_TOKEN` (Max-subscription OAuth via `claude setup-token`), not `ANTHROPIC_API_KEY`. Token expires — if the job fails auth, regenerate + re-set the secret. Workflow uses the official code-review plugin + `--model claude-opus-4-7` + `pull-requests: write` + `--comment` + bot-PR skip filter.
- **Style-object types**: define as `Pick<React.CSSProperties, …>` (not a standalone `{…}` interface) — csstype tightening in React minor bumps breaks structural assignment to a `style` prop (Audit 4: `TiltStyle` → `FeaturesGrid` TS2322 under React 19.2.7).

## Audit 4 — 2026-06-09
- **health_before:** 0 Dependabot alerts · 0 secret-scanning · CI green on `main` · branch protection healthy · community 100% (SECURITY.md present; community-profile API flag stale). 5 open Dependabot PRs — 2 grouped (#104 dev/18, #105 prod/34 incl. Convex 1.40) + #102 (tsgo), #95/#96 (Actions). #105 failing typecheck. ~26 code-scanning notes + 4 warnings (low/info). Health ≈ 95.
- **health_after:** all deps current via caret bulk `pnpm update`; `pnpm audit` clean; full gate green (4381/4381 tests); Convex 1.40 deployed; grouped PRs closed superseded. Health 100.
- **items_fixed:** 1 bulk dep update (34 prod + 18 dev) + 1 root-cause type fix (`useTilt` `TiltStyle` → `Pick<React.CSSProperties>`).
- **items_discussed:** 1 (Phase 4 deploy plan + Convex deploy → "Approve + Convex deploy").
- **prs_merged:** #108 (consolidated bulk update, squash). #104 + #105 closed as superseded. #95/#96/#102 left for Dependabot auto-merge.
- **quality_issues_fixed:** 1 (FeaturesGrid `TiltStyle` TS2322 from React 19.2.x csstype tightening).
- **deployed:** yes (commit `7b9b2a0`; Convex `giant-dragon-464` deployed — `convex` + `@convex-dev/auth` bumps affect backend; Vercel prod rebuild).
- **duration:** part of a larger session (after email-cost-control + signup-monitoring work).

### Changes Made
- **Deps (bulk, caret)**: convex 1.39.1→1.40.0, @convex-dev/auth 0.0.92→0.0.93, next 16.2.6→16.2.7, ai →6.0.198, react 19.2.6→19.2.7, vitest →4.1.8, plus radix-ui / ai-sdk / remotion / sentry patch+minor. `pnpm audit` clean.
- **Fix**: `src/lib/hooks/useTilt.ts` — `TiltStyle` interface → `Pick<React.CSSProperties, "transform" | "transition">` (React 19.2.x csstype tightening broke the `style` assignment in `FeaturesGrid`). No runtime change.

### Decisions
- **Dep strategy**: consolidated caret bulk `pnpm update` + closed grouped PRs #104/#105 superseded — consistent with the audits 1–3 policy. (Started from Dependabot #105's branch, rebased onto current `main`, then `pnpm update` to fold in the dev group.)
- **Convex deploy despite no `convex/` source change**: `convex` + `@convex-dev/auth` version bumps affect backend-compiled code → deployed to apply 0.0.93.
- **#95/#96/#102 (individual, not grouped)**: left for Dependabot auto-merge rather than superseded.

## Audit 3 — 2026-05-24
- **health_before:** 15 Dependabot alerts (6 high, 9 moderate — all transitive in `v2/pnpm-lock.yaml`) + ~26 Semgrep false-positive `unsafe-formatstring` alerts on the lockfile + 3 open Dependabot PRs + `claude-review` CI broken (missing OAuth secret + first-time workflow validation)
- **health_after:** `pnpm audit` clean (0 vulns); Semgrep lockfile noise excluded; 3 Dependabot PRs closed superseded; `claude-review` fixed + verified live; deployed
- **items_fixed:** 3 audit-scoped (bulk `pnpm update`, postcss/ws overrides, `.semgrepignore`) + related same-session CI/docs work (below)
- **items_discussed:** 2 (dep strategy → "do ALL"; Semgrep lockfile exclusion → yes)
- **prs_merged:** #92 docs (auto-merge armed); 3 Dependabot PRs (#90/#91/#77) closed as superseded. (Earlier same session: #88 PostHog outage fix, #89 claude-review — both merged.)
- **quality_issues_fixed:** 0 (typecheck/tests/build clean; `page-context` parallel-flake confirmed passes 62/62 isolated)
- **deployed:** yes (commit `bc29a16`; Vercel production rebuild; no Convex deploy — `convex/` unchanged)
- **duration:** part of a larger session

### Changes Made
- **Security (deps)**: `pnpm update` — protobufjs 7.5.5→7.6.1, fast-uri + others; `pnpm.overrides` added postcss `>=8.5.10` (XSS via unescaped `</style>`), ws `>=8.20.1` (uninitialized memory disclosure). `pnpm audit` → no known vulnerabilities.
- **Semgrep**: added `.semgrepignore` excluding `*-lock.yaml` / `package-lock.json` / `yarn.lock` + build dirs from code-pattern rules (removes 26 false-positive lockfile alerts).
- **CI (related)**: fixed `claude-review` — set `CLAUDE_CODE_OAUTH_TOKEN`, adopted official code-review plugin at full quality (checkout@v6, `pull-requests: write`, `--comment`, `--model claude-opus-4-7`, `--append-system-prompt` for perf+tests), restored bot-PR skip filter. Verified live on PR #92.
- **Docs (related)**: TD-06 (instrumentation-client outage) added to CONCERNS.md + CLAUDE.md (PR #92).

### Decisions
- **Dep strategy**: bulk `pnpm update` + overrides + close Dependabot PRs superseded — user "do ALL" (consistent with audits 1 & 2).
- **Semgrep lockfile exclusion**: user approved — kills 26 false-positive formatstring alerts; Dependabot remains the dep-CVE source.
- **No Convex deploy**: audit changes were frontend-dep + CI + docs only; `convex/` unchanged, so only the Vercel frontend rebuild was needed.

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

## Archived Summaries
- **Audit 1 — 2026-04-11**: 27 vulns (10H/15M/2L) + 1 critical CVE (next 16.1.5→16.2.3, RSC DoS) + 9 stale PRs → bulk dep update (13+), all PRs closed superseded, deployed (`0eae6c6`). One-offs: lucide brand-icon inlining, static `icon.png` (Edge size), @types/node→22 (later 24), TS 6 / Vite 8 majors kept.
