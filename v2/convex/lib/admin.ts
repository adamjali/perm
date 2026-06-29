/**
 * Admin Authorization and Helper Functions
 *
 * Provides admin-specific authorization guards and helper functions.
 * Only the email defined in ADMIN_EMAIL is considered an admin.
 */

import { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserId } from "./auth";

/**
 * Get the admin email address from ADMIN_EMAIL env var.
 * Read at call time (not module load time) so tests can set it dynamically
 * and Convex env var changes take effect without redeployment.
 */
export function getAdminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL;
}

/**
 * Get the recipient for CRITICAL alerts (security/abuse + system errors).
 *
 * These go to a direct personal inbox (SECURITY_ALERT_EMAIL) so they arrive even
 * if the permtracker.app domain mail or the ADMIN_EMAIL account is down/
 * compromised. Falls back to ADMIN_EMAIL if the security address isn't set.
 * Note: ADMIN_EMAIL stays the admin-identity gate — do not repurpose it.
 */
export function getSecurityAlertEmail(): string | undefined {
  return process.env.SECURITY_ALERT_EMAIL ?? getAdminEmail();
}

/** @deprecated Use getAdminEmail() — kept for backwards compat in tests */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Admin authorization guard.
 * Throws if current user is not an admin.
 *
 * @throws {Error} If not authenticated, not admin, or ADMIN_EMAIL not configured
 */
export async function requireAdmin(ctx: QueryCtx): Promise<void> {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    throw new Error("Admin not configured: ADMIN_EMAIL environment variable is not set");
  }

  const userId = await getCurrentUserId(ctx);

  const user = await ctx.db.get(userId);

  if (!user || user.email !== adminEmail) {
    throw new Error("Unauthorized: Admin access required");
  }
}

/**
 * Get the current admin user's profile.
 *
 * Combines requireAdmin check + profile lookup into a single helper.
 * Use in admin mutations that need to read/write the admin's own profile.
 *
 * @throws {Error} If not admin or profile not found
 */
export async function getAdminProfile(ctx: QueryCtx): Promise<Doc<"userProfiles">> {
  await requireAdmin(ctx);
  const userId = await getCurrentUserId(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .first();

  if (!profile) {
    throw new Error("User profile not found");
  }
  return profile;
}

/**
 * Helper function to get admin dashboard data.
 * Shared between the public query and internal query.
 *
 * Bulk-loads all 5 tables, builds lookup maps, assembles per-user summary in one pass.
 * Default sort: lastActivity descending. Supports dynamic sorting via opts.sortBy/sortOrder.
 */
export type UserSummaryRow = {
  userId: Id<"users">;
  email: string;
  name: string;
  emailVerified: boolean;
  verificationMethod: "google" | "password_otp" | "no_auth_account" | "unverified";
  authProviders: string[];
  accountCreated: number;
  lastLoginTime: number | null;
  totalLogins: number;
  totalCases: number;
  activeCases: number;
  deletedCases: number;
  lastCaseUpdate: number | null;
  userType: "individual" | "firm_admin" | "firm_member";
  firmName: string | null;
  accountStatus: "active" | "pending_deletion" | "deleted";
  deletedAt: number | null;
  termsAccepted: number | null;
  termsVersion: string | null;
  lastActivity: number;
};

export interface AdminDashboardData {
  generatedAt: number;
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  pendingDeletion: number;
  usersWithCases: number;
  totalCasesInSystem: number;
  users: UserSummaryRow[];
  totalCount: number;
  totalPages: number;
  page: number;
}

export interface AdminPaginationOpts {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

function compareUserField(
  a: UserSummaryRow,
  b: UserSummaryRow,
  field: string,
  order: "asc" | "desc"
): number {
  const aVal = a[field as keyof UserSummaryRow];
  const bVal = b[field as keyof UserSummaryRow];

  if (aVal === null && bVal === null) return 0;
  if (aVal === null || aVal === undefined) return 1;
  if (bVal === null || bVal === undefined) return -1;

  let cmp = 0;
  if (typeof aVal === "boolean" && typeof bVal === "boolean") {
    cmp = Number(aVal) - Number(bVal);
  } else if (typeof aVal === "string" && typeof bVal === "string") {
    cmp = aVal.localeCompare(bVal);
  } else if (typeof aVal === "number" && typeof bVal === "number") {
    cmp = aVal - bVal;
  } else if (Array.isArray(aVal) && Array.isArray(bVal)) {
    cmp = aVal.join(",").localeCompare(bVal.join(","));
  }

  return order === "asc" ? cmp : -cmp;
}

export async function getAdminDashboardDataHelper(
  ctx: QueryCtx,
  opts: AdminPaginationOpts = {}
): Promise<AdminDashboardData> {
  const page = opts.page ?? 0;
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const sortBy = opts.sortBy ?? "lastActivity";
  const sortOrder = opts.sortOrder ?? "desc";
  const search = opts.search?.toLowerCase().trim();

  // Bulk-load all 5 tables (with safety cap)
  const [users, authAccounts, authSessions, userProfiles, cases] = await Promise.all([
    ctx.db.query("users").take(2000),
    ctx.db.query("authAccounts").take(5000),
    ctx.db.query("authSessions").take(10000),
    ctx.db.query("userProfiles").take(2000),
    ctx.db.query("cases").take(10000),
  ]);

  // Build lookup maps: userId -> docs[]
  const accountsByUserId = new Map<Id<"users">, Doc<"authAccounts">[]>();
  for (const account of authAccounts) {
    const existing = accountsByUserId.get(account.userId) ?? [];
    existing.push(account);
    accountsByUserId.set(account.userId, existing);
  }

  const sessionsByUserId = new Map<Id<"users">, Doc<"authSessions">[]>();
  for (const session of authSessions) {
    const existing = sessionsByUserId.get(session.userId) ?? [];
    existing.push(session);
    sessionsByUserId.set(session.userId, existing);
  }

  const profileByUserId = new Map<Id<"users">, Doc<"userProfiles">>();
  for (const profile of userProfiles) {
    profileByUserId.set(profile.userId, profile);
  }

  const casesByUserId = new Map<Id<"users">, Doc<"cases">[]>();
  for (const c of cases) {
    const existing = casesByUserId.get(c.userId) ?? [];
    existing.push(c);
    casesByUserId.set(c.userId, existing);
  }

  // Aggregate stats
  let totalUsers = 0;
  let activeUsers = 0;
  let deletedUsers = 0;
  let pendingDeletion = 0;
  let usersWithCases = 0;

  // Assemble per-user summary
  const userSummaries = users.map((user) => {
    const accounts = accountsByUserId.get(user._id) ?? [];
    const sessions = sessionsByUserId.get(user._id) ?? [];
    const profile = profileByUserId.get(user._id);
    const userCases = casesByUserId.get(user._id) ?? [];

    // Auth providers
    const authProviders = accounts.map((a) => a.provider);

    // Email verification: Google = always verified; password = check emailVerified field
    const hasGoogle = accounts.some((a) => a.provider === "google");
    const hasPasswordVerified = accounts.some(
      (a) => a.provider === "password" && !!a.emailVerified
    );
    const emailVerified = hasGoogle || hasPasswordVerified;

    // Verification method
    let verificationMethod: UserSummaryRow["verificationMethod"];
    if (accounts.length === 0) {
      verificationMethod = "no_auth_account";
    } else if (hasGoogle) {
      verificationMethod = "google";
    } else if (hasPasswordVerified) {
      verificationMethod = "password_otp";
    } else {
      verificationMethod = "unverified";
    }

    // Login stats: prefer persistent fields, fall back to session count for pre-existing users
    const lastLoginTime = profile?.lastLoginAt
      ?? (sessions.length > 0 ? Math.max(...sessions.map((s) => s._creationTime)) : null);
    const totalLogins = profile?.loginCount ?? sessions.length;

    // Case stats
    const totalCasesCount = userCases.length;
    const activeCases = userCases.filter(
      (c) =>
        c.deletedAt === undefined &&
        c.caseStatus !== "closed" &&
        !(c.caseStatus === "i140" && c.progressStatus === "approved")
    ).length;
    const deletedCases = userCases.filter((c) => c.deletedAt !== undefined).length;
    const lastCaseUpdate = userCases.length > 0
      ? Math.max(...userCases.map((c) => c.updatedAt))
      : null;

    // Account status
    let accountStatus: "active" | "pending_deletion" | "deleted";
    if (user.deletedAt !== undefined) {
      accountStatus = "deleted";
    } else if (profile?.deletedAt !== undefined) {
      accountStatus = "pending_deletion";
    } else {
      accountStatus = "active";
    }

    // Last activity: max of (lastLogin, lastCaseUpdate, profile updatedAt)
    const activityCandidates: number[] = [];
    if (lastLoginTime !== null) activityCandidates.push(lastLoginTime);
    if (lastCaseUpdate !== null) activityCandidates.push(lastCaseUpdate);
    if (profile?.updatedAt) activityCandidates.push(profile.updatedAt);
    const lastActivity = activityCandidates.length > 0
      ? Math.max(...activityCandidates)
      : user._creationTime;

    // Aggregate counters
    totalUsers++;
    if (accountStatus === "active") activeUsers++;
    if (accountStatus === "deleted") deletedUsers++;
    if (accountStatus === "pending_deletion") pendingDeletion++;
    if (totalCasesCount > 0) usersWithCases++;

    return {
      userId: user._id,
      email: user.email ?? "(no email)",
      name: profile?.fullName ?? user.name ?? "(no name)",
      emailVerified,
      verificationMethod,
      authProviders,
      accountCreated: user._creationTime,
      lastLoginTime,
      totalLogins,
      totalCases: totalCasesCount,
      activeCases,
      deletedCases,
      lastCaseUpdate,
      userType: (profile?.userType || "individual") as UserSummaryRow["userType"],
      firmName: profile?.firmName ?? null,
      accountStatus,
      deletedAt: user.deletedAt ?? null,
      termsAccepted: profile?.termsAcceptedAt ?? null,
      termsVersion: profile?.termsVersion ?? null,
      lastActivity,
    };
  });

  // Search filter
  const filtered = search
    ? userSummaries.filter((u) =>
        u.email.toLowerCase().includes(search) ||
        u.name.toLowerCase().includes(search) ||
        u.userType.toLowerCase().includes(search) ||
        u.accountStatus.toLowerCase().includes(search) ||
        (u.firmName?.toLowerCase().includes(search) ?? false) ||
        u.userId.toLowerCase().includes(search)
      )
    : userSummaries;

  // Sort
  filtered.sort((a, b) => compareUserField(a, b, sortBy, sortOrder));

  // Paginate
  const totalCount = filtered.length;
  const totalPagesCalc = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPagesCalc - 1);
  const start = safePage * pageSize;
  const pageUsers = filtered.slice(start, start + pageSize);

  return {
    generatedAt: Date.now(),
    totalUsers,
    activeUsers,
    deletedUsers,
    pendingDeletion,
    usersWithCases,
    totalCasesInSystem: cases.length,
    users: pageUsers,
    totalCount,
    totalPages: totalPagesCalc,
    page: safePage,
  };
}
