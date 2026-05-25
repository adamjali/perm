# Codebase Concerns

**Analysis Date:** 2026-02-21
**Last Updated:** 2026-05-24 (dependency-pass resolutions + version refresh)

## Risk Matrix

```mermaid
quadrantChart
    title Severity vs Effort
    x-axis Low Effort --> High Effort
    y-axis Low Severity --> High Severity
    quadrant-1 Plan & Schedule
    quadrant-2 Critical Priority
    quadrant-3 Backlog
    quadrant-4 Quick Wins
    SWC Minifier Bug: [0.7, 0.9]
    CSP unsafe-eval: [0.3, 0.8]
    Unbounded .collect(): [0.5, 0.7]
    Legacy Migration Fields: [0.3, 0.3]
    Unused Dependencies: [0.2, 0.3]
    Dead Components: [0.2, 0.2]
    any Types in Tests: [0.4, 0.3]
    Archive Screenshots: [0.1, 0.1]
    Webpack concatenateModules: [0.6, 0.6]
    @hookform/resolvers: [0.1, 0.2]
    Full Table Scans: [0.5, 0.6]
    Audit Vuln minimatch: [0.4, 0.5]
    bn.js vuln: [0.3, 0.5]
```

---

## Tech Debt

### TD-01: SWC Minifier Bug Workaround (CRITICAL)

- **Issue:** SWC drops `var` declarations when a function has ~20+ `??`/`?.` operations, causing `ReferenceError: _ref is not defined` in production builds. This is an upstream SWC bug (swc#760, swc#7953, swc#9468) with no fix date.
- **Files:**
  - `v2/src/components/cases/detail/quick-edit/QuickEditFields.tsx` (lines 88-92) -- comment documenting workaround
  - `v2/src/components/demo/DemoCaseModal.tsx` -- 44 `??` usages detected
  - `v2/src/components/settings/CalendarSyncSection.tsx` -- 19 `??` usages detected
  - `v2/next.config.ts` (line 47) -- `concatenateModules: false` workaround
- **Impact:** Production ReferenceError crashes. Developers must remember to use `||` instead of `??` in complex functions. The `concatenateModules: false` setting disables scope hoisting for ALL client bundles, increasing bundle size.
- **Fix approach:** Monitor SWC issue tracker. When fixed, remove `concatenateModules: false` from `v2/next.config.ts` and replace `||` workarounds back to `??`. Run `grep -rl '\b_ref\b' .next/static/chunks/ | wc -l` after every build to verify zero hits. Document the build-time scan in CI.

### TD-02: Webpack Module Concatenation Disabled

- **Issue:** `config.optimization.concatenateModules = false` disables scope hoisting on ALL client-side bundles to work around `motion-dom` ESM export mangling.
- **Files:** `v2/next.config.ts` (lines 43-50)
- **Impact:** Larger client bundle size. Every module boundary retained instead of being hoisted. Estimated 5-15% bundle size increase.
- **Fix approach:** Wait for `motion/react` to fix ESM exports, then re-enable concatenation. Alternatively, vendor-lock motion-dom to a specific version and test concatenation per version.

### TD-03: React Compiler Disabled

- **Issue:** React Compiler (`reactCompiler: true`) is commented out due to causing `ReferenceError` with both Turbopack and Webpack (variable scoping and motion-dom export mangling).
- **Files:** `v2/next.config.ts` (lines 23-27)
- **Impact:** Missing automatic memoization optimizations from the React Compiler. Manual `useMemo`/`useCallback` required everywhere.
- **Fix approach:** Track https://github.com/vercel/next.js/issues/78163. Re-enable when the SWC plugin ships.

### TD-04: Legacy Migration Fields in Schema

- **Issue:** `legacyId` and `legacyAuthId` fields remain in `userProfiles` and `cases` tables with associated indexes (`by_legacy_id`). These were used during the v1-to-v2 PostgreSQL-to-Convex migration and are no longer needed.
- **Files:**
  - `v2/convex/schema.ts` (lines 73-74, 245, 257, 551)
  - `v2/scripts/migration/` -- stale migration scripts still present
- **Impact:** Wasted index storage and reads. Schema clutter that confuses new contributors. Migration scripts contain references to old PostgreSQL database.
- **Fix approach:** Remove `legacyId`, `legacyAuthId` fields and `by_legacy_id` indexes from schema. Delete `v2/scripts/migration/` directory. Deploy schema migration.

### TD-05: Stale Planning and Audit Files

- **Issue:** Multiple stale artifact directories committed to the repo.
- **Files:**
  - `v2/page_audits/ditch-io-audit-report.md` -- single audit file, unclear purpose
  - `v2/.planning/features/003-visual-motion-overhaul/` -- empty or abandoned feature directory
  - `v2/.planning/features/004-visual-overhaul-animations/` -- duplicate of 003?
  - `v2/.planning/features/005-fix-onboarding-tour/` -- no plan files
  - `v2/.planning/features/007-graceful-errors-and-observability/` -- no plan files
  - `v2/.planning/features/011-hero-server-client-split/` -- no plan files
  - `v2/.planning/VERSION-DECISIONS.md` -- references removed packages (`@ai-sdk/openai`, `ai-fallback`)
- **Impact:** Repo clutter. Misleading planning artifacts. VERSION-DECISIONS.md is stale.
- **Fix approach:** Remove empty feature directories. Update or remove VERSION-DECISIONS.md. Move `page_audits/` to a more appropriate location or delete.

### TD-06: Dual instrumentation-client.ts Analytics Outage (RESOLVED 2026-05-24)

- **Issue:** Next.js loads exactly ONE `instrumentation-client.ts`, and with a `src/` app dir it must be `src/instrumentation-client.ts` — a root-level `instrumentation-client.ts` is silently ignored. PostHog's `posthog.init()` lived at the repo root; when the BotID security feature added `src/instrumentation-client.ts` (commit `8f6da2a`), it shadowed the PostHog file, so `posthog.init()` never ran. Client analytics went fully dark for ~1 month (zero `$pageview`/`$identify`/`$exception` from ~2026-04-23). Server-side PostHog (`posthog-node` in `/api/chat`) and Sentry were unaffected.
- **Files:**
  - `v2/src/instrumentation-client.ts` — now hosts BOTH `posthog.init()` and `initBotId()`, each in its own try/catch
  - `v2/instrumentation-client.ts` — DELETED (was the dead root file)
  - `v2/next.config.ts` — added `/ingest/array/:path*` rewrite for newer posthog-js lazy bundles
- **Impact:** A complete, invisible analytics outage (no error thrown — the file simply was not loaded). All Vercel env vars were present; the bug was purely file location.
- **Detection (reuse for any "SDK silently stopped" case):**
  - `curl https://permtracker.app/` then grep the `main-app-*.js` chunk for `posthog` vs `botid` — proves which client-instrumentation code actually shipped to prod.
  - PostHog HogQL: `SELECT event, max(timestamp), count() FROM events WHERE timestamp > now() - INTERVAL 120 DAY GROUP BY event` — pinpoints when each event stopped (client vs server split).
- **Rule:** PostHog, BotID, and any future client instrumentation MUST live together in the single `src/instrumentation-client.ts`; never create a root-level one. `NEXT_PUBLIC_*` vars are build-time inlined, so analytics/observability changes need a redeploy to take effect.

---

## Dead Code

### DC-01: Unused Home Page Components

- **Issue:** `VideoShowcase`, `FeatureShowcase`, `ContactSection`, and `FloatingShapes` are exported from the barrel file but never imported by any page.
- **Files:**
  - `v2/src/components/home/VideoShowcase.tsx` (51 lines) -- exported but unused
  - `v2/src/components/home/FeatureShowcase.tsx` (108 lines) -- exported but unused
  - `v2/src/components/home/ContactSection.tsx` (376 lines) -- exported but unused
  - `v2/src/components/home/DecorativeElements.tsx` -- `FloatingShapes` export unused (only `ScrollProgress` is used)
  - `v2/src/components/home/index.ts` (lines 12, 14, 19, 20) -- dead exports
- **Impact:** ~535 lines of dead component code shipped in the codebase. `ContactSection` is particularly large.
- **Fix approach:** Remove unused components. Clean up barrel file exports. The contact page at `v2/src/app/(public)/contact/page.tsx` does NOT use `ContactSection` -- it has its own inline implementation.

### DC-02: shadcn/ui Command Component — INVALID, NOT dead code (corrected 2026-05-24)

- **Status:** INVALID. `cmdk` IS used — `v2/src/components/ui/command.tsx` (shadcn Command) is imported by `v2/src/components/job-description/TemplateSelector.tsx`. Do NOT remove `cmdk` or `command.tsx`.
- **Files:**
  - `v2/src/components/ui/command.tsx` -- shadcn Command component (in use)
  - `v2/src/components/job-description/TemplateSelector.tsx` -- imports it
  - `v2/package.json` -- `"cmdk": "^1.1.1"` (required)
- **Fix approach:** None — original "unused" finding was wrong.

### DC-03: Unused `@hookform/resolvers` Dependency — RESOLVED (2026-05-24)

- **Issue:** The package `@hookform/resolvers` was in `package.json` but never imported. A custom `zod4-resolver.ts` was written to replace it due to Zod 4 compatibility issues.
- **Resolution:** `@hookform/resolvers` removed from `package.json` in the 2026-05-24 dependency pass. The custom `v2/src/lib/forms/zod4-resolver.ts` remains the form validation resolver.

### DC-04: Archive Screenshots in Public Directory

- **Issue:** `public/images/screenshots/archive/` contains 2.5MB of old screenshots (`cases-old.png`, `dashboard-old.png`) that are not referenced anywhere in the codebase.
- **Files:** `v2/public/images/screenshots/archive/` (2.5MB)
- **Impact:** Adds 2.5MB to the repo and potentially to deployed assets.
- **Fix approach:** Delete the archive directory. If historical reference is needed, move to a non-committed location.

---

## Security Considerations

### SEC-01: CSP Allows `unsafe-eval` and `unsafe-inline`

- **Risk:** Content Security Policy includes `'unsafe-eval'` in `script-src` and `'unsafe-inline'` in both `script-src` and `style-src`. This weakens XSS protection.
- **Files:** `v2/next.config.ts` (lines 87-88)
- **Current mitigation:** Required by Vercel Analytics/Live, Sentry SDK, and Senja testimonial widget. Tailwind CSS uses inline styles extensively.
- **Recommendations:**
  1. Add nonce-based CSP for scripts (`'nonce-xxx'` instead of `'unsafe-inline'` for scripts)
  2. Investigate if `unsafe-eval` can be removed -- Sentry SDK v10 may support strict CSP
  3. Move to `style-src 'self' 'nonce-xxx'` if Tailwind supports it

### SEC-02: Full Table Scans in Auth Callback

- **Issue:** The `createOrUpdateUser` auth callback uses `.filter()` instead of `.withIndex()` to find users by email, performing a full table scan on every OAuth/new account flow.
- **Files:** `v2/convex/auth.ts` (lines 114-117)
- **Impact:** O(n) scan on the users table during authentication. Performance degrades as user count grows. Comment on line 113 acknowledges this but claims limited type information prevents using index.
- **Fix approach:** Cast the context to use the email index: `ctx.db.query("users").withIndex("email", q => q.eq("email", email))`. The index exists (schema.ts line 62). The TypeScript limitation can be worked around with type assertion.

### SEC-03: FEIN Encryption Key Sharing

- **Issue:** FEIN (Federal Employer Identification Number) encryption uses the same `OAUTH_ENCRYPTION_KEY` as OAuth token encryption.
- **Files:** `v2/convex/cases.ts` (lines 28-31)
- **Impact:** If the OAuth key is compromised, FEINs are also compromised. Key rotation affects both systems simultaneously.
- **Fix approach:** Use a separate encryption key (`FEIN_ENCRYPTION_KEY`) for FEIN data. Add migration to re-encrypt existing FEINs with the new key.

### SEC-04: Password Validation Minimum Only

- **Issue:** Password validation only checks `password.length < 8`. No complexity requirements (uppercase, number, special character).
- **Files:** `v2/convex/auth.ts` (lines 59-64)
- **Impact:** Weak passwords accepted. OWASP recommends minimum 8 characters with complexity or a passphrase-based approach.
- **Fix approach:** Add OWASP-aligned validation: min 8 chars, check against known breached password lists (e.g., HaveIBeenPwned top 1000), or adopt passphrase-based minimum length (12+ chars with no complexity requirement).

---

## Performance Bottlenecks

### PERF-01: Unbounded `.collect()` Queries (83 occurrences)

- **Problem:** 83 uses of `.collect()` across 20 Convex files, some without any limit or filter, loading entire tables into memory.
- **Files:**
  - `v2/convex/admin.ts` (5 occurrences) -- includes `ctx.db.query("userProfiles").collect()` on line 803
  - `v2/convex/onboarding.ts` -- `ctx.db.query("userProfiles").collect()` on line 221
  - `v2/convex/lib/deletion.ts` (14 occurrences)
  - `v2/convex/scheduledJobs.ts` (9 occurrences)
  - `v2/convex/conversationMessages.ts` (5 occurrences)
  - `v2/convex/jobDescriptionTemplates.ts` (7 occurrences)
  - `v2/convex/cases.ts` (9 occurrences)
- **Cause:** Convex `.collect()` loads all matching documents into memory. Without `.take(N)`, this is unbounded.
- **Improvement path:** Replace `.collect()` with `.take(N)` where N is a reasonable upper bound. For admin endpoints that need all profiles, add pagination. The `userProfiles.collect()` calls will fail when user count exceeds Convex's document limit.

### PERF-02: Hard-Coded `.take(1000)` Everywhere (21 occurrences)

- **Problem:** 21 queries use `.take(1000)` as a blanket limit. For users with fewer cases, this is fine. For power users approaching 1000 cases, data silently truncates.
- **Files:**
  - `v2/convex/cases.ts` (6 occurrences, lines 138, 2723, 2832, 3020, 3051, 3077)
  - `v2/convex/dashboard.ts` (3 occurrences, lines 62, 145, 389)
  - `v2/convex/calendar.ts` (line 118)
  - `v2/convex/timeline.ts` (4 occurrences)
  - `v2/convex/chatCaseData.ts` (2 occurrences)
  - `v2/convex/notifications.ts` (3 occurrences)
  - `v2/convex/scheduledJobs.ts` (2 occurrences)
- **Cause:** Quick fix to prevent unbounded reads, but 1000 is arbitrary and may be too low for power users.
- **Improvement path:** Replace with proper cursor-based pagination where user-facing. For internal queries, document the 1000 limit and monitor usage.

### PERF-03: Large Public Assets in Git

- **Problem:** 15MB of images in `public/images/`, including 2.5MB of archived screenshots and 1.5MB OG image.
- **Files:**
  - `v2/public/images/` (15MB total)
  - `v2/public/images/screenshots/archive/` (2.5MB, unreferenced)
  - `v2/public/og-image.png` (1.5MB)
  - `v2/public/images/hero-showcase.png` (1.0MB)
- **Cause:** Large PNGs committed directly to git without optimization.
- **Improvement path:** Compress OG image (1.5MB is excessive for 1200x630). Delete archive directory. Consider using Next.js Image optimization or a CDN for large assets.

### PERF-04: RAG Knowledge Files Hardcoded (2498 lines)

- **Problem:** Two large knowledge base files (`appGuideKnowledge.ts` at 1834 lines, `permKnowledge.ts` at 664 lines) contain inline string content that gets bundled into the Convex deployment.
- **Files:**
  - `v2/convex/lib/rag/appGuideKnowledge.ts` (1834 lines)
  - `v2/convex/lib/rag/permKnowledge.ts` (664 lines)
- **Cause:** Knowledge content embedded as TypeScript string literals for RAG ingestion.
- **Improvement path:** Move knowledge content to external JSON or markdown files loaded at ingestion time. Reduces Convex function bundle size.

---

## Fragile Areas

### FRAG-01: `convex/cases.ts` (3096 lines)

- **Files:** `v2/convex/cases.ts`
- **Why fragile:** Largest backend file. Contains CRUD, list queries, filtered pagination, calendar sync helpers, FEIN encryption, bulk operations, and import validation all in one file. Any change risks unintended side effects.
- **Safe modification:** Extract logical groups: case CRUD, case listing/pagination, calendar sync helpers, FEIN encryption utilities, bulk operations.
- **Test coverage:** Has `v2/convex/cases.test.ts` but the test file is much smaller than the source.

### FRAG-02: AI Chat Route Handler (350+ lines)

- **Files:** `v2/src/app/api/chat/route.ts` (350+ lines), `v2/src/app/api/chat/create-tools.ts` (1424 lines)
- **Why fragile:** Complex multi-provider fallback, streaming, tool calling, summarization, and conversation persistence all in one request handler. `create-tools.ts` at 1424 lines is the second largest frontend file.
- **Safe modification:** The `FallbackModel` class is well-isolated. Tool definitions in `create-tools.ts` could be split by category (query tools, action tools, search tools).
- **Test coverage:** `v2/src/lib/ai/__tests__/tools.test.ts` (857 lines) and `v2/src/lib/ai/__tests__/providers.test.ts` exist but use many `as any` casts.

### FRAG-03: CasesPageClient.tsx (1251 lines)

- **Files:** `v2/src/app/(authenticated)/cases/CasesPageClient.tsx`
- **Why fragile:** Combines filtering, sorting, search, pagination, drag-and-drop, selection mode, bulk operations, view toggle, and import modal state management in one component.
- **Safe modification:** Extract filter state management, selection logic, and drag-and-drop into custom hooks. Extract the filter bar, selection bar, and pagination as standalone components.
- **Test coverage:** No co-located test file found for this page client.

---

## Dependencies at Risk

### DEP-01: `minimatch` ReDoS Vulnerability (CVE-2026-26996) — MITIGATED (2026-05-24)

- **Risk:** High severity ReDoS vulnerability in `minimatch` < 10.2.1. Affects eslint and Storybook transitive dependencies.
- **Impact:** Only affects development tooling (not production runtime). An attacker would need to control glob patterns passed to eslint/Storybook.
- **Resolution:** pnpm override `"minimatch": ">=10.2.3"` applied in `v2/package.json` (2026-05-24).

### DEP-02: `bn.js` Infinite Loop Vulnerability — MITIGATED (2026-05-24)

- **Risk:** Moderate severity infinite loop in `bn.js` < 5.2.3, via `web-push > asn1.js > bn.js`.
- **Impact:** Affects the web push notification signing. Could be triggered by malformed push subscription data.
- **Resolution:** pnpm override `"bn.js": ">=5.2.3"` applied in `v2/package.json` (2026-05-24).

### DEP-03: `gsap` Potentially Unused

- **Risk:** `gsap` (3.15.0) is in `dependencies` but is only dynamically imported via `useGSAP.ts` hook, which is used by 3 content components (`ChangelogTimeline`, `ContentHero`, `ContentCTA`). The library is ~50KB minified.
- **Impact:** Adds to install size. Could be replaced with `motion/react` which is already installed.
- **Migration plan:** Evaluate if the 3 GSAP usages (scroll stagger, parallax) can use motion/react's `useScroll` and `useTransform` instead. If so, remove gsap dependency.

### DEP-04: `lucia` Used Only for Scrypt

- **Risk:** `lucia` (3.2.2) is a full auth library but only `Scrypt` is imported from it (in `convex/admin.ts` line 17).
- **Impact:** Full auth library installed for a single hash function.
- **Migration plan:** Replace with `@oslojs/crypto` (already installed) which provides `Scrypt` or use Node.js built-in `crypto.scrypt`.

---

## Type Safety Gaps

### TYPE-01: `any` Types in Production Code

- **Issue:** 4 `any` casts in non-test production code.
- **Files:**
  - `v2/convex/auth.ts` (line 24) -- `ctx: any` in `onAuthEvent`
  - `v2/convex/lib/errorRecording.ts` (lines 23, 29) -- `internal as any` and `runAfter` args
  - `v2/src/lib/ai/providers.ts` (line 136) -- `error as any` for status code extraction
  - `v2/src/app/api/chat/route.ts` (line 329) -- `error as any` for status code extraction
- **Impact:** Bypasses TypeScript's type checking. The `ctx: any` in auth.ts is particularly risky as it silences all type errors in the auth callback.
- **Fix approach:** For `ctx: any`, use `GenericMutationCtx<DataModel>` type. For error handling, create a typed `extractErrorStatus(error: unknown)` utility. For `errorRecording.ts`, use proper type assertions for the internal API.

### TYPE-02: `any` Types in Test Files (60+ occurrences)

- **Issue:** 60+ `as any` casts across test files, primarily for mock data and Convex ID types.
- **Files:**
  - `v2/src/lib/export/__tests__/caseExport.test.ts` (30+ `as any` casts)
  - `v2/src/lib/ai/__tests__/providers.test.ts` (9 `as any` casts)
  - `v2/src/components/forms/__tests__/CaseForm.test.tsx` (8 `as any` casts)
  - `v2/convex/lib/caseListHelpers.test.ts` (2 `as any` casts)
- **Impact:** Tests may not catch type errors. Mock data shape may drift from actual types.
- **Fix approach:** Create typed test factories: `createMockCase()`, `createMockCaseId()`, etc. Use `as Id<"cases">` instead of `as any` for Convex IDs (this pattern is already used in some tests).

### TYPE-03: eslint-disable Comments (14 in src/, 16 in convex/)

- **Issue:** 30 `eslint-disable` comments across the codebase, mostly for `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`.
- **Files:**
  - `v2/convex/admin.ts` -- 6 `@typescript-eslint/no-unused-vars` suppressions (destructuring unused fields)
  - `v2/src/app/(authenticated)/cases/CasesPageClient.tsx` (line 111, 817) -- exhaustive deps and explicit any
  - `v2/src/components/forms/sections/RFEEntryList.tsx` (line 139) -- exhaustive deps
  - `v2/src/components/forms/sections/RFIEntryList.tsx` (line 135) -- exhaustive deps
  - `v2/src/components/chat/ChatMessage.tsx` (line 81) -- exhaustive deps
- **Impact:** Suppressed warnings may hide real issues. The `react-hooks/exhaustive-deps` suppressions could cause stale closure bugs.
- **Fix approach:** For `no-unused-vars` in destructuring, use `_` prefix convention. For exhaustive-deps, review and either add missing deps or use `useRef` pattern.

---

## Configuration Debt

### CFG-01: Stale VERSION-DECISIONS.md

- **Issue:** `v2/.planning/VERSION-DECISIONS.md` references packages no longer in `package.json` (`@ai-sdk/openai`, `ai-fallback`).
- **Files:** `v2/.planning/VERSION-DECISIONS.md`
- **Impact:** Misleading documentation.
- **Fix approach:** Remove the AI SDK section or update to reflect current state (v6 migration completed, packages removed).

### CFG-02: `optimizePackageImports` Limited to 2 Packages

- **Issue:** Only `["lucide-react", "date-fns"]` in `optimizePackageImports` due to breakage with `zod` and `motion/react`.
- **Files:** `v2/next.config.ts` (line 40)
- **Impact:** Larger bundles for other barrel-export-heavy packages. The comments explain why zod and motion are excluded, which is good documentation.
- **Fix approach:** Monitor new versions of `zod` and `motion/react` for ESM compatibility. Re-test adding them to the list.

### CFG-03: Development vs Production Build Mismatch

- **Issue:** `pnpm dev` uses Turbopack (`next dev --turbopack`) but `pnpm build` uses Webpack (`next build --webpack`). Different bundlers may produce different behavior.
- **Files:** `v2/package.json` (scripts section, lines 7-8)
- **Impact:** Bugs that only appear in production builds (the SWC minifier bug is an example). Developers may not catch issues until deploy.
- **Fix approach:** Document the mismatch clearly. Consider running `pnpm build` in CI pre-merge. The mismatch exists because Turbopack is faster for dev but not production-safe.

---

## Test Coverage Gaps

### TEST-01: CasesPageClient.tsx (1251 lines, no test file)

- **What's not tested:** The largest page client component has no co-located or dedicated test file. Contains complex filter state, drag-and-drop, bulk operations.
- **Files:** `v2/src/app/(authenticated)/cases/CasesPageClient.tsx`
- **Risk:** Regressions in filtering, sorting, pagination, selection mode, and bulk operations would go undetected.
- **Priority:** High

### TEST-02: Flaky Tests Documented But Not Fixed

- **What's not tested:** `toast.test.ts` and `page-context.test.tsx` are documented as flaky in MEMORY.md but remain in the test suite.
- **Files:**
  - `v2/src/lib/__tests__/toast.test.ts` -- flaky when run with other tests
  - `v2/src/lib/ai/__tests__/page-context.test.tsx` -- flaky when run with other tests
- **Risk:** Flaky tests erode confidence in the test suite. Developers may start ignoring test failures.
- **Priority:** Medium

### TEST-03: Admin Dashboard Backend (convex/admin.ts, 903 lines)

- **What's not tested:** Admin functions have `convex/lib/__tests__/admin.test.ts` (25 tests per MEMORY.md) but the 903-line `admin.ts` file has complex user management, data copying, email sending that may not be fully covered.
- **Files:** `v2/convex/admin.ts`
- **Risk:** Admin operations (user deletion, data copy, bulk management) are high-stakes and under-tested.
- **Priority:** Medium

### TEST-04: Calendar Sync Integration

- **What's not tested:** `convex/googleCalendarSync.ts` and `convex/googleCalendarActions.ts` (1356 lines) handle Google Calendar OAuth and event sync. Integration testing is difficult but no mock-based unit tests found.
- **Files:**
  - `v2/convex/googleCalendarActions.ts` (1356 lines)
  - `v2/convex/googleCalendarSync.ts`
  - `v2/convex/googleAuth.ts` (557 lines)
- **Risk:** Calendar sync bugs would silently fail or create duplicate/missing events.
- **Priority:** Medium

---

## Missing Critical Features

### MISS-01: No Rate Limiting on Chat API

- **Problem:** The `/api/chat` route has no rate limiting. Each request triggers AI model calls that consume free-tier API quotas.
- **Files:** `v2/src/app/api/chat/route.ts`
- **Blocks:** Cost control. A malicious user could exhaust all AI provider quotas.
- **Fix approach:** Add per-user rate limiting (e.g., 30 requests/minute) using Convex's `rateLimits` table pattern already used for auth endpoints.

### MISS-02: No Error Boundary for Public Pages

- **Problem:** Public pages (`(public)` route group) have no error boundary. Only authenticated pages have `error.tsx` files.
- **Files:**
  - `v2/src/app/(public)/` -- no `error.tsx`
  - `v2/src/app/(auth)/error.tsx` -- exists for auth pages
  - `v2/src/app/(authenticated)/error.tsx` -- exists for authenticated pages
- **Blocks:** Graceful error handling on marketing/content pages. A crash in HeroSection or FAQSection shows the default Next.js error page.
- **Fix approach:** Add `v2/src/app/(public)/error.tsx` with branded error UI.

---

## Prioritized Recommendations

### Immediate (This Sprint)

1. **SEC-02:** Fix full table scan in auth callback -- one-line `.withIndex()` change
2. **DC-03:** Remove `@hookform/resolvers` from `package.json` -- unused dependency
3. **DC-04:** Delete `public/images/screenshots/archive/` -- 2.5MB of dead files
4. **DEP-01/02:** Add pnpm overrides for `minimatch` and `bn.js` vulnerabilities

### Short-Term (Next 2 Sprints)

5. **DC-01:** Remove unused home page components (`VideoShowcase`, `FeatureShowcase`, `ContactSection`)
6. ~~**DC-02:** Remove `cmdk`~~ — INVALID: `cmdk`/`command.tsx` are used by `TemplateSelector.tsx`. No action.
7. **DEP-04:** Replace `lucia` with `@oslojs/crypto` Scrypt (already installed)
8. **TEST-01:** Add tests for `CasesPageClient.tsx`
9. **MISS-02:** Add error boundary for public pages
10. **TD-04:** Remove legacy migration fields from schema

### Medium-Term (Next Quarter)

11. **MISS-01:** Add rate limiting to chat API
12. **TD-01/02:** Monitor SWC fixes, re-enable `concatenateModules` when safe
13. **PERF-01:** Replace unbounded `.collect()` with `.take(N)` in critical paths
14. **FRAG-01:** Split `convex/cases.ts` into logical modules
15. **TYPE-01:** Create typed error utility, fix `ctx: any` in auth callback
16. **SEC-01:** Investigate removing `unsafe-eval` from CSP

### Long-Term (Backlog)

17. **TD-03:** Re-enable React Compiler when Next.js SWC plugin ships
18. **DEP-03:** Evaluate replacing gsap with motion/react
19. **PERF-04:** Externalize RAG knowledge content
20. **TYPE-02:** Create test factories to eliminate `as any` in test files

---

*Concerns audit: 2026-02-21 · Dependency-pass update: 2026-05-24*
