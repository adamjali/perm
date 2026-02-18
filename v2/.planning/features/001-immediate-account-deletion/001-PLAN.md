---
phase: feature-001
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - convex/users.ts
  - convex/users.test.ts
  - convex/notificationActions.ts
  - src/emails/AccountDeletionConfirm.tsx
  - src/components/settings/DeleteNowDialog.tsx
  - src/components/settings/__tests__/DeleteNowDialog.test.tsx
  - src/components/settings/SupportSection.tsx
  - src/components/settings/__tests__/SupportSection.test.tsx
  - src/components/layout/DeletionBanner.tsx
  - src/components/layout/__tests__/DeletionBanner.test.tsx
  - src/app/(authenticated)/layout.tsx

must_haves:
  truths:
    - "User with scheduled deletion sees a 'Delete Now' button in SupportSection"
    - "Clicking 'Delete Now' opens a dialog requiring typed 'DELETE' + checkbox confirmation"
    - "Confirming immediate deletion sends confirmation email then permanently deletes account"
    - "User with scheduled deletion sees a persistent warning banner on all authenticated pages"
    - "Banner is dismissible per session via sessionStorage but reappears on next login"
    - "Banner links to /settings"
    - "Immediate deletion rejects if no scheduled deletion exists"
  artifacts:
    - path: "convex/users.ts"
      provides: "immediateAccountDeletion mutation"
      contains: "immediateAccountDeletion"
    - path: "convex/notificationActions.ts"
      provides: "sendImmediateDeletionEmail action"
      contains: "sendImmediateDeletionEmail"
    - path: "src/emails/AccountDeletionConfirm.tsx"
      provides: "immediate prop for email template"
      contains: "immediate"
    - path: "src/components/settings/DeleteNowDialog.tsx"
      provides: "Delete Now confirmation dialog"
      contains: "DeleteNowDialog"
    - path: "src/components/layout/DeletionBanner.tsx"
      provides: "Persistent deletion warning banner"
      contains: "DeletionBanner"
  key_links:
    - from: "src/components/settings/SupportSection.tsx"
      to: "src/components/settings/DeleteNowDialog.tsx"
      via: "import and render when isDeletionScheduled"
      pattern: "DeleteNowDialog"
    - from: "src/components/settings/DeleteNowDialog.tsx"
      to: "api.users.immediateAccountDeletion"
      via: "useMutation call on confirm"
      pattern: "immediateAccountDeletion"
    - from: "convex/users.ts (immediateAccountDeletion)"
      to: "convex/scheduledJobs.ts (permanentlyDeleteAccount)"
      via: "ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount)"
      pattern: "internal\\.scheduledJobs\\.permanentlyDeleteAccount"
    - from: "src/app/(authenticated)/layout.tsx"
      to: "src/components/layout/DeletionBanner.tsx"
      via: "import and render after Header"
      pattern: "DeletionBanner"
---

<objective>
Add immediate account deletion capability and persistent deletion warning banner.

Purpose: Users who have already scheduled account deletion should be able to delete immediately instead of waiting 30 days. All authenticated pages should remind users with pending deletions via a dismissible banner.

Output: Working "Delete Now" flow (backend mutation + confirmation dialog) and app-wide DeletionBanner component.
</objective>

<execution_context>
:execute-plan
:summary-template
</execution_context>

<context>
@v2/CLAUDE.md
@v2/convex/users.ts (lines 686-810 — requestAccountDeletion + cancelAccountDeletion mutations)
@v2/convex/scheduledJobs.ts (lines 946-1019 — permanentlyDeleteAccount internal mutation)
@v2/convex/notificationActions.ts (lines 394-436 — sendAccountDeletionEmail action)
@v2/src/emails/AccountDeletionConfirm.tsx (full file — email template)
@v2/src/components/settings/SupportSection.tsx (full file — current deletion UI)
@v2/src/app/(authenticated)/layout.tsx (full file — authenticated layout)
@v2/convex/users.test.ts (lines 250-427 — account deletion tests)
@v2/src/components/settings/__tests__/SupportSection.test.tsx (full file — SupportSection tests)
@v2/src/components/ui/checkbox.tsx (Radix Checkbox component)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — immediateAccountDeletion mutation + email + tests</name>
  <files>
    convex/users.ts
    convex/users.test.ts
    convex/notificationActions.ts
    src/emails/AccountDeletionConfirm.tsx
  </files>
  <action>
**1a. Update email template** (`src/emails/AccountDeletionConfirm.tsx`):

Add optional `immediate?: boolean` prop to `AccountDeletionConfirmProps` interface. When `immediate` is true:
- Change banner text from "Account Deletion Scheduled" to "Account Deleted"
- Change header title from "Account Deletion Request" to "Account Deleted"
- Change header subtitle to "Your account has been permanently deleted"
- Replace the greeting paragraph with: "Your PERM Tracker account and all associated data have been permanently deleted as requested."
- Remove the "What happens next" list items
- Remove the "Cancel CTA" section entirely (no cancel URL when immediate)
- Keep the support section but change text to: "If you didn't request this deletion, please contact support immediately."
- Change previewText to: "Your PERM Tracker account has been permanently deleted"
- Keep all existing non-immediate behavior unchanged (backwards compatible)

**1b. Add sendImmediateDeletionEmail action** (`convex/notificationActions.ts`):

Add after `sendAccountDeletionEmail` (after line ~436). Pattern matches existing action:

```typescript
export const sendImmediateDeletionEmail = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
  },
  handler: async (_ctx, args) => {
    const appUrl = getAppUrl();
    const supportUrl = "mailto:support@permtracker.app";

    const { AccountDeletionConfirm } = await import(
      "../src/emails/AccountDeletionConfirm"
    );

    const html = await render(
      AccountDeletionConfirm({
        userName: args.userName,
        deletionDate: new Date().toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        }),
        cancelUrl: appUrl, // Not used when immediate=true, but required by type
        supportUrl,
        immediate: true,
      })
    );

    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.to],
      subject: "Account Deleted - PERM Tracker",
      html,
    });

    if (error) {
      log.error('Failed to send immediate deletion confirmation email', { error: error.message, to: args.to });
      throw new Error(`Email failed: ${error.message}`);
    }

    log.info('Immediate deletion confirmation email sent', { to: args.to });
  },
});
```

Also add `internalAction` to the imports from `./_generated/server` if not already present (it likely is — check first).

**1c. Add immediateAccountDeletion mutation** (`convex/users.ts`):

Insert after `cancelAccountDeletion` (after line ~810). Follow the exact patterns from `requestAccountDeletion` and `cancelAccountDeletion`:

```typescript
/**
 * Immediately delete a user's account.
 *
 * This bypasses the 30-day grace period for users who have already
 * scheduled deletion. Sends a confirmation email, then permanently
 * deletes all user data by calling permanentlyDeleteAccount.
 *
 * Precondition: User must have an active scheduled deletion (deletedAt set and in future).
 *
 * @returns Object with success status
 */
export const immediateAccountDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Verify deletion was actually scheduled
    if (!profile.deletedAt) {
      throw new Error("No deletion scheduled for this account");
    }

    // Verify we're still within the grace period (deletedAt in future)
    if (profile.deletedAt < Date.now()) {
      throw new Error("Grace period has expired. Account is being deleted automatically.");
    }

    // Cancel the existing scheduled deletion job (we're doing it now)
    if (profile.scheduledDeletionJobId) {
      await ctx.scheduler.cancel(profile.scheduledDeletionJobId);
    }

    // Get user email to send confirmation BEFORE deletion
    const user = await ctx.db.get(userId as Id<"users">);
    if (user?.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.notificationActions.sendImmediateDeletionEmail,
        {
          to: user.email,
          userName: profile.fullName || user.name || user.email,
        }
      );
    }

    // Set deletedAt to past so permanentlyDeleteAccount guard passes
    await ctx.db.patch(userId as Id<"users">, {
      deletedAt: Date.now() - 1000,
    });
    await ctx.db.patch(profile._id, {
      deletedAt: Date.now() - 1000,
      scheduledDeletionJobId: undefined,
      updatedAt: Date.now(),
    });

    // Call the existing permanent deletion logic
    await ctx.runMutation(internal.scheduledJobs.permanentlyDeleteAccount, {
      userId: userId as Id<"users">,
    });

    return { success: true, message: "Account permanently deleted" };
  },
});
```

**1d. Add backend tests** (`convex/users.test.ts`):

Add a new `describe("immediateAccountDeletion", ...)` block inside the existing `describe("Account Deletion", ...)` block (after the `cancelAccountDeletion` describe at line ~426). Follow the exact same test patterns using `createTestContext`, `createAuthenticatedContext`, `setupSchedulerTests`, `finishScheduledFunctions`:

Tests to write:
1. `"deletes account immediately when deletion is scheduled"` — request deletion, then immediate delete, verify user profile is gone (query returns null)
2. `"rejects if no deletion is scheduled"` — create profile without scheduling deletion, call immediateAccountDeletion, expect throw "No deletion scheduled"
3. `"rejects unauthenticated users"` — call without auth context, expect throw
4. `"throws error if profile does not exist"` — auth user without profile, expect throw "User profile not found"
5. `"cancels scheduled deletion job before deleting"` — request deletion, immediate delete, verify the scheduled job doesn't also run (account is already gone)
6. `"returns success message"` — verify return value has `{ success: true, message: "Account permanently deleted" }`
  </action>
  <verify>
Run: `cd ./v2 && pnpm vitest run convex/users.test.ts --reporter=verbose`

All existing account deletion tests still pass. All 6 new immediateAccountDeletion tests pass.

Also verify TypeScript compiles: `cd ./v2 && npx tsc --noEmit --project tsconfig.json 2>&1 | head -20` (no errors in modified files).
  </verify>
  <done>
- `immediateAccountDeletion` mutation exists in `convex/users.ts`, exported and callable via `api.users.immediateAccountDeletion`
- Mutation validates scheduled deletion exists, cancels scheduled job, sets deletedAt to past, sends email, calls permanentlyDeleteAccount
- `sendImmediateDeletionEmail` action exists in `convex/notificationActions.ts` using `immediate: true` on email template
- Email template renders different copy when `immediate` prop is true (no cancel CTA, "Account Deleted" subject)
- All 6 new tests pass, all existing tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend — DeleteNowDialog + DeletionBanner + integration</name>
  <files>
    src/components/settings/DeleteNowDialog.tsx
    src/components/settings/__tests__/DeleteNowDialog.test.tsx
    src/components/settings/SupportSection.tsx
    src/components/settings/__tests__/SupportSection.test.tsx
    src/components/layout/DeletionBanner.tsx
    src/components/layout/__tests__/DeletionBanner.test.tsx
    src/app/(authenticated)/layout.tsx
  </files>
  <action>
**2a. Create DeleteNowDialog** (`src/components/settings/DeleteNowDialog.tsx`):

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

const DELETE_CONFIRMATION_TEXT = "DELETE";

export interface DeleteNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteNowDialog({ open, onOpenChange }: DeleteNowDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const immediateDelete = useMutation(api.users.immediateAccountDeletion);
  const { signOut } = useAuthActions();
  const { beginSignOut, cancelSignOut } = useAuthContext();
  const router = useRouter();

  const isConfirmed = confirmation === DELETE_CONFIRMATION_TEXT && acknowledged;

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      beginSignOut();
      await immediateDelete({});
      toast.success("Your account has been permanently deleted.");
      try {
        await signOut();
      } catch {
        // Sign out may fail since account is deleted — that's expected
      }
      router.push("/login");
    } catch (error) {
      cancelSignOut();
      console.error("Failed to delete account immediately:", error);
      const message = error instanceof Error ? error.message : "Failed to delete account";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setConfirmation("");
      setAcknowledged(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Zap className="w-5 h-5" />
            Delete Account Now
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-muted-foreground text-sm space-y-3 pt-2">
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-destructive font-medium text-sm">
                  This will permanently delete your account and all data RIGHT NOW.
                  This cannot be undone.
                </p>
              </div>
              <p>The following will be permanently deleted immediately:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>All your PERM cases and related data</li>
                <li>Notification preferences and history</li>
                <li>Calendar sync settings</li>
                <li>Your user profile</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Checkbox acknowledgment */}
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              aria-label="I understand this is immediate and irreversible"
            />
            <span className="text-sm text-muted-foreground leading-tight">
              I understand this is immediate and irreversible
            </span>
          </label>

          {/* Text confirmation */}
          <div>
            <p className="text-sm font-medium mb-2">
              Type{" "}
              <span className="font-mono bg-muted px-1.5 py-0.5 border border-border">
                {DELETE_CONFIRMATION_TEXT}
              </span>{" "}
              to confirm:
            </p>
            <Input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={`Type ${DELETE_CONFIRMATION_TEXT} to confirm`}
              className={
                confirmation === DELETE_CONFIRMATION_TEXT
                  ? "border-destructive focus:ring-destructive"
                  : ""
              }
              autoComplete="off"
              data-testid="delete-now-confirmation-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
            loading={isDeleting}
            loadingText="Deleting..."
          >
            <Zap className="w-4 h-4 mr-2" />
            Delete Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**2b. Create DeleteNowDialog tests** (`src/components/settings/__tests__/DeleteNowDialog.test.tsx`):

Use `// @vitest-environment jsdom` at top. Follow SupportSection test patterns exactly: `renderWithProviders`, mock `convex/react` (useMutation), mock `@convex-dev/auth/react`, mock `next/navigation`, mock `@/lib/toast`.

Mock `useMutation` to return a `mockImmediateDelete` fn. Mock the `useAuthContext` with `beginSignOut`/`cancelSignOut` fns.

Tests to write:
1. `"renders dialog title and warning"` — open=true, verify "Delete Account Now" and warning text present
2. `"Delete Now button disabled when checkbox unchecked and input empty"` — verify button disabled initially
3. `"Delete Now button disabled when only checkbox checked"` — check checkbox, verify still disabled
4. `"Delete Now button disabled when only input filled"` — type DELETE, verify still disabled
5. `"Delete Now button enabled when both checkbox and input confirmed"` — check + type DELETE, verify enabled
6. `"resets state when dialog closes"` — open, type + check, close, reopen, verify reset to empty/unchecked
7. `"calls immediateAccountDeletion mutation on confirm"` — fill both, click Delete Now, verify mockImmediateDelete called
8. `"shows error toast on mutation failure"` — mockImmediateDelete.mockRejectedValue, verify toast.error called
9. `"does not render when open is false"` — open=false, verify dialog not in DOM

**2c. Update SupportSection** (`src/components/settings/SupportSection.tsx`):

Changes:
- Add `import DeleteNowDialog from "./DeleteNowDialog";`
- Add state: `const [deleteNowOpen, setDeleteNowOpen] = useState(false);`
- Inside the `isDeletionScheduled` AnimatePresence block (the amber warning banner, lines 272-298), add a "Delete Now" button BEFORE the existing "Cancel Deletion" button:
  ```tsx
  <div className="flex items-center gap-2 flex-shrink-0">
    <Button
      variant="destructive"
      size="sm"
      onClick={() => setDeleteNowOpen(true)}
    >
      Delete Now
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={handleCancelDeletion}
    >
      Cancel Deletion
    </Button>
  </div>
  ```
  (Replace the existing single Cancel Deletion button with this two-button group)
- After the confirmation Dialog (line ~393), render: `<DeleteNowDialog open={deleteNowOpen} onOpenChange={setDeleteNowOpen} />`
- Update the toast message in `handleDeleteAccount` (line 116-118) to: `toast.success(\`Account deletion scheduled. You have ${GRACE_PERIOD_DAYS} days to cancel. Sign in and go to Settings to cancel.\`);`

**2d. Update SupportSection tests** (`src/components/settings/__tests__/SupportSection.test.tsx`):

Add new tests inside the existing "Delete Account Section" describe:
1. `"shows Delete Now button when deletion is scheduled"` — render with `scheduledDeletionProfile`, verify "Delete Now" button exists
2. `"does not show Delete Now button when no deletion scheduled"` — render with `defaultProfile`, verify no "Delete Now" button
3. `"opens DeleteNowDialog when Delete Now is clicked"` — render with `scheduledDeletionProfile`, click "Delete Now", verify "Delete Account Now" dialog title appears

**2e. Create DeletionBanner** (`src/components/layout/DeletionBanner.tsx`):

```typescript
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Persistent warning banner for accounts with scheduled deletion.
 * Shown on all authenticated pages between Header and main content.
 * Dismissible per session (sessionStorage). Reappears on next login.
 *
 * SessionStorage key: `dismissedDeletionBanner_${deletedAt}` so if user
 * cancels and re-schedules, the banner reappears.
 */
export default function DeletionBanner() {
  const profile = useQuery(api.users.currentUserProfile, {});
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  const isDeletionScheduled =
    profile?.deletedAt !== undefined &&
    profile?.deletedAt !== null &&
    profile.deletedAt > Date.now();

  const storageKey = isDeletionScheduled
    ? `dismissedDeletionBanner_${profile.deletedAt}`
    : null;

  useEffect(() => {
    if (!storageKey) {
      setDismissed(true);
      return;
    }
    const wasDismissed = sessionStorage.getItem(storageKey) === "true";
    setDismissed(wasDismissed);
  }, [storageKey]);

  const handleDismiss = () => {
    if (storageKey) {
      sessionStorage.setItem(storageKey, "true");
    }
    setDismissed(true);
  };

  if (!isDeletionScheduled || dismissed) {
    return null;
  }

  const deletionDate = new Date(profile.deletedAt!).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="relative bg-amber-50 dark:bg-amber-950/30 border-b-2 border-amber-300 dark:border-amber-800 px-4 py-3"
      role="alert"
      aria-label="Account deletion warning"
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your account is scheduled for deletion on{" "}
            <strong>{deletionDate}</strong>.{" "}
            <Link
              href="/settings"
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
            >
              Go to Settings
            </Link>{" "}
            to cancel or delete now.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="flex-shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          aria-label="Dismiss deletion warning"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

**2f. Create DeletionBanner tests** (`src/components/layout/__tests__/DeletionBanner.test.tsx`):

Use `// @vitest-environment jsdom` at top. Mock `convex/react` (useQuery returning profile data). Mock `sessionStorage` with `vi.spyOn`.

Tests to write:
1. `"renders banner when deletion is scheduled"` — mock profile with future deletedAt, verify banner text and role="alert"
2. `"does not render when no deletion scheduled"` — mock profile without deletedAt, verify nothing rendered
3. `"does not render when profile is loading"` — mock useQuery returning undefined, verify nothing rendered
4. `"displays correct deletion date"` — mock with specific timestamp, verify formatted date shown
5. `"links to /settings"` — verify link with href="/settings" exists
6. `"dismisses banner on X click and sets sessionStorage"` — click dismiss, verify sessionStorage.setItem called, banner disappears
7. `"stays dismissed within same session"` — mock sessionStorage.getItem returning "true", verify banner not shown
8. `"reappears with new deletedAt value"` — different deletedAt = different key, banner shows again

**2g. Add DeletionBanner to authenticated layout** (`src/app/(authenticated)/layout.tsx`):

- Add import: `import DeletionBanner from "@/components/layout/DeletionBanner";`
- Render `<DeletionBanner />` directly after `<Header />` (line 55), before the `<main>` tag. This places it visually between the header and content on every authenticated page.
  </action>
  <verify>
Run all modified test files:
```bash
cd ./v2 && pnpm vitest run \
  src/components/settings/__tests__/DeleteNowDialog.test.tsx \
  src/components/settings/__tests__/SupportSection.test.tsx \
  src/components/layout/__tests__/DeletionBanner.test.tsx \
  --reporter=verbose
```

All tests pass. No TypeScript errors: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`

Run full quick check to verify no regressions: `pnpm test:fast`
  </verify>
  <done>
- DeleteNowDialog renders with typed "DELETE" + checkbox double confirmation, calls `api.users.immediateAccountDeletion`
- SupportSection shows "Delete Now" button alongside "Cancel Deletion" when deletion is scheduled
- SupportSection toast after scheduling includes "Sign in and go to Settings to cancel."
- DeletionBanner renders on all authenticated pages via layout.tsx, reads from `currentUserProfile` query
- DeletionBanner is dismissible per session (sessionStorage keyed by deletedAt), reappears on new login
- DeletionBanner links to /settings with clear messaging
- All new tests pass, all existing SupportSection tests pass, no regressions
  </done>
</task>

</tasks>

<verification>
1. Backend: `pnpm vitest run convex/users.test.ts --reporter=verbose` — all account deletion tests pass (existing + 6 new)
2. Frontend: `pnpm vitest run src/components/settings/__tests__/ src/components/layout/__tests__/DeletionBanner.test.tsx --reporter=verbose` — all tests pass
3. TypeScript: `npx tsc --noEmit` — no type errors
4. Quick regression: `pnpm test:fast` — full quick suite passes
</verification>

<success_criteria>
- immediateAccountDeletion mutation exported and functional in convex/users.ts
- Mutation validates scheduled deletion, cancels scheduled job, sends email, permanently deletes
- Email template supports immediate=true variant with "Account Deleted" messaging
- DeleteNowDialog requires both typed "DELETE" and checkbox to enable confirm button
- SupportSection shows "Delete Now" button when deletion is scheduled
- DeletionBanner visible on all authenticated pages for accounts with pending deletion
- Banner dismissible per session, reappears on login, links to /settings
- All tests pass (backend + frontend), no regressions
</success_criteria>

<output>
After completion, create `.planning/features/001-immediate-account-deletion/001-SUMMARY.md`
</output>
