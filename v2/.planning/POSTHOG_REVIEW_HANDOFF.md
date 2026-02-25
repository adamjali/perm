# PostHog Integration Review — Handoff

## Status: IN PROGRESS

The PostHog wizard ran and instrumented 13 files. We ran 6 review agents and identified fixes. Some fixes are done, more remain.

## COMPLETED

### C1: Guard env var assertions
- `instrumentation-client.ts` — rewrote with `if (posthogKey)` guard + dev warning
- `src/lib/posthog-server.ts` — rewrote: returns `null` if key missing, callers use `?.`
- Dead `shutdownPostHog()` removed (I3 also done)

### S1: Created `src/lib/analytics.ts`
- Safe wrapper with `capture()`, `identify()`, `reset()` — all try/catch, never throws
- Mirrors `@/lib/toast` and `@/lib/sentry` patterns
- `reset()` added for logout (fixes I4)

## REMAINING — Must update these 10 files to use `analytics` wrapper instead of direct `posthog` import

Replace `import posthog from "posthog-js"` → `import { analytics } from "@/lib/analytics"`
Replace `posthog.capture(` → `analytics.capture(`
Replace `posthog.identify(` → `analytics.identify(`

### Files to update:
1. `src/components/auth/LoginTracker.tsx` — change posthog.identify + posthog.capture → analytics.identify + analytics.capture
2. `src/app/(auth)/signup/SignupPageClient.tsx` — change 4 posthog.capture calls → analytics.capture. ALSO fix `user_signed_up_google` → `analytics.capture("user_signed_up", { method: "google" })` and rename to `signup_google_initiated` since it fires BEFORE OAuth completes
3. `src/app/(authenticated)/cases/CasesPageClient.tsx` — change 7 posthog.capture → analytics.capture
4. `src/app/(authenticated)/cases/new/AddCasePageClient.tsx` — change 3 posthog.capture → analytics.capture
5. `src/hooks/useFormSubmission.ts` — change 2 posthog.capture → analytics.capture
6. `src/components/settings/CalendarSyncSection.tsx` — change 2 posthog.capture → analytics.capture
7. `src/components/settings/DeadlineEnforcementToggle.tsx` — change 1 posthog.capture → analytics.capture
8. `src/components/settings/NotificationPreferencesSection.tsx` — change 1 posthog.capture → analytics.capture
9. `src/components/settings/ProfileSection.tsx` — change 1 posthog.capture → analytics.capture
10. `src/app/api/chat/route.ts` — change `getPostHogClient().capture(` → `getPostHogClient()?.capture(` (2 places, already returns null)

### Also remaining:
- **I1**: Add `console.warn` to empty catch blocks in `route.ts` lines 243 and 308
- **I2**: Remove `https://*.posthog.com` wildcard from CSP connect-src in `next.config.ts:108` (keep only specific domains needed by proxy)
- **I4**: Call `analytics.reset()` in sign-out flow — check `src/lib/contexts/AuthContext.tsx` or wherever signOut happens
- **I5**: Fix `v2/CLAUDE.md` line ~76 — change "sessionStorage" to "localStorage with 30-second debounce"
- **I6**: Make `posthogUserId` a `const` in `route.ts` — `const posthogUserId = userProfile?._id || "anonymous";`
- **S3**: Add global posthog-js mock to `vitest.setup.ts`

### Nice-to-have (skip if time-constrained):
- S2: Typed event catalog (`src/lib/analytics/events.ts`)
- S4: LoginTracker tests
- S5: Comment improvements

## Setup Report
Moved to `.planning/posthog-setup-report.md` — has full event inventory and dashboard links.

## Commands to verify when done
```bash
pnpm typecheck   # Should pass clean
pnpm test:fast   # ~1300 tests should pass
```
