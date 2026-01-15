/**
 * Shared Status Types - Single Source of Truth
 *
 * This file defines the canonical CaseStatus and ProgressStatus types.
 * All other files should import from here to ensure consistency.
 *
 * Used by:
 * - src/lib/lib/perm/types.ts
 * - convex/lib/dashboardTypes.ts
 * - convex/schema.ts (indirectly - schema uses v.literal() strings)
 */

// Case lifecycle stages
export type CaseStatus = "pwd" | "recruitment" | "eta9089" | "i140" | "closed";

// Progress within a stage
export type ProgressStatus =
  | "working"
  | "waiting_intake"
  | "filed"
  | "approved"
  | "under_review"
  | "rfi_rfe";

// Runtime arrays for iteration and validation
export const CASE_STATUSES = [
  "pwd",
  "recruitment",
  "eta9089",
  "i140",
  "closed",
] as const satisfies readonly CaseStatus[];

export const PROGRESS_STATUSES = [
  "working",
  "waiting_intake",
  "filed",
  "approved",
  "under_review",
  "rfi_rfe",
] as const satisfies readonly ProgressStatus[];

// Type guards for runtime validation
export function isCaseStatus(value: unknown): value is CaseStatus {
  return (
    typeof value === "string" &&
    (CASE_STATUSES as readonly string[]).includes(value)
  );
}

export function isProgressStatus(value: unknown): value is ProgressStatus {
  return (
    typeof value === "string" &&
    (PROGRESS_STATUSES as readonly string[]).includes(value)
  );
}
