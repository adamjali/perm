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
 * Admin email address (must match frontend constant)
 */
export const ADMIN_EMAIL = "admin@yahoo.com";

/**
 * Admin authorization guard.
 * Throws if current user is not an admin.
 *
 * @throws {Error} If not authenticated or not admin
 */
export async function isAdmin(ctx: QueryCtx): Promise<void> {
  const userId = await getCurrentUserId(ctx);

  // Get the user record
  const user = await ctx.db.get(userId as Id<"users">);

  if (!user || user.email !== ADMIN_EMAIL) {
    throw new Error("Unauthorized: Admin access required");
  }
}

/**
 * Helper function to get admin dashboard data.
 * Shared between the public query and internal query.
 *
 * Bulk-loads all 5 tables, builds lookup maps, assembles per-user summary in one pass.
 * Sorted by lastActivity descending (most recently active first).
 */
export async function getAdminDashboardDataHelper(ctx: QueryCtx) {
  // Bulk-load all 5 tables
  const [users, authAccounts, authSessions, userProfiles, cases] = await Promise.all([
    ctx.db.query("users").collect(),
    ctx.db.query("authAccounts").collect(),
    ctx.db.query("authSessions").collect(),
    ctx.db.query("userProfiles").collect(),
    ctx.db.query("cases").collect(),
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
      (a) => a.provider === "password" && a.emailVerified !== undefined
    );
    const emailVerified = hasGoogle || hasPasswordVerified;

    // Verification method
    let verificationMethod: string;
    if (accounts.length === 0) {
      verificationMethod = "no_auth_account";
    } else if (hasGoogle) {
      verificationMethod = "google";
    } else if (hasPasswordVerified) {
      verificationMethod = "password_otp";
    } else {
      verificationMethod = "unverified";
    }

    // Session stats
    const lastLoginTime = sessions.length > 0
      ? Math.max(...sessions.map((s) => s._creationTime))
      : null;
    const totalLogins = sessions.length;

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
      userType: profile ? profile.userType : "(no profile)",
      firmName: profile?.firmName ?? null,
      accountStatus,
      deletedAt: user.deletedAt ?? null,
      termsAccepted: profile?.termsAcceptedAt ?? null,
      termsVersion: profile?.termsVersion ?? null,
      lastActivity,
    };
  });

  // Sort by lastActivity descending
  userSummaries.sort((a, b) => b.lastActivity - a.lastActivity);

  return {
    generatedAt: Date.now(),
    totalUsers,
    activeUsers,
    deletedUsers,
    pendingDeletion,
    usersWithCases,
    totalCasesInSystem: cases.length,
    users: userSummaries,
  };
}
