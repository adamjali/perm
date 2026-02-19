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
 * Check if the current user is a firm admin
 * @throws {Error} If user is not authenticated or profile not found
 */
export async function isFirmAdmin(ctx: AuthContext): Promise<boolean> {
  const profile = await getCurrentUserProfile(ctx);
  return profile.userType === "firm_admin";
}

/**
 * Get the current user's effective firm ID
 * - For firm admins: returns their own user ID (they are the firm)
 * - For firm members: returns their firmId
 * @throws {Error} If user is not authenticated or profile not found
 */
export async function getCurrentUserFirmId(ctx: AuthContext): Promise<string> {
  const profile = await getCurrentUserProfile(ctx);

  if (profile.userType === "firm_admin") {
    return profile.userId;
  }

  if (!profile.firmId) {
    throw new Error("User is not associated with a firm");
  }

  return profile.firmId;
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
 * Verify that the current user has firm-level access to a resource
 * Access is granted if:
 * - User directly owns the resource, OR
 * - User is in the same firm as the resource owner
 *
 * @param resource - The resource to check access for (or null)
 * @param resourceName - Name of the resource type (for error messages)
 * @throws {Error} If resource doesn't exist or user doesn't have access
 */
export async function verifyFirmAccess<T extends { userId: string }>(
  ctx: AuthContext,
  resource: T | null,
  resourceName: string
): Promise<void> {
  if (!resource) {
    throw new Error(`${resourceName} not found`);
  }

  const userId = await getCurrentUserId(ctx);

  // Direct ownership
  if (resource.userId === userId) {
    return;
  }

  // Check firm membership
  const currentUserProfile = await getCurrentUserProfile(ctx);
  const resourceOwnerProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", resource.userId as Id<"users">))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  if (!resourceOwnerProfile) {
    throw new Error(`${resourceName} owner profile not found`);
  }

  // Get effective firm IDs
  const currentUserFirmId = currentUserProfile.userType === "firm_admin"
    ? currentUserProfile.userId
    : currentUserProfile.firmId;

  const resourceOwnerFirmId = resourceOwnerProfile.userType === "firm_admin"
    ? resourceOwnerProfile.userId
    : resourceOwnerProfile.firmId;

  // Check if in same firm
  if (currentUserFirmId && resourceOwnerFirmId && currentUserFirmId === resourceOwnerFirmId) {
    return;
  }

  throw new Error(`Access denied: you do not have access to this ${resourceName}`);
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
