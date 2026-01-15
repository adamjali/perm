# Convex API Reference

**Version:** 2.0.0
**Last Updated:** 2025-12-31
**Status:** Active Development

---

## Table of Contents

- [Overview](#overview)
- [Authentication Patterns](#authentication-patterns)
- [Module Reference](#module-reference)
  - [cases.ts](#casests)
  - [notifications.ts](#notificationsts)
  - [dashboard.ts](#dashboardts)
  - [calendar.ts](#calendarts)
  - [timeline.ts](#timelinets)
  - [users.ts](#usersts)
  - [auditLogs.ts](#auditlogsts)
  - [deadlineEnforcement.ts](#deadlineenforcementts)
  - [userCaseOrder.ts](#usercaseorderts)
- [Scheduled Jobs](#scheduled-jobs)
- [Internal Actions](#internal-actions)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The PERM Tracker v2 API is built on [Convex](https://convex.dev), providing real-time, reactive database operations with built-in authentication and type safety.

### Function Summary

| Category | Count | Description |
|----------|-------|-------------|
| **Public Queries** | 25 | Read operations exposed to clients |
| **Public Mutations** | 23 | Write operations exposed to clients |
| **Internal Mutations** | 8 | Server-side only mutations |
| **Internal Actions** | 6 | Server-side actions (Node.js runtime) |
| **Internal Queries** | 2 | Server-side only queries |
| **Scheduled Jobs (Crons)** | 3 | Automated background tasks |
| **Total** | 67 | All Convex functions |

### Module Overview

| Module | Public Functions | Internal Functions | Description |
|--------|-----------------|-------------------|-------------|
| `cases.ts` | 16 | 0 | Case CRUD, bulk operations, import/export |
| `notifications.ts` | 10 | 4 | Notification system, real-time updates |
| `dashboard.ts` | 4 | 0 | Dashboard metrics and statistics |
| `calendar.ts` | 3 | 0 | Calendar event data and preferences |
| `timeline.ts` | 1 | 0 | Timeline visualization data |
| `users.ts` | 3 | 0 | User profile management |
| `auditLogs.ts` | 2 | 0 | Audit trail queries |
| `deadlineEnforcement.ts` | 0 | 2 | Deadline monitoring (internal) |
| `userCaseOrder.ts` | 3 | 0 | Drag-drop reordering |
| `pushSubscriptions.ts` | 0 | 2 | Push notification subscriptions |
| `pushNotifications.ts` | 0 | 1 | Push notification delivery |
| `notificationActions.ts` | 0 | 5 | Email delivery actions |
| `scheduledJobs.ts` | 3 | 0 | Cron job definitions |

### Quick Start

```typescript
// 1. Import the Convex client
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// 2. Query cases (reactive - auto-updates on changes)
const cases = useQuery(api.cases.list, { status: "pwd" });

// 3. Create a case
const createCase = useMutation(api.cases.create);
await createCase({
  employerName: "Acme Corp",
  beneficiaryIdentifier: "John Doe",
  positionTitle: "Software Engineer",
});

// 4. Get dashboard data
const summary = useQuery(api.dashboard.getSummary);
const deadlines = useQuery(api.dashboard.getDeadlines);
```

---

## Authentication Patterns

All API functions require authentication via Convex Auth. The codebase uses two primary authentication helpers:

### `getCurrentUserId(ctx)` - Strict Authentication

Throws an error if user is not authenticated. Use for mutations and operations that must fail if unauthorized.

```typescript
import { getCurrentUserId } from "./lib/auth";

export const create = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // Throws "Not authenticated" if no valid session
    const userId = await getCurrentUserId(ctx);

    // Proceed with authenticated operation
    await ctx.db.insert("cases", {
      userId,
      ...args,
    });
  },
});
```

**Use when:**
- Creating, updating, or deleting data
- Operations that must not proceed without authentication
- Any mutation

### `getCurrentUserIdOrNull(ctx)` - Graceful Authentication

Returns `null` if user is not authenticated. Use for queries that should gracefully handle sign-out transitions.

```typescript
import { getCurrentUserIdOrNull } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Returns null during sign-out, token refresh, etc.
    const userId = await getCurrentUserIdOrNull(ctx);

    if (userId === null) {
      return []; // Graceful empty response
    }

    // Proceed with authenticated query
    return await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});
```

**Use when:**
- Read-only queries
- Operations where empty results are acceptable
- Preventing UI errors during auth transitions

### `verifyOwnership(ctx, doc, entityName)` - Ownership Verification

Verifies the current user owns a document. Throws if document is null or owned by another user.

```typescript
import { verifyOwnership } from "./lib/auth";

export const update = mutation({
  args: { id: v.id("cases"), /* ... */ },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.id);

    // Throws "Case not found" or "Access denied"
    await verifyOwnership(ctx, caseDoc, "case");

    // Safe to update - user owns this case
    await ctx.db.patch(args.id, { ...updates });
  },
});
```

**Pattern for secure operations:**
1. Fetch the document
2. Call `verifyOwnership()`
3. Perform the operation

---

## Module Reference

### cases.ts

Core CRUD operations for PERM cases with validation, audit logging, and notification triggers.

**Module Location:** `convex/cases.ts`

---

#### `list` - Query

List cases for the current user with optional filters.

```typescript
list(args?: {
  status?: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  favoritesOnly?: boolean;
}): Promise<Case[]>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `CaseStatus` | No | Filter by case status |
| `favoritesOnly` | `boolean` | No | Only return favorited cases |

**Returns:** `Case[]` - Array of case documents (empty array if not authenticated)

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated (graceful sign-out handling)

**Example:**
```typescript
// List all PWD stage cases
const pwdCases = useQuery(api.cases.list, { status: "pwd" });

// List only favorited cases
const favorites = useQuery(api.cases.list, { favoritesOnly: true });

// List all cases (no filter)
const allCases = useQuery(api.cases.list);
```

**Notes:**
- For paginated lists with sorting and search, use `listFiltered` instead
- Limited to 1000 cases per query

---

#### `get` - Query

Get a single case by ID with ownership verification.

```typescript
get(args: {
  id: Id<"cases">;
}): Promise<Case | null>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `Id<"cases">` | Yes | The case document ID |

**Returns:** `Case | null` - The case document or `null`

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns `null` in all failure cases for security

**Returns `null` when:**
- User is not authenticated
- Case not found in database (may have been deleted)
- User does not own the case

**Example:**
```typescript
const caseDoc = useQuery(api.cases.get, { id: caseId });

if (caseDoc === undefined) {
  return <Skeleton />; // Loading
}

if (caseDoc === null) {
  return <NotFound />; // Case not found or access denied
}

return <CaseDetails case={caseDoc} />;
```

**Notes:**
- Returns `null` for security instead of throwing errors (doesn't reveal existence of other users' cases)
- In development mode, distinct reasons are logged for debugging

---

#### `listFiltered` - Query

Paginated list with search, sorting, and multiple filter options.

```typescript
listFiltered(args?: {
  status?: string;
  progressStatus?: string;
  searchQuery?: string;
  favoritesOnly?: boolean;
  duplicatesOnly?: boolean;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}): Promise<CaseListResponse>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | `string` | No | - | Filter by case status |
| `progressStatus` | `string` | No | - | Filter by progress status |
| `searchQuery` | `string` | No | - | Fuzzy search across employer, beneficiary, position |
| `favoritesOnly` | `boolean` | No | `false` | Only favorited cases |
| `duplicatesOnly` | `boolean` | No | `false` | Only cases marked as duplicates |
| `sortBy` | `string` | No | `"deadline"` | Sort field: `deadline`, `updatedAt`, `employerName`, `beneficiaryIdentifier` |
| `sortOrder` | `string` | No | `"asc"` | Sort direction: `asc` or `desc` |
| `page` | `number` | No | `1` | Page number (1-indexed) |
| `pageSize` | `number` | No | `12` | Results per page (0 = no limit) |

**Returns:**
```typescript
interface CaseListResponse {
  cases: CaseCardData[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty results if unauthenticated

**Example:**
```typescript
// Paginated list with search
const { cases, pagination } = useQuery(api.cases.listFiltered, {
  searchQuery: "Acme",
  status: "recruitment",
  sortBy: "deadline",
  sortOrder: "asc",
  page: 1,
  pageSize: 20,
}) ?? { cases: [], pagination: { totalCount: 0, hasNextPage: false } };

// Get all cases without pagination
const allCases = useQuery(api.cases.listFiltered, { pageSize: 0 });
```

**Notes:**
- Uses client-side pagination (loads all cases then paginates)
- For 1000+ cases, consider cursor-based pagination with indexed deadline fields
- Search is fuzzy and case-insensitive

---

#### `checkDuplicates` - Query

Check for duplicate cases before importing or creating.

```typescript
checkDuplicates(args: {
  cases: Array<{
    employerName: string;
    beneficiaryIdentifier: string;
  }>;
  excludeCaseId?: Id<"cases">;
}): Promise<{ duplicates: DuplicateMatch[] }>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cases` | `Array<{employerName, beneficiaryIdentifier}>` | Yes | Cases to check |
| `excludeCaseId` | `Id<"cases">` | No | Exclude from check (for edit mode) |

**Returns:**
```typescript
interface DuplicateMatch {
  index: number;              // Index in input array
  employerName: string;
  beneficiaryIdentifier: string;
  existingCaseId: string;     // ID of existing duplicate
  existingPositionTitle?: string;
  existingCaseStatus?: string;
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty duplicates if unauthenticated

**Example:**
```typescript
// Check for duplicates before import
const { duplicates } = await checkDuplicates({
  cases: [
    { employerName: "Acme Corp", beneficiaryIdentifier: "John Doe" },
    { employerName: "Tech Inc", beneficiaryIdentifier: "Jane Smith" },
  ],
});

if (duplicates.length > 0) {
  // Show duplicate resolution dialog
  showDuplicateDialog(duplicates);
}

// When editing, exclude the current case from duplicate check
const { duplicates } = await checkDuplicates({
  cases: [{ employerName: editedName, beneficiaryIdentifier: editedBeneficiary }],
  excludeCaseId: currentCaseId,
});
```

**Notes:**
- Matching is case-insensitive and trimmed
- Used by import flow and case edit form

---

#### `create` - Mutation

Create a new PERM case with full validation.

```typescript
create(args: {
  // Required
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;

  // Optional status fields
  caseStatus?: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus?: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
  priorityLevel?: "low" | "normal" | "high" | "urgent";

  // Optional boolean flags
  isFavorite?: boolean;
  isPinned?: boolean;
  isProfessionalOccupation?: boolean;
  calendarSyncEnabled?: boolean;
  showOnTimeline?: boolean;

  // Optional date fields (ISO strings YYYY-MM-DD)
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  // ... (60+ additional optional fields)

  // Duplicate tracking
  duplicateOf?: Id<"cases">;
}): Promise<Id<"cases">>
```

**Returns:** `Id<"cases">` - The created case ID

**Authentication:** Uses `getCurrentUserId()` - throws `"Not authenticated"` if unauthenticated

**Side Effects:**
1. **Validation:** Runs full PERM validation rules - throws on validation failure
2. **Derived Dates:** Auto-calculates `recruitmentStartDate`, `recruitmentEndDate`, `filingWindowOpens`, `filingWindowCloses`, `recruitmentWindowCloses`
3. **Audit Log:** Creates audit log entry for case creation
4. **Notification:** Creates "New Case Created" notification
5. **Email:** Schedules status change email if user preferences allow

**Example:**
```typescript
const createCase = useMutation(api.cases.create);

try {
  const caseId = await createCase({
    employerName: "Acme Corporation",
    beneficiaryIdentifier: "John Doe",
    positionTitle: "Senior Software Engineer",
    caseStatus: "pwd",
    progressStatus: "working",
    pwdFilingDate: "2024-06-01",
    pwdDeterminationDate: "2024-06-15",
    isProfessionalOccupation: true,
  });

  router.push(`/cases/${caseId}`);
} catch (error) {
  if (error.message.includes("Validation failed")) {
    // Parse validation errors: "[V-PWD-01] pwd_filing_date: message"
    const errors = parseValidationErrors(error.message);
    setFormErrors(errors);
  }
}
```

**Validation Error Format:**
```
Validation failed: [V-PWD-01] pwd_filing_date: PWD filing date must be before determination date; [V-REC-03] sunday_ad_first_date: Sunday ads must fall on a Sunday
```

---

#### `update` - Mutation

Update an existing case with validation and status change notifications.

```typescript
update(args: {
  id: Id<"cases">;
  // All case fields optional for partial updates
  employerName?: string;
  beneficiaryIdentifier?: string;
  positionTitle?: string;
  caseStatus?: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus?: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
  // ... (all other case fields)
}): Promise<Id<"cases">>
```

**Returns:** `Id<"cases">` - The updated case ID

**Authentication:** Uses `verifyOwnership()` - throws if not authenticated or not owner

**Throws:**
- `"Not authenticated"` - User not logged in
- `"Case not found"` - Case ID doesn't exist
- `"Access denied: you do not own this case"` - User doesn't own the case
- `"Cannot update deleted case"` - Case was soft-deleted
- `"Validation failed: ..."` - PERM validation errors

**Side Effects:**
1. **Validation:** Runs full PERM validation with merged data
2. **Derived Dates:** Recalculates derived dates on update
3. **Audit Log:** Creates update audit log with old/new values
4. **Notification:** Creates notification if `caseStatus` changed
5. **Email:** Schedules status change email if caseStatus changed and preferences allow

**Example:**
```typescript
const updateCase = useMutation(api.cases.update);

await updateCase({
  id: caseId,
  caseStatus: "recruitment",
  progressStatus: "working",
  pwdDeterminationDate: "2024-06-20",
});
```

---

#### `remove` - Mutation

Permanently delete a case and all associated data.

```typescript
remove(args: {
  id: Id<"cases">;
}): Promise<Id<"cases">>
```

**Returns:** `Id<"cases">` - The deleted case ID

**Authentication:** Uses `verifyOwnership()` - throws if not authenticated or not owner

**Side Effects:**
1. **Cascade Delete:** Deletes all notifications associated with this case
2. **Calendar Events:** Deletes associated Google Calendar events
3. **User References:** Removes case from userCaseOrder, timelinePreferences, dismissedDeadlines
4. **Conversation References:** Clears case references from conversations and message citations
5. **Audit Log:** Creates delete audit log entry (before deletion)

**Example:**
```typescript
const removeCase = useMutation(api.cases.remove);

await removeCase({ id: caseId });
toast.success("Case deleted permanently");
```

---

#### `bulkRemove` - Mutation

Permanently delete multiple cases at once with graceful error handling.

```typescript
bulkRemove(args: {
  ids: Id<"cases">[];
}): Promise<{
  successCount: number;
  failedCount: number;
  errors?: string[];
}>
```

**Returns:** Object with success/failure counts and error messages

**Authentication:** Uses `getCurrentUserId()` - throws if not authenticated

**Side Effects:**
- **Cascade Delete:** Deletes notifications for each removed case
- **Audit Log:** Creates delete audit log for each case

**Example:**
```typescript
const bulkRemove = useMutation(api.cases.bulkRemove);

const result = await bulkRemove({ ids: selectedCaseIds });

if (result.failedCount > 0) {
  console.warn("Some cases failed to delete:", result.errors);
}

toast.success(`${result.successCount} cases deleted`);
```

**Error Handling:** Continues processing on individual failures instead of aborting entire operation.

---

#### `bulkUpdateStatus` - Mutation

Update status for multiple cases with notifications.

```typescript
bulkUpdateStatus(args: {
  ids: Id<"cases">[];
  status: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
}): Promise<{
  successCount: number;
  failedCount: number;
  errors?: string[];
}>
```

**Returns:** Object with success/failure counts and error messages

**Authentication:** Uses `getCurrentUserId()` - throws if not authenticated

**Side Effects:**
- **Audit Log:** Creates update audit log for each case
- **Notifications:** Creates status change notification for each case
- **Emails:** Sends emails for **first 10 cases only** (prevents email flooding)

**Example:**
```typescript
const bulkUpdateStatus = useMutation(api.cases.bulkUpdateStatus);

// Close multiple cases
const result = await bulkUpdateStatus({
  ids: selectedCaseIds,
  status: "closed",
});

toast.success(`${result.successCount} cases closed`);
```

---

#### `toggleFavorite` - Mutation

Toggle the favorite status of a case.

```typescript
toggleFavorite(args: {
  id: Id<"cases">;
}): Promise<boolean>
```

**Returns:** `boolean` - The new favorite state

**Authentication:** Uses `verifyOwnership()` - throws if not authenticated or not owner

**Example:**
```typescript
const toggleFavorite = useMutation(api.cases.toggleFavorite);

const newState = await toggleFavorite({ id: caseId });
toast.success(newState ? "Added to favorites" : "Removed from favorites");
```

---

#### `togglePinned` - Mutation

Toggle the pinned status of a case.

```typescript
togglePinned(args: {
  id: Id<"cases">;
}): Promise<boolean>
```

**Returns:** `boolean` - The new pinned state

**Authentication:** Uses `verifyOwnership()` - throws if not authenticated or not owner

---

#### `toggleCalendarSync` - Mutation

Toggle calendar sync for a case.

```typescript
toggleCalendarSync(args: {
  id: Id<"cases">;
}): Promise<boolean>
```

**Returns:** `boolean` - The new calendar sync enabled state

**Authentication:** Uses `verifyOwnership()` - throws if not authenticated or not owner

**Throws:** `"Cannot update deleted case"` - Case was soft-deleted

---

#### `importCases` - Mutation

Bulk import cases with duplicate resolution support.

```typescript
importCases(args: {
  cases: Array<{
    employerName: string;
    beneficiaryIdentifier: string;
    positionTitle?: string;
    caseStatus?: CaseStatus;
    progressStatus?: ProgressStatus;
    // ... additional optional fields
  }>;
  resolutions?: Record<string, "skip" | "replace">;
}): Promise<{
  importedCount: number;
  skippedCount: number;
  replacedCount: number;
}>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cases` | `Array<ImportCase>` | Yes | Cases to import |
| `resolutions` | `Record<string, "skip" \| "replace">` | No | Duplicate resolution by index |

**Returns:** Import statistics with counts

**Authentication:** Uses `getCurrentUserId()` - throws if not authenticated

**Side Effects:**
- **Validation:** Logs warnings but doesn't reject cases
- **Audit Log:** Creates audit log for each imported case
- **Replace:** Soft-deletes existing case when replacing

**Example:**
```typescript
const importCases = useMutation(api.cases.importCases);

// First check for duplicates
const { duplicates } = await checkDuplicates({ cases: csvData });

// User selects resolution for each duplicate
const resolutions: Record<string, "skip" | "replace"> = {};
duplicates.forEach((d, i) => {
  resolutions[String(d.index)] = userChoice[i]; // "skip" or "replace"
});

// Import with resolutions
const result = await importCases({
  cases: csvData,
  resolutions,
});

toast.success(`Imported ${result.importedCount} cases`);
```

---

#### `reopenCase` - Mutation

Reopen a closed case with automatic status recalculation.

```typescript
reopenCase(args: {
  id: Id<"cases">;
}): Promise<{
  success: boolean;
  newCaseStatus: string;
  newProgressStatus: string;
}>
```

**Returns:** Object with success flag and calculated statuses

**Authentication:** Uses `verifyOwnership()` - throws if not authenticated or not owner

**Throws:**
- `"Case is not closed"` - Case isn't in closed status
- `"Cannot reopen deleted case"` - Case was soft-deleted

**Side Effects:**
- **Status Calculation:** Determines appropriate status based on case data
- **Audit Log:** Creates update audit log

**Example:**
```typescript
const reopenCase = useMutation(api.cases.reopenCase);

const result = await reopenCase({ id: caseId });

toast.success(`Case reopened to ${result.newCaseStatus} stage`);
```

---

### notifications.ts

Real-time notification system with bell badge, dropdown, and full page support.

**Module Location:** `convex/notifications.ts`

---

#### `getUnreadCount` - Query

Get count of unread notifications for the notification bell badge.

```typescript
getUnreadCount(): Promise<number>
```

**Returns:** `number` - Count of unread notifications (0-1000), or 0 if not authenticated

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns 0 if unauthenticated (graceful sign-out handling)

**Performance:** Uses `by_user_and_unread` index for efficient counting (limited to 1000)

**Example:**
```typescript
const unreadCount = useQuery(api.notifications.getUnreadCount);

return (
  <NotificationBell>
    {unreadCount > 0 && (
      <Badge variant="destructive">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
    )}
  </NotificationBell>
);
```

---

#### `getRecentNotifications` - Query

Get the most recent N notifications for the dropdown menu.

```typescript
getRecentNotifications(args?: {
  limit?: number;
}): Promise<NotificationWithCase[]>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `5` | Maximum notifications to return |

**Returns:**
```typescript
interface NotificationWithCase {
  _id: Id<"notifications">;
  userId: Id<"users">;
  caseId?: Id<"cases">;
  type: NotificationType;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  isRead: boolean;
  createdAt: number;
  // Enriched case info (if caseId exists and case not deleted)
  caseInfo: {
    employerName?: string;
    beneficiaryIdentifier?: string;
    caseStatus?: string;
  } | null;
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Example:**
```typescript
const recentNotifications = useQuery(api.notifications.getRecentNotifications, { limit: 5 });

return (
  <DropdownMenu>
    {recentNotifications?.map((notification) => (
      <NotificationItem
        key={notification._id}
        notification={notification}
        caseInfo={notification.caseInfo}
      />
    ))}
  </DropdownMenu>
);
```

---

#### `getNotifications` - Query

Get paginated notifications with optional filters for the full notifications page.

```typescript
getNotifications(args?: {
  cursor?: string;
  limit?: number;
  filters?: {
    type?: NotificationType[];
    isRead?: boolean;
    caseId?: Id<"cases">;
  };
}): Promise<{
  notifications: NotificationWithCase[];
  nextCursor: string | null;
  hasMore: boolean;
}>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cursor` | `string` | No | - | Compound cursor for pagination (`timestamp\|id`) |
| `limit` | `number` | No | `20` | Results per page |
| `filters.type` | `NotificationType[]` | No | - | Filter by notification types |
| `filters.isRead` | `boolean` | No | - | Filter by read/unread status |
| `filters.caseId` | `Id<"cases">` | No | - | Filter by specific case |

**Returns:**
```typescript
interface PaginatedNotifications {
  notifications: NotificationWithCase[];
  nextCursor: string | null;  // Compound format: "timestamp|id"
  hasMore: boolean;
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty results if unauthenticated

**Cursor Format:** `{timestamp}|{_id}` - compound format ensures unique cursors even with identical timestamps

**Example:**
```typescript
// Initial load
const { notifications, nextCursor, hasMore } = useQuery(api.notifications.getNotifications, {
  limit: 20,
  filters: { isRead: false },
}) ?? { notifications: [], nextCursor: null, hasMore: false };

// Load more (triggered by user scroll/button)
const loadMore = async () => {
  const more = await getNotifications({
    cursor: nextCursor,
    limit: 20,
    filters: { isRead: false },
  });
  setNotifications([...notifications, ...more.notifications]);
};
```

---

#### `getNotificationsByCase` - Query

Get all notifications for a specific case.

```typescript
getNotificationsByCase(args: {
  caseId: Id<"cases">;
}): Promise<Notification[]>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `caseId` | `Id<"cases">` | Yes | The case to get notifications for |

**Returns:** `Notification[]` - Array of notifications, ordered by `createdAt` desc

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated or case not owned

**Security:** Verifies user owns the case before returning notifications

**Example:**
```typescript
const caseNotifications = useQuery(api.notifications.getNotificationsByCase, {
  caseId: selectedCaseId,
});

return (
  <CaseNotificationHistory notifications={caseNotifications} />
);
```

---

#### `getNotificationStats` - Query

Get notification statistics for dashboard display.

```typescript
getNotificationStats(): Promise<{
  total: number;
  unread: number;
  byType: Record<string, number>;
}>
```

**Returns:**
```typescript
interface NotificationStats {
  total: number;                     // Total notifications (max 1000)
  unread: number;                    // Unread count
  byType: Record<string, number>;    // Count by type (e.g., { deadline_reminder: 5, status_change: 3 })
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns zeros if unauthenticated

**Example:**
```typescript
const stats = useQuery(api.notifications.getNotificationStats);

return (
  <StatsCard>
    <p>Total: {stats?.total ?? 0}</p>
    <p>Unread: {stats?.unread ?? 0}</p>
    <p>Deadline Reminders: {stats?.byType.deadline_reminder ?? 0}</p>
  </StatsCard>
);
```

---

#### `markAsRead` - Mutation

Mark a single notification as read.

```typescript
markAsRead(args: {
  notificationId: Id<"notifications">;
}): Promise<{ success: true }>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notificationId` | `Id<"notifications">` | Yes | The notification to mark as read |

**Returns:** `{ success: true }`

**Authentication:** Uses `getCurrentUserId()` - throws `"Not authenticated"` if unauthenticated

**Throws:**
- `"Not authenticated"` - User not logged in
- `"Notification not found"` - Notification doesn't exist
- `"Access denied: you do not own this notification"` - User doesn't own the notification

**Side Effects:** Sets `isRead: true`, `readAt: now`, `updatedAt: now`

**Example:**
```typescript
const markAsRead = useMutation(api.notifications.markAsRead);

const handleNotificationClick = async (notificationId: Id<"notifications">) => {
  await markAsRead({ notificationId });
  // Navigate to notification target
};
```

---

#### `markAllAsRead` - Mutation

Mark all notifications as read for the current user (batched operation).

```typescript
markAllAsRead(): Promise<{
  count: number;
  hasMore: boolean;
}>
```

**Returns:**
```typescript
interface MarkAllResult {
  count: number;    // Number marked in this batch (max 100)
  hasMore: boolean; // True if more unread remain (call again)
}
```

**Authentication:** Uses `getCurrentUserId()` - throws `"Not authenticated"` if unauthenticated

**Batching:** Processes 100 notifications per call to prevent timeouts. Call repeatedly until `hasMore: false`.

**Example:**
```typescript
const markAllAsRead = useMutation(api.notifications.markAllAsRead);

const handleMarkAllAsRead = async () => {
  let result = await markAllAsRead();
  let totalMarked = result.count;

  // Continue until all are marked
  while (result.hasMore) {
    result = await markAllAsRead();
    totalMarked += result.count;
  }

  toast.success(`Marked ${totalMarked} notifications as read`);
};
```

---

#### `markMultipleAsRead` - Mutation

Mark specific notifications as read.

```typescript
markMultipleAsRead(args: {
  notificationIds: Id<"notifications">[];
}): Promise<{ count: number }>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notificationIds` | `Id<"notifications">[]` | Yes | Array of notification IDs to mark |

**Returns:** `{ count: number }` - Number of notifications actually marked (excludes already-read)

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Throws:**
- `"Notification {id} not found"` - Any notification in array doesn't exist
- `"Access denied: you do not own notification {id}"` - User doesn't own any notification

**Validation:** Verifies ownership of ALL notifications before updating ANY (atomic check)

**Example:**
```typescript
const markMultipleAsRead = useMutation(api.notifications.markMultipleAsRead);

const handleBulkRead = async (selectedIds: Id<"notifications">[]) => {
  const { count } = await markMultipleAsRead({ notificationIds: selectedIds });
  toast.success(`Marked ${count} notifications as read`);
};
```

---

#### `deleteNotification` - Mutation

Delete a single notification (hard delete).

```typescript
deleteNotification(args: {
  notificationId: Id<"notifications">;
}): Promise<{ success: true }>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notificationId` | `Id<"notifications">` | Yes | The notification to delete |

**Returns:** `{ success: true }`

**Authentication:** Uses `getCurrentUserId()` - throws `"Not authenticated"` if unauthenticated

**Throws:**
- `"Not authenticated"` - User not logged in
- `"Notification not found"` - Notification doesn't exist
- `"Access denied: you do not own this notification"` - User doesn't own the notification

**Notes:** This is a hard delete (no soft delete for notifications)

---

#### `deleteAllRead` - Mutation

Delete all read notifications for the current user (batched operation).

```typescript
deleteAllRead(): Promise<{
  count: number;
  hasMore: boolean;
}>
```

**Returns:**
```typescript
interface DeleteAllResult {
  count: number;    // Number deleted in this batch (max 100)
  hasMore: boolean; // True if more read notifications remain
}
```

**Authentication:** Uses `getCurrentUserId()` - throws `"Not authenticated"` if unauthenticated

**Batching:** Processes 100 notifications per call. Call repeatedly until `hasMore: false`.

**Example:**
```typescript
const deleteAllRead = useMutation(api.notifications.deleteAllRead);

const handleClearRead = async () => {
  let result = await deleteAllRead();
  let totalDeleted = result.count;

  while (result.hasMore) {
    result = await deleteAllRead();
    totalDeleted += result.count;
  }

  toast.success(`Deleted ${totalDeleted} read notifications`);
};
```

---

#### `createNotification` - Internal Mutation

Create a notification from server-side code.

```typescript
// Internal - not exposed to client
createNotification(args: {
  userId: Id<"users">;
  caseId?: Id<"cases">;
  type: NotificationType;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  deadlineDate?: string;
  deadlineType?: string;
  daysUntilDeadline?: bigint;
}): Promise<Id<"notifications">>
```

**Notification Types:**
```typescript
type NotificationType =
  | "deadline_reminder"
  | "status_change"
  | "rfe_alert"
  | "rfi_alert"
  | "system"
  | "auto_closure";
```

**Usage:** Called from scheduled jobs, case mutations, and deadline enforcement

---

#### `cleanupCaseNotifications` - Internal Mutation

Delete all notifications for a deleted case (batched).

```typescript
// Internal - not exposed to client
cleanupCaseNotifications(args: {
  caseId: Id<"cases">;
}): Promise<{ count: number; hasMore: boolean }>
```

**Usage:** Called from `cases.remove` mutation for cascade cleanup

---

#### `markEmailSent` - Internal Mutation

Mark a notification as having been sent via email.

```typescript
// Internal - not exposed to client
markEmailSent(args: {
  notificationId: Id<"notifications">;
}): Promise<void>
```

**Side Effects:** Sets `emailSent: true`, `emailSentAt: now`, `updatedAt: now`

**Usage:** Called from email actions after successful Resend delivery

---

### dashboard.ts

Dashboard metrics including deadlines, case summaries, and recent activity.

**Module Location:** `convex/dashboard.ts`

---

#### `getDeadlines` - Query

Get all case deadlines grouped by urgency level.

```typescript
getDeadlines(): Promise<{
  overdue: DeadlineItem[];
  thisWeek: DeadlineItem[];
  thisMonth: DeadlineItem[];
  later: DeadlineItem[];
}>
```

**Returns:**
```typescript
interface DeadlineItem {
  caseId: Id<"cases">;
  caseNumber?: string;
  employerName: string;
  beneficiaryName: string;
  type: DeadlineType;        // "pwd_expiration" | "eta9089_filing" | "rfi_response" | etc.
  label: string;             // Human-readable label
  dueDate: string;           // ISO date string
  daysUntil: number;         // Negative = overdue
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
}
```

**Urgency Groups:**
| Group | Criteria |
|-------|----------|
| `overdue` | `daysUntil < 0` |
| `thisWeek` | `0 <= daysUntil <= 7` |
| `thisMonth` | `8 <= daysUntil <= 30` |
| `later` | `daysUntil > 30` |

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty groups if unauthenticated

**Deadline Types Extracted:**
- `pwd_expiration` - PWD expiration date
- `eta9089_filing` - ETA 9089 filing window deadline
- `eta9089_expiration` - ETA 9089 certification expiration (urgent, <30 days)
- `i140_filing_window` - I-140 filing deadline (not urgent)
- `rfi_response` - RFI response due date
- `rfe_response` - RFE response due date

**Example:**
```typescript
const deadlines = useQuery(api.dashboard.getDeadlines);

if (deadlines === undefined) {
  return <DashboardSkeleton />;
}

return (
  <div>
    <DeadlineSection title="Overdue" items={deadlines.overdue} variant="urgent" />
    <DeadlineSection title="This Week" items={deadlines.thisWeek} variant="warning" />
    <DeadlineSection title="This Month" items={deadlines.thisMonth} />
    <DeadlineSection title="Later" items={deadlines.later} variant="muted" />
  </div>
);
```

**Notes:**
- Excludes closed cases from deadline extraction
- Extracts deadlines from all deadline-related date fields
- Sorted by urgency (most urgent first) within each group
- Limited to 1000 cases per query

---

#### `getSummary` - Query

Get case counts by status with progress breakdowns for dashboard cards.

```typescript
getSummary(): Promise<{
  pwd: { count: number; subtext: string; progress: number };
  recruitment: { count: number; subtext: string; progress: number };
  eta9089: { count: number; subtext: string; progress: number };
  i140: { count: number; subtext: string; progress: number };
  complete: { count: number; subtext: string; progress: number };
  closed: { count: number; subtext: string; progress: number };
  duplicates: { count: number; subtext: string; progress: number };
}>
```

**Returns:** Object with counts, subtexts, and progress percentages for each category

**Category Definitions:**

| Category | Criteria | Subtext Example | Progress Calculation |
|----------|----------|-----------------|---------------------|
| `pwd` | `caseStatus === "pwd"` | "3 working, 2 filed" | % filed |
| `recruitment` | `caseStatus === "recruitment"` | "5 ready to start, 2 in progress" | % in progress |
| `eta9089` | `caseStatus === "eta9089"` | "2 prep, 1 RFI, 3 filed" | % filed |
| `i140` | `caseStatus === "i140"` AND `progressStatus !== "approved"` | "1 prep, 2 RFE, 1 filed" | % filed |
| `complete` | `caseStatus === "i140"` AND `progressStatus === "approved"` | "I-140 Approved" | 100% |
| `closed` | `caseStatus === "closed"` | "Archived" | 100% |
| `duplicates` | `duplicateOf !== undefined` | "Marked as duplicate" | 0% |

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns zero counts if unauthenticated

**Performance:** Single-pass aggregation (O(n)) instead of multiple filter calls

**Example:**
```typescript
const summary = useQuery(api.dashboard.getSummary);

if (summary === undefined) {
  return <SummarySkeleton />;
}

return (
  <div className="grid grid-cols-4 gap-4">
    <SummaryCard
      title="PWD"
      count={summary.pwd.count}
      subtext={summary.pwd.subtext}
      progress={summary.pwd.progress}
    />
    <SummaryCard
      title="Recruitment"
      count={summary.recruitment.count}
      subtext={summary.recruitment.subtext}
      progress={summary.recruitment.progress}
    />
    {/* ... more cards */}
  </div>
);
```

---

#### `getRecentActivity` - Query

Get the 5 most recently updated cases for the activity feed.

```typescript
getRecentActivity(): Promise<RecentActivityItem[]>
```

**Returns:**
```typescript
interface RecentActivityItem {
  id: Id<"cases">;
  caseNumber?: string;
  employerName: string;
  beneficiaryIdentifier: string;
  action: string;             // "Updated" (generic action)
  timestamp: number;          // Unix timestamp
  caseStatus: string;
  progressStatus: string;
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Performance:** Uses `by_user_and_updated_at` index for efficient ordering

**Example:**
```typescript
const recentActivity = useQuery(api.dashboard.getRecentActivity);

return (
  <ul className="divide-y">
    {recentActivity?.map((item) => (
      <li key={item.id} className="py-3">
        <Link href={`/cases/${item.id}`}>
          <p className="font-medium">{item.employerName}</p>
          <p className="text-sm text-muted-foreground">
            {item.beneficiaryIdentifier} - {item.action}
          </p>
          <time className="text-xs text-muted-foreground">
            {formatRelativeTime(item.timestamp)}
          </time>
        </Link>
      </li>
    ))}
  </ul>
);
```

---

#### `getUpcomingDeadlines` - Query

Get deadlines within N days (includes overdue).

```typescript
getUpcomingDeadlines(args?: {
  days?: number;
}): Promise<DeadlineItem[]>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `days` | `number` | No | `30` | Number of days ahead (clamped to 1-365) |

**Returns:** `DeadlineItem[]` - Sorted by urgency (most urgent first)

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Includes:**
- Overdue deadlines (negative `daysUntil`)
- Deadlines within the specified days window

**Example:**
```typescript
// Get deadlines for next 7 days
const weekDeadlines = useQuery(api.dashboard.getUpcomingDeadlines, { days: 7 });

// Get deadlines for next 90 days
const quarterDeadlines = useQuery(api.dashboard.getUpcomingDeadlines, { days: 90 });

// Default: 30 days
const monthDeadlines = useQuery(api.dashboard.getUpcomingDeadlines);
```

**Notes:**
- Days parameter is clamped to range [1, 365]
- Sorted by `daysUntil` ascending (overdue first, then urgent)

---

### calendar.ts

Calendar integration with case deadline visualization and preferences.

**Module Location:** `convex/calendar.ts`

---

#### `getCalendarEvents` - Query

Get cases with all deadline-relevant fields for calendar display.

```typescript
getCalendarEvents(args?: {
  showCompleted?: boolean;
  showClosed?: boolean;
}): Promise<CalendarEventData[]>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `showCompleted` | `boolean` | No | `false` | Include I-140 approved cases |
| `showClosed` | `boolean` | No | `false` | Include closed/archived cases |

**Returns:**
```typescript
interface CalendarEventData {
  id: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";

  // PWD dates
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;

  // Recruitment dates
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;

  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;

  // I-140 dates
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;

  // RFI/RFE entries
  rfiEntries: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  rfeEntries: Array<{...}>;  // Same structure as rfiEntries
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Filters Applied:**
- Always excludes soft-deleted cases
- Excludes I-140 approved cases unless `showCompleted: true`
- Excludes closed cases unless `showClosed: true`

**Example:**
```typescript
// Active cases only (default)
const events = useQuery(api.calendar.getCalendarEvents);

// Include completed cases
const allEvents = useQuery(api.calendar.getCalendarEvents, {
  showCompleted: true,
  showClosed: true,
});

// Transform to calendar library format
const calendarEvents = events?.flatMap((caseData) => {
  const events = [];

  if (caseData.pwdExpirationDate) {
    events.push({
      id: `${caseData.id}-pwd-expiration`,
      title: `PWD Expires: ${caseData.beneficiaryIdentifier}`,
      date: caseData.pwdExpirationDate,
      type: "deadline",
      caseId: caseData.id,
    });
  }

  // ... map other deadline fields

  return events;
});
```

**Notes:**
- Returns raw case data - client is responsible for extracting calendar events
- All date fields are ISO strings (YYYY-MM-DD)
- Limited to 1000 cases per query

---

#### `getCalendarPreferences` - Query

Get user's calendar visibility preferences.

```typescript
getCalendarPreferences(): Promise<CalendarPreferences>
```

**Returns:**
```typescript
interface CalendarPreferences {
  hiddenCases: Id<"cases">[];      // Cases hidden from calendar
  hiddenDeadlineTypes: string[];   // Deadline types hidden (e.g., "pwd_expiration")
  showCompleted: boolean;          // Show I-140 approved cases
  showClosed: boolean;             // Show closed/archived cases
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns defaults if unauthenticated

**Default Values:**
```typescript
{
  hiddenCases: [],
  hiddenDeadlineTypes: [],
  showCompleted: false,
  showClosed: false,
}
```

**Example:**
```typescript
const preferences = useQuery(api.calendar.getCalendarPreferences);

// Filter events based on preferences
const visibleEvents = calendarEvents.filter((event) => {
  if (preferences.hiddenCases.includes(event.caseId)) return false;
  if (preferences.hiddenDeadlineTypes.includes(event.type)) return false;
  return true;
});

// Use preferences for visibility toggles
const [showCompleted, setShowCompleted] = useState(preferences?.showCompleted ?? false);
```

---

#### `updateCalendarPreferences` - Mutation

Update user's calendar visibility preferences.

```typescript
updateCalendarPreferences(args?: {
  hiddenCases?: Id<"cases">[];
  hiddenDeadlineTypes?: string[];
  showCompleted?: boolean;
  showClosed?: boolean;
}): Promise<Id<"userProfiles">>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hiddenCases` | `Id<"cases">[]` | No | Cases to hide from calendar |
| `hiddenDeadlineTypes` | `string[]` | No | Deadline types to hide |
| `showCompleted` | `boolean` | No | Show I-140 approved cases |
| `showClosed` | `boolean` | No | Show closed/archived cases |

**Returns:** `Id<"userProfiles">` - The user profile ID (creates profile if needed)

**Authentication:** Uses `getCurrentUserId()` - throws `"Not authenticated"` if unauthenticated

**Behavior:**
- Only updates fields that are provided (partial update)
- Creates user profile with defaults if it doesn't exist
- Existing preferences for non-provided fields are preserved

**Example:**
```typescript
const updatePreferences = useMutation(api.calendar.updateCalendarPreferences);

// Hide a specific case from calendar
const handleHideCase = async (caseId: Id<"cases">) => {
  const current = preferences?.hiddenCases ?? [];
  await updatePreferences({
    hiddenCases: [...current, caseId],
  });
};

// Toggle showing completed cases
const handleToggleCompleted = async () => {
  await updatePreferences({
    showCompleted: !preferences?.showCompleted,
  });
};

// Hide all RFI deadlines
const handleHideRfiDeadlines = async () => {
  const current = preferences?.hiddenDeadlineTypes ?? [];
  await updatePreferences({
    hiddenDeadlineTypes: [...current, "rfi_response"],
  });
};
```

**Deadline Type Values:**
```typescript
type DeadlineType =
  | "pwd_expiration"
  | "eta9089_filing"
  | "eta9089_expiration"
  | "i140_filing_window"
  | "rfi_response"
  | "rfe_response"
  | "recruitment_end";
```

---

### timeline.ts

Timeline visualization showing case progression over time.

**Module Location:** `convex/timeline.ts`

---

#### `getPreferences` - Query

Get user's timeline preferences (or defaults).

```typescript
getPreferences(): Promise<{
  selectedCaseIds: Id<"cases">[] | null;
  timeRange: 3 | 6 | 12 | 24;
}>
```

**Returns:**
```typescript
interface TimelinePreferences {
  selectedCaseIds: Id<"cases">[] | null;  // null = all active cases
  timeRange: 3 | 6 | 12 | 24;            // Months to display
}
```

**Default Values:**
```typescript
{
  selectedCaseIds: null,  // Shows all active (non-closed) cases
  timeRange: 12,          // 12 months
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns defaults if unauthenticated

**Example:**
```typescript
const preferences = useQuery(api.timeline.getPreferences);

// null means "all cases selected"
const isAllSelected = preferences?.selectedCaseIds === null;
```

---

#### `getCasesForTimeline` - Query

Get cases with all timeline-relevant data for visualization.

```typescript
getCasesForTimeline(args?: {
  timeRange?: 3 | 6 | 12 | 24;
}): Promise<TimelineCaseData[]>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | `3 \| 6 \| 12 \| 24` | No | From preferences or `12` | Months to include |

**Returns:**
```typescript
interface TimelineCaseData {
  id: Id<"cases">;
  employerName: string;
  positionTitle: string;
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
  // PWD dates
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  // Recruitment dates
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  // I-140 dates
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;
  // RFI/RFE entries
  rfiEntries: TimelineRfiRfeEntry[];
  rfeEntries: TimelineRfiRfeEntry[];
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Filters Applied:**
- Excludes soft-deleted cases
- Excludes cases with `showOnTimeline: false`
- Uses `selectedCaseIds` from preferences (or all active if null)
- Excludes closed cases if `selectedCaseIds` is null

**Example:**
```typescript
const timelineCases = useQuery(api.timeline.getCasesForTimeline, { timeRange: 6 });

// Transform to timeline events
const events = timelineCases?.flatMap((caseData) => {
  const events: TimelineEvent[] = [];
  if (caseData.pwdFilingDate) {
    events.push({ date: caseData.pwdFilingDate, type: "pwd_filed", caseId: caseData.id });
  }
  // ... map other dates
  return events;
});
```

---

#### `updatePreferences` - Mutation

Update user's timeline preferences.

```typescript
updatePreferences(args?: {
  selectedCaseIds?: Id<"cases">[] | null;
  timeRange?: 3 | 6 | 12 | 24;
}): Promise<Id<"timelinePreferences">>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selectedCaseIds` | `Id<"cases">[] \| null` | No | Cases to show (null = all active) |
| `timeRange` | `3 \| 6 \| 12 \| 24` | No | Months to display |

**Returns:** `Id<"timelinePreferences">` - The preferences document ID

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Behavior:** Creates preferences if they don't exist, otherwise updates only provided fields

**Example:**
```typescript
const updatePreferences = useMutation(api.timeline.updatePreferences);

// Set time range
await updatePreferences({ timeRange: 6 });

// Select specific cases
await updatePreferences({ selectedCaseIds: [case1Id, case2Id] });

// Show all active cases
await updatePreferences({ selectedCaseIds: null });
```

---

#### `addCaseToTimeline` - Mutation

Add a single case to the timeline selection.

```typescript
addCaseToTimeline(args: {
  caseId: Id<"cases">;
}): Promise<Id<"timelinePreferences">>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `caseId` | `Id<"cases">` | Yes | Case to add to timeline |

**Returns:** `Id<"timelinePreferences">` - The preferences document ID

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Throws:** `"Case not found"` - Case doesn't exist, is deleted, or not owned

**Behavior:**
- If `selectedCaseIds` is null (all cases), converts to explicit list with all active cases + new case
- If explicit list, adds the case if not already included
- Creates preferences document if it doesn't exist

**Example:**
```typescript
const addCaseToTimeline = useMutation(api.timeline.addCaseToTimeline);

const handleAddToTimeline = async (caseId: Id<"cases">) => {
  await addCaseToTimeline({ caseId });
  toast.success("Case added to timeline");
};
```

---

#### `removeCaseFromTimeline` - Mutation

Remove a single case from the timeline selection.

```typescript
removeCaseFromTimeline(args: {
  caseId: Id<"cases">;
}): Promise<Id<"timelinePreferences">>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `caseId` | `Id<"cases">` | Yes | Case to remove from timeline |

**Returns:** `Id<"timelinePreferences">` - The preferences document ID

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Behavior:**
- If `selectedCaseIds` is null (all cases), converts to explicit list with all active cases minus this case
- If explicit list, removes the case from the array

**Example:**
```typescript
const removeCaseFromTimeline = useMutation(api.timeline.removeCaseFromTimeline);

const handleRemoveFromTimeline = async (caseId: Id<"cases">) => {
  await removeCaseFromTimeline({ caseId });
  toast.success("Case removed from timeline");
};
```

---

### users.ts

User profile management and authentication helpers.

**Module Location:** `convex/users.ts`

---

#### `currentUser` - Query

Get the currently authenticated user document.

```typescript
currentUser(): Promise<User | null>
```

**Returns:** `User | null` - The user document or null if not authenticated

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns null if unauthenticated

**Example:**
```typescript
const user = useQuery(api.users.currentUser);

if (user) {
  console.log("Logged in as:", user.email);
}
```

---

#### `currentUserProfile` - Query

Get the current user's profile with notification preferences.

```typescript
currentUserProfile(): Promise<UserProfile | null>
```

**Returns:** `UserProfile | null` - The profile document or null

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns null if unauthenticated

**Example:**
```typescript
const profile = useQuery(api.users.currentUserProfile);

// Check notification preferences
const emailEnabled = profile?.emailNotificationsEnabled ?? true;
const timezone = profile?.timezone ?? "America/New_York";
```

---

#### `getDecryptedGoogleTokens` - Query

Get decrypted Google OAuth tokens for API calls.

```typescript
getDecryptedGoogleTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  googleEmail: string | null;
} | null>
```

**Returns:** Decrypted Google OAuth tokens or null if not available

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns null if unauthenticated

**Security:** Tokens are encrypted at rest and decrypted only when needed

**Example:**
```typescript
const tokens = useQuery(api.users.getDecryptedGoogleTokens);

// Use tokens for Google Calendar API
if (tokens?.accessToken) {
  const calendar = await getGoogleCalendarEvents(tokens.accessToken);
}
```

---

#### `ensureUserProfile` - Mutation

Ensure a user profile exists for the current user (idempotent).

```typescript
ensureUserProfile(): Promise<Id<"userProfiles">>
```

**Returns:** `Id<"userProfiles">` - The profile ID (existing or newly created)

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Behavior:** Creates profile with default values if it doesn't exist, returns existing ID if it does

**Default Values Created:**
```typescript
{
  userType: "individual",
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: false,
  urgentDeadlineDays: 7n,
  reminderDaysBefore: [1n, 3n, 7n, 14n, 30n],
  timezone: "America/New_York",
  calendarSyncEnabled: true,
  autoDeadlineEnforcementEnabled: false,
  // ... other defaults
}
```

**Usage:** Called after login/signup to ensure profile exists

**Example:**
```typescript
const ensureUserProfile = useMutation(api.users.ensureUserProfile);

// Call after successful authentication
useEffect(() => {
  if (isAuthenticated) {
    ensureUserProfile();
  }
}, [isAuthenticated]);
```

---

#### `updateUserProfile` - Mutation

Update the current user's profile with partial fields.

```typescript
updateUserProfile(args: {
  // User type
  userType?: "individual" | "firm_admin" | "firm_member";
  firmId?: Id<"users">;
  firmName?: string;
  // Profile info
  fullName?: string;
  jobTitle?: string;
  company?: string;
  profilePhotoUrl?: string;
  // Notification settings
  emailNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  urgentDeadlineDays?: bigint;
  reminderDaysBefore?: bigint[];
  emailDeadlineReminders?: boolean;
  emailStatusUpdates?: boolean;
  emailRfeAlerts?: boolean;
  preferredNotificationEmail?: "signup" | "google" | "both";
  // Quiet hours
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;  // HH:MM format
  quietHoursEnd?: string;
  timezone?: string;
  // Calendar sync
  calendarSyncEnabled?: boolean;
  // ... additional calendar sync fields
  // Google OAuth (auto-encrypted)
  googleEmail?: string;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  googleTokenExpiry?: number;
  // UI preferences
  casesSortBy?: string;
  casesSortOrder?: "asc" | "desc";
  casesPerPage?: bigint;
  darkModeEnabled?: boolean;
  // Deadline Enforcement
  autoDeadlineEnforcementEnabled?: boolean;
}): Promise<Id<"userProfiles">>
```

**Returns:** `Id<"userProfiles">` - The updated profile ID

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Throws:** `"User profile not found"` - Profile doesn't exist (call `ensureUserProfile` first)

**Security:** OAuth tokens are automatically encrypted before storage

**Example:**
```typescript
const updateUserProfile = useMutation(api.users.updateUserProfile);

// Update notification settings
await updateUserProfile({
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  urgentDeadlineDays: 7n,
});

// Update timezone
await updateUserProfile({
  timezone: "America/Los_Angeles",
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
});
```

---

#### `savePushSubscription` - Mutation

Save push subscription for current user.

```typescript
savePushSubscription(args: {
  subscription: string;  // JSON stringified PushSubscription
}): Promise<{ success: true }>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subscription` | `string` | Yes | JSON stringified browser PushSubscription object |

**Returns:** `{ success: true }`

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Throws:**
- `"User profile not found"` - Profile doesn't exist
- `"Invalid push subscription format: not valid JSON"` - Invalid JSON
- `"Invalid push subscription: missing required fields"` - Missing endpoint, keys.p256dh, or keys.auth

**Side Effects:** Sets `pushSubscription` and enables `pushNotificationsEnabled`

**Example:**
```typescript
const savePushSubscription = useMutation(api.users.savePushSubscription);

const enablePush = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  await savePushSubscription({ subscription: JSON.stringify(subscription) });
};
```

---

#### `removePushSubscription` - Mutation

Remove push subscription for current user.

```typescript
removePushSubscription(): Promise<{ success: true }>
```

**Returns:** `{ success: true }`

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Side Effects:** Clears `pushSubscription` and disables `pushNotificationsEnabled`

**Example:**
```typescript
const removePushSubscription = useMutation(api.users.removePushSubscription);

const disablePush = async () => {
  await removePushSubscription();
  toast.success("Push notifications disabled");
};
```

---

### auditLogs.ts

Audit trail for compliance and debugging.

**Module Location:** `convex/auditLogs.ts`

---

#### `listMine` - Query

List audit logs for the current user.

```typescript
listMine(args?: {
  tableName?: string;
  limit?: number;
}): Promise<AuditLog[]>
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tableName` | `string` | No | - | Filter by table (e.g., "cases") |
| `limit` | `number` | No | `50` | Maximum logs to return |

**Returns:** `AuditLog[]` - Array of audit logs, ordered by timestamp desc

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Example:**
```typescript
const auditLogs = useQuery(api.auditLogs.listMine, {
  tableName: "cases",
  limit: 100,
});

return (
  <AuditLogTable logs={auditLogs} />
);
```

---

#### `forDocument` - Query

Get audit logs for a specific document.

```typescript
forDocument(args: {
  documentId: string;
  tableName: string;
}): Promise<AuditLog[]>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | `string` | Yes | The document ID to get logs for |
| `tableName` | `string` | Yes | The table name (e.g., "cases") |

**Returns:** `AuditLog[]` - Array of audit logs for the document, ordered by timestamp desc

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Security:** Only returns logs for documents owned by the current user

**Example:**
```typescript
const caseAuditLogs = useQuery(api.auditLogs.forDocument, {
  documentId: caseId,
  tableName: "cases",
});

return (
  <CaseHistory logs={caseAuditLogs} />
);
```

---

#### `byDateRange` - Query

Get audit logs within a date range.

```typescript
byDateRange(args: {
  startDate: number;
  endDate: number;
  tableName?: string;
}): Promise<AuditLog[]>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | `number` | Yes | Start timestamp (Unix ms) |
| `endDate` | `number` | Yes | End timestamp (Unix ms) |
| `tableName` | `string` | No | Filter by table name |

**Returns:** `AuditLog[]` - Array of audit logs in range, ordered by timestamp desc

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Performance:** Uses `by_user_and_timestamp` compound index for efficient range queries

**Example:**
```typescript
// Get logs for the last 7 days
const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const logs = useQuery(api.auditLogs.byDateRange, {
  startDate: oneWeekAgo,
  endDate: Date.now(),
  tableName: "cases",
});
```

---

### deadlineEnforcement.ts

Automated deadline monitoring and case auto-closure.

**Module Location:** `convex/deadlineEnforcement.ts`

---

#### `isEnforcementEnabled` - Query

Check if deadline enforcement is enabled for the current user.

```typescript
isEnforcementEnabled(): Promise<boolean>
```

**Returns:** `boolean` - True if auto deadline enforcement is enabled

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns false if unauthenticated

**Usage:** Check before calling `checkAndEnforceDeadlines` on login

**Example:**
```typescript
const enforcementEnabled = useQuery(api.deadlineEnforcement.isEnforcementEnabled);

useEffect(() => {
  if (enforcementEnabled) {
    checkAndEnforceDeadlines();
  }
}, [enforcementEnabled]);
```

---

#### `getAutoClosureAlerts` - Query

Get unread auto-closure alerts for dashboard display.

```typescript
getAutoClosureAlerts(): Promise<AutoClosureAlert[]>
```

**Returns:**
```typescript
interface AutoClosureAlert {
  notificationId: Id<"notifications">;
  caseId: Id<"cases"> | null;
  title: string;
  message: string;
  closureReason: string;
  employerName: string;
  beneficiaryIdentifier: string;
  createdAt: number;
  isRead: boolean;
}
```

**Authentication:** Uses `getCurrentUserIdOrNull()` - returns empty array if unauthenticated

**Example:**
```typescript
const alerts = useQuery(api.deadlineEnforcement.getAutoClosureAlerts);

if (alerts && alerts.length > 0) {
  return (
    <AlertBanner>
      {alerts.length} case(s) were automatically closed due to deadline violations
    </AlertBanner>
  );
}
```

---

#### `checkAndEnforceDeadlines` - Mutation

Check and enforce deadlines for the current user's cases.

```typescript
checkAndEnforceDeadlines(): Promise<EnforcementResult>
```

**Returns:**
```typescript
interface EnforcementResult {
  enabled: boolean;              // Whether enforcement was enabled
  casesChecked: number;          // Number of active cases checked
  casesClosed: number;           // Number of cases auto-closed
  closedCases: Array<{
    caseId: string;
    employerName: string;
    beneficiaryIdentifier: string;
    violationType: string;       // e.g., "pwd_expired", "filing_window_missed"
    reason: string;              // Human-readable reason
  }>;
}
```

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Enforcement Rules:**
| Violation Type | Condition | Action |
|---------------|-----------|--------|
| `pwd_expired` | PWD expiration date passed | Close case |
| `recruitment_window_missed` | Recruitment window closed without completion | Close case |
| `filing_window_missed` | Filing window closed without filing | Close case |
| `eta9089_expired` | ETA 9089 certification expired | Close case |

**Side Effects:**
1. Closes cases with violations (sets `caseStatus: "closed"`, `closureReason`)
2. Creates `auto_closure` notification for each closed case
3. Schedules auto-closure email for each closed case

**Example:**
```typescript
const checkAndEnforce = useMutation(api.deadlineEnforcement.checkAndEnforceDeadlines);

const result = await checkAndEnforce();

if (result.casesClosed > 0) {
  toast.warning(`${result.casesClosed} case(s) auto-closed due to deadline violations`);
}
```

---

#### `dismissAutoClosureAlert` - Mutation

Dismiss a single auto-closure alert by marking it as read.

```typescript
dismissAutoClosureAlert(args: {
  notificationId: Id<"notifications">;
}): Promise<{ success: true }>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notificationId` | `Id<"notifications">` | Yes | The alert notification to dismiss |

**Returns:** `{ success: true }`

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

**Throws:**
- `"Notification not found"` - Notification doesn't exist
- `"Access denied"` - User doesn't own the notification
- `"Not an auto-closure notification"` - Wrong notification type

---

#### `dismissAllAutoClosureAlerts` - Mutation

Dismiss all auto-closure alerts for the current user.

```typescript
dismissAllAutoClosureAlerts(): Promise<{
  success: true;
  dismissedCount: number;
}>
```

**Returns:** `{ success: true, dismissedCount: number }`

**Authentication:** Uses `getCurrentUserId()` - throws if unauthenticated

---

### userCaseOrder.ts

Custom drag-drop case ordering with filter snapshot persistence.

**Module Location:** `convex/userCaseOrder.ts`

**Note:** This module handles custom sort order persistence when users drag-drop reorder cases.

---

## Scheduled Jobs

Automated background tasks running on Convex cron scheduler.

**Module Location:** `convex/crons.ts` (scheduling) + `convex/scheduledJobs.ts` (handlers)

---

### Cron Configuration

| Job | Schedule | Handler |
|-----|----------|---------|
| `deadline-reminders` | Daily at 14:00 UTC (9 AM EST) | `checkDeadlineReminders` |
| `notification-cleanup` | Hourly at :30 | `cleanupOldNotifications` |
| `weekly-digest` | Mondays at 14:00 UTC | `sendWeeklyDigest` |

```typescript
// crons.ts configuration
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "deadline-reminders",
  { hourUTC: 14, minuteUTC: 0 },
  internal.scheduledJobs.checkDeadlineReminders
);

crons.hourly(
  "notification-cleanup",
  { minuteUTC: 30 },
  internal.scheduledJobs.cleanupOldNotifications
);

crons.weekly(
  "weekly-digest",
  { dayOfWeek: "monday", hourUTC: 14, minuteUTC: 0 },
  internal.scheduledJobs.sendWeeklyDigest
);

export default crons;
```

---

### `checkDeadlineReminders` - Internal Action

Daily job to check all cases for upcoming deadlines and create notifications.

```typescript
// Internal - called by cron scheduler
checkDeadlineReminders(): Promise<{
  processed: number;
  emailsScheduled: number;
}>
```

**Process:**
1. Query all cases needing reminders (uses deduplication)
2. For each reminder:
   - Create notification in database
   - If user has email enabled and not in quiet hours, schedule email
   - (Future: Schedule push notification if enabled)

**Deadline Types Checked:**
- PWD expiration (`pwdExpirationDate`)
- Filing window closes (`filingWindowCloses`)
- I-140 filing deadline (180 days from ETA 9089 certification)
- RFI response due dates (`rfiEntries[].responseDueDate`)
- RFE response due dates (`rfeEntries[].responseDueDate`)

**Reminder Intervals:** User-configurable (default: 1, 3, 7, 14, 30 days before)

**Deduplication:** Prevents duplicate notifications for same (caseId, deadlineType, daysUntilDeadline)

---

### `cleanupOldNotifications` - Internal Action

Hourly job to delete read notifications older than 90 days.

```typescript
// Internal - called by cron scheduler
cleanupOldNotifications(): Promise<{
  deleted: number;
}>
```

**Keeps:**
- All unread notifications (regardless of age)
- Read notifications newer than 90 days

**Deletes:**
- Read notifications older than 90 days

**Batching:** Processes up to 1000 notifications per run to prevent timeouts

---

### `sendWeeklyDigest` - Internal Action

Weekly job to send summary emails on Mondays.

```typescript
// Internal - called by cron scheduler
sendWeeklyDigest(): Promise<{
  sent: number;
}>
```

**Content:**
- Upcoming deadlines for the week
- Unread notification count
- (Future: Recent case status changes)

**Recipients:** Users with `emailNotificationsEnabled: true`

---

### Internal Queries (scheduledJobs.ts)

```typescript
// Get cases with upcoming deadlines needing reminders
getCasesNeedingReminders(): Promise<DeadlineReminder[]>

// Get users who should receive weekly digest
getUsersForWeeklyDigest(): Promise<Array<{
  userId: Id<"users">;
  email: string;
  profile: Doc<"userProfiles">;
}>>

// Get read notifications older than threshold
getOldReadNotifications(args: {
  olderThan: number;
}): Promise<Id<"notifications">[]>

// Get upcoming deadlines for a user (weekly digest helper)
getUpcomingDeadlinesForUser(args: {
  userId: Id<"users">;
  daysAhead: number;
}): Promise<UpcomingDeadline[]>

// Get unread count for a user (weekly digest helper)
getUnreadCountForUser(args: {
  userId: Id<"users">;
}): Promise<number>
```

---

## Internal Actions

Server-side actions using Node.js runtime for external integrations.

---

### Email Actions (notificationActions.ts)

All email actions use [Resend](https://resend.com) for delivery with React Email templates.

**Environment Variables:**
- `AUTH_RESEND_KEY` - Resend API key
- `APP_URL` - Application URL for email links (defaults to `https://permtracker.app`)

---

#### `sendDeadlineReminderEmail` - Internal Action

Send a deadline reminder email.

```typescript
// Internal - called from scheduled jobs
sendDeadlineReminderEmail(args: {
  notificationId: Id<"notifications">;
  to: string;
  employerName: string;
  beneficiaryName: string;
  deadlineType: string;      // e.g., "PWD Expiration"
  deadlineDate: string;      // e.g., "January 15, 2025"
  daysUntil: number;         // Negative = overdue
  caseId: string;
}): Promise<void>
```

**Subject Generation:**
- Overdue: `"OVERDUE: {deadlineType} for {employerName}"`
- Urgent (<=7 days): `"Urgent: {deadlineType} in {daysUntil} day(s)"`
- Normal: `"Reminder: {deadlineType} in {daysUntil} days"`

**Side Effects:** Marks notification as emailed on success

---

#### `sendStatusChangeEmail` - Internal Action

Send a case status change notification email.

```typescript
// Internal - called from case mutations
sendStatusChangeEmail(args: {
  notificationId: Id<"notifications">;
  to: string;
  beneficiaryName: string;
  companyName: string;
  previousStatus: string;
  newStatus: string;
  changeType: "stage" | "progress";
  changedAt: string;
  caseId: string;
  caseNumber?: string;
}): Promise<void>
```

**Subject:** `"Case {Stage|Progress} Updated: {previousStatus} to {newStatus} - {beneficiaryName}"`

---

#### `sendRfiAlertEmail` - Internal Action

Send an RFI (Request for Information) alert email.

```typescript
// Internal - called from scheduled jobs and case mutations
sendRfiAlertEmail(args: {
  notificationId: Id<"notifications">;
  to: string;
  beneficiaryName: string;
  companyName: string;
  dueDate: string;
  daysRemaining: number;
  receivedDate: string;
  alertType: "new" | "reminder";
  caseId: string;
  caseNumber?: string;
}): Promise<void>
```

**Subject Generation:**
- Overdue: `"OVERDUE: RFI Response for {beneficiaryName}"`
- Urgent (<=7 days): `"Urgent: RFI Response Due in {daysRemaining} day(s)"`
- New: `"New RFI Received - {beneficiaryName}"`
- Reminder: `"RFI Response Due in {daysRemaining} days"`

---

#### `sendRfeAlertEmail` - Internal Action

Send an RFE (Request for Evidence) alert email.

```typescript
// Internal - called from scheduled jobs and case mutations
sendRfeAlertEmail(args: {
  notificationId: Id<"notifications">;
  to: string;
  beneficiaryName: string;
  companyName: string;
  dueDate: string;
  daysRemaining: number;
  receivedDate: string;
  alertType: "new" | "reminder";
  caseId: string;
  caseNumber?: string;
  i140FilingDate?: string;
}): Promise<void>
```

**Subject Generation:** Similar to RFI with 14-day urgent threshold instead of 7

---

#### `sendAutoClosureEmail` - Internal Action

Send a case auto-closure notification email.

```typescript
// Internal - called from deadline enforcement
sendAutoClosureEmail(args: {
  notificationId: Id<"notifications">;
  to: string;
  beneficiaryName: string;
  companyName: string;
  violationType: string;     // Human-readable violation type
  reason: string;            // Human-readable closure reason
  closedAt: string;          // Formatted timestamp
  caseId: string;
  caseNumber?: string;
}): Promise<void>
```

**Subject:** `"CASE CLOSED: {beneficiaryName} at {companyName} - {violationType}"`

**Priority:** Always urgent - auto-closure emails bypass quiet hours

---

### Push Notification Actions (pushNotifications.ts)

Uses Web Push API with VAPID for browser push notifications.

**Environment Variables:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key
- `VAPID_PRIVATE_KEY` - VAPID private key

---

#### `sendPushNotification` - Internal Action

Send a Web Push notification to a user.

```typescript
// Internal - called from scheduled jobs
sendPushNotification(args: {
  userId: Id<"users">;
  title: string;
  body: string;
  url?: string;              // URL to open on click (default: "/dashboard")
  tag?: string;              // Notification grouping tag (default: "perm-tracker")
}): Promise<{
  sent: boolean;
  reason?: string;           // "vapid_not_configured" | "no_subscription" | "push_disabled" | "subscription_expired" | "send_failed"
  error?: string;
}>
```

**Return Values:**
| `sent` | `reason` | Description |
|--------|----------|-------------|
| `true` | - | Push sent successfully |
| `false` | `vapid_not_configured` | VAPID keys missing |
| `false` | `no_subscription` | User has no push subscription |
| `false` | `push_disabled` | User disabled push notifications |
| `false` | `subscription_expired` | Subscription invalid (auto-cleared) |
| `false` | `send_failed` | Web Push API error |

**Side Effects:** Automatically clears expired subscriptions (HTTP 410/404)

---

### Push Subscription Helpers (pushSubscriptions.ts)

Internal functions for push subscription management.

```typescript
// Get user profile for push subscription lookup
getUserProfileById(args: {
  userId: Id<"users">;
}): Promise<UserProfile | null>

// Clear expired/invalid push subscription
clearPushSubscription(args: {
  userId: Id<"users">;
}): Promise<void>
```

---

## Error Handling

### Standard Error Patterns

All API functions follow consistent error patterns:

```typescript
// Authentication errors
throw new Error("Not authenticated");

// Authorization errors
throw new Error("Access denied: you do not own this case");
throw new Error("Access denied: cannot update another user's profile");
throw new Error("Access denied: you do not own this notification");

// Not found errors
throw new Error("Case not found");
throw new Error("Notification not found");
throw new Error("User profile not found");

// Validation errors (from Convex validators)
throw new Error("Invalid date format: expected YYYY-MM-DD");
throw new Error("Invalid push subscription format: not valid JSON");
throw new Error("Invalid push subscription: missing required fields");

// Business logic errors
throw new Error("Not an auto-closure notification");
throw new Error("Cannot delete case with active RFI/RFE");
```

### Error Response Format

Client-side errors are caught and displayed via toast notifications:

```typescript
try {
  await mutation(args);
} catch (error) {
  toast.error(error.message);
}
```

### Error Handling Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Auth (Query) | Return empty/null | `return []` or `return null` |
| Auth (Mutation) | Throw error | `throw new Error("Not authenticated")` |
| Not Found | Don't reveal existence | `throw new Error("Case not found")` even if it exists but isn't owned |
| Validation | Be specific | `throw new Error("Invalid date: {value}")` |
| Email Failures | Log but don't fail | `console.error(...); return` |

---

## Cross-Cutting Patterns

### Authentication Pattern

Two authentication helpers handle different scenarios:

```typescript
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

// Query pattern - graceful null return (for sign-out handling)
export const myQuery = query({
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return []; // or null, or default value
    }
    // ... rest of query
  },
});

// Mutation pattern - throw on null (requires auth)
export const myMutation = mutation({
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    // throws "Not authenticated" if null
    // ... rest of mutation
  },
});
```

**When to use which:**
- `getCurrentUserIdOrNull()` - Queries that should gracefully handle sign-out
- `getCurrentUserId()` - Mutations that require authentication

---

### Ownership Verification Pattern

```typescript
// Always verify ownership before returning/modifying data
const caseDoc = await ctx.db.get(args.caseId);

// Pattern 1: Don't reveal existence (security-sensitive)
if (!caseDoc || caseDoc.userId !== userId) {
  throw new Error("Case not found"); // Don't reveal it exists
}

// Pattern 2: Check each condition separately (for debugging)
if (!caseDoc) {
  throw new Error("Case not found");
}
if (caseDoc.userId !== userId) {
  throw new Error("Access denied: you do not own this case");
}

// Pattern 3: Filter query results (bulk operations)
const notifications = await ctx.db.query("notifications")
  .collect();
return notifications.filter(n => n.userId === userId);
```

---

### Soft Delete Pattern

```typescript
// Soft delete with timestamp
await ctx.db.patch(caseId, {
  deletedAt: Date.now(),
  updatedAt: Date.now(),
});

// Query excluding soft-deleted records
const activeCases = await ctx.db
  .query("cases")
  .withIndex("by_user_id", (q) => q.eq("userId", userId))
  .filter((q) => q.eq(q.field("deletedAt"), undefined))
  .collect();

// Include deleted for admin/history views
const allCases = await ctx.db
  .query("cases")
  .withIndex("by_user_id", (q) => q.eq("userId", userId))
  .collect(); // No deletedAt filter
```

---

### Pagination Patterns

#### Cursor-Based Pagination (Recommended)

Uses compound cursor format for uniqueness: `{timestamp}|{_id}`

```typescript
export const getNotifications = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit = 20 }) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return { notifications: [], nextCursor: null, hasMore: false };

    // Parse compound cursor
    let cursorTimestamp: number | undefined;
    let cursorId: string | undefined;
    if (cursor) {
      const [ts, id] = cursor.split("|");
      cursorTimestamp = parseInt(ts!, 10);
      cursorId = id;
    }

    // Query with cursor position
    let query = ctx.db
      .query("notifications")
      .withIndex("by_user_and_created", (q) => q.eq("userId", userId))
      .order("desc");

    const all = await query.collect();

    // Apply cursor filter manually for compound cursor
    let startIndex = 0;
    if (cursorTimestamp && cursorId) {
      startIndex = all.findIndex(
        (n) => n.createdAt < cursorTimestamp ||
               (n.createdAt === cursorTimestamp && n._id <= cursorId)
      );
      if (startIndex === -1) startIndex = all.length;
    }

    const page = all.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < all.length;

    // Build next cursor
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem
      ? `${lastItem.createdAt}|${lastItem._id}`
      : null;

    return { notifications: page, nextCursor, hasMore };
  },
});
```

#### Convex Native Pagination

For simpler cases, use Convex's built-in pagination:

```typescript
export const listCases = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit = 20 }) => {
    const results = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ cursor, numItems: limit });

    return {
      items: results.page,
      nextCursor: results.continueCursor,
      hasMore: !results.isDone,
    };
  },
});
```

---

### Batching Patterns

For operations that may affect many records, use batching to prevent timeouts.

#### Batched Update Pattern

```typescript
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const BATCH_SIZE = 100;

    // Get batch of unread notifications
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .take(BATCH_SIZE);

    const now = Date.now();
    let count = 0;

    for (const notification of unread) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
      count++;
    }

    // Check if more remain
    const remaining = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .take(1);

    return { count, hasMore: remaining.length > 0 };
  },
});
```

#### Client-Side Batch Loop

```typescript
const handleMarkAllAsRead = async () => {
  let result = await markAllAsRead();
  let totalMarked = result.count;

  // Continue until all are processed
  while (result.hasMore) {
    result = await markAllAsRead();
    totalMarked += result.count;
  }

  toast.success(`Marked ${totalMarked} notifications as read`);
};
```

#### Batched Deletion Pattern

```typescript
export const deleteAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const BATCH_SIZE = 100;

    const readNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isRead"), true))
      .take(BATCH_SIZE);

    for (const notification of readNotifications) {
      await ctx.db.delete(notification._id);
    }

    // Check if more remain
    const remaining = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isRead"), true))
      .take(1);

    return { count: readNotifications.length, hasMore: remaining.length > 0 };
  },
});
```

---

### Notification Creation Patterns

#### Standard Notification Creation

```typescript
// From case mutations (status changes, etc.)
const notificationId = await ctx.db.insert("notifications", {
  userId: userId as Id<"users">,
  caseId: caseDoc._id,
  type: "status_change",
  title: `Case status updated to ${newStatus}`,
  message: `${caseDoc.employerName} - ${caseDoc.beneficiaryIdentifier}`,
  priority: "normal",
  isRead: false,
  emailSent: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

#### Notification with Email Scheduling

```typescript
import { shouldSendEmail, buildUserNotificationPrefs } from "./lib/notificationHelpers";
import { internal } from "./_generated/api";

// Create notification
const notificationId = await ctx.db.insert("notifications", {
  userId: userId as Id<"users">,
  caseId: caseDoc._id,
  type: "deadline_reminder",
  title,
  message,
  priority: calculatePriority(daysUntilDeadline),
  deadlineType: "pwd_expiration",
  deadlineDate: pwdExpirationDate,
  daysUntilDeadline: BigInt(daysUntilDeadline),
  isRead: false,
  emailSent: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Schedule email if preferences allow
const userProfile = await ctx.db
  .query("userProfiles")
  .withIndex("by_user_id", (q) => q.eq("userId", userId))
  .first();

if (shouldSendEmail("deadline_reminder", priority, buildUserNotificationPrefs(userProfile))) {
  const user = await ctx.db.get(userId as Id<"users">);
  if (user?.email) {
    await ctx.scheduler.runAfter(0, internal.notificationActions.sendDeadlineReminderEmail, {
      notificationId,
      to: user.email,
      employerName: caseDoc.employerName,
      // ... other params
    });
  }
}
```

#### Notification Helper Functions

```typescript
import {
  generateNotificationTitle,
  generateNotificationMessage,
  calculatePriority,
  shouldSendEmail,
  buildUserNotificationPrefs,
  formatDeadlineType,
} from "./lib/notificationHelpers";

// Generate consistent titles
const title = generateNotificationTitle("deadline_reminder", {
  deadlineType: "pwd_expiration",
  daysUntilDeadline: 7,
  caseLabel: "John Doe at Acme Corp",
});
// Returns: "PWD Expiration in 7 days: John Doe at Acme Corp"

// Calculate priority based on urgency
const priority = calculatePriority(daysUntilDeadline, "deadline_reminder");
// Returns: "urgent" if <= 0, "high" if <= 3, "normal" if <= 7, "low" otherwise

// Check if email should be sent
const send = shouldSendEmail(
  "deadline_reminder",
  priority,
  userPrefs,
  currentTimeInTimezone  // Optional, for quiet hours check
);
```

---

### Data Validation Patterns

#### Convex Argument Validators

```typescript
import { v } from "convex/values";

export const createCase = mutation({
  args: {
    // Required fields
    employerName: v.string(),
    beneficiaryIdentifier: v.string(),

    // Optional fields with defaults applied in handler
    positionTitle: v.optional(v.string()),

    // Enum validation
    caseStatus: v.union(
      v.literal("pwd"),
      v.literal("recruitment"),
      v.literal("eta_9089"),
      v.literal("i140"),
      v.literal("complete"),
      v.literal("closed")
    ),

    // Optional ID references
    relatedCaseId: v.optional(v.id("cases")),

    // Nested objects
    rfiEntry: v.optional(v.object({
      receivedDate: v.string(),
      responseDueDate: v.string(),
      description: v.optional(v.string()),
    })),

    // Arrays
    additionalRecruitmentMethods: v.optional(v.array(v.object({
      method: v.string(),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
    }))),

    // BigInt for large numbers (stored efficiently)
    urgentDeadlineDays: v.optional(v.int64()),
  },
  handler: async (ctx, args) => {
    // Additional validation beyond schema
    if (args.employerName.trim().length === 0) {
      throw new Error("Employer name cannot be empty");
    }
    // ...
  },
});
```

#### Date Validation Pattern

```typescript
// All dates are ISO strings (YYYY-MM-DD)
function validateDateString(dateStr: string, fieldName: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new Error(`Invalid ${fieldName}: expected YYYY-MM-DD format`);
  }

  const date = new Date(dateStr + "T00:00:00Z");
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: not a valid date`);
  }
}

// Date sequence validation
function validateDateSequence(
  earlierDate: string | undefined,
  laterDate: string | undefined,
  earlierName: string,
  laterName: string
): void {
  if (earlierDate && laterDate && earlierDate > laterDate) {
    throw new Error(`${earlierName} must be before ${laterName}`);
  }
}
```

#### Business Rule Validation

Use the central PERM validation module:

```typescript
import { validateCase, validatePWD, validateRecruitment } from "../lib/perm";

// Full case validation
const result = validateCase(caseData);
if (!result.valid) {
  // result.errors contains all validation failures
  const errorMessages = result.errors.map(e => e.message).join("; ");
  throw new Error(`Validation failed: ${errorMessages}`);
}

// Specific stage validation
const pwdResult = validatePWD({
  pwd_filing_date: caseData.pwdFilingDate,
  pwd_determination_date: caseData.pwdDeterminationDate,
  pwd_expiration_date: caseData.pwdExpirationDate,
});
```

---

### Cascade Update Pattern

When updating dates, use the cascade system to auto-calculate dependent dates:

```typescript
import { applyCascade, applyCascadeMultiple } from "../lib/perm";

// Single field cascade
const updatedCase = applyCascade(currentCase, {
  field: "pwd_determination_date",
  value: "2024-06-15",
});
// Automatically sets pwd_expiration_date

// Multiple field cascade
const updatedCase = applyCascadeMultiple(currentCase, [
  { field: "pwd_determination_date", value: "2024-06-15" },
  { field: "notice_of_filing_start_date", value: "2024-08-01" },
]);
// Cascades both changes with proper ordering
```

---

### Index Usage Pattern

Always use indexes for efficient queries:

```typescript
// Good: Uses index
const cases = await ctx.db
  .query("cases")
  .withIndex("by_user_id", (q) => q.eq("userId", userId))
  .collect();

// Good: Uses compound index
const notifications = await ctx.db
  .query("notifications")
  .withIndex("by_user_and_unread", (q) =>
    q.eq("userId", userId).eq("isRead", false)
  )
  .collect();

// Good: Uses range query on compound index
const logs = await ctx.db
  .query("auditLogs")
  .withIndex("by_user_and_timestamp", (q) =>
    q
      .eq("userId", userId)
      .gte("timestamp", startDate)
      .lte("timestamp", endDate)
  )
  .collect();

// Avoid: Full table scan with filter
const cases = await ctx.db
  .query("cases")
  .filter((q) => q.eq(q.field("employerName"), "Acme Corp"))  // No index!
  .collect();
```

---

## Best Practices

### 1. Use Reactive Queries

```typescript
// DO: Use useQuery for reactive data
const cases = useQuery(api.cases.list);

// DON'T: Manually poll for updates
// The query auto-updates when underlying data changes
```

### 2. Batch Operations When Possible

```typescript
// DO: Use bulk operations for multiple items
await bulkRemove({ ids: selectedCaseIds });

// DON'T: Call single operations in a loop
for (const id of ids) {
  await remove({ id }); // Inefficient!
}
```

### 3. Use Appropriate Indexes

Queries use indexes for efficient filtering. Available indexes:

```typescript
// cases table indexes
"by_user_id"                    // Filter by owner
"by_user_and_updated_at"        // Sort by update time
"by_user_and_status"            // Filter by status
"by_user_and_deadline"          // Sort by deadline

// notifications table indexes
"by_user_id"                    // Filter by owner
"by_user_and_unread"            // Filter unread
"by_case_id"                    // Filter by case
```

### 4. Handle Authentication Gracefully

```typescript
// Queries return empty data during sign-out
const cases = useQuery(api.cases.list) ?? [];

// Check for null before rendering
if (cases === undefined) {
  return <Skeleton />;
}
```

### 5. Validate Before Mutating

```typescript
// Client-side validation
const result = validateCase(formData);
if (!result.valid) {
  setErrors(result.errors);
  return;
}

// Server-side validation happens automatically
await createCase(formData);
```

---

*This documentation is auto-generated from the codebase and updated with each release.*
