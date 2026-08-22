# GitHub Audit History

## Saved Policies
<!-- Persistent rules applied automatically on future audits -->
- **sharp — track the CVE floor, never pin to Next's copy**: sharp is NOT a peerDependency of next (next declares only sass, react, react-dom, @playwright/test, @opentelemetry/api, babel-plugin-react-compiler). Duplicate libvips comes from two *installed copies*, which a `pnpm.overrides.sharp` entry collapses. Audit 6: sharp was pinned to ^0.34.5 "to match Next's peer" while 0.34.5 carried a HIGH CVE (GHSA-f88m-g3jw-g9cj), and the Dependabot bump was wrongly waved off. Always check the advisory before declining a bump on peer-compatibility grounds.
- **SECURITY.md false positive**: the community-profile API returns `files.security: null` for this repo even though SECURITY.md exists at the root, is committed, and health_percentage is 100. Do not score -5 or propose creating one on the strength of that field; check `contents/SECURITY.md` instead.
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
- **js-yaml DoS (GHSA-h67p-54hq-rp68)**: ACCEPTED / leave-open (Audit 5). Transitive via `gray-matter@4.0.3` (latest, unmaintained) which calls `js-yaml.safeLoad`/`safeDump` — **removed in 4.x**, so forcing the patch (`>=4.2.0`) breaks all MDX frontmatter parsing. No exploit path: gray-matter only parses **repo-authored** MDX frontmatter, never untrusted input. Do NOT add a `js-yaml` override. If ever fixing for real: pass a custom js-yaml-4 engine to gray-matter via `content/index.ts`, then override. Otherwise expect 1 moderate `pnpm audit`/Dependabot entry to persist.
- **dompurify CVE refresh**: when a new dompurify advisory lands, bump the existing `pnpm.overrides.dompurify` floor to the patched version (Audit 5: `>=3.3.2` → `>=3.4.11`; Audit 7: `>=3.4.12` → `>=3.4.13` for the IN_PLACE detached-subtree XSS, which made the previous floor exactly one patch short). It's transitive-only; the override is the canonical pin.
- **Override floors must cap the major**: a bare `">=x.y.z"` in `pnpm.overrides` accepts *anything* above it, including majors. Audit 7: `nanoid: ">=3.3.18"` (a patch-level advisory fix) resolved to **6.0.1**, three majors up and ESM-only, while the only consumer is `postcss@8.5.25` asking for `^3.3.11`. Correct form is `">=3.3.18 <4"`. Always write the ceiling when the advisory is a patch fix, then re-`pnpm install` and confirm the resolved version.
- **image-size (via @storybook/nextjs-vite)**: ACCEPTED / leave-open. Two HIGH DoS advisories (ICNS, and JXL/HEIF infinite loops) with `patched_versions: <0.0.0`, meaning **no fixed release exists**. devDependency only, never ships. Do not invent an override floor: there is no version to float to. Re-check when upstream publishes.

## Audit 7 — 2026-08-22 (Search Console driven)
- **Trigger**: reviewing Google Search Console, not a scheduled audit. 21 pages listed "not indexed"; only 2 of the 6 reasons were real defects, the rest were correct canonicalisation/noindex behaviour being reported as if it were a problem.
- **Fixed (SEO/crawl)**: `/register` was a live 404 (redirect list covered `/register.html` only) → 308 to `/signup`. Every robots.txt `Disallow` carried a trailing slash, so `/admin/` never matched `/admin`; robots paths are prefix matches, so the slashes were dropped after checking that no public route (notably `/security`) collides. Next generates a crawlable route per `opengraph-image.tsx`; five sat under "Crawled - currently not indexed" and now send `X-Robots-Tag: noindex` via `source: "/:path*/:og(opengraph-image.*)"`, verified against path-to-regexp 6.3.0 before writing.
- **Fixed (content)**: `guides/perm-recruitment-checklist` was the one genuinely un-indexed *page*. Markup was already correct (canonical, index/follow, Article JSON-LD); it was 826 words of near-pure bullets vs 2,712 for the guide that ranks, i.e. a Google quality verdict, so it was expanded to 2,115 words with the derived timing math (180-day ceiling, 30-day floor, the day-150 deadline that falls out of both, per-step latest start dates, business-day notice math).
- **Content error found via primary source**: reading 20 CFR 656.17 from eCFR (rather than from memory) showed `guides/ultimate-perm-guide-2026` listed "Company Website Posting" as **mandatory step 3**. The employer's website is 656.17(e)(1)(ii)(B), one of ten *additional* options. Only the job order and two Sunday ads are mandatory under (e)(1)(i). Corrected and renumbered.
- **Deps**: 2 new alerts (nanoid HIGH, dompurify MODERATE), both transitive, both fixed by override floors. See the new "Override floors must cap the major" policy.
- **Verification method**: dev server rather than inspection for the redirect/header behaviour; `@mdx-js/mdx` compile for all three guides; live production curl after deploy for all four fixes.
- **Deployed**: 3 commits to `main`, two Vercel production deploys, both Ready and verified live. No Convex changes.
- **Open / not done**: 256 em-dashes remain across 12 of 14 `content/*.mdx` files (only the 2 guides touched here are clean); `tutorials/getting-started.mdx` alone has 98. They leak into related-post cards and JSON-LD on otherwise-clean pages. Dependabot has 5+ non-security version PRs open again.

## Audit 6 — 2026-08-03
- **health 0 -> 100**: 20 open Dependabot alerts (2 critical, 11 high, 6 medium, 1 low) cleared to zero; `pnpm audit` reports no known vulnerabilities. Secret scanning already clean; code scanning findings are all note/warning, no error severity.
- **Fixed**: next 16.2.9->16.2.12 (9 alerts), @auth/core 0.41.2->0.41.3 (3, incl. 1 critical), sharp 0.34.5->0.35.3 (2 high), @vitest/browser->4.1.10 (1 critical, dev). Override floors raised: postcss >=8.5.18, brace-expansion >=5.0.8, dompurify >=3.4.12 (per Saved Policy), plus new fast-uri >=3.1.4, sharp >=0.35.0, undici >=6.27.0 (all 9 remaining audit findings were one package via @ai-sdk/cerebras).
- **Method**: caret `pnpm update` per Saved Policy (never --latest), then overrides for stubborn transitives, then full `pnpm install` to re-resolve — `pnpm update` alone does NOT re-apply overrides to already-locked entries, which is why sharp looked unfixed at first.
- **Governance**: added `Typecheck + Vitest` to required status checks on main. `enforce_admins` left false deliberately so direct pushes to main (the deploy path) keep working. Required reviews left off: sole maintainer.
- **No Convex deploy**: zero `convex/` changes, frontend-only -> Vercel only.
- **Machine note**: five build attempts failed on ENOSPC before ~23 GB was freed. Explicitly-backgrounded builds got killed; a foreground build auto-moved to background completed. Prefer the latter on this machine.

## Audit 5 — 2026-06-29
- **health_before:** 2 medium Dependabot alerts (dompurify 3.4.10 GHSA-cmwh-pvxp-8882; js-yaml 3.x GHSA-h67p-54hq-rp68 via gray-matter) · 0 secret-scanning · 26 Semgrep "note" + 4 "warning" code-scanning (all false-positive/acknowledged — `unsafe-formatstring` template-literals + `content/index.ts` path-traversal already eslint-disabled w/ justification + `JsonLdScript` dangerouslySetInnerHTML) · CI green on `main` · branch protection healthy (strict, CodeQL required) · community 100% · 4 open Dependabot PRs (#112 checkout 6→7, #113 dev group, #114 prod group/31, #115 native-preview), all 7d old. Health **94**.
- **health_after:** dompurify CVE fixed (override → `>=3.4.11`, resolves 3.4.11); js-yaml left open per decision (no real fix without breaking gray-matter); full gate green (typecheck 0, 2149/2149 fast tests, build ✓ zero warnings). Health **97** (1 residual accepted moderate).
- **items_fixed:** dompurify override bump (CVE) + caret-safe bulk `pnpm update` (dev tooling: storybook 10.4.6, vite 8.1.0, eslint 10.6.0, playwright 1.61.1, happy-dom, axe, @vitejs/plugin-react) + `@typescript/native-preview` tsgo → 20260628.1 + `actions/checkout` v6→v7 across all 6 workflows.
- **items_discussed:** 1 (js-yaml handling → "Leave open, no change"). Saved as policy.
- **prs_closed:** #112/#113/#114/#115 closed as superseded by the bulk update.
- **quality_issues_fixed:** 0 (gate clean on first pass under new tsgo build + dev-tool bumps).
- **deployed:** yes — pushed to `main` (Vercel prod rebuild). No Convex deploy (no `convex/` changes; no backend-affecting deps bumped).
- **duration:** ~30 min, standalone audit.

### Changes Made
- **Security**: `pnpm.overrides.dompurify` `>=3.3.2` → `>=3.4.11` (GHSA-cmwh-pvxp-8882 — permanent `ALLOWED_ATTR` pollution via `setConfig()`). `pnpm audit` drops to 1 moderate (js-yaml, accepted).
- **Deps (dev, caret bulk)**: storybook+addons 10.4.5→10.4.6, vite 8.0.16→8.1.0, eslint 10.5.0→10.6.0, eslint-plugin-storybook 10.4.6, playwright/@playwright/test 1.61.0→1.61.1, happy-dom 20.10.3→20.10.6, @axe-core/react 4.11.3→4.12.1, @vitejs/plugin-react 6.0.2→6.0.3. Prod deps already current within carets (June maintenance).
- **Dev tooling**: `@typescript/native-preview` (exact-pinned) 7.0.0-dev.20260615.1 → 20260628.1 — typecheck clean.
- **CI**: `actions/checkout@v6` → `@v7` in all 6 workflows (indexnow, semgrep, codeql-analysis, test, claude, claude-code-review). v7 = ESM conversion + blocks fork-PR checkout on `pull_request_target`/`workflow_run` (security hardening); v7 also self-bumps js-yaml to 4.2.0.

### Decisions
- **js-yaml left open**: user chose accept/leave-open over dismiss-with-reason or custom-engine fix. Documented as Saved Policy — expect it to persist on future audits.
- **No Convex deploy**: only frontend dev-deps + dompurify (browser sanitization) + workflow YAMLs changed; `convex/` untouched, no backend-runtime dep bumped → Vercel-only.
- **Bulk update + supersede**: consistent with audits 1–4 — caret `pnpm update`, close grouped Dependabot PRs superseded rather than rebase-merge each.

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

## Archived Summaries
- **Audit 2 — 2026-04-21**: 2 Dependabot alerts (critical protobufjs RCE 7.5.4→7.5.5, medium dompurify 3.3.3→3.4.1) + 4 code-scanning + 5 PRs + 3 Sentry deprecations + Next 16 middleware→proxy. Bulk deps, Sentry config migration (`disableLogger`/`automaticVercelMonitors` → webpack block), deleted empty `sentry.client.config.ts`, renamed `middleware.ts`→`proxy.ts`, @types/node policy v22→v24. All 5 PRs superseded, deployed (`2db97e0`, Convex + Vercel).
- **Audit 1 — 2026-04-11**: 27 vulns (10H/15M/2L) + 1 critical CVE (next 16.1.5→16.2.3, RSC DoS) + 9 stale PRs → bulk dep update (13+), all PRs closed superseded, deployed (`0eae6c6`). One-offs: lucide brand-icon inlining, static `icon.png` (Edge size), @types/node→22 (later 24), TS 6 / Vite 8 majors kept.
