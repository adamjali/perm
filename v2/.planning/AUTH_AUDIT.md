# Authentication Architecture Audit — PERM Tracker v2

**Purpose:** Exhaustive reference for migrating from `@convex-dev/auth@0.0.91` (beta) to **Clerk**.
**Generated:** 2026-04-20 · READ-ONLY audit.
**Source tree:** `v2`
**Stack under audit:** Next.js 16.2.3 · React 19.2.5 · Convex 1.35.1 · TypeScript strict · Vercel Hobby.

> Every citation is `absolute_file_path:line`. Line numbers are accurate as of the working tree
> on main at time of audit.

---

## Table of Contents

1. [Provider wiring](#1-provider-wiring)
2. [Auth helpers + call graph](#2-auth-helpers--call-graph)
3. [Auth route surface (client)](#3-auth-route-surface-client)
4. [User data model](#4-user-data-model)
5. [Identity touchpoints OUTSIDE auth.ts](#5-identity-touchpoints-outside-authts)
6. [Data dependencies / foreign keys](#6-data-dependencies--foreign-keys)
7. [Third-party auth integrations](#7-third-party-auth-integrations)
8. [Session + security](#8-session--security)
9. [Tests + fixtures](#9-tests--fixtures)
10. [Env variables](#10-env-variables)
11. [Pre-existing Clerk artifacts](#11-pre-existing-clerk-artifacts)
12. [`Id<"users">` assumptions](#12-idusers-assumptions)
13. [Admin detection](#13-admin-detection)
14. [Current deployment state](#14-current-deployment-state)
15. [Recent Phase 1 integration points](#15-recent-phase-1-integration-points)
16. [Migration Risk Register](#16-migration-risk-register)

---

## 1. Provider wiring

### 1.1 Tree diagram (top → bottom)

```
src/app/layout.tsx  (RootLayout — Server Component)
└── <ConvexAuthNextjsServerProvider>        ← v2/src/app/layout.tsx:142
    └── <html>
        └── <body>
            └── <SharedProviders>           ← src/app/shared-providers.tsx:12 (theme + toaster; NO auth/convex)
                └── children                ← route groups mount their own ConvexProviders

src/app/(auth)/layout.tsx                   ← uses <ConvexProviders>
src/app/(authenticated)/layout.tsx          ← uses <ConvexProviders>
src/app/(public)/layout.tsx                 ← does NOT wrap Convex (public pages skip WS overhead)
```

### 1.2 `ConvexAuthNextjsServerProvider` — root layout

**File:** `v2/src/app/layout.tsx`

- Line 7: `import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";`
- Line 142–165: `<ConvexAuthNextjsServerProvider>` wraps the full `<html>` tree.

This SSR provider reads the Convex Auth session cookie and makes it available to RSC. It is mounted
at the root so every route (public, auth, authenticated) gets access to the token on the server.

### 1.3 `ConvexAuthNextjsProvider` + `AuthProvider` + `PageContextProvider` — client chain

**File:** `v2/src/app/providers.tsx`

- Line 3: `import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";`
- Line 10–17: instantiates `ConvexReactClient(NEXT_PUBLIC_CONVEX_URL)`; throws at module-load if the env var is missing.
- Line 27–76: `BeforeUnloadSuppressor` — suppresses Convex Auth's native `beforeunload` popup during internal SPA navigation (intercepts link clicks, resets a flag after 100ms).
- Line 82–94: `ConvexProviders` exports the Convex+auth chain:
  ```tsx
  <ConvexAuthNextjsProvider client={convex}>
    <BeforeUnloadSuppressor>
      <AuthProvider>                  // custom — @/lib/contexts/AuthContext
        <PageContextProvider>
          {children}
        </PageContextProvider>
      </AuthProvider>
    </BeforeUnloadSuppressor>
  </ConvexAuthNextjsProvider>
  ```

Mounted by:
- `v2/src/app/(auth)/layout.tsx:4,12` (auth route group)
- `v2/src/app/(authenticated)/layout.tsx:33,41` (authenticated group)

### 1.4 `src/middleware.ts` — full breakdown

**File:** `v2/src/middleware.ts` (113 lines)

**Imports (L1–8):**
- `convexAuthNextjsMiddleware`, `createRouteMatcher`, `nextjsMiddlewareRedirect` from `@convex-dev/auth/nextjs/server`
- `NextResponse`, `fetchMutation` (Convex HTTP client), `api` (generated types)

**Route matchers:**
- L11–31: `isProtectedRoute` — matches `/dashboard`, `/cases`, `/calendar`, `/timeline`, `/settings`, `/notifications`, `/admin` (and `/api/chat`, `/api/google/connect`, `/api/google/disconnect`). Unmatched routes fall through.
- L34: `isAuthRoute` — matches `/login`, `/signup` (for signed-in redirect).
- L42: `isConvexAuthApiRoute` — matches `/api/auth` and `/api/auth/` (where the Convex Auth library mounts its single POST handler for all flows).

**Middleware body (L44–107):** Wrapped in `convexAuthNextjsMiddleware`.
- **L49–73 (per-IP rate limit gate):** On POST to `/api/auth`, read `x-forwarded-for` / `x-real-ip`, call `api.authRateLimit.checkIpRateLimit` with `action: "ip_auth"` via `fetchMutation`. If denied, return 429 with `Retry-After` header. Wraps in try/catch — **fails open** on infrastructure glitches.
- **L75–81:** Skip auth check on any route that isn't protected *or* auth.
- **L83:** `await convexAuth.isAuthenticated()` — library cookie read.
- **L86–88:** If already signed in on `/login` or `/signup` → `nextjsMiddlewareRedirect(request, "/dashboard")`.
- **L91–93:** If unauthenticated on a protected route → redirect to `/login`.
- **L98–105 (`shouldHandleCode` option):** Prevents Convex Auth from intercepting the query-string `code` param on `/api/google/callback` (our own Calendar OAuth endpoint). All other `code` params (e.g., Google Sign-In via Convex Auth) are handled by the library.

**Config (L109–112):**
```ts
matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
```
Matches all routes except static files and Next.js internals.

### 1.5 Server-side usages of `@convex-dev/auth/nextjs/server`

Grep results for `convexAuthNextjsToken`, `isAuthenticatedNextjs`, `convexAuthNextjsMiddleware`:

| File | Lines | Use |
|---|---|---|
| `src/middleware.ts` | 2, 44 | `convexAuthNextjsMiddleware` — route guard + IP rate limit |
| `src/app/api/chat/route.ts` | 24, 124, 134 | `isAuthenticatedNextjs()` + `convexAuthNextjsToken()` (chat streaming) |
| `src/app/api/chat/execute-tool/route.ts` | 14, 487, 492 | same pattern (tool executor) |
| `src/app/api/google/callback/route.ts` | 16–17, 77, 86 | Calendar OAuth callback — verifies Convex Auth session |
| `src/app/api/google/connect/route.ts` | 16–17, 31, 44 | Calendar OAuth initiation |
| `src/app/api/google/disconnect/route.ts` | 20–21, 29, 35 | Calendar disconnect |

**No use of `@convex-dev/auth/server` functions on the Next.js server** (only `@convex-dev/auth/nextjs/server`). The `/server` subpath (non-nextjs) is only consumed inside `convex/` — see below.

**Convex-side uses of `@convex-dev/auth/server`:**
| File | Lines | Function |
|---|---|---|
| `convex/auth.ts` | 3 | `convexAuth({...})` — main wiring |
| `convex/schema.ts` | 45 | `authTables` |
| `convex/lib/auth.ts` | 13 | `getAuthUserId` |
| `convex/userCaseOrder.ts` | 14, 55, 104 | `getAuthUserId` (direct — bypasses `convex/lib/auth` helpers) |
| `convex/pushSubscriptions.ts` | 18, 33 | `getAuthUserId` (direct) |

### 1.6 Inactivity timeout + multi-tab sync

**Entry point:** `AuthContext` in `v2/src/lib/contexts/AuthContext.tsx` manages the sign-out state machine only (`idle | signingOut`).

**InactivityTimeoutProvider:** `v2/src/components/layout/InactivityTimeoutProvider.tsx`
- Mounted inside `<ConvexProviders>` in the authenticated layout at `src/app/(authenticated)/layout.tsx:42`.
- L13: `HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000` — server-side heartbeat.
- L24: `const { signOut } = useAuthActions();` (library hook).
- L26: `recordActivity = useMutation(api.users.recordActivity)` — writes `userProfiles.lastActiveAt`.
- L30–40: `useEffect` fires `recordActivity()` immediately on mount and every 5 minutes. Stops when `enabled=false` or `isSigningOut`.
- L42–78: `performSignOut` — calls `beginSignOut()`, then races `signOut()` against an 8-second timeout, then ALWAYS does `window.location.href = "/login"` regardless of error.
- L80–83: `useInactivityTimeout({ onTimeout: performSignOut, enabled: enabled && !isSigningOut })`.
- L88: `<TimeoutWarningModal>` — renders when `isWarningVisible && !isSigningOut`.

**useInactivityTimeout hook:** `v2/src/lib/hooks/useInactivityTimeout.ts`
- **Constants (L26–43):**
  - `INACTIVITY_TIMEOUT = 15 * 60 * 1000` (15 min — hard logout)
  - `WARNING_TIME = 13 * 60 * 1000` (13 min — warning modal appears, leaving 2 min countdown)
  - `ACTIVITY_DEBOUNCE = 1000` (1 s)
  - `CHANNEL_NAME = "perm-tracker-auth-channel"` (BroadcastChannel name)
  - `STORAGE_KEY = "perm-tracker-last-activity"` (localStorage key)
  - Activity events: `["mousedown", "keydown", "scroll", "touchstart", "click"]`
  - `MIN_HIDDEN_DURATION = 5000` (ms before recalc timers on return from backgrounded tab)
- **Multi-tab sync:**
  - L266–279: `handleChannelMessage` receives `{type:"activity", timestamp}` or `{type:"logout"}` from other tabs and updates `lastActivityRef` / calls `onTimeout`.
  - L294–301: `new BroadcastChannel("perm-tracker-auth-channel")` on mount (safe — wrapped in try/catch and feature-detect).
  - L303–310: On mount, reads `localStorage.getItem("perm-tracker-last-activity")` so a newly opened tab respects activity from another tab.
  - L152–165: `updateLastActivity` calls `safeSetItem` + `channel.postMessage`.
- **Visibility/focus handling:**
  - L327–360: `handleVisibilityChange` records `hiddenAt` on hide, recalculates elapsed on unhide; if past warning or timeout threshold, shows warning with correct remaining time or logs out immediately.
  - L363–391: `handleWindowFocus` — same logic for laptop wake / tab switch. Critical: does NOT reset the timer on focus (only on intentional interaction).

**TimeoutWarningModal:** `v2/src/components/layout/TimeoutWarningModal.tsx` (rendered by provider above).

**Dependencies on Convex Auth library:**
- `useAuthActions` (L3, L24 of InactivityTimeoutProvider) — migrating to Clerk means swapping to `useClerk().signOut()` or `useAuth().signOut()`.

---

## 2. Auth helpers + call graph

### 2.1 Full helper inventory — `convex/lib/auth.ts`

All in `v2/convex/lib/auth.ts`:

| Line | Helper | Signature | Purpose |
|---|---|---|---|
| 23 | `getCurrentUserId(ctx)` | `AuthContext → Promise<Id<"users">>` | Throws `"not authenticated"` if null. Wraps `getAuthUserId(ctx)`. |
| 34 | `getCurrentUserIdOrNull(ctx)` | `AuthContext → Promise<Id<"users"> | null>` | Direct pass-through to `getAuthUserId`. |
| 42 | `getCurrentUserProfile(ctx)` | `AuthContext → Promise<Doc<"userProfiles">>` | Returns caller's profile, filters `deletedAt===undefined`. Throws if profile missing. |
| 62 | `isFirmAdmin(ctx)` | `AuthContext → Promise<boolean>` | `profile.userType === "firm_admin"`. |
| 73 | `getCurrentUserFirmId(ctx)` | `AuthContext → Promise<string>` | Returns `profile.userId` for firm_admin, `profile.firmId` for firm_member. Throws if neither. |
| 93 | `verifyOwnership<T>(ctx, resource, name)` | `(AuthContext, {userId:string}|null, string) → Promise<void>` | Throws if `!resource` or `resource.userId !== currentUserId`. |
| 119 | `verifyFirmAccess<T>(ctx, resource, name)` | `(AuthContext, {userId:string}|null, string) → Promise<void>` | Ownership OR same-firm membership. Has `as Id<"users">` cast at L139. |
| 174 | `extractUserIdFromAction(subject)` | `string → Id<"users">` | `subject.split("|")[0] as Id<"users">`. Works around multi-method identity subjects in actions. |
| 204 | `isEmailVerified(ctx, userId)` | `(QueryCtx, Id<"users">) → Promise<boolean>` | Reads `authAccounts` via index; Google = verified, password+emailVerified = verified. |
| 223 | `getVerifiedUserIds(ctx)` | `QueryCtx → Promise<Set<Id<"users">>>` | Bulk N+1-avoidance variant. |

### 2.2 Admin helpers — `convex/lib/admin.ts`

All in `v2/convex/lib/admin.ts`:

| Line | Helper | Purpose |
|---|---|---|
| 17 | `getAdminEmail()` | Reads `process.env.ADMIN_EMAIL` at call time (so tests can stub). |
| 22 | `ADMIN_EMAIL` (deprecated export) | Module-load snapshot for test compat. |
| 30 | `requireAdmin(ctx)` | Throws unless `getCurrentUserId(ctx)`'s `users` record has `email === ADMIN_EMAIL`. |
| 53 | `getAdminProfile(ctx)` | `requireAdmin` + `userProfiles` lookup. |
| 146 | `getAdminDashboardDataHelper(ctx, opts)` | Bulk-loads users/authAccounts/authSessions/profiles/cases, builds per-user summary with sort+paginate. Consumed by `convex/admin.ts:getAdminDashboardData`. |

### 2.3 Call-graph counts (distinct file hits)

**`getCurrentUserId`** — 79 occurrences in 20 files (test file excluded):

| File | Count |
|---|---|
| `convex/users.ts` | 9 |
| `convex/notifications.ts` | 7 |
| `convex/cases.ts` | 6 |
| `convex/conversations.ts` | 5 |
| `convex/deadlineEnforcement.ts` | 4 |
| `convex/timeline.ts` | 4 |
| `convex/conversationSummary.ts` | 4 |
| `convex/googleAuth.ts` | 4 |
| `convex/documents.ts` | 4 |
| `convex/conversationMessages.ts` | 4 |
| `convex/toolCache.ts` | 4 |
| `convex/calendar.ts` | 4 |
| `convex/lib/auth.ts` | 4 (self) |
| `convex/lib/audit.ts` | 3 |
| `convex/onboarding.ts` | 3 |
| `convex/lib/admin.ts` | 3 |
| `convex/dataExport.ts` | 2 |
| `convex/admin.ts` | 2 |
| `convex/jobDescriptionTemplates.ts` | 2 |
| `convex/rateLimitConfig.ts` | 1 |

**`getCurrentUserIdOrNull`** — 68 occurrences in 16 files:

| File | Count |
|---|---|
| `convex/cases.ts` | 10 |
| `convex/users.ts` | 8 |
| `convex/notifications.ts` | 7 |
| `convex/conversationSummary.ts` | 5 |
| `convex/jobDescriptionTemplates.ts` | 5 |
| `convex/dashboard.ts` | 5 |
| `convex/chatCaseData.ts` | 4 |
| `convex/conversationMessages.ts` | 4 |
| `convex/deadlineEnforcement.ts` | 3 |
| `convex/timeline.ts` | 3 |
| `convex/conversations.ts` | 3 |
| `convex/googleAuth.ts` | 3 |
| `convex/calendar.ts` | 3 |
| `convex/onboarding.ts` | 2 |
| `convex/authRateLimit.ts` | 2 |
| `convex/lib/auth.ts` | 1 (self) |

**`getCurrentUserProfile`** — only 4 self-references inside `convex/lib/auth.ts`. **This helper is not called from anywhere else.** (Consumers use `userProfiles.by_user_id` index directly.)

**`verifyOwnership`** — used in 3 files:
- `convex/cases.ts:5,949,1265,1943,1969,1998,2054,2101,2147,3001` (9 call sites)
- `convex/jobDescriptionTemplates.ts:19,230,300,337,379` (4 call sites)
- `convex/documents.ts:4,29,87,148` (3 call sites)

**`verifyFirmAccess`** — defined but **zero call sites** in the current codebase. Dead code (kept for future multi-user firms).

**`isFirmAdmin`, `getCurrentUserFirmId`** — defined; **zero production call sites** (tests only).

**`extractUserIdFromAction`** — 5 production callers:
- `convex/users.ts:970` (`immediateAccountDeletion` action)
- `convex/admin.ts:866` (`sendAdminEmail` action)
- `convex/knowledge.ts:62` (`searchKnowledge` action — applies user-keyed rate limit)
- `convex/googleCalendarActions.ts:1225, 1267` (2 actions)
- `convex/googleAuth.ts:493` (1 action)
- Plus tests: `convex/lib/__tests__/admin.test.ts:190, 196, 202`

**`isEmailVerified`** — used in `convex/notifications.ts` (2 references near top of file), `convex/welcomeEmailHelpers.ts` (indirect via `getVerifiedUserIds`).

**`getVerifiedUserIds`** — used in:
- `convex/welcomeEmailHelpers.ts:11,27` (welcome blast filter)
- `convex/scheduledJobs.ts` (cron dependent — 4 uses; see file for context)
- `convex/notifications.ts` (batch reminder filter)

**`requireAdmin`** — 4 production call sites plus helpers:
- `convex/admin.ts:690` (`updateUserAdmin` mutation) and `:764` (`deleteUserAdmin` mutation).
- `convex/abuseBlocklist.ts:141, 174, 192, 206` (4 admin mutations/queries — `adminBlockIp`, `adminUnblockIp`, `listActiveBlocks`, `previewIpNormalization`).
- `convex/adminSecurity.ts:20, 68, 135, 166, 189, 208` (8 admin queries/mutations — `getSecuritySummary`, `listRecentEvents`, `listFlaggedUsers`, `adminUnsuspendUser`, `adminSuspendUser`, `previewIpNormalization`).
- `convex/supportEmail.ts` (2 references — admin guard on support email queries/actions).
- `convex/lib/admin.ts:36` (self, inside `requireAdmin`).

**`getAdminProfile`** — called from:
- `convex/admin.ts:594` (`getAdminDashboardData`), `:628` (`saveAdminNotificationPreferences`), `:658` (`saveAdminSortPreference`).

**`getAdminDashboardDataHelper`** — called from:
- `convex/admin.ts:525` (`getUserSummary` internalQuery), `:595` (`getAdminDashboardData` public query).
- `convex/lib/admin.ts:146` (definition).

### 2.4 Client-side auth hooks

**`useAuthActions`** — `@convex-dev/auth/react`. Callers:
- `src/app/(auth)/login/LoginPageClient.tsx:3, 41`
- `src/app/(auth)/signup/SignupPageClient.tsx:3, 36`
- `src/app/(auth)/reset-password/ResetPasswordPageClient.tsx:3, 35`
- `src/components/layout/Header.tsx:8, 37` (user menu sign-out)
- `src/components/layout/InactivityTimeoutProvider.tsx:3, 24`
- `src/components/settings/SupportSection.tsx` (sign-out preview?)
- `src/components/settings/DeleteNowDialog.tsx` (sign-out after delete)
- `src/components/settings/__tests__/DeleteNowDialog.test.tsx`
- `src/components/settings/__tests__/SupportSection.test.tsx`
- `src/components/layout/__tests__/Header.test.tsx`
- `src/components/layout/__tests__/InactivityTimeoutProvider.test.tsx`
- `src/hooks/__tests__/useChatWithPersistence.test.ts`

**`useConvexAuth`** — `convex/react` (from convex core; library-agnostic name). Callers:
- `src/components/auth/LoginTracker.tsx:23, 32`
- `src/components/auth/PendingTermsHandler.tsx:20, 25`
- `src/app/(authenticated)/error.tsx` (error boundary auth state)
- Several tests.

**`AuthLoading` / `Authenticated` / `Unauthenticated`** components — not used anywhere in production code (no matches outside tests and `@/node_modules`).

**`useQuery(api.users.currentUser)`** — 17 distinct production files (see Section 2 counts above). Key consumers:
- `src/components/layout/SentryUserContext.tsx:15` — Sentry identity binding.
- `src/lib/admin/adminAuth.ts:19` — `useAdminAuth` hook.
- `src/components/layout/Header.tsx`, `src/components/layout/DeletionBanner.tsx`, `src/components/auth/LoginTracker.tsx`, etc.

**`useQuery(api.users.currentUserProfile)`** — LoginTracker + multiple feature clients.

**`useQuery(api.users.isAdmin)`** — `src/lib/admin/adminAuth.ts:20`.

---

## 3. Auth route surface (client)

### 3.1 Auth group — `src/app/(auth)/`

```
src/app/(auth)/
├── layout.tsx                               (wraps children in <ConvexProviders>)
├── error.tsx
├── login/
│   ├── page.tsx                             (RSC shell — mounts LoginPageClient)
│   └── LoginPageClient.tsx                  (client component; 521 lines)
├── signup/
│   ├── page.tsx                             (RSC shell)
│   └── SignupPageClient.tsx                 (client component; 594 lines)
└── reset-password/
    ├── page.tsx                             (RSC shell)
    └── ResetPasswordPageClient.tsx          (client component; 407 lines)
```

- `v2/src/app/(auth)/layout.tsx` — 42 lines; mounts `<ConvexProviders>` + `AuthHeader` + `AuthFooter` + `<SentryClientInit>`. No `<InactivityTimeoutProvider>` (unauth routes don't need it).

### 3.2 `LoginPageClient.tsx` — flow breakdown

**File:** `v2/src/app/(auth)/login/LoginPageClient.tsx`

**Hooks + mutations (L41–49):**
- `useAuthActions().signIn`
- `useConvex()` (direct Convex client — for inline query call)
- `useMutation(api.users.recordMyLogin)`
- `useMutation(api.authRateLimit.checkAuthRateLimit)`
- `useMutation(api.authRateLimit.clearAuthRateLimit)`
- `useAction(api.turnstile.verifyTurnstileToken)`
- `useAuthContext().completeSignOut`
- `useSearchParams`, `useRouter`

**Credential sign-in flow — `handleSubmit` (L105–221):**
1. L117–122 — pre-flight `checkAuthRateLimit({ email, action: "login" })`. Toast + abort if blocked.
2. L127–146 — inline `convex.query(api.abuseDetection.checkEmailSuspension, { email })`. If suspended, show friendly "temporarily locked" toast and abort. Fail-open on query error.
3. L152–169 — if `turnstileToken` present, `verifyTurnstile({ token })` server-side. Fail-open on verify service error.
4. L171–176 — build `FormData` (`email`, `password`, `flow: "signIn"`) and call `signIn("password", formData)`.
5. L179–186 — on `result.signingIn === true`: clear rate limit, write `localStorage["perm_last_login_at"]`, fire `recordMyLogin()` (fire-and-forget), `router.push("/dashboard")`.
6. L187–191 — on `signingIn === false` (email not verified): advance to `verification` step; provider already re-sent OTP.
7. L193–220 — error classification (rate limit / network / `handleStaleDeployment` / generic). Only rate-limit + network get Sentry; invalid-credentials are filtered out.

**OTP verification — `handleVerificationSubmit` (L223–263):**
- Builds `FormData` with `email`, `code`, `flow: "email-verification"`.
- Calls `signIn("password", formData)`.
- Success: `recordMyLogin()`, push `/dashboard`.

**Google OAuth — `handleGoogleSignIn` (L265–286):**
- `signIn("google", { redirectTo: "/dashboard" })` — library handles redirect + callback.

**UI state (L50–72):** `step: "login" | "verification"`, `email`, `password`, `turnstileToken`, `showExpiredBanner` (driven by `?expired=1` query param from auth error redirect), loading flags.

**Turnstile config:** `appearance="interaction-only"` (invisible for most users).

### 3.3 `SignupPageClient.tsx` — flow breakdown

**File:** `v2/src/app/(auth)/signup/SignupPageClient.tsx` (594 lines)

**Hooks (L36–40):**
- `useAuthActions().signIn`, `useMutation(api.users.recordMyLogin)`, `useMutation(api.authRateLimit.checkAuthRateLimit)`, `useAction(api.turnstile.verifyTurnstileToken)`, `useRouter`.

**Validation:** field-level `validateEmailValue`, `validateNameValue`, `validatePasswordValue`, `validateConfirmPassword` from `@/lib/auth/signup-validation`. Touched-flag UX (don't show errors before blur).

**`handleCredentialsSubmit` (L151–256):**
1. L170–174 — pre-flight `checkAuthRateLimit({ email, action: "signup" })`.
2. L176–193 — **mandatory** Turnstile verification (blocks submit on failure, unlike login).
3. L198–202 — build FormData with `email`, `name?`, `password`, `flow: "signUp"`.
4. L205 — `signIn("password", formData)`.
5. L208–213 — if `result.signingIn === true`: push `/dashboard`, record login.
6. L214–218 — else advance to OTP verification step.
7. L219–255 — error classification: server-side name validation rejections ("names can't contain..."), "already exists" duplicate error, rate limit, network.

**Google sign-up (L301–321):** `signIn("google", { redirectTo: "/dashboard" })`.

**Turnstile config:** `appearance="always"` (visible deterrent).

### 3.4 `ResetPasswordPageClient.tsx` — flow breakdown

**File:** `v2/src/app/(auth)/reset-password/ResetPasswordPageClient.tsx` (407 lines)

**Two steps — `email` → `reset`:**

**Step 1 (L110–180) — request code:**
- Rate-limit `password_reset`.
- Mandatory Turnstile verify.
- `signIn("password", { email, flow: "reset" })`.
- Success or error: **always** advance to step 2 and show the same success toast. Avoids leaking account existence (L170–176).

**Step 2 (L182–230) — verify + set new password:**
- `FormData`: `email`, `code`, `newPassword`, `flow: "reset-verification"`.
- `signIn("password", formData)`.
- Success: `router.push("/login")`.

### 3.5 `/api/auth` route — the secret handler

There is **no file** at `src/app/api/auth/[[...auth]]/route.ts`. The `/api/auth` handler is mounted internally by `convexAuthNextjsMiddleware` inside `src/middleware.ts`. See the comment block at `src/middleware.ts:36–41`:

> @convex-dev/auth mounts its handlers at the single `/api/auth` path... All flows (signUp, signIn, reset, OTP verify, signOut) go through this one endpoint, distinguished by body.action + body.flow. Token refresh happens INSIDE this middleware (no additional POST).

### 3.6 Google OAuth flow (Convex Auth's Google, NOT the Calendar OAuth)

- `signIn("google", { redirectTo: "/dashboard" })` — triggers the library's OAuth round-trip. All callbacks handled by the same `/api/auth` middleware endpoint.
- Convex Auth's Google provider is loaded at `convex/auth.ts:1`: `import Google from "@auth/core/providers/google";` — registered in the `providers:` array at `convex/auth.ts:50`.
- **Our own Calendar OAuth** (`/api/google/connect`, `/api/google/callback`, `/api/google/disconnect`) is separate — see Section 7.

---

## 4. User data model

### 4.1 Framework-managed auth tables

These come from `authTables` in `@convex-dev/auth/server`, spread into `convex/schema.ts:50` (`...authTables`):

**File:** `v2/node_modules/@convex-dev/auth/src/server/implementation/types.ts` (lines 36–132)

| Table | Fields | Indexes |
|---|---|---|
| **`users`** (overridden — see 4.2) | `name?`, `image?`, `email?`, `emailVerificationTime?`, `phone?`, `phoneVerificationTime?`, `isAnonymous?` | `email`, `phone` |
| **`authSessions`** | `userId: Id<"users">`, `expirationTime: number` | `userId` |
| **`authAccounts`** | `userId: Id<"users">`, `provider: string`, `providerAccountId: string`, `secret?: string`, `emailVerified?: string`, `phoneVerified?: string` | `userIdAndProvider`, `providerAndAccountId` |
| **`authRefreshTokens`** | `sessionId: Id<"authSessions">`, `expirationTime: number`, `firstUsedTime?: number`, `parentRefreshTokenId?: Id<"authRefreshTokens">` | `sessionId`, `sessionIdAndParentRefreshTokenId` |
| **`authVerificationCodes`** | `accountId: Id<"authAccounts">`, `provider: string`, `code: string`, `expirationTime: number`, `verifier?: string`, `emailVerified?: string`, `phoneVerified?: string` | `accountId`, `code` |
| **`authVerifiers`** | `sessionId?: Id<"authSessions">`, `signature?: string` | `signature` |
| **`authRateLimits`** | `identifier: string`, `lastAttemptTime: number`, `attemptsLeft: number` | `identifier` |

> Note: `authRateLimits` is the framework's per-email OTP/password rate limit table. Our custom per-email + per-IP limits live in a separate `rateLimits` table (see `convex/schema.ts:804–811`) to avoid coupling our logic to library internals.

### 4.2 App-extended `users` table

**File:** `v2/convex/schema.ts:52–66`

The `users` table is redefined (post-spread, overriding the default) with the same spec *plus* app fields:

```ts
users: defineTable({
  name: v.optional(v.string()),              // framework
  image: v.optional(v.string()),             // framework
  email: v.optional(v.string()),             // framework
  isAnonymous: v.optional(v.boolean()),      // framework
  phone: v.optional(v.string()),             // framework (added by us? yes - spec matches)
  emailVerificationTime: v.optional(v.number()),  // DEPRECATED — unreliable; auth callback bypasses library default setter
  deletedAt: v.optional(v.number()),         // APP — soft delete
})
  .index("email", ["email"])
  .index("by_deleted_at", ["deletedAt"])     // APP index
```

- `phoneVerificationTime` from authTables is **dropped** by the override (not present in our override). Because we don't use phone auth it's irrelevant, but flag for migration testing.

### 4.3 App-owned table: `userProfiles`

**File:** `v2/convex/schema.ts:68–253`

> "Separate table for app-specific user data (survives Clerk migration)" — L68. Deliberately isolated from framework-controlled `users` table.

Full field list (grouped):

- **Identity:** `userId: Id<"users">` (1:1), `fullName?`, `jobTitle?`, `company?`, `profilePhotoUrl?`.
- **Organization:** `userType: "individual"|"firm_admin"|"firm_member"`, `firmId?: Id<"users">`, `firmName?`.
- **Notifications:** `emailNotificationsEnabled`, `smsNotificationsEnabled`, `pushNotificationsEnabled`, `pushSubscription?: string` (JSON-stringified), `urgentDeadlineDays`, `reminderDaysBefore[]`.
- **Email prefs:** `emailDeadlineReminders`, granular `emailDeadlineReminderPwd/Recruitment/Eta9089/I140/Rfi/Rfe`, `emailStatusUpdates`, `emailRfeAlerts`, `emailWeeklyDigest?`, `preferredNotificationEmail?` (DEPRECATED).
- **Quiet hours:** `quietHoursEnabled`, `quietHoursStart?`, `quietHoursEnd?`, `timezone`.
- **Calendar sync:** `calendarSyncEnabled`, per-category toggles, `calendarHiddenCases?`, `calendarHiddenDeadlineTypes?`, `calendarShowCompleted?`, `calendarShowClosed?`.
- **Google OAuth (Calendar):** `googleEmail?`, `googleRefreshToken?` (encrypted), `googleAccessToken?` (encrypted), `googleTokenExpiry?`, `googleScopes?`, `googleCalendarConnected`, `gmailConnected`.
- **UI preferences:** `casesSortBy`, `casesSortOrder`, `casesPerPage`, `dismissedDeadlines[]`, `darkModeEnabled`, `privacyModeEnabled?`.
- **Chatbot:** `actionMode?: "off"|"confirm"|"auto"`.
- **Admin UI:** `adminSortBy?`, `adminSortOrder?`, `adminNotifyNewUser?`, `adminNotifyFirstCase?`, `adminNotifyAnyCase?`.
- **Deadline enforcement:** `autoDeadlineEnforcementEnabled`.
- **Legal:** `termsAcceptedAt?`, `termsVersion?`.
- **Onboarding:** `onboardingStep?`, `onboardingCompletedAt?`, `onboardingChecklist?[]`, `onboardingChecklistDismissed?`.
- **Login tracking:** `loginCount?`, `lastLoginAt?`, `lastActiveAt?`, `postSignupEmailsSent?`.
- **Deletion:** `scheduledDeletionJobId?: Id<"_scheduled_functions">`, `deletedAt?`.
- **Abuse:** `suspendedAt?`, `suspendedReason?`, `suspendedUntil?`.
- **Timestamps:** `createdAt`, `updatedAt`.

**Indexes:** `by_user_id`, `by_firm_id`, `by_deleted_at`.

### 4.4 `convex/auth.ts` — full breakdown

**File:** `v2/convex/auth.ts` (172 lines)

- **L1–10:** Imports. Note `Google` from `@auth/core/providers/google`, `Password` from `@convex-dev/auth/providers/Password`, `convexAuth` from `@convex-dev/auth/server`, `ResendOTP`, `ResendPasswordReset`.
- **L23–46: `onAuthEvent(ctx, userId)` helper** — internal post-auth hook. Runs `internal.users.ensureUserProfileInternal` with `userId`. Catches errors, calls `recordError`. Crucially **does NOT fire welcome email / admin notification** — that's deferred to the first verified login.
- **L48–171: `convexAuth({...})`** — exports `{ auth, signIn, signOut, store, isAuthenticated }`.
  - **L49–82 Providers:**
    - `Google` (raw `@auth/core` provider).
    - `Password<DataModel>({ verify: ResendOTP, reset: ResendPasswordReset, profile, validatePasswordRequirements })`.
    - L54–74 `profile()` callback: runs `validateUserName(params.name)` — sync name validator that rejects URLs, emojis, excessive length, repeated content. Throws on violation (prevents user record creation + email dispatch). **Turnstile is NOT enforced here** (callback is strictly sync; async fetch can't run).
    - L75–81 `validatePasswordRequirements`: min 8 chars, skip when `undefined` (reset flow).
  - **L84–170 Callbacks:**
    - L102–163 `createOrUpdateUser(ctx, args)`:
      1. If `args.existingUserId` — patch name/image if new values exist, call `onAuthEvent`, return.
      2. Else if `args.profile.email` — look up existing user by `email` index (L129–132; uses `(ctx.db.query("users") as any).withIndex("email", ...)` — ESLint-disabled because Convex's generic FilterApi can't resolve dynamically-registered indexes). If found, link and patch missing name/image.
      3. Else insert new `users` row with `{name, image, email}` and call `onAuthEvent`.
    - L165–169 Comment: `afterUserCreatedOrUpdated` is intentionally removed because the library skips it when `createOrUpdateUser` is defined (lib internal lines 58–63 of `node_modules/@convex-dev/auth/src/server/implementation/users.ts`).

### 4.5 `convex/auth.config.ts`

**File:** `v2/convex/auth.config.ts` (11 lines, full content):

```ts
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
export default authConfig;
```

This is consumed by `ctx.auth` (Convex runtime) to validate JWTs. For Convex Auth the `domain` equals the Convex deployment's `CONVEX_SITE_URL`. For Clerk migration this file needs to change to point at Clerk's Frontend API URL (JWKS issuer) with `applicationID: "convex"`.

### 4.6 `convex/users.ts` — user lifecycle functions (1002 lines)

Complete list of exported functions + purpose:

| Line | Export | Type | Purpose |
|---|---|---|---|
| 20 | `currentUser` | query | Returns `ctx.db.get(currentUserId)` or null. Heavily used in UI. |
| 36 | `isAdmin` | query | `{ isAdmin: user.email === process.env.ADMIN_EMAIL }`. |
| 55 | `isPostHogExcluded` | query | Check email against `POSTHOG_EXCLUDED_EMAILS` csv (supports `@domain` entries + exact match). |
| 79 | `currentUserProfile` | query | Fetches `userProfiles.by_user_id` for caller. |
| 105 | `ensureUserProfile` | mutation | Idempotent; creates profile with `buildDefaultProfile`. Schedules welcome email + admin "New User" notification. **Alternative path to `ensureUserProfileInternal`** (kept so `PendingTermsHandler` safety net works). |
| 179 | `ensureUserProfileInternal` | internalMutation | Called from `onAuthEvent` in `convex/auth.ts`. Idempotent. Does NOT schedule emails (deferred to `recordMyLogin`). |
| 224 | `recordMyLogin` | mutation | Called client-side by `LoginTracker` + login/signup pages. Increments `loginCount`, sets `lastLoginAt`, `lastActiveAt`. **First call flips `postSignupEmailsSent=true` and schedules welcome + admin emails** — defeats signup-spam because unverified attackers never get here. |
| 301 | `recordActivity` | mutation | Client heartbeat (5-min interval) updates `userProfiles.lastActiveAt`. |
| 322 | `updateUserProfile` | mutation | Partial-update; auto-creates profile if missing; encrypts Google tokens before storage. |
| 495 | `acceptTermsOfService` | mutation | Legacy — kept for future re-consent flows. Terms are now auto-stamped at profile creation. |
| 575 | `savePushSubscription` | mutation | Stores push JSON on profile; validates endpoint/keys. Rate-limited via `rateLimiter.limit("pushSubscriptionSave", userId)`. |
| 634 | `removePushSubscription` | mutation | Clears `pushSubscription` and disables push. |
| 689 | `getActionMode` | query | Returns `profile.actionMode ?? "confirm"`. |
| 717 | `updateActionMode` | mutation | Updates `actionMode`; audits change. |
| 764 | `requestAccountDeletion` | mutation | Sets `deletedAt` = now+30d on user+profile; schedules `internal.scheduledJobs.permanentlyDeleteAccount`; emails confirmation. |
| 845 | `cancelAccountDeletion` | mutation | Clears `deletedAt` + cancels scheduled deletion job. |
| 906 | `prepareImmediateDeletion` | internalMutation | Helper for immediate flow — cancels job, sets `deletedAt` to the past. |
| 963 | `immediateAccountDeletion` | action | Action (needs Node for runAction). Uses `extractUserIdFromAction(identity.subject)`. Calls `prepareImmediateDeletion` then `scheduledJobs.permanentlyDeleteAccount`. |

### 4.7 `LoginTracker.tsx` — why it exists

**File:** `v2/src/components/auth/LoginTracker.tsx` (87 lines)

- **Problem compensated:** `createOrUpdateUser` is NOT called for password sign-ins of *existing* users (the library's `retrieveAccountWithCredentials` path bypasses it). So OAuth logins get login tracking via `onAuthEvent`, but password logins of existing users wouldn't — LoginTracker is the client-side safety net covering both.
- **Lifecycle (L59–83):**
  1. Guard: require `isAuthenticated`, loaded `profile`, `hasFired.current === false`, not `isExcluded`.
  2. `analytics.identify(profile._id, { name: profile.fullName })` (idempotent).
  3. 30-second debounce via `localStorage.getItem("perm_last_login_at")` — avoids double-counting when LoginPageClient already recorded.
  4. If past debounce, fire `analytics.capture("user_logged_in", {auth_method:"oauth_or_password"})` and call `recordMyLogin()` mutation.
- **PostHog opt-out (L48–57):** Uses `api.users.isPostHogExcluded` query to opt users out via `analytics.optOut()` / back in with `analytics.optIn()`.

### 4.8 `buildDefaultProfile()` — default profile factory

**File:** `v2/convex/lib/userDefaults.ts`

- L16: `TERMS_VERSION = "2026-02-17"` — ToS acceptance default.
- L22–30: `DEFAULT_NOTIFICATION_PREFS` — `{emailNotificationsEnabled:true, emailDeadlineReminders:true, emailStatusUpdates:false, emailRfeAlerts:true, pushNotificationsEnabled:false, quietHoursEnabled:false, timezone:"America/New_York"}`.
- L38–86: `buildDefaultProfile(userId, overrides?)` sets:
  - `userType: "individual"`, notification/push/email/calendar/SMS defaults, `urgentDeadlineDays:7`, `reminderDaysBefore: [1,3,7,14,30]`, `emailWeeklyDigest: true`, `casesSortBy:"updatedAt"`, `casesSortOrder:"desc"`, `casesPerPage:20`, `darkModeEnabled:false`, `autoDeadlineEnforcementEnabled:false`, `loginCount:0`, `lastLoginAt: now`, `termsAcceptedAt: now` (unless overridden), `termsVersion: TERMS_VERSION`, `createdAt:now`, `updatedAt:now`.
  - `calendarSync*: true` for all deadline categories, `googleCalendarConnected:false`, `gmailConnected:false`.

---

## 5. Identity touchpoints OUTSIDE `auth.ts`

### 5.1 Sentry user identification

**File:** `v2/src/lib/sentry.ts`
- L149–162: `setUser({ id, email?, username? })` wraps `Sentry.setUser(...)` with client lazy-load guard.

**Binding site:** `v2/src/components/layout/SentryUserContext.tsx`
- L15: `useQuery(api.users.currentUser, isSigningOut ? "skip" : undefined)`.
- L17–29: on `user` change, `setUser({ id: user._id, email, username: name })`; on sign-out, `setUser(null)`.
- **Mounted at** `src/app/(authenticated)/layout.tsx:47`.

Migration note: Clerk's user ID will be different from Convex `_id`. If we adopt Clerk's `external_id` trick to preserve `Id<"users">`, Sentry keeps the same ID. New users post-migration will have a *different* underlying Clerk user record but still a Convex `_id` on our side — Sentry will continue using the Convex `_id` string.

### 5.2 PostHog user identification

**Wrapper:** `v2/src/lib/analytics.ts` — `identify`, `reset`, `optOut`, `optIn`, `hasOptedOut`, `capture`.

**Binding site:** `v2/src/components/auth/LoginTracker.tsx:65`
```ts
analytics.identify(profile._id, { name: profile.fullName });
```

**Reset site:** `v2/src/lib/contexts/AuthContext.tsx:89`
```ts
beginSignOut: analytics.reset() resets PostHog identity before the transition to "signingOut".
```

PostHog uses `profile._id` (the `Id<"userProfiles">` string, **not** `user._id`). This is intentional per the comment in LoginTracker.tsx and is consistent with the chat route's `posthogUserId = userProfile?._id || "anonymous"` at `src/app/api/chat/route.ts:257`.

### 5.3 Resend contact sync (marketing list)

**Files:**
- `v2/convex/marketingEmail.ts` — `"use node"` action module.
- `v2/convex/marketingEmailHelpers.ts` — internalQuery helpers (separate because Node files can't have queries).
- `v2/convex/marketingWebhook.ts` — inbound webhook recording to `marketingEvents` table.
- `v2/convex/http.ts:66–102` — Resend webhook handler (filters by `body.type.startsWith("contact.")`).

**Flow:**
- `convex/marketingEmail.ts:73–92 getMarketingSubscriptionStatus` (action) — per-user GET via Resend REST (`/contacts/<email>`).
- `convex/marketingEmail.ts:97–117 updateMarketingSubscription` (action) — per-user PATCH `unsubscribed: !subscribed`.
- `convex/marketingEmail.ts:141–260 syncContacts` (internalAction) — full reconciliation:
  1. L154–168 iterates `internal.marketingEmailHelpers.listAllUsers` (paginated 500/page).
  2. Source of truth: `users` table (NOT `userProfiles`). Deleted users (`user.deletedAt !== undefined`) trigger contact removal.
  3. Rate-limited 600ms/req (Resend free tier 2/s).
  4. **Critical:** uses snake_case (`first_name`, `segment_ids`). Segment ID: `"260e591b-971e-4e2e-b52e-edba5b369dbb"` (General).

**Email flows from `users.email`** — the primary identity field. Any migration must preserve `users.email` continuity (same email = same Resend contact).

### 5.4 AI chat route — userId attachment

**File:** `v2/src/app/api/chat/route.ts`

- L24: imports `isAuthenticatedNextjs`, `convexAuthNextjsToken`.
- L124–131: auth gate `isAuthenticatedNextjs()` — 401 if unauthenticated.
- L134–141: `token = await convexAuthNextjsToken()` — JWT forwarded to Convex queries.
- L247: fetches `api.users.currentUserProfile` with `{ token }`.
- L257: `posthogUserId = userProfile?._id || "anonymous"` — **uses `Id<"userProfiles">`, not `Id<"users">`** for PostHog attribution.

**Same pattern in `src/app/api/chat/execute-tool/route.ts:487–495`.**

### 5.5 Push notifications — userId attachment

**File:** `v2/convex/pushSubscriptions.ts`

- L18: `import { getAuthUserId } from "@convex-dev/auth/server"` — **direct library import, bypassing `convex/lib/auth`**.
- L33: `const userId = await getAuthUserId(ctx)` in public query.
- L66–75: `getUserProfileById` (internalQuery) takes `userId: v.id("users")` — called by push action via `ctx.runQuery`.
- L87–104: `clearPushSubscription` (internalMutation) takes `userId: v.id("users")`.

Push payload delivery: `convex/pushNotifications.ts` (Node action) reads `VAPID_*` keys from env, uses `web-push` package. `userId: Id<"users">` flows through `ctx.runQuery/runMutation` boundaries.

### 5.6 `ADMIN_EMAIL` env usage — exhaustive list

- `convex/lib/admin.ts:17` (`getAdminEmail()`), L22 (module-load `ADMIN_EMAIL` const, deprecated), L33 (`requireAdmin` guard).
- `convex/users.ts:42` (`isAdmin` query).
- `convex/notificationActions.ts:666` (log-only — warns if unset when trying to send admin notification).
- Docs-only: `docs/SECURITY.md:25`, `docs/ACCESS_CONTROL.md:68`, `docs/INCIDENT_RESPONSE.md:24`.
- Tests: `convex/lib/__tests__/admin.test.ts:177,181`, `convex/__tests__/systemErrors.test.ts:12,23,29`.

### 5.7 `identity.subject.split("|")` pattern — all call sites

Via `extractUserIdFromAction` in `convex/lib/auth.ts:174`. Callers already listed in Section 2.3:

- `convex/users.ts:970` — `immediateAccountDeletion`
- `convex/admin.ts:866` — `sendAdminEmail`
- `convex/knowledge.ts:62` — `searchKnowledge`
- `convex/googleCalendarActions.ts:1225, 1267`
- `convex/googleAuth.ts:493`

Migration impact: Clerk's identity subject format is different (no `|`-join for multi-provider users; Clerk handles this internally). This helper becomes a no-op or needs re-implementation.

### 5.8 Marketing email sync — how `users` powers Resend reconciliation

Already covered in 5.3. Key detail: `convex/marketingEmailHelpers.ts:14–28 listAllUsers` returns `{email, name, deletedAt}` — NO `_id`. Resend contact keys are emails, not user IDs. Email continuity is the ONLY requirement for sync survival.

---

## 6. Data dependencies / foreign keys

### 6.1 Tables with `userId: v.id("users")` (required)

From `v2/convex/schema.ts`:

| Line | Table | Field |
|---|---|---|
| 71 | `userProfiles` | `userId` |
| 258 | `cases` | `userId` |
| 564 | `notifications` | `userId` |
| 611 | `conversations` | `userId` |
| 708 | `auditLogs` | `userId` |
| 744 | `userCaseOrder` | `userId` |
| 786 | `timelinePreferences` | `userId` |
| 863 | `jobDescriptionTemplates` | `userId` |

### 6.2 Tables with optional `userId`

| Line | Table | Field |
|---|---|---|
| 85 | `userProfiles` | `firmId?: Id<"users">` (self-ref) |
| 952 | `systemErrors` | `userId?: Id<"users">` |

### 6.3 Tables with NO `userId` but referenced via other ID chains

- `conversationMessages` → `conversationId: Id<"conversations">` → user.
- `toolCache` → `conversationId` → user.
- `authAccounts`/`authSessions`/`authRefreshTokens`/`authVerificationCodes`/`authVerifiers` → `userId` or chain (framework-managed).
- `rateLimits`, `abuseBlocklist`, `apiUsage`, `toolCache`, `supportEmails`, `marketingEvents`, `systemErrors` — infra tables, no strict user linkage.

### 6.4 No `uploadedBy`, `createdBy`, `ownerId` fields

None found — `userId` is the sole ownership field convention throughout.

### 6.5 Soft-delete interactions

- **`users.deletedAt`** (line 63) — set by `users.requestAccountDeletion` (`convex/users.ts:801–803`) and cleared by `cancelAccountDeletion` (`:886–888`). Also set by admin delete.
- **`userProfiles.deletedAt`** (line 235) — same. Set by `requestAccountDeletion` (`:794–798`).
- **`userProfiles.suspendedAt`** (line 247–249) — admin-controlled abuse suspension. Blocks login in `checkEmailSuspension` (`convex/abuseDetection.ts:116–144`).
- **Cascade:** `convex/lib/deletion.ts:39–185 purgeAllUserData(ctx, userId)` is the single source of truth for permanent deletion. Deletes:
  - cases, notifications, conversations + messages + toolCache, auditLogs, userCaseOrder, timelinePreferences, jobDescriptionTemplates, userProfiles, authAccounts + authVerificationCodes, authSessions + authRefreshTokens, finally the `users` row itself.
  - Called by `convex/admin.ts:820 purgeUserInternal` and `convex/scheduledJobs.ts permanentlyDeleteAccount` (scheduled 30d after `requestAccountDeletion`).

---

## 7. Third-party auth integrations

### 7.1 Google OAuth for sign-in (via Convex Auth library)

- Provider import: `convex/auth.ts:1 import Google from "@auth/core/providers/google";`
- Registered: `convex/auth.ts:50 providers: [Google, Password<DataModel>({...})]`.
- Env vars consumed by `@auth/core/providers/google`:
  - `AUTH_GOOGLE_ID` (from `.env.example:14`)
  - `AUTH_GOOGLE_SECRET` (from `.env.example:15`)
  - Also seen in `.env.local.example` as `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET` — **this is a discrepancy** (legacy names from an earlier setup). Current code expects `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
- Redirect URI registered with Google: `<site>/api/auth/callback/google` (convention for Auth.js providers; handled by the library's internal `/api/auth` endpoint).
- Post-OAuth redirect: `signIn("google", { redirectTo: "/dashboard" })` — specified at `LoginPageClient.tsx:269` and `SignupPageClient.tsx:305`.
- Google profile name is run through `validateUserName(params.name)` in `convex/auth.ts:69` — same sanitation as password flow.

### 7.2 Cloudflare Turnstile (anti-bot)

- **Client component:** `v2/src/components/auth/AuthTurnstile.tsx` — uses `@marsidev/react-turnstile`. Reads `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (L34). Falls back to Cloudflare's "always passes" test key `1x00000000000000000000AA` in dev.
- **Server action:** `v2/convex/turnstile.ts` — `"use node"` action `verifyTurnstileToken` POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET_KEY`. Fail-open in dev (no secret); fail-closed in prod.
- **Env vars:**
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client, `.env.example` not listed — set in Vercel env directly)
  - `TURNSTILE_SECRET_KEY` (Convex env)
- **Callsites:** signup (`appearance="always"`), reset-password (`appearance="always"`), login (`appearance="interaction-only"` — invisible unless Cloudflare ML flags attempt).

### 7.3 Resend for email verification + password reset

- `v2/convex/ResendOTP.ts` — wraps `Email` from `@convex-dev/auth/providers/Email` with a `sendVerificationRequest` using Resend SDK. 12-char alphanumeric codes via `generateSecureOTP` (`convex/lib/crypto.ts`). Uses `process.env.AUTH_RESEND_KEY`. From address: `"PERM Tracker <noreply@permtracker.app>"`. Template: `src/emails/VerificationCode.tsx`.
- `v2/convex/ResendPasswordReset.ts` — identical pattern. Template: `src/emails/PasswordResetCode.tsx`.
- Blocklist guard: both call `isEmailBlocked(email)` from `convex/lib/emailBlocklist.ts` and silently skip blocklisted recipients.
- **Convex Auth wiring:** `convex/auth.ts:52` — `Password<DataModel>({ verify: ResendOTP, reset: ResendPasswordReset, ... })`.
- **Non-throwing send:** Both `ResendOTP.sendVerificationRequest` and `ResendPasswordReset.sendVerificationRequest` log errors but don't throw. The Convex Auth library stores the verification token in the DB first; if the email fails, the user can retry to resend.

---

## 8. Session + security

### 8.1 Cookie settings

- The Convex Auth library manages session cookies via `convexAuthNextjsMiddleware`. The cookie name + flags are set internally by the library; not directly configurable in our code.
- Inspection of the library source (`node_modules/@convex-dev/auth/src/server/cookies.ts`) would show: cookie is typically `__convexAuthJWT` or similar, `httpOnly: true`, `secure: true` (production), `sameSite: "lax"`, `path: "/"`.
- **No custom cookie handling in our code** for the auth session. (We do set `google_oauth_state` cookie at `src/app/api/google/connect/route.ts:72–78` — that's for the Calendar OAuth CSRF nonce, 10-min expiry.)

### 8.2 Inactivity timeout + warning modal

- Inactivity limit: **15 minutes** (`useInactivityTimeout.ts:28` — `INACTIVITY_TIMEOUT`).
- Warning fires at: **13 minutes** (`WARNING_TIME`) — modal shows for 2 minutes before hard logout.
- Warning modal: `v2/src/components/layout/TimeoutWarningModal.tsx`.
- Sign-out trigger: `performSignOut` in `InactivityTimeoutProvider.tsx:42–78`:
  1. `beginSignOut()` → `analytics.reset()` → context transitions to `signingOut`.
  2. Race `signOut()` vs 8-second timeout (`InactivityTimeoutProvider.tsx:55–61`).
  3. Regardless of outcome, `window.location.href = "/login"` (`InactivityTimeoutProvider.tsx:77`).
- Multi-tab sync: `BroadcastChannel("perm-tracker-auth-channel")` + `localStorage["perm-tracker-last-activity"]`.

### 8.3 Sign-out flow

**Primary sign-out handler (user-initiated):** `v2/src/components/layout/Header.tsx:55–69`
```ts
async function handleSignOut(): Promise<void> {
  if (isSigningOut) return;
  beginSignOut();
  try {
    await signOut();                       // library
    window.location.href = "/login";
  } catch (error) {
    handleOperationError(error, {...});
    cancelSignOut();
  }
}
```

**Inactivity sign-out:** `InactivityTimeoutProvider.tsx:42–78` (see 8.2).

**`completeSignOut()` in `AuthContext`** (`src/lib/contexts/AuthContext.tsx:96`): called from `LoginPageClient:94` on mount to flip state back to `idle` after arriving at `/login`.

**Token clearing:** handled by Convex Auth library's `signOut()`; no manual cookie wipe in our code. The `InactivityTimeoutProvider` comment at L52–69 explicitly notes that token clearing happens internally and that the server session expires on its own if the client call fails.

---

## 9. Tests + fixtures

### 9.1 Primary test utility for Convex functions

**File:** `v2/test-utils/convex.ts`

Uses `convex-test` (from `devDependencies` L136 of package.json: `"convex-test": "^0.0.47"`).

- L15–17: `createTestContext()` returns `convexTest(schema, modules)` where `modules = import.meta.glob("../convex/**/*.ts")`.
- L25–52: `createAuthenticatedContext(t, name?)`:
  1. Create a temp `withIdentity({subject: "temp-user-" + rand})` context.
  2. Insert a `users` row (yields real `Id<"users">`).
  3. Return proxy `{ ctx: t.withIdentity({subject: userId, name}), userId }`.
  
  **The key insight:** test identity's `subject` IS the Convex `Id<"users">` string. This is how `getAuthUserId(ctx)` returns the expected ID in tests.

- L55–80: scheduler helpers (`setupSchedulerTests`, `finishScheduledFunctions`, `withScheduler`, `advanceTime`).

### 9.2 `as Id<"users">` cast patterns in tests

Grep found cast sites. Representative examples:
- `src/components/notifications/__tests__/NotificationList.test.tsx:39` — `userId: "user-123" as Id<"users">` (fixture).
- `convex/lib/caseListHelpers.test.ts:17` — `userId: "user123" as Id<"users">` (fixture).
- `convex/lib/__tests__/admin.test.ts:9` — `const MOCK_USER_ID = "test-user-123" as Id<"users">`.
- `convex/__tests__/scheduledJobs.test.ts:43` — `return identity!.subject as Id<"users">` (extracts subject-as-userId).

### 9.3 Test files that touch identity

From grep for `asUser|withIdentity|convex-test|ConvexTest|ctx\.auth\.getUserIdentity`:

- `convex/__tests__/conversationSummary.test.ts`
- `convex/__tests__/chatCaseData.test.ts`
- `convex/__tests__/scheduledJobs.test.ts`
- `convex/__tests__/conversations.test.ts`
- `convex/__tests__/conversationMessages.test.ts`
- Plus many under `convex/lib/__tests__/`.

---

## 10. Env variables

### 10.1 Convex deployment env vars

| Variable | Consumed by | Purpose |
|---|---|---|
| `CONVEX_SITE_URL` | `convex/auth.config.ts:4` | JWT issuer for `ctx.auth` validation. Auto-set by Convex. |
| `CONVEX_DEPLOYMENT` | CLI + build | Convex deployment name (see `.env.example:7`, `.env.local.example:8`). |
| `JWT_PRIVATE_KEY` | `@convex-dev/auth` internals | Signs Convex Auth JWTs. Set in Convex deployment env (not `.env.local`). `.env.local.example:15` documents. |
| `JWKS` | `@convex-dev/auth` internals | JWKS pub key. Set in Convex deployment env. Companion to `JWT_PRIVATE_KEY`. |
| `SITE_URL` | `@convex-dev/auth` internals | OAuth redirect base. Set in Convex deployment env. |
| `AUTH_GOOGLE_ID` | `@auth/core/providers/google` | Google OAuth client id. `.env.example:14`. |
| `AUTH_GOOGLE_SECRET` | same | Google OAuth secret. `.env.example:15`. |
| `AUTH_GOOGLE_EMAIL_DOMAIN` | | Listed in `.env.example:16` as `permtracker.app` — no grep hits in source code; may be unused/stale. |
| `AUTH_RESEND_KEY` | `convex/ResendOTP.ts:22`, `ResendPasswordReset.ts:21`, `convex/lib/email.ts:25`, `convex/marketingEmail.ts:24` | Resend API key for OTP + password reset + marketing sync. |
| `RESEND_WEBHOOK_SECRET` | `convex/http.ts:34` | svix signature verification. |
| `TURNSTILE_SECRET_KEY` | `convex/turnstile.ts:36` | Cloudflare siteverify secret. |
| `ADMIN_EMAIL` | `convex/lib/admin.ts:18,22`, `convex/users.ts:42`, `convex/notificationActions.ts:666` | Single admin email. No fallback. |
| `POSTHOG_EXCLUDED_EMAILS` | `convex/users.ts:61` | CSV of emails/domains excluded from PostHog. |
| `OAUTH_ENCRYPTION_KEY` | `convex/lib/crypto.ts:56` | AES-256-GCM key for Google Calendar token encryption. |
| `GOOGLE_CALENDAR_CLIENT_ID` | `convex/googleCalendarActions.ts:39` | Calendar OAuth (separate from sign-in). |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | `convex/googleCalendarActions.ts:40` | |
| `TAVILY_API_KEY`, `BRAVE_API_KEY` | `convex/webSearch.ts:92,142` | Web search providers. |
| `SUPPORT_FORWARD_EMAIL` | `convex/supportEmail.ts:29` | Default support forward address. |
| `SENTRY_DSN` | `convex/lib/sentry.ts:59` | Convex-side Sentry. |
| `NODE_ENV` | multiple | Prod guard. |
| `LOG_LEVEL` | `convex/lib/logging.ts:87` | |
| `VAPID_PRIVATE_KEY` | `convex/pushNotifications.ts:49` | Web Push. |
| `APP_URL` | `convex/notificationActions.ts:45` | Default "https://permtracker.app" fallback. |

### 10.2 Next.js client/server env vars

| Variable | Consumed by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `src/app/providers.tsx:10` | Convex WebSocket URL. |
| `NEXT_PUBLIC_APP_URL` | `src/app/layout.tsx:42,127`, `src/app/robots.ts:4` | Metadata base URL. |
| `NEXT_PUBLIC_SITE_URL` | `.env.example:19` | Older alias; still referenced in docs. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `src/components/auth/AuthTurnstile.tsx:34` | Turnstile client key. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `src/components/pwa/ServiceWorkerRegistration.tsx:112`, `src/lib/pushSubscription.ts:194`, `convex/pushNotifications.ts:48` | Web push public key. |
| `NEXT_PUBLIC_SENTRY_DSN` | `instrumentation-client.ts` + Sentry config | Frontend Sentry. |
| `SENTRY_AUTH_TOKEN` | build-time (Sentry Webpack plugin) | Source map upload. |
| `CALENDAR_OAUTH_REDIRECT_URI` | `src/lib/google/oauth.ts` | Dev URL for Calendar OAuth. |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | `.env.example:48` | Alternate name for `OAUTH_ENCRYPTION_KEY` — **discrepancy worth verifying**. |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `MISTRAL_API_KEY` | `src/lib/ai/providers.ts` | AI SDK providers. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_AUTH_FROM_EMAIL` | `src/lib/resend` (if any) | Alt Resend configuration (mostly not used in favor of `AUTH_RESEND_KEY` in Convex). |

### 10.3 Env var **name inconsistencies to flag for migration**:

1. `.env.example:14` says `AUTH_GOOGLE_ID` but `.env.local.example:18` says `AUTH_GOOGLE_CLIENT_ID`. The codebase uses `AUTH_GOOGLE_ID` (implicit via Auth.js convention). `.env.local.example` is stale.
2. `.env.example:48` has `CALENDAR_TOKEN_ENCRYPTION_KEY` but the actual code uses `OAUTH_ENCRYPTION_KEY` (`convex/lib/crypto.ts:56`). `.env.example` is stale.
3. `AUTH_RESEND_KEY` (used by code) vs `RESEND_API_KEY` (listed in `.env.example:64`). **Code uses `AUTH_RESEND_KEY`** exclusively.

---

## 11. Pre-existing Clerk artifacts

### 11.1 Grep results across `src/`, `convex/`, `docs/`

**In `src/`:** No matches.

**In `convex/`:** One non-code match:
- `v2/convex/schema.ts:68` — comment: `// Separate table for app-specific user data (survives Clerk migration)` — architectural intent, not a code dependency.

**In `docs/`:** Two documentation hints:
- `v2/docs/SECURITY.md:135` — `- No MFA (planned with Clerk migration)`
- `v2/docs/SECURITY.md:138` — `- No password-history enforcement (Clerk will provide)`

### 11.2 Skill reference files (tooling, NOT app code)

`.agents/skills/convex-setup-auth/` contains reference docs for Clerk *as one of several auth options* — these are Claude skill reference files and are **not loaded by the app**. Files include `references/clerk.md`, `SKILL.md`. These can safely be ignored for migration purposes.

### 11.3 `package.json` dependencies

**Confirmed:** Zero `@clerk/*` packages installed.

Current auth-relevant dependencies (from `v2/package.json:32–108`):
- `@auth/core ^0.41.1`
- `@convex-dev/auth ^0.0.91`  ← **beta, the one being migrated away from**
- `lucia ^3.2.2`  ← present; used for `Scrypt` password hashing only. See `convex/admin.ts:17 import { Scrypt } from "lucia";` — used for test user creation (`createTestUserInternal`). Should remain usable until we remove test-user creation.
- `@oslojs/crypto ^1.0.1`  ← present; no direct grep hits in our app code. May be transitive from `lucia` or ResendOTP support. Review before removing.

**Verdict:** No stale Clerk artifacts. `package.json` has no Clerk deps.

---

## 12. `Id<"users">` assumptions

### 12.1 Current Convex `Id<"users">` format

Convex auto-generates IDs as ~32-char base32-lowercase strings with a table prefix (e.g., `k97...`). Code paths that **rely on this specific shape** are mostly bounded to the tool execution route — see 12.2.

### 12.2 `assertConvexId` validator (tool executor)

**File:** `v2/src/app/api/chat/execute-tool/route.ts:67–79`

```ts
function assertConvexId(value: unknown, tableName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) { throw ... }
  // MongoDB ObjectIds are exactly 24 hex chars — reject those explicitly
  if (/^[0-9a-f]{24}$/.test(value)) { throw ... }
}
```

**Usage:** called for `caseId` / `notificationId` in all tool operations (L156, 199, 246, etc.). **Not currently used for `userId` directly**, but the same pattern could be an issue anywhere AI tools receive user-provided IDs. Clerk's `user_xxx` format (e.g., `user_2X9a8B...`) would pass this check (no hex-only), but it would fail if we ever added a hard assertion on the Convex prefix.

### 12.3 Route params with `userId` embedded

No routes take `userId` as a path param. The admin security page at `src/app/(authenticated)/admin/security/SecurityDashboardClient.tsx:428` does `await unsuspend({ userId: userId as Id<"users"> })` — `userId` comes from a dropdown state, not from URL.

### 12.4 `as Id<"users">` casts on strings from external sources

The only meaningful cases:
- `convex/lib/auth.ts:175 subject.split("|")[0] as Id<"users">` — **the danger**: this is where Clerk's JWT subject string will arrive. Clerk returns `user_xxx...` as the subject. We'd need to map this to our Convex `Id<"users">` (either via the `external_id` Clerk feature, or a client-side `clerkId → convexId` lookup).
- `src/app/(authenticated)/admin/security/SecurityDashboardClient.tsx:428` — `userId as Id<"users">` cast from dropdown state.
- `convex/lib/auth.ts:139 resource.userId as Id<"users">` — cast from a generically-typed resource field.

### 12.5 Plain string logs embedding userId

Grep shows log messages reference `userId` by template literal in many places (e.g., `convex/auth.ts:36 "Failed to ensure user profile for ${userId}"`), but no structural parsing assumes a specific format. These are log-only strings.

### 12.6 Migration danger zone

The critical issue: **Clerk's `user_xxx` IDs are NOT Convex IDs**. If we use Clerk's `external_id` feature to preserve Convex `Id<"users">` for migrated users, existing rows stay valid. But:

- **New users post-migration** will get a brand-new `Id<"users">` when we insert them into the `users` table — this ID will be unrelated to Clerk's `user_xxx`.
- **The mapping must be stored** — conventionally as `users.clerkId: string` or using Clerk's `ctx.auth.getUserIdentity().subject` which returns the Clerk ID.
- **`getAuthUserId(ctx)` from `@convex-dev/auth/server`** will no longer exist — we'll need a replacement that reads `ctx.auth.getUserIdentity()` and looks up `users` by `clerkId`.

Every one of the 79+ `getCurrentUserId` call sites in `convex/` will transparently keep working if `getCurrentUserId` is re-implemented to do the Clerk-ID → Convex `_id` lookup. But `extractUserIdFromAction` (currently splits `|`-joined subjects) is Clerk-incompatible — needs a full replacement.

---

## 13. Admin detection

### 13.1 Current implementation

**Server-side:** `convex/lib/admin.ts:30–43 requireAdmin(ctx)` — single source of truth.

```ts
export async function requireAdmin(ctx: QueryCtx): Promise<void> {
  const adminEmail = getAdminEmail();       // process.env.ADMIN_EMAIL
  if (!adminEmail) throw new Error("Admin not configured: ...");
  const userId = await getCurrentUserId(ctx);
  const user = await ctx.db.get(userId);
  if (!user || user.email !== adminEmail) throw new Error("Unauthorized: ...");
}
```

**Client-side:** `src/lib/admin/adminAuth.ts:17–28`:
```ts
export function useAdminAuth() {
  const { isSigningOut } = useAuthContext();
  const user = useQuery(api.users.currentUser, isSigningOut ? "skip" : undefined);
  const adminCheck = useQuery(api.users.isAdmin, isSigningOut ? "skip" : undefined);
  return { isAdmin: adminCheck?.isAdmin || false, isLoading: ..., isSigningOut, user };
}
```

- `api.users.isAdmin` query (`convex/users.ts:36–48`) — returns `{ isAdmin: user.email === process.env.ADMIN_EMAIL }`.

### 13.2 Admin check call sites

**Convex (all use `requireAdmin` or `getAdminProfile`):**
- `convex/admin.ts:594, 628, 658, 690, 764, 866` (dashboard + mutations + sendAdminEmail action).
- `convex/abuseBlocklist.ts:141, 174, 192, 208` (4 admin functions).
- `convex/adminSecurity.ts:20, 68, 135, 166, 189, 208` (6 admin functions).
- `convex/supportEmail.ts` (admin guard).

**Frontend (all use `useAdminAuth`):**
- `src/app/(authenticated)/admin/AdminDashboardClient.tsx` (L1).
- `src/app/(authenticated)/admin/security/SecurityDashboardClient.tsx`.
- `src/components/layout/Header.tsx:15` — imports `useAdminAuth` to conditionally render `ADMIN_NAV_LINK`.

### 13.3 Admin routes

- `/admin` — main dashboard (users, cases, stats).
- `/admin/security` — blocklist, strikes, flagged users.

Both are listed in `src/middleware.ts:23–25` as protected routes.

---

## 14. Current deployment state

### 14.1 Convex deployments

Per the project memory notes and project CLAUDE.md:
- **Prod:** `giant-dragon-464`
- **Dev:** `giddy-peccary-484`

Both read from `v2/.env.local` (`CONVEX_DEPLOYMENT=...`, `NEXT_PUBLIC_CONVEX_URL=https://....convex.cloud`). Actual values not read in this audit (READ-ONLY).

### 14.2 Convex auth config file

**Exists at:** `v2/convex/auth.config.ts` (11 lines).

Content: single provider pointing at `process.env.CONVEX_SITE_URL` with `applicationID: "convex"`. This is the **self-issuer** setup: Convex Auth signs its own JWTs using `JWT_PRIVATE_KEY` stored in the Convex deployment env, validates them against the same domain. Clerk will replace this with Clerk's Frontend API URL + `applicationID: "convex"`.

### 14.3 Vercel env vars

Skipped per instructions.

---

## 15. Recent Phase 1 integration points

### 15.1 `convex/abuseBlocklist.ts`

**File:** `v2/convex/abuseBlocklist.ts` (228 lines)

- **Uses:** `requireAdmin` from `convex/lib/admin.ts` (L32 import; L141, 174, 192, 208 call sites).
- **Schema table:** `abuseBlocklist` at `convex/schema.ts:816–825`, keyed by normalized IP. **No user coupling** beyond admin-gate on mutations.
- **Strike logging:** reuses `rateLimits` table (key `ip_strike:<ip>`) — doesn't need its own schema.
- **Cleanup:** `cleanupExpiredBlocks` (L201–215) — cron via `convex/crons.ts`.

### 15.2 `convex/abuseDetection.ts`

**File:** `v2/convex/abuseDetection.ts` (145 lines)

**Critical for migration:** uses `(ctx.db.query("users") as any).withIndex("email", ...)` at two places:

- L66–71: `recordAuthFailure` (internalMutation) — looks up user by email to apply auto-suspension.
- L121–126: `checkEmailSuspension` (public query) — called by login page pre-signIn.

The `as any` cast exists because Convex's strictly-typed FilterApi doesn't resolve the framework-added `email` index (it's registered at schema-load time, after `users` is overridden in our schema).

**Pattern consequence for Clerk migration:** if we keep the `users` table as-is (with our override), the `email` index still works. If we rename `users` or restructure it, these `as any` casts need updates. **Clerk provides `users.emailAddress` differently** — we'd likely keep our current structure.

### 15.3 `convex/authRateLimit.ts`

**File:** `v2/convex/authRateLimit.ts` (179 lines)

- L19: `import { getCurrentUserIdOrNull } from "./lib/auth"` — used in `clearAuthRateLimit` at L175 to allow only authenticated users to clear limits.
- L49–87: `checkAuthRateLimit({email, action})` — called pre-signIn by forms.
- L74–78: on rejection for `login`/`password_reset`/`otp_verify`, schedules `internal.abuseDetection.recordAuthFailure` — this is where the `users` email-lookup pattern propagates.
- L99–157: `checkIpRateLimit({ip, action})` — called by middleware on `/api/auth` POSTs and by `/api/chat` route.

### 15.4 `convex/adminSecurity.ts`

**File:** `v2/convex/adminSecurity.ts` (213 lines)

All 7 exports gate on `await requireAdmin(ctx)`:
- `getSecuritySummary` (L17) — KPI cards.
- `listRecentEvents` (L62) — rate-limit strikes + system errors.
- `listFlaggedUsers` (L132) — filters `userProfiles` by `suspendedAt`, hydrates with `user.email`.
- `adminUnsuspendUser` (L163) — clears suspension fields on profile.
- `adminSuspendUser` (L183) — sets suspension fields on profile.
- `previewIpNormalization` (L206) — dev helper.

No direct coupling to Convex Auth internals; purely reads/writes our own tables.

---

## 16. Migration Risk Register

Everything below is an **assumption, coupling, or implicit contract** the Clerk migration needs to handle. Ordered roughly by severity.

### Severity: critical (migration-blockers)

1. **`getAuthUserId(ctx)` is the universal auth primitive.** Every `getCurrentUserId`/`getCurrentUserIdOrNull` in `convex/lib/auth.ts` delegates to it. There are 79+ call sites across 20 files in `convex/`. Migration strategy: replace with a Clerk-aware wrapper that reads `ctx.auth.getUserIdentity()`, extracts the Clerk subject, and looks up the `users` row by `clerkId`. Without this, every Convex function breaks.

2. **`extractUserIdFromAction(subject.split("|")[0])`** is a specific hack for Convex Auth's multi-provider identity encoding. Clerk does not use `|`-joined subjects. All 5 action-side call sites (`convex/users.ts:970`, `convex/admin.ts:866`, `convex/knowledge.ts:62`, `convex/googleCalendarActions.ts:1225, 1267`, `convex/googleAuth.ts:493`) will silently return wrong user IDs if not rewritten.

3. **`convex/auth.ts` and `convex/auth.config.ts` are Convex-Auth-specific.** `convexAuth({...})` is the entire auth wiring. Migration deletes this file and replaces `auth.config.ts` with a Clerk issuer domain. All consumers of `store`, `signIn`, `signOut`, `isAuthenticated` from the export (e.g., `convex/http.ts:4 auth.addHttpRoutes(http)`) must be updated.

4. **`src/middleware.ts` uses `convexAuthNextjsMiddleware`**. Clerk uses `clerkMiddleware` with a different API for `createRouteMatcher` and `auth.protect()`. The IP rate-limit POST gate (`src/middleware.ts:49–73`) must survive — it calls `fetchMutation(api.authRateLimit.checkIpRateLimit)`, which is library-agnostic. But Clerk's middleware doesn't have a `shouldHandleCode` option — our Google Calendar callback pass-through logic at L98–105 needs a different solution (likely a route matcher excluding `/api/google/callback`).

5. **`@convex-dev/auth/nextjs/server`** exports `isAuthenticatedNextjs`, `convexAuthNextjsToken`, `convexAuthNextjsMiddleware`. Used in 6 route handlers (chat, execute-tool, google connect/callback/disconnect) plus middleware. All imports need replacement with `auth()` from Clerk plus a Convex-token-fetch path (Clerk's `getToken({ template: "convex" })`).

6. **`useAuthActions`** from `@convex-dev/auth/react` is used in 8+ components. Clerk's equivalent is `useClerk().signOut()` (or `useAuth().signOut()` from `@clerk/nextjs`). The `signIn` family (`signIn("password", formData)`, `signIn("google", {redirectTo})`) doesn't have a 1:1 Clerk API — Clerk uses hosted UI or SDK components. This is the **largest UX refactor** in the migration because LoginPageClient/SignupPageClient/ResetPasswordPageClient all have custom forms built around `signIn(...)`.

7. **`authTables` spread in `convex/schema.ts:50`** — `users`, `authSessions`, `authAccounts`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits`. When we remove `@convex-dev/auth`, **only the `users` table (which we've overridden anyway) is meaningfully kept**. The auth-specific tables (`authSessions`, `authAccounts`, etc.) become dead — but `purgeAllUserData` at `convex/lib/deletion.ts:131–165` still queries them for user deletion cascade. Decision: either keep the tables empty but preserve the cascade code, or remove them from schema and strip the cascade.

8. **`authAccounts` is the source of truth for email verification.** `convex/lib/auth.ts:204 isEmailVerified(ctx, userId)` and `:223 getVerifiedUserIds(ctx)` check `authAccounts.provider === "password"` with `emailVerified` set, or `provider === "google"`. With Clerk, email verification is a Clerk-side property (`user.emailAddresses[0].verification.status === "verified"`). We need a replacement that reads Clerk's webhook-synced verification status from a new column on `users` or by re-querying Clerk.

### Severity: high (behavioral contracts)

9. **`LoginTracker.tsx` compensates for a library-specific quirk.** The comment at L6–13 explains `recordMyLogin` must be called client-side because `createOrUpdateUser` doesn't fire for password sign-ins of existing users. With Clerk, this quirk disappears (Clerk has proper session webhooks), but the client-side `recordMyLogin` path still needs to exist for browser-based login counting. Easy to preserve.

10. **`PendingTermsHandler` is a safety net** (`src/components/auth/PendingTermsHandler.tsx`) — if profile creation fails during auth callback, this component catches the `profile === null` state and retries `ensureUserProfile()`. With Clerk webhooks, we'll typically create profiles synchronously on user.created webhook — this component remains useful as fallback.

11. **`users.email` is the sync key for Resend contacts.** `convex/marketingEmail.ts` and `convex/marketingEmailHelpers.ts` use email as the primary contact key. If migration disrupts email continuity (e.g., Clerk using a different email format or normalizing), Resend contacts can get duplicated. Recommend: pre-migration snapshot of emails + post-migration diff to catch drift.

12. **`users.deletedAt` + `userProfiles.deletedAt` cascade via scheduled jobs.** `requestAccountDeletion` (`convex/users.ts:764`) schedules `permanentlyDeleteAccount` 30 days out. The `scheduledDeletionJobId` field on `userProfiles` holds the scheduler reference. Migration must NOT break any of the pending scheduled jobs; `_scheduled_functions` entries persist across deploys.

13. **Inactivity timeout logic is auth-library-agnostic** (`useInactivityTimeout.ts`) — only the sign-out call at `performSignOut` (InactivityTimeoutProvider.tsx:60) is library-coupled. Easy swap to Clerk's `signOut()`.

14. **`AuthContext` `beginSignOut` calls `analytics.reset()`** (`src/lib/contexts/AuthContext.tsx:89`) — important behavior because PostHog needs to detach user identity before sign-out transition. Preserve.

15. **BotID check at `src/app/api/chat/route.ts:87`** — not auth-coupled but gate runs before auth. Keep order in place.

16. **Suspension check pre-signIn** (`src/app/(auth)/login/LoginPageClient.tsx:127–146`) — Convex query `api.abuseDetection.checkEmailSuspension`. This query uses the `(users as any).withIndex("email")` pattern. Still valid post-migration if `users.email` remains indexed.

### Severity: medium (format/compatibility)

17. **`extractUserIdFromAction` / action `identity.subject` shape change** — Clerk `subject` is `user_xxx`, not a Convex `Id`. If we use Clerk's `external_id` to set the Convex `Id<"users">` as the subject, all actions keep working with no code change. If not, actions must do a DB lookup.

18. **`assertConvexId` in `src/app/api/chat/execute-tool/route.ts:67–79`** — explicitly rejects 24-hex-char MongoDB ObjectIds. Clerk user IDs (`user_xxx`) are NOT 24-hex, so they pass. But this validator is never applied to `userId` — only to `caseId` / `notificationId`. No direct impact.

19. **`@auth/core/providers/google`** is imported at `convex/auth.ts:1` (via Convex Auth's Password provider peer). When removing `@convex-dev/auth`, this transitive dep is no longer needed. Clean up `package.json:38 @auth/core ^0.41.1` if nothing else uses it.

20. **`lucia` dependency** (`package.json:83`) — used by `convex/admin.ts:17 import { Scrypt } from "lucia"` for test user creation. Can keep or replace with `@node-rs/argon2`.

21. **`@oslojs/crypto`** (`package.json:48`) — no direct consumer found in our code. Likely transitive. Verify and remove if safe.

22. **`.env.local.example` and `.env.example` have inconsistent var names** — `AUTH_GOOGLE_ID` vs `AUTH_GOOGLE_CLIENT_ID`, `OAUTH_ENCRYPTION_KEY` vs `CALENDAR_TOKEN_ENCRYPTION_KEY`, `AUTH_RESEND_KEY` vs `RESEND_API_KEY`. Migration is a good time to standardize.

23. **`JWT_PRIVATE_KEY` + `JWKS` env vars** (Convex deployment) go away once Convex validates Clerk JWTs. Do not remove them until migration is fully cutover and stale tokens expire.

24. **Google Calendar OAuth is SEPARATE from sign-in OAuth.** See Section 7 — `GOOGLE_CALENDAR_CLIENT_ID`/`SECRET` are a distinct Google Cloud project config. Migration does not touch Calendar. Keep `/api/google/connect,callback,disconnect` routes and their env vars unchanged.

25. **Google OAuth redirect URI registered with Google for sign-in:** currently `<site>/api/auth/callback/google` (Auth.js convention mounted by the library). Clerk uses Clerk-hosted redirect URIs (`https://<your-clerk-frontend-api>/v1/oauth_callback`), so the Google OAuth app needs a new redirect URI registered in Google Cloud Console. The existing one stays for the transition period.

26. **Convex Auth's `authRateLimits` table** (framework-managed) holds live OTP/password attempt counters. Stateful during migration cutover — if we flip to Clerk mid-window, a legitimate user could be left with an invalid framework rate-limit record. Low probability issue; plan to purge after cutover.

### Severity: low (cosmetic / cleanup)

27. **`verifyFirmAccess` and `isFirmAdmin` are dead code.** No production call sites. Good time to remove if desired.

28. **Sentry `setUser`** uses `user._id` string — works with any ID format. No migration concern.

29. **PostHog uses `profile._id` (Id<"userProfiles">)** — format-agnostic.

30. **`onboardingStep`/`onboardingCompletedAt` on profiles** — app-owned, not auth-coupled.

31. **Google Sign-In profile `name` passes through `validateUserName()`** at `convex/auth.ts:69`. With Clerk, name validation happens in Clerk's hosted UI or we do it in our own pre-sign-in flow. Preserve `validateUserName` regardless.

32. **Zero stale Clerk code** in `src/`, `convex/`, or dependencies. Green field.

---

## Appendix A — Files worth reading in full before migration

1. `v2/convex/auth.ts` (172 lines) — entire auth wiring
2. `v2/convex/lib/auth.ts` (235 lines) — helper API
3. `v2/convex/lib/admin.ts` (332 lines) — admin guards + dashboard helper
4. `v2/convex/schema.ts` (984 lines) — schema; lines 44–253 most relevant
5. `v2/src/middleware.ts` (113 lines) — middleware behavior
6. `v2/src/app/(auth)/login/LoginPageClient.tsx` (521 lines) — login form orchestration
7. `v2/src/app/(auth)/signup/SignupPageClient.tsx` (594 lines) — signup form
8. `v2/src/app/(auth)/reset-password/ResetPasswordPageClient.tsx` (407 lines) — reset form
9. `v2/convex/users.ts` (1002 lines) — user lifecycle
10. `v2/convex/lib/deletion.ts` (185 lines) — deletion cascade

---

## Appendix B — Migration ready-state checklist (for tracking)

- [ ] Replace `getAuthUserId` in `convex/lib/auth.ts` to look up Convex `_id` from Clerk `subject`.
- [ ] Replace `extractUserIdFromAction` with Clerk-aware equivalent (5 callers).
- [ ] Delete `convex/auth.ts`; rewrite `convex/auth.config.ts` to point at Clerk issuer.
- [ ] Replace `src/middleware.ts` with `clerkMiddleware`; preserve IP rate-limit gate and Google Calendar callback bypass.
- [ ] Replace `ConvexAuthNextjsServerProvider` (root layout) with `ClerkProvider`.
- [ ] Replace `ConvexAuthNextjsProvider` + `BeforeUnloadSuppressor` in `providers.tsx` with `ConvexProviderWithClerk`.
- [ ] Rewrite `LoginPageClient`, `SignupPageClient`, `ResetPasswordPageClient` to use Clerk SDK.
- [ ] Add Clerk webhook handler (`user.created`, `user.updated`, `user.deleted`, `session.created`) to sync `users` table + trigger `ensureUserProfileInternal`.
- [ ] Replace `useAuthActions` with `useClerk()` (8+ callers).
- [ ] Replace `isAuthenticatedNextjs`/`convexAuthNextjsToken` in 6 API routes.
- [ ] Replace `useConvexAuth` with `useAuth` from `@clerk/nextjs` (2 callers in `LoginTracker`, `PendingTermsHandler`).
- [ ] Decide: keep or drop `authAccounts`/`authSessions`/etc. tables (affects `purgeAllUserData`).
- [ ] Replace `isEmailVerified` / `getVerifiedUserIds` with Clerk-backed implementation.
- [ ] Update `convex/abuseDetection.ts` — email lookup still works if `users.email` index preserved.
- [ ] Register Google OAuth redirect URI on Clerk side; keep old URI until migration completes.
- [ ] Port `users.emailVerificationTime` (deprecated) and `users.phoneVerificationTime` concerns — likely no action, but confirm.
- [ ] Migrate in-flight users: pre-migration snapshot, use Clerk `external_id` to preserve Convex `Id<"users">`.
- [ ] Clean up env vars: remove `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_GOOGLE_*` (after Clerk takes over), stale `.env.example` entries.
- [ ] Remove `@auth/core`, `@convex-dev/auth`, `lucia` (if test-user creation dropped), `@oslojs/crypto` (if transitive).
- [ ] Verify test utility `createAuthenticatedContext` still works: `ctx.withIdentity({subject: userId})` must produce the same behavior in Clerk-backed auth.
- [ ] Update `docs/SECURITY.md:135,138` to reflect MFA availability.
