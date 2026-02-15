---
status: resolved
trigger: "inactivity timeout modal bug - Sign Out click causes modal to briefly disappear then reappear with frozen timer"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - Two compounding bugs caused the frozen timer reappearance.
test: All 29 tests pass (27 existing + 2 new regression tests)
expecting: N/A
next_action: Archive and commit

## Symptoms

expected: Click "Sign out" on inactivity modal -> immediately signs out and redirects to login. Cancel/Stay -> dismisses modal and resets timer. Timer expires -> auto signs out.
actual: Click "Sign out" -> modal briefly disappears, then reappears with a frozen timer. Need to click "Sign out" a second time.
errors: No specific error messages reported.
reproduction: Wait for inactivity timeout modal to appear, click "Sign out".
started: Recent changes involved interaction between inactivity timeout and unsaved-changes dialogs on case forms.

## Eliminated

- hypothesis: Race condition between click handler and auto-logout timer firing simultaneously
  evidence: Activity handler checks isWarningVisibleRef and skips reset when warning is showing. Auto-logout timer is cleared by effect cleanup when enabled changes. Timing collision is unlikely and doesn't match "consistent" repro.
  timestamp: 2026-02-15T00:00:30Z

- hypothesis: beforeunload from useUnsavedChanges blocking window.location.href navigation
  evidence: useUnsavedChanges respects `disabled: isSigningOut` prop. disabledRef is updated via effect which runs before signOut() resolves. beforeunload handler checks disabledRef at fire time. Unlikely to block.
  timestamp: 2026-02-15T00:00:35Z

- hypothesis: Convex auth state change causing component tree remount/unmount
  evidence: ConvexProviderWithAuth doesn't unmount children on auth change. AuthProvider state persists. No error boundary would reset modal state.
  timestamp: 2026-02-15T00:00:40Z

## Evidence

- timestamp: 2026-02-15T00:00:10Z
  checked: Convex signOut() implementation in node_modules/@convex-dev/auth/src/react/client.tsx
  found: signOut() catches server call errors but does NOT catch errors from setToken() -> onChange() -> invalidateCache(). invalidateCache() is a Next.js server action that can throw on network failure.
  implication: If signOut() throws (e.g. after tab backgrounded / network issues), performSignOut's catch block calls cancelSignOut(), resetting isSigningOut to false.

- timestamp: 2026-02-15T00:00:20Z
  checked: useInactivityTimeout hook state management when enabled toggles false then true
  found: When enabled goes true->false, effect cleanup clears timers but does NOT reset isWarningVisible or remainingSeconds state. When enabled goes false->true, effect re-runs and calls startTimers() which sets fresh 13-min/15-min timers but does NOT reset isWarningVisible.
  implication: isWarningVisible remains true from before. Modal immediately reappears when isSigningOut goes back to false. Countdown interval was cleared so remainingSeconds is frozen.

- timestamp: 2026-02-15T00:00:25Z
  checked: performSignOut error handling flow in InactivityTimeoutProvider.tsx
  found: On error: cancelSignOut() -> isSigningOut=false -> enabled goes back to true -> useInactivityTimeout re-initializes but isWarningVisible=true persists -> modal reappears with frozen timer. Second click works because signOut() succeeds (token already partially cleared or network recovered).
  implication: This is the exact bug flow described by user.

## Resolution

root_cause: TWO compounding bugs:
  1. PRIMARY (trigger): Convex's signOut() can throw when the invalidateCache() server action fails (common after tab backgrounded / network hiccup during inactivity period). This causes performSignOut's catch block to call cancelSignOut(), which resets isSigningOut to false.
  2. SECONDARY (state leak): useInactivityTimeout hook does NOT reset isWarningVisible state when enabled toggles false->true. So when isSigningOut returns to false, the modal immediately reappears with stale isWarningVisible=true and frozen remainingSeconds (countdown interval was cleared).

fix:
  1. InactivityTimeoutProvider.tsx: Made inactivity sign-out "best-effort" — signOut() errors are caught and logged but ALWAYS followed by window.location.href = "/login". Removed cancelSignOut() and toast.error() from error path. Removed unused toast import and cancelSignOut destructuring.
  2. useInactivityTimeout.ts: Added state reset (isWarningVisible=false, remainingSeconds=120) when enabled goes to false. This prevents stale modal state from persisting if the hook is ever re-enabled.
  3. Updated test to verify best-effort redirect behavior. Added 2 new regression tests for the enabled toggle state reset.

verification: All 29 tests pass (27 existing + 2 new). Verified through code tracing that all three flows work correctly:
  - Sign out click: beginSignOut -> try signOut -> redirect (always)
  - Cancel/Stay: extendSession -> resetTimeout -> fresh timers
  - Timer expires: setIsWarningVisible(false) -> onTimeoutRef.current() -> performSignOut -> redirect

files_changed:
  - src/components/layout/InactivityTimeoutProvider.tsx
  - src/lib/hooks/useInactivityTimeout.ts
  - src/components/layout/__tests__/InactivityTimeoutProvider.test.tsx
  - src/lib/hooks/__tests__/useInactivityTimeout.test.ts
