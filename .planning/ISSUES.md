# Deferred Issues

Issues logged during execution for future consideration.

---

## ISS-001: Add stage/urgency colors to @theme inline mapping

**Logged:** 2025-12-22 | **Phase:** 17 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-22)

**Issue:** Stage colors (`--stage-pwd`, `--stage-recruitment`, etc.) and urgency colors are defined as CSS variables but not mapped in the `@theme inline` block. This means they're not available as Tailwind utilities like `bg-stage-pwd`.

**Current state:** Only accessible via `var(--stage-pwd)` inline styles.

**Suggested fix:** Add to `@theme inline` in globals.css:
```css
--color-stage-pwd: var(--stage-pwd);
--color-stage-recruitment: var(--stage-recruitment);
--color-stage-eta9089: var(--stage-eta9089);
--color-stage-eta9089-working: var(--stage-eta9089-working);
--color-stage-i140: var(--stage-i140);
--color-stage-closed: var(--stage-closed);
--color-urgency-urgent: var(--urgency-urgent);
--color-urgency-soon: var(--urgency-soon);
--color-urgency-normal: var(--urgency-normal);
```

**When to address:** Phase 17 Plan 02 or later when components need these utilities.

---

## ISS-002: Add grain overlay texture effect

**Logged:** 2025-12-22 | **Phase:** 17 | **Task:** Design Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-22)

**Issue:** Design inspirations (design2, design4, design5) include a subtle grain/noise texture overlay that adds visual depth and character to the neobrutalist aesthetic.

**Resolution:** Implemented `.grain-overlay` utility class in `globals.css` and applied to root layout (`layout.tsx`). Storybook story at UI/Utilities/GrainOverlay.

---

## ISS-003: Build skeleton/loading state components

**Logged:** 2025-12-22 | **Phase:** 17 | **Task:** Design Review
**Priority:** Medium | **Status:** ✅ Resolved (2025-12-22)

**Issue:** Design inspirations show skeleton loading states with shimmer animations that match the neobrutalist style.

**Resolution:** Created `Skeleton` component in `v2/src/components/ui/skeleton.tsx` with variants:
- Base skeleton with shimmer animation
- Line variant for text
- Block variant for rectangles
- Circle variant for avatars

Storybook story at UI/Skeleton. Component documented in DESIGN_SYSTEM.md.

---

## ISS-004: Extract shared generateRandomString helper

**Logged:** 2025-12-23 | **Phase:** 18 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-23)

**Issue:** The `generateRandomString` function is duplicated in both `ResendOTP.ts` and `ResendPasswordReset.ts`. This creates maintenance overhead.

**Resolution:** Created shared utility file at `v2/convex/lib/crypto.ts` with proper JSDoc comments. Updated both OTP provider files to import from the shared location. TypeScript compilation verified successfully.

---

## ISS-005: Add error handling for Resend API calls

**Logged:** 2025-12-23 | **Phase:** 18 | **Task:** Code Review
**Priority:** Medium | **Status:** ✅ Resolved (2025-12-23)

**Issue:** The `sendVerificationRequest` functions in OTP providers don't handle potential Resend API failures. If the email fails to send, users won't know why verification isn't working.

**Resolution:** Added error handling to both `ResendOTP.ts` and `ResendPasswordReset.ts`:
```typescript
const { error } = await resend.emails.send({...});
if (error) {
  throw new Error(`Failed to send email: ${error.message}`);
}
```

**Files modified:**
- `./v2/convex/ResendOTP.ts`
- `./v2/convex/ResendPasswordReset.ts`

**Verification:** Build passes successfully with `npm run build`.

---

## ISS-006: Verify auth.config.ts usage

**Logged:** 2025-12-23 | **Phase:** 18 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-23)

**Issue:** The `auth.config.ts` file exports an empty providers array. According to Convex Auth patterns, this file should export the site URL configuration. Verify if this file is actually needed.

**Resolution:** Fixed `auth.config.ts` to match the official Convex Auth example repository pattern. The file now properly exports the SITE_URL configuration:

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

Also set the `SITE_URL` environment variable in Convex:
```bash
npx convex env set SITE_URL http://localhost:3000
```

**Files modified:**
- `./v2/convex/auth.config.ts`

**Verification:** Build passes successfully with `npm run build`.

---

## ISS-007: Add `documents` field to cases table

**Logged:** 2025-12-23 | **Phase:** 19 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-23)

**Issue:** The V2_CONVEX_SCHEMA.md specification includes a `documents` field for the cases table for storing document attachments, but it was not included in the 19-01 core schema implementation.

**Resolution:** Added structured `documents` field to cases table in `schema.ts`:
```typescript
documents: v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    url: v.string(), // Convex file storage URL
    mimeType: v.string(),
    size: v.int64(), // File size in bytes
    uploadedAt: v.number(),
  })
),
```

**Files modified:**
- `./v2/convex/schema.ts`

---

## ISS-008: Handle orphaned dismissedDeadlines on case deletion

**Logged:** 2025-12-23 | **Phase:** 19 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-23)

**Issue:** The `dismissedDeadlines` array in userProfiles uses `v.id("cases")` which creates a hard dependency. If a case is deleted, the dismissed deadline entries will have orphaned references.

**Resolution:** Created helper functions in `convex/lib/userProfileHelpers.ts`:
- `cleanDismissedDeadlinesForCase()` - Remove entries for a single deleted case
- `cleanDismissedDeadlinesForCases()` - Bulk cleanup for multiple cases
- `isOrphanedDismissedDeadline()` - Check if an entry is orphaned
- `removeOrphanedDismissedDeadlines()` - Data maintenance cleanup

These helpers are ready to be called from case deletion mutations in Phase 21.

**Files created:**
- `./v2/convex/lib/userProfileHelpers.ts`

---

## ISS-009: Add index on cases `updatedAt` for sorting

**Logged:** 2025-12-23 | **Phase:** 19 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-23)

**Issue:** The default UI sorting is by `updatedAt` (via `casesSortBy: "updatedAt"` default) but there's no index supporting this query pattern. Queries will work but may be slower at scale.

**Resolution:** Added compound index to cases table in `schema.ts`:
```typescript
.index("by_user_and_updated_at", ["userId", "updatedAt"])
```

**Files modified:**
- `./v2/convex/schema.ts`

---

## ISS-010: CaseFilterBar debounce may use stale filters

**Logged:** 2025-12-25 | **Phase:** 21 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** In CaseFilterBar.tsx, the useEffect for debounced search uses `filters` inside the callback but doesn't include it in the dependency array. This creates a stale closure risk if filters change during the debounce window.

**Resolution:** Fixed using React ref pattern. CaseFilterBar.tsx lines 106-154 now use `filtersRef` and `onFiltersChangeRef` to avoid stale closures. The refs update on every render, and the debounce effect reads from refs instead of capturing stale values.

**Files modified:**
- `v2/src/components/cases/CaseFilterBar.tsx`

---

## ISS-011: CaseFilterBar activeTab not synced with URL on mount

**Logged:** 2025-12-25 | **Phase:** 21 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** The `activeTab` state in CaseFilterBar starts at "active" regardless of URL params. If a user navigates directly to `?status=closed`, the tab visual won't match.

**Resolution:**
1. Added `deriveTabFromFilters` helper function outside the component
2. Changed useState to use lazy initializer: `useState(() => deriveTabFromFilters(filters))`
3. Tab now correctly matches URL params on initial render (no flash)

**Files modified:**
- `v2/src/components/cases/CaseFilterBar.tsx`

---

## ISS-012: Notification pagination cursor uses timestamp (collision risk)

**Logged:** 2025-12-31 | **Phase:** 24 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** The `getNotifications` query uses `createdAt` timestamp as cursor via `parseInt`. If two notifications have the same `createdAt`, pagination could skip items or loop infinitely.

**Resolution:**
1. Changed cursor format to compound `"timestamp|_id"` for guaranteed uniqueness
2. Updated filter logic: `createdAt < cursorTime || (createdAt === cursorTime && _id < cursorId)`
3. Added backward compatibility fallback for legacy timestamp-only cursors

**Files modified:**
- `v2/convex/notifications.ts`

---

## ISS-013: Notification batch operations could exceed transaction limits

**Logged:** 2025-12-31 | **Phase:** 24 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** `markAllAsRead` and `deleteAllRead` mutations process all matching notifications in a single transaction without batching. For users with many notifications, this could exceed Convex's transaction limits.

**Resolution:** Added batching with `BATCH_SIZE = 100` to all three mutations:
- `markAllAsRead` - Now returns `{ count, hasMore }` and processes in batches
- `deleteAllRead` - Now returns `{ count, hasMore }` and processes in batches
- `cleanupCaseNotifications` - Now returns `{ count, hasMore }` and processes in batches

Clients can retry while `hasMore` is true to process all notifications.

**Files modified:**
- `v2/convex/notifications.ts`

---

## ISS-014: Test data uses `as any` casts for userId

**Logged:** 2025-12-31 | **Phase:** 24 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** Tests cast `userId` as `any` when inserting notifications because `createAuthenticatedContext` returns a string but schema expects `Id<"users">`.

**Resolution:**
1. Modified `createAuthenticatedContext` to return `{ ctx, userId }` with properly-typed `Id<"users">`
2. Used Proxy pattern for backward compatibility (existing tests continue to work)
3. Updated `notifications.test.ts` to use new pattern: `const { ctx: user, userId } = await createAuthenticatedContext(t)`
4. Removed all 23 `as any` casts from notifications tests

**Files modified:**
- `v2/test-utils/convex.ts` - Added AuthenticatedContext interface and Proxy return
- `v2/test-utils/index.ts` - Exported AuthenticatedContext type
- `v2/convex/notifications.test.ts` - Removed all `as any` casts

---

## ISS-015: Extract `formatStatus` helper to avoid duplication

**Logged:** 2025-12-31 | **Phase:** 24-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** The `formatStatus` helper function is duplicated identically in two locations within `cases.ts`. This violates DRY principles and increases maintenance burden.

**Resolution:**
1. Exported `formatCaseStatus` from `notificationHelpers.ts`
2. Added import to `cases.ts`
3. Removed both inline `formatStatus` definitions
4. Replaced all calls with `formatCaseStatus`

**Files modified:**
- `v2/convex/lib/notificationHelpers.ts` - Exported `formatCaseStatus`
- `v2/convex/cases.ts` - Imported and used centralized function

---

## ISS-016: Extract `buildUserNotificationPrefs` helper

**Logged:** 2025-12-31 | **Phase:** 24-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** The same preference object construction pattern appears 4 times across `cases.ts` (3x) and `deadlineEnforcement.ts` (1x) when calling `shouldSendEmail`.

**Resolution:**
1. Added `buildUserNotificationPrefs` helper to `notificationHelpers.ts`
2. Replaced all 4 occurrences with the helper function call
3. Code now uses `buildUserNotificationPrefs(userProfile)` instead of inline object

**Files modified:**
- `v2/convex/lib/notificationHelpers.ts` - Added `buildUserNotificationPrefs` export
- `v2/convex/cases.ts` - Replaced 3 occurrences
- `v2/convex/deadlineEnforcement.ts` - Replaced 1 occurrence

---

## ISS-017: Type assertion in `formatDeadlineType` call

**Logged:** 2025-12-31 | **Phase:** 24-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** In `deadlineEnforcement.ts` (line ~193), the `violation.type` is cast with `as Parameters<typeof formatDeadlineType>[0]` which bypasses TypeScript's type checking.

**Resolution:**
1. Added type-safe `violationTypeToDeadlineType()` mapping function
2. Explicit mapping from `ViolationType` to `DeadlineNotificationType`:
   - `pwd_expired` → `pwd_expiration`
   - `recruitment_window_missed` → `recruitment_window`
   - `filing_window_missed` → `filing_window_opens`
   - `eta9089_expired` → `eta9089_expiration`
3. Replaced unsafe cast with type-safe function call

**Files modified:**
- `v2/convex/deadlineEnforcement.ts` - Added mapping function, imported types

---

## ISS-018: VAPID configuration at module level without error handling

**Logged:** 2025-12-31 | **Phase:** 24-05 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2025-12-31)

**Issue:** In `pushNotifications.ts`, VAPID keys are configured at module load time. If environment variables are missing initially but added later, the module won't pick them up without redeployment. Additionally, if keys are misconfigured, `webpush.setVapidDetails()` could throw at module init time.

**Resolution:**
1. Replaced module-level configuration with `ensureVapidConfigured()` lazy initializer
2. Added try-catch around `setVapidDetails()` call
3. Caches configuration state (`vapidConfigured`) and errors (`vapidConfigError`)
4. Updated `sendPushNotification` to call `ensureVapidConfigured()` and return detailed error info

**Files modified:**
- `v2/convex/pushNotifications.ts`

---

## ISS-019: Use Next.js Image Component for Profile Photos

**Logged:** 2025-12-31 | **Phase:** 25-01 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** ProfileSection uses native `<img>` tag for profile photos instead of `next/image` component.

**Resolution:** Already implemented. ProfileSection.tsx already uses `next/image` with proper attributes:
- `<Image>` component imported from `next/image`
- Width/height: 80x80
- `unoptimized` prop for third-party Google profile photos
- Proper alt text fallback

No changes needed - issue was resolved in Phase 25 implementation.

---

## ISS-020: Add Keyboard Navigation to Settings Tabs

**Logged:** 2025-12-31 | **Phase:** 25-01 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** SettingsLayout has proper ARIA attributes but missing arrow key navigation between tabs as per WAI-ARIA Authoring Practices.

**Resolution:** Implemented full WAI-ARIA keyboard navigation:
- Added `useTabKeyboardNavigation` hook for reusable keyboard handling
- Desktop sidebar: ArrowUp/ArrowDown to move between tabs
- Mobile tabs: ArrowLeft/ArrowRight to move between tabs
- Home key: Jump to first tab
- End key: Jump to last tab
- Roving tabindex: Only active tab is in tab order (tabIndex=0, others=-1)
- Focus management: Focus moves with selection using requestAnimationFrame

**Files modified:**
- `v2/src/components/settings/SettingsLayout.tsx`

---

## ISS-021: Document Tab Styling Decision (Uppercase vs Normal Case)

**Logged:** 2025-12-31 | **Phase:** 25-01 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** NotificationTabs uses uppercase tracking-wide for labels, SettingsLayout uses normal case. This is intentional (icons alongside text in SettingsLayout), but should be documented.

**Resolution:** Added documentation to DESIGN_SYSTEM.md explaining the two tab styling patterns:
- **Text-only tabs** (NotificationTabs): Use `uppercase tracking-wide` for short labels without icons
- **Icon + text tabs** (SettingsLayout): Use normal case for longer labels with icons

Rationale documented: Uppercase improves scanability for text-only tabs, but combined with icons creates visual heaviness.

**Files modified:**
- `v2/docs/DESIGN_SYSTEM.md` - Added "ISS-021 Resolution - Tab Styling Decision" section

---

## ISS-022: Add test coverage for calendar sync hooks

**Logged:** 2026-01-01 | **Phase:** 25.1-03 | **Task:** Code Review
**Priority:** Medium | **Status:** ✅ Resolved (2026-01-03)

**Issue:** The new calendar sync integration in `cases.ts` has no corresponding test coverage. While the mutations themselves are tested, the calendar sync scheduling paths are not.

**Resolution:** Added comprehensive test section "Calendar Sync Integration" in `v2/convex/cases.test.ts` with 13 tests covering:
- Case create with calendarSyncEnabled (scheduling sync on create)
- Case create with calendarSyncEnabled=false (no sync scheduled)
- Case create error handling (sync failure doesn't block case creation)
- Case update with deadline-relevant field changes
- Case update with non-deadline field changes (no sync)
- Case update with case-level sync disabled (no sync)
- Case remove (calendar event deletion scheduled)
- Case restore with sync enabled (sync scheduled)
- Case restore with sync disabled (no sync)
- Toggle calendar sync ON (sync scheduled)
- Toggle calendar sync OFF (delete events scheduled)
- Bulk enable calendar sync for multiple cases
- Bulk disable calendar sync for multiple cases

Created `createUserWithGoogleConnected` test helper to set up user profiles with Google Calendar connected for eligibility checks.

**Files modified:**
- `v2/convex/cases.test.ts` (lines 1084-1491)

**Tests verified:** All 13 tests pass.

---

## ISS-023: Consider calendar sync for bulkUpdateStatus mutation

**Logged:** 2026-01-01 | **Phase:** 25.1-03 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** The `scheduleCalendarSyncBulk` helper in `calendarSyncHelpers.ts` is defined but not used. The `bulkUpdateStatus` mutation doesn't trigger calendar sync, but bulk status changes likely affect calendar events if they change `caseStatus` or `progressStatus`.

**Resolution:** Implemented option 1 - added calendar sync to `bulkUpdateStatus` mutation using `scheduleCalendarSyncBulk`. Changes:
- Track successful case IDs during bulk status update loop
- After the loop completes, schedule bulk calendar sync for all successfully updated cases
- Calendar sync is best-effort, non-blocking (errors logged but don't fail the operation)

Also fixed related TypeScript errors:
- Added missing `emailWeeklyDigest` field in `calendar.ts` userProfile creation
- Added bounds check and null safety to keyboard navigation in `SettingsLayout.tsx`

**Files modified:**
- `v2/convex/cases.ts` (lines 1096, 1201, 1208-1220)
- `v2/convex/calendar.ts` (line 232)
- `v2/src/components/settings/SettingsLayout.tsx` (lines 116-125)

---

## ISS-024: Add rate limiting protection for bulk calendar sync

**Logged:** 2026-01-01 | **Phase:** 25.1-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** The `syncAllCases` action iterates through all cases sequentially without throttling. For users with many cases (50+), this could trigger Google Calendar API rate limits (429 errors).

**Resolution:** Added 100ms delay between case syncs in `syncAllCases` action. This allows ~10 cases/second throughput, well under Google Calendar API limits while still completing bulk syncs in reasonable time (50 cases = 5 seconds).

**Files modified:**
- `v2/convex/googleCalendarActions.ts` (lines 953-956)

---

## ISS-025: Disconnect should revoke Google OAuth token

**Logged:** 2026-01-01 | **Phase:** 25.1-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** The disconnect handler clears tokens from Convex but doesn't revoke the token with Google. Users would still see the app in their Google permissions until token expires.

**Resolution:** Implemented `disconnectWithRevocation` action in `googleAuth.ts` that:
1. Gets the encrypted access token via `getTokenForRevocation` internal query
2. Decrypts the token using the existing crypto helper
3. Revokes the token with Google's OAuth endpoint (`https://oauth2.googleapis.com/revoke`)
4. Clears tokens from Convex via `clearGoogleTokensInternal`

Updated `/api/google/disconnect` route to use `fetchAction` with the new action. Token revocation is best-effort - we still clear tokens even if revocation fails (e.g., token already expired).

**Files modified:**
- `v2/convex/googleAuth.ts` - Added `getTokenForRevocation` and `disconnectWithRevocation`
- `v2/src/app/api/google/disconnect/route.ts` - Changed from `fetchMutation` to `fetchAction`

---

## ISS-026: Improve sync progress UX for long-running operations

**Logged:** 2026-01-01 | **Phase:** 25.1-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** The "Sync All" operation shows a spinner but doesn't provide real-time progress for long-running syncs. Users with 50+ cases may not know if the operation is progressing.

**Resolution:** Improved the sync progress UX with:
1. Added `getSyncEligibleCaseCount` public query to show case count before syncing
2. Shows "X cases ready to sync" when idle
3. During sync: "Syncing X cases to calendar..." with animated progress bar
4. Elapsed time counter showing "Xs elapsed"
5. Contextual message ("This may take a minute..." for larger syncs)
6. Progress bar fills based on estimated time (~150ms per case)

This provides visual feedback without requiring complex real-time progress tracking infrastructure.

**Files modified:**
- `v2/convex/cases.ts` - Added `getSyncEligibleCaseCount` query
- `v2/src/components/settings/CalendarSyncSection.tsx` - Enhanced sync progress UI

---

## ISS-027: Consider consistent button placement in SelectionBar

**Logged:** 2026-01-01 | **Phase:** 25.1-04 | **Task:** Code Review
**Priority:** Low | **Status:** ✅ Resolved (2026-01-03)

**Issue:** The mobile layout places calendar sync buttons in a separate row at the bottom, while desktop has them inline. This is intentional for space constraints but creates slightly inconsistent mental models.

**Resolution:** Reorganized mobile layout and documented the responsive pattern:
1. Row 1: Export actions (CSV, JSON)
2. Row 2: Case management (Archive, Delete) + Calendar sync (when connected) - now grouped together
3. Row 3: Recovery actions (Re-open - conditional, when closed cases selected)

Updated component documentation with detailed responsive layout section explaining the grouping rationale.

**Files modified:**
- `v2/src/components/cases/SelectionBar.tsx` - Reorganized mobile layout, added documentation

---
