/**
 * User Profile Helper Functions
 *
 * Utilities for managing userProfiles data, particularly for handling
 * cascading operations when related entities change.
 */

import { Id } from "../_generated/dataModel";

/**
 * Dismissed deadline entry stored in userProfiles
 */
export interface DismissedDeadline {
  caseId: Id<"cases">;
  deadlineType: string;
  dismissedAt: number;
}

/**
 * Removes all dismissed deadlines for a specific case from a user's profile.
 *
 * This should be called when a case is deleted to prevent orphaned references.
 * The dismissedDeadlines array uses v.id("cases") which creates a hard dependency,
 * so we must clean up when cases are removed.
 *
 * @param dismissedDeadlines - Current array of dismissed deadlines from userProfile
 * @param caseId - The ID of the case being deleted
 * @returns New array with the case's entries removed
 *
 * @example
 * ```typescript
 * // In a case deletion mutation:
 * const userProfile = await ctx.db.get(userProfileId);
 * const cleanedDeadlines = cleanDismissedDeadlinesForCase(
 *   userProfile.dismissedDeadlines,
 *   caseId
 * );
 * await ctx.db.patch(userProfileId, { dismissedDeadlines: cleanedDeadlines });
 * ```
 */
export function cleanDismissedDeadlinesForCase(
  dismissedDeadlines: DismissedDeadline[],
  caseId: Id<"cases">
): DismissedDeadline[] {
  return dismissedDeadlines.filter((dd) => dd.caseId !== caseId);
}

/**
 * Removes all dismissed deadlines for multiple cases at once.
 *
 * Useful for bulk case deletion operations.
 *
 * @param dismissedDeadlines - Current array of dismissed deadlines from userProfile
 * @param caseIds - Array of case IDs being deleted
 * @returns New array with all specified cases' entries removed
 */
export function cleanDismissedDeadlinesForCases(
  dismissedDeadlines: DismissedDeadline[],
  caseIds: Id<"cases">[]
): DismissedDeadline[] {
  const caseIdSet = new Set(caseIds);
  return dismissedDeadlines.filter((dd) => !caseIdSet.has(dd.caseId));
}

/**
 * Checks if a dismissed deadline entry references an orphaned case.
 *
 * This is useful for cleanup routines that want to validate existing data.
 *
 * @param dismissedDeadline - A single dismissed deadline entry
 * @param validCaseIds - Set of currently valid case IDs
 * @returns true if the entry references a case that no longer exists
 */
export function isOrphanedDismissedDeadline(
  dismissedDeadline: DismissedDeadline,
  validCaseIds: Set<Id<"cases">>
): boolean {
  return !validCaseIds.has(dismissedDeadline.caseId);
}

/**
 * Removes orphaned dismissed deadline entries.
 *
 * Use this for data cleanup/maintenance to remove entries that reference
 * deleted cases.
 *
 * @param dismissedDeadlines - Current array of dismissed deadlines from userProfile
 * @param validCaseIds - Set of currently valid case IDs for this user
 * @returns New array with orphaned entries removed
 */
export function removeOrphanedDismissedDeadlines(
  dismissedDeadlines: DismissedDeadline[],
  validCaseIds: Set<Id<"cases">>
): DismissedDeadline[] {
  return dismissedDeadlines.filter((dd) => validCaseIds.has(dd.caseId));
}
