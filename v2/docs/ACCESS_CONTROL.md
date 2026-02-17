# Access Control Model

> PERM Tracker authorization architecture for SOC 2 Security (CC6)

## User Roles

| Role | Description | Access |
|------|-------------|--------|
| **User** | Authenticated attorney/paralegal | Own data only |
| **Admin** | Single admin (email-based) | All user data (read/write) + admin dashboard |

## Authentication Flow

### Password Sign-In
1. User submits email + password
2. Frontend calls `checkAuthRateLimit` (pre-flight rate check)
3. If allowed, calls `signIn("password", ...)` via Convex Auth
4. Convex Auth validates credentials, creates session
5. `LoginTracker` component records login timestamp client-side

### Google OAuth
1. User clicks "Sign in with Google"
2. Redirected to Google consent screen
3. On callback, Convex Auth `createOrUpdateUser` links/creates account
4. `onAuthEvent` creates profile via `ensureUserProfileInternal`
5. `PendingTermsHandler` ensures terms acceptance

## Data Isolation

Every Convex function enforces user isolation:

```typescript
// Pattern used in ALL queries and mutations:
const userId = await getCurrentUserId(ctx); // Throws if not authenticated
const cases = await ctx.db
  .query("cases")
  .withIndex("by_user_id", (q) => q.eq("userId", userId))
  .collect();
```

### Index-Based Isolation

All user-owned tables have `by_user_id` indexes. Queries always filter by authenticated user's ID:
- `cases.by_user_id`
- `userProfiles.by_user_id`
- `conversations.by_user_id`
- `notifications.by_user_id`
- `auditLogs.by_user_id`

### Ownership Verification

For single-record operations, `verifyOwnership()` checks `doc.userId === currentUserId`:

```typescript
const caseDoc = await ctx.db.get(args.id);
await verifyOwnership(ctx, caseDoc, "case"); // Throws if not owner
```

## Admin Access

### Guard Function

```typescript
// convex/lib/admin.ts
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getCurrentUserId(ctx);
  const user = await ctx.db.get(userId);
  const adminEmail = process.env.ADMIN_EMAIL; // No fallback — denies admin access if unset
  if (user?.email !== adminEmail) throw new ConvexError("Forbidden: admin access required");
  return userId;
}
```

### Admin Audit Trail

Admin mutations that modify user data log to `auditLogs`:
- `updateUserAdmin` — logs old/new profile values
- `deleteUserAdmin` — logs deletion BEFORE purging user data

### Admin Queries (Read-Only)

Admin queries use `QueryCtx` which cannot write to the database. Audit logging for read-only access is documented as an accepted risk (cannot write audit logs from queries without converting to mutations, which would change semantics).

## Convex Function Visibility

| Type | Visibility | Use Case |
|------|-----------|----------|
| `query` / `mutation` / `action` | Public (client-callable) | User-facing operations |
| `internalQuery` / `internalMutation` / `internalAction` | Internal only | Server-to-server, crons, scheduled jobs |

Internal functions are never exposed to the client API. They are called via `internal.*` references from other server functions or cron jobs.

## Session Management

- Sessions managed by Convex Auth (HttpOnly session cookies)
- 15-minute inactivity timeout with 2-minute warning
- Multi-tab sync prevents orphaned sessions
- Sign-out invalidates session server-side
