---
phase: 002-admin-dashboard
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/admin/adminAuth.ts
  - convex/lib/admin.ts
  - convex/admin.ts
  - convex/users.ts
  - src/lib/admin/csvExport.ts
  - src/lib/constants/navigation.ts
  - src/components/layout/Header.tsx
  - src/app/(authenticated)/admin/page.tsx
  - src/app/(authenticated)/admin/AdminDashboardClient.tsx
  - src/components/admin/AdminStatsGrid.tsx
  - src/components/admin/UsersTable.tsx
  - src/components/admin/UserEditModal.tsx
  - src/components/admin/UserDeleteConfirmModal.tsx
  - src/components/admin/SendEmailModal.tsx
  - src/components/admin/ExportButton.tsx
autonomous: true

must_haves:
  truths:
    - "Admin navigates to /admin and sees full dashboard with stats and user table"
    - "Non-admin user navigating to /admin is redirected to /dashboard"
    - "Admin can edit a user profile (name, userType) and changes persist"
    - "Admin can permanently delete a user and all their data"
    - "Admin can export all user data as CSV"
    - "Admin can send an email to any user via the dashboard"
    - "Admin link appears in header nav only for admin email"
  artifacts:
    - path: "src/lib/admin/adminAuth.ts"
      provides: "ADMIN_EMAIL constant, useAdminAuth() hook"
    - path: "convex/lib/admin.ts"
      provides: "isAdmin() backend guard"
    - path: "convex/admin.ts"
      provides: "getAdminDashboardData query, updateUserAdmin mutation, sendAdminEmail action"
    - path: "src/app/(authenticated)/admin/AdminDashboardClient.tsx"
      provides: "Full admin dashboard UI"
  key_links:
    - from: "AdminDashboardClient.tsx"
      to: "convex/admin.ts:getAdminDashboardData"
      via: "useQuery(api.admin.getAdminDashboardData)"
      pattern: "useQuery.*api\\.admin\\.getAdminDashboardData"
    - from: "convex/admin.ts:getAdminDashboardData"
      to: "convex/admin.ts:getUserSummary"
      via: "ctx.runQuery(internal.admin.getUserSummary)"
      pattern: "runQuery.*internal\\.admin\\.getUserSummary"
    - from: "Header.tsx"
      to: "src/lib/admin/adminAuth.ts"
      via: "ADMIN_EMAIL check on currentUser.email"
      pattern: "ADMIN_EMAIL"
    - from: "convex/admin.ts mutations"
      to: "convex/lib/admin.ts:isAdmin"
      via: "isAdmin(ctx) guard on every public endpoint"
      pattern: "isAdmin"
---

<objective>
Build a complete /admin route with full admin panel for user management.

Purpose: Give the sole admin ([ADMIN_EMAIL env var]) a protected dashboard to view all users, edit profiles, delete accounts, export data as CSV, and send emails -- all within the existing neobrutalist design system.

Output: Working /admin page with stats grid, searchable/sortable users table, and action modals (edit, delete, send email, export CSV).
</objective>

<execution_context>
:execute-plan
:summary-template
</execution_context>

<context>
@convex/admin.ts (existing internalQuery getUserSummary at line 922 -- reuse this)
@convex/lib/auth.ts (getCurrentUserId pattern)
@convex/users.ts (currentUser query, permanentlyDeleteAccount pattern)
@convex/scheduledJobs.ts (permanentlyDeleteAccount internalMutation at line 946)
@convex/notificationActions.ts (Resend email pattern: getResend(), FROM_EMAIL, sendNotificationEmail)
@src/lib/constants/navigation.ts (AUTHENTICATED_NAV_LINKS array)
@src/components/layout/Header.tsx (nav rendering, currentUser query)
@src/app/(authenticated)/dashboard/page.tsx (page.tsx server pattern)
@src/app/(authenticated)/dashboard/DashboardPageClient.tsx (client component pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Admin auth layer + backend queries/mutations</name>
  <files>
    src/lib/admin/adminAuth.ts
    convex/lib/admin.ts
    convex/admin.ts
    convex/users.ts
    src/lib/admin/csvExport.ts
  </files>
  <action>
    **1. Create `src/lib/admin/adminAuth.ts`:**
    - Export `ADMIN_EMAIL = "[ADMIN_EMAIL env var]"` constant
    - Export `useAdminAuth()` hook that:
      - Calls `useQuery(api.users.currentUser)`
      - Returns `{ isAdmin: boolean, isLoading: boolean, user }` where `isAdmin = user?.email === ADMIN_EMAIL`
      - `isLoading` is true when `user === undefined` (Convex loading state)

    **2. Create `convex/lib/admin.ts`:**
    - Export `ADMIN_EMAIL = "[ADMIN_EMAIL env var]"` (backend mirror)
    - Export `async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<void>` that:
      - Gets userId via `getCurrentUserId(ctx)` from `./auth`
      - Loads user doc via `ctx.db.get(userId as Id<"users">)`
      - Throws `"Unauthorized: admin access required"` if `user?.email !== ADMIN_EMAIL`
    - This is a GUARD function (throws, not returns boolean). Every public admin endpoint calls this first.

    **3. Add to `convex/admin.ts` (append, do NOT modify existing functions):**

    Add these PUBLIC functions at the bottom of the file:

    a) `getAdminDashboardData` - a `query` (NOT internalQuery):
       - Calls `isAdmin(ctx)` guard from `../lib/admin`
       - Calls `ctx.runQuery(internal.admin.getUserSummary, {})` to reuse the existing internalQuery
       - Returns the result directly (it already has stats + user summaries)

    WAIT -- Convex queries CANNOT call ctx.runQuery. Queries are pure reads. Instead:
       - Duplicate the getUserSummary logic inline (copy the bulk-load + map pattern from lines 922-1080)
       - OR better: refactor getUserSummary body into a shared helper function in convex/lib/admin.ts that both the internalQuery and the new public query can call. The helper takes `ctx` and returns the same shape.
       - PREFERRED approach: Create `async function getAdminDashboardDataHelper(ctx: QueryCtx)` in `convex/lib/admin.ts` that contains the exact getUserSummary logic. Then:
         - Update the existing `getUserSummary` internalQuery to call the helper
         - Create new `getAdminDashboardData` public query that calls `isAdmin(ctx)` then the helper

    b) `updateUserAdmin` - a `mutation`:
       - Args: `{ userId: v.id("users"), fullName: v.optional(v.string()), userType: v.optional(v.union(v.literal("individual"), v.literal("firm_admin"), v.literal("firm_member"))) }`
       - Calls `isAdmin(ctx)` guard
       - Loads userProfile by userId index, patches the provided fields + `updatedAt: Date.now()`
       - If fullName provided, also patch the `users` table `name` field
       - Returns `{ success: true }`

    c) `deleteUserAdmin` - a `mutation`:
       - Args: `{ userId: v.id("users") }`
       - Calls `isAdmin(ctx)` guard
       - Follows the EXACT same deletion logic as `permanentlyDeleteAccount` in scheduledJobs.ts (lines 946-1025+): delete cases, notifications, conversations+messages+toolCache, auditLogs, userProfile, auth sessions, auth accounts, finally the user doc
       - Does NOT check deletedAt or grace period (admin bypass)
       - Returns `{ success: true }`

    d) `sendAdminEmail` - an `action`:
       - Args: `{ toEmail: v.string(), subject: v.string(), body: v.string() }`
       - Gets auth identity, verifies admin email from identity
       - Uses Resend directly (same pattern as notificationActions.ts): `new Resend(process.env.AUTH_RESEND_KEY)` with `from: "PERM Tracker Admin <notifications@permtracker.app>"`
       - Sends plain text email with the subject and body
       - Returns `{ success: true }`

    **4. Create `src/lib/admin/csvExport.ts`:**
    - Export `function exportUsersToCSV(users: UserSummary[]): string` where UserSummary matches the shape returned by getUserSummary's users array
    - Columns: userId, email, name, accountStatus, emailVerified, verificationMethod, authProviders (joined), accountCreated (ISO), lastLoginTime (ISO or "never"), totalLogins, totalCases, activeCases, deletedCases, userType, firmName, termsAccepted (ISO or "none"), lastActivity (ISO)
    - Properly escape commas and quotes in values (wrap in quotes, double-escape internal quotes)
    - Export `function downloadCSV(csvContent: string, filename: string): void` that creates a Blob, triggers download via temporary anchor element

    **5. Add to `convex/users.ts` -- NO changes needed.** The admin delete is self-contained in convex/admin.ts.
  </action>
  <verify>
    - `npx tsc --noEmit` passes (no type errors)
    - `convex/lib/admin.ts` exports `isAdmin` and `ADMIN_EMAIL` and `getAdminDashboardDataHelper`
    - `convex/admin.ts` exports `getAdminDashboardData` (query), `updateUserAdmin` (mutation), `deleteUserAdmin` (mutation), `sendAdminEmail` (action)
    - `src/lib/admin/adminAuth.ts` exports `ADMIN_EMAIL` and `useAdminAuth`
    - `src/lib/admin/csvExport.ts` exports `exportUsersToCSV` and `downloadCSV`
  </verify>
  <done>
    Backend admin guard rejects non-admin users with thrown error. getAdminDashboardData returns full user summary data behind admin check. updateUserAdmin patches user profile fields. deleteUserAdmin removes all user data. sendAdminEmail sends via Resend. CSV export utility generates valid CSV with proper escaping.
  </done>
</task>

<task type="auto">
  <name>Task 2: Admin route page + header nav link</name>
  <files>
    src/app/(authenticated)/admin/page.tsx
    src/app/(authenticated)/admin/AdminDashboardClient.tsx
    src/components/admin/AdminStatsGrid.tsx
    src/components/admin/UsersTable.tsx
    src/components/admin/UserEditModal.tsx
    src/components/admin/UserDeleteConfirmModal.tsx
    src/components/admin/SendEmailModal.tsx
    src/components/admin/ExportButton.tsx
    src/lib/constants/navigation.ts
    src/components/layout/Header.tsx
  </files>
  <action>
    **1. Create `src/app/(authenticated)/admin/page.tsx`:**
    Follow exact pattern from dashboard/page.tsx:
    ```tsx
    import type { Metadata } from "next";
    import { AdminDashboardClient } from "./AdminDashboardClient";

    export const metadata: Metadata = {
      title: "Admin Dashboard",
      robots: { index: false, follow: false },
    };

    export default function AdminPage() {
      return <AdminDashboardClient />;
    }
    ```

    **2. Create `src/app/(authenticated)/admin/AdminDashboardClient.tsx`:**
    - "use client" directive
    - Import `useAdminAuth` from `@/lib/admin/adminAuth`
    - Import `useQuery, useMutation, useAction` from "convex/react"
    - Import `api` from convex generated
    - Auth gate: if `isLoading` show skeleton, if `!isAdmin` redirect to /dashboard via `router.push("/dashboard")`
    - Call `useQuery(api.admin.getAdminDashboardData)` -- returns undefined while loading, then the full stats+users object
    - State: `searchQuery` string for filtering users, `sortField`/`sortOrder` for table sorting
    - State: `editingUser` (user object or null), `deletingUser` (user object or null), `emailingUser` (user object or null) for modal control
    - Layout (neobrutalist style matching existing pages):
      - Page heading: "Admin Dashboard" in `font-heading text-4xl font-black uppercase`
      - Subtext: "System overview and user management"
      - `<AdminStatsGrid>` component with stats from query
      - Search input (border-2 border-black) + `<ExportButton>`
      - `<UsersTable>` with filtered/sorted users, onEdit/onDelete/onEmail callbacks
      - Conditional modals: `<UserEditModal>`, `<UserDeleteConfirmModal>`, `<SendEmailModal>`

    **3. Create `src/components/admin/AdminStatsGrid.tsx`:**
    - Props: `{ totalUsers, activeUsers, deletedUsers, pendingDeletion, usersWithCases, totalCasesInSystem }`
    - Grid of 6 stat cards (3 cols on lg, 2 on md, 1 on sm)
    - Each card: `border-2 border-black shadow-hard-sm bg-white dark:bg-black dark:border-white/20 p-6`
    - Show label (font-heading uppercase text-xs tracking-wide text-muted-foreground) + value (text-3xl font-black font-heading)
    - Cards: Total Users, Active Users, Deleted Users, Pending Deletion, Users With Cases, Total Cases
    - Color accents: Active=lime/primary, Deleted=red, Pending=amber, Cases=blue

    **4. Create `src/components/admin/UsersTable.tsx`:**
    - Props: `{ users, searchQuery, sortField, sortOrder, onSort, onEdit, onDelete, onEmail }`
    - Filter users by searchQuery (match against email, name, firmName -- case insensitive)
    - Sort by sortField/sortOrder
    - Table with neobrutalist style: `border-2 border-black` on table, `border-b-2 border-black` on rows, `font-heading uppercase text-xs tracking-wide` headers
    - Columns: Name, Email, Status (colored badge), Type, Cases, Last Active (relative time using date-fns formatDistanceToNow), Actions
    - Status badges: active=lime bg, deleted=red bg, pending_deletion=amber bg -- all with `border-2 border-black text-xs font-bold px-2 py-0.5`
    - Actions column: 3 icon buttons (Pencil for edit, Trash2 for delete, Mail for email) with `border-2 border-black p-1.5 hover:shadow-hard-sm hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all`
    - Show "No users found" empty state if filtered list is empty
    - Clickable column headers for sorting (with ChevronUp/ChevronDown indicator)

    **5. Create `src/components/admin/UserEditModal.tsx`:**
    - Props: `{ user, onClose, onSave }` where onSave calls the updateUserAdmin mutation
    - Use Dialog from shadcn (or build inline modal with neobrutalist style: fixed overlay, centered card with border-4 border-black shadow-hard bg-white)
    - Form fields: Full Name (text input), User Type (select: individual/firm_admin/firm_member)
    - Pre-populate from user data
    - Save button: `bg-primary border-2 border-black shadow-hard-sm font-heading font-bold uppercase hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5`
    - Cancel button: same style but bg-white
    - Show loading state while mutation runs, toast success/error

    **6. Create `src/components/admin/UserDeleteConfirmModal.tsx`:**
    - Props: `{ user, onClose, onConfirm }` where onConfirm calls deleteUserAdmin mutation
    - Neobrutalist modal with RED warning styling
    - Show user email and name prominently
    - Warning text: "This will permanently delete ALL data for this user including cases, notifications, conversations, and profile. This action cannot be undone."
    - Require typing the user's email to confirm (input must match exactly)
    - Delete button: `bg-red-500 text-white border-2 border-black` -- disabled until email matches
    - Show loading state during deletion, toast on success/error

    **7. Create `src/components/admin/SendEmailModal.tsx`:**
    - Props: `{ user, onClose }` where user provides the recipient email
    - Neobrutalist modal
    - Fields: To (pre-filled, readonly), Subject (text input), Body (textarea, 6 rows min)
    - Send button with primary styling, Cancel button
    - Calls `sendAdminEmail` action, shows loading state, toasts success/error, closes on success

    **8. Create `src/components/admin/ExportButton.tsx`:**
    - Props: `{ users }` -- the full users array from dashboard data
    - Button styled neobrutalist: `border-2 border-black bg-white font-heading font-bold uppercase shadow-hard-sm hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5`
    - Icon: Download from lucide-react
    - On click: calls `exportUsersToCSV(users)` then `downloadCSV(csv, "perm-tracker-users-{date}.csv")`

    **9. Update `src/lib/constants/navigation.ts`:**
    - Add `export const ADMIN_NAV_LINK: NavLink = { href: "/admin", label: "Admin" };`
    - Do NOT add it to AUTHENTICATED_NAV_LINKS array (it's conditional, handled in Header)

    **10. Update `src/components/layout/Header.tsx`:**
    - Import `ADMIN_NAV_LINK` from navigation constants
    - Import `ADMIN_EMAIL` from `@/lib/admin/adminAuth`
    - In the desktop nav section (where AUTHENTICATED_NAV_LINKS.map runs), add AFTER the map:
      ```tsx
      {user?.email === ADMIN_EMAIL && (
        <NavLink
          key="/admin"
          href="/admin"
          spinnerClassName="text-primary"
          className={cn(
            "hover-underline px-3 lg:px-4 py-2 text-sm font-semibold font-heading uppercase tracking-wide transition-colors",
            pathname === "/admin" ? "text-primary" : "text-white hover:text-primary"
          )}
        >
          Admin
        </NavLink>
      )}
      ```
    - Same pattern in mobile menu section (after AUTHENTICATED_NAV_LINKS.map, before user section)
    - This requires access to `user` which is already available as `useQuery(api.users.currentUser)` in the Header component
  </action>
  <verify>
    - `npx tsc --noEmit` passes (no type errors)
    - `pnpm build` succeeds (Next.js build including /admin route)
    - Navigate to /admin as admin user -- sees stats grid and users table
    - Navigate to /admin as non-admin user -- redirected to /dashboard
    - Admin link visible in header only for admin email
    - Click Edit on a user -- modal opens with pre-filled data
    - Click Delete on a user -- confirmation modal with email-match guard
    - Click Email on a user -- send email modal with pre-filled recipient
    - Click Export -- CSV file downloads
  </verify>
  <done>
    Full admin dashboard renders at /admin behind admin email guard. Stats grid shows 6 metrics. Users table is searchable, sortable, and has edit/delete/email actions. All modals work with proper loading states and toast feedback. CSV export downloads valid file. Header shows conditional Admin link. Non-admin users cannot access the page.
  </done>
</task>

</tasks>

<verification>
1. Auth guard: Non-admin email calling `getAdminDashboardData` query throws "Unauthorized"
2. Auth guard: Non-admin navigating to /admin in browser is redirected to /dashboard
3. Header: Admin link visible ONLY when logged in as [ADMIN_EMAIL env var]
4. Stats: Numbers match actual database state (totalUsers, activeUsers, etc.)
5. Search: Typing in search box filters table by name/email/firm
6. Sort: Clicking column headers toggles sort direction
7. Edit: Saving changes persists to database, reflected on refresh
8. Delete: Typing email confirmation + clicking delete removes all user data
9. Email: Sending email via modal delivers to recipient inbox
10. Export: Downloaded CSV opens correctly in Excel/Sheets with all columns
11. TypeScript: `npx tsc --noEmit` clean
12. Build: `pnpm build` succeeds
</verification>

<success_criteria>
- /admin route loads for admin, redirects for others
- All 6 stat cards render with correct numbers
- Users table shows all users with search + sort
- Edit modal saves profile changes
- Delete modal with email confirmation deletes all user data
- Send email modal delivers via Resend
- CSV export downloads with all user fields
- Admin nav link conditional in header (desktop + mobile)
- Zero TypeScript errors, clean build
</success_criteria>

<output>
After completion, create `.planning/features/002-admin-dashboard/002-01-SUMMARY.md`
</output>
