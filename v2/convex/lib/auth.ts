/**
 * Authentication and Authorization Helper Library
 *
 * This module provides security helpers for Convex functions to:
 * - Get authenticated user information
 * - Verify ownership of resources
 * - Check firm-level access permissions
 * - Enforce multi-tenancy isolation
 *
 * All helpers respect soft-delete (deletedAt) semantics.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type AuthContext = QueryCtx | MutationCtx;

/**
 * Get the current authenticated user's ID
 * @throws {Error} If user is not authenticated
 */
export async function getCurrentUserId(ctx: AuthContext): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("not authenticated");
  }
  return userId;
}

/**
 * Get the current authenticated user's ID, or null if not authenticated
 */
export async function getCurrentUserIdOrNull(ctx: AuthContext): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

/**
 * Get the current user's profile (excluding soft-deleted profiles)
 * @throws {Error} If user is not authenticated or profile not found
 */
export async function getCurrentUserProfile(ctx: AuthContext): Promise<Doc<"userProfiles">> {
  const userId = await getCurrentUserId(ctx);

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  if (!profile) {
    throw new Error("User profile not found");
  }

  return profile;
}



/**
 * Verify that the current user owns a specific resource
 * @param resource - The resource to check ownership of (or null)
 * @param resourceName - Name of the resource type (for error messages)
 * @throws {Error} If resource doesn't exist or user doesn't own it
 */
export async function verifyOwnership<T extends { userId: string }>(
  ctx: AuthContext,
  resource: T | null,
  resourceName: string
): Promise<void> {
  if (!resource) {
    throw new Error(`${resourceName} not found`);
  }

  const userId = await getCurrentUserId(ctx);

  if (resource.userId !== userId) {
    throw new Error(`Access denied: you do not own this ${resourceName}`);
  }
}


/**
 * Look up a user document by email, normalized lower-case + trimmed.
 * Returns null if the email is empty or no user matches.
 *
 * Centralizes the `users.email` index lookup so callers don't need an
 * `as any` cast to satisfy the strict @convex-dev/auth users table type.
 */
export async function getUserByEmail(
  ctx: AuthContext,
  email: string,
): Promise<Doc<"users"> | null> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .first();
}

/**
 * Extract the primary user ID from an action's identity subject.
 *
 * In actions, `ctx.auth.getUserIdentity()` returns an identity whose
 * `subject` may contain multiple IDs joined by `|` (when a user has
 * multiple auth methods). The first ID is the primary user ID.
 *
 * @param subject - The identity.subject string
 * @returns The primary user ID as Id<"users">
 */
export function extractUserIdFromAction(subject: string): Id<"users"> {
  return subject.split("|")[0] as Id<"users">;
}

// ============================================================================
// EMAIL VERIFICATION HELPERS (source of truth: authAccounts table)
// ============================================================================

/**
 * Verification predicate: an auth account proves email ownership if it is
 * Google OAuth (always verified) or a password account with emailVerified set.
 */
function isVerifiedAccount(account: { provider: string; emailVerified?: string }): boolean {
  return account.provider === "google" || (account.provider === "password" && !!account.emailVerified);
}

/**
 * Check if a user's email is verified via the authAccounts table.
 *
 * Uses authAccounts as the canonical source of truth:
 * - Google OAuth = always verified (Google verifies email ownership)
 * - Password provider with emailVerified field set = verified (OTP-confirmed)
 *
 * This replaces checking users.emailVerificationTime, which was unreliable
 * because the custom createOrUpdateUser callback bypassed the library's
 * default setter for that field.
 *
 * Use for per-user checks (1 indexed query). For batch jobs that process
 * all users, use getVerifiedUserIds() instead to avoid N+1 queries.
 */
export async function isEmailVerified(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();

  return accounts.some(isVerifiedAccount);
}

/**
 * Bulk-check email verification for all users.
 *
 * Loads all authAccounts once and builds a Set of verified user IDs.
 * Use in batch/cron jobs (getCasesNeedingReminders, getUsersForWeeklyDigest,
 * getAllUsersForBlast) to avoid N+1 per-user queries.
 *
 * Verification logic matches isEmailVerified(): Google = verified,
 * password + emailVerified = verified.
 */
export async function getVerifiedUserIds(ctx: QueryCtx): Promise<Set<Id<"users">>> {
  const allAccounts = await ctx.db.query("authAccounts").collect();
  const verified = new Set<Id<"users">>();

  for (const account of allAccounts) {
    if (isVerifiedAccount(account)) {
      verified.add(account.userId);
    }
  }

  return verified;
}
