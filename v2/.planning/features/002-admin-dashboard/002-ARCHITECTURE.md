# Feature 002: Architecture

**Feature:** Admin Dashboard
**Date:** 2026-02-02
**Chosen Approach:** Clean Architecture

## Summary

Build `/admin` route with shared admin abstractions: `useAdminAuth()` hook, `isAdmin` backend helper, admin component library. Reuse existing `getUserSummary` internalQuery wrapped in a public query with admin email guard. Full user management: edit, delete, export CSV, send email.

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/admin/adminAuth.ts` | ADMIN_EMAIL constant + useAdminAuth() hook |
| `convex/lib/admin.ts` | isAdmin() backend helper |
| `src/app/(authenticated)/admin/page.tsx` | Server component (metadata) |
| `src/app/(authenticated)/admin/AdminDashboardClient.tsx` | Main admin page client component |
| `src/components/admin/AdminStatsGrid.tsx` | Stats cards (total users, cases, etc.) |
| `src/components/admin/UsersTable.tsx` | Users data table with actions |
| `src/components/admin/UserEditModal.tsx` | Edit user modal |
| `src/components/admin/UserDeleteConfirmModal.tsx` | Delete confirmation dialog |
| `src/components/admin/SendEmailModal.tsx` | Send email to user modal |
| `src/components/admin/ExportButton.tsx` | CSV export button |
| `src/lib/admin/csvExport.ts` | CSV generation utility |

## Files to Modify

| File | Changes |
|------|---------|
| `convex/admin.ts` | Add public getAdminDashboardData query, updateUserAdmin mutation, sendAdminEmail action |
| `convex/users.ts` | Add permanentlyDeleteUserAdmin mutation |
| `src/components/layout/Header.tsx` | Conditional admin nav link |
| `src/lib/constants/navigation.ts` | Add ADMIN_NAV_LINK |

## Trade-offs Accepted

- Email hardcoded (single admin) — sufficient for now, env var for future multi-admin
- Client-side CSV export — fine for <1000 users
- No audit logging — add later if needed
- No undo for delete — confirmation dialog is sufficient guard
