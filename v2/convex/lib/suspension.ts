/**
 * Suspension state — single typed view over the userProfiles triplet
 * (suspendedAt, suspendedReason, suspendedUntil).
 *
 * The schema currently stores three independent optional fields, which means
 * "suspended" isn't a single state at the type level — it's any combination
 * of those three being set or unset. This helper collapses the triplet into
 * one nullable union so callers don't have to cast or branch on three fields.
 *
 * If the schema is ever migrated to a nested `suspension` object, swap the
 * read implementation here without touching consumers.
 */

import type { Doc } from "../_generated/dataModel";

export interface Suspension {
  /** When the suspension was applied (epoch ms). */
  at: number;
  /** Free-text reason — admin-supplied or auto-generated. */
  reason: string | null;
  /** When the suspension auto-lifts (epoch ms). null = manual unsuspend required. */
  until: number | null;
}

/**
 * Read suspension state from a userProfiles document.
 * Returns null if not suspended (or if the suspension auto-lifted past `until`).
 */
export function getUserSuspension(
  profile: Doc<"userProfiles"> | null | undefined,
): Suspension | null {
  if (!profile?.suspendedAt) return null;
  if (profile.suspendedUntil && profile.suspendedUntil < Date.now()) return null;
  return {
    at: profile.suspendedAt,
    reason: profile.suspendedReason ?? null,
    until: profile.suspendedUntil ?? null,
  };
}

/** Convenience: returns true iff the user is currently suspended. */
export function isUserSuspended(profile: Doc<"userProfiles"> | null | undefined): boolean {
  return getUserSuspension(profile) !== null;
}

/**
 * The exact triplet shape to spread into `ctx.db.patch(profileId, ...)`.
 * Mirrors the schema fields so reads (getUserSuspension) and writes share one
 * definition and illegal states (e.g. `suspendedUntil` set without
 * `suspendedAt`) are unrepresentable.
 */
export interface SuspensionPatch {
  suspendedAt: number | undefined;
  suspendedReason: string | undefined;
  suspendedUntil: number | undefined;
}

/**
 * Build the patch to APPLY a suspension. `suspendedAt` is always set together
 * with the reason; `untilMs` is the auto-lift time (omit for a manual-unsuspend
 * lock). Spread the result into `ctx.db.patch`.
 *
 * @example
 *   await ctx.db.patch(profile._id, setSuspension({ reason, untilMs: now + DURATION }));
 */
export function setSuspension(opts: {
  reason: string;
  /** When the suspension auto-lifts (epoch ms). Omit for manual-only unsuspend. */
  untilMs?: number;
  /** When the suspension is applied (epoch ms). Defaults to now. */
  atMs?: number;
}): SuspensionPatch {
  return {
    suspendedAt: opts.atMs ?? Date.now(),
    suspendedReason: opts.reason,
    suspendedUntil: opts.untilMs,
  };
}

/**
 * Build the patch to CLEAR a suspension — unsets all three fields together so
 * no orphaned partial state can survive. Spread into `ctx.db.patch`.
 */
export function clearSuspension(): SuspensionPatch {
  return {
    suspendedAt: undefined,
    suspendedReason: undefined,
    suspendedUntil: undefined,
  };
}
