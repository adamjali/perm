/**
 * Centralized Urgency Calculation Module
 *
 * Single source of truth for all urgency level calculations.
 * Consolidates 7+ duplicate implementations across the codebase.
 *
 * @module lib/status/urgency
 *
 * Urgency Thresholds:
 * - URGENT: ≤7 days (action required immediately)
 * - SOON: 8-30 days (plan action soon)
 * - NORMAL: 30+ days (on track)
 * - OVERDUE: <0 days (past deadline)
 * - COMPLETED: has been submitted/resolved
 *
 * Usage:
 * ```typescript
 * import { getUrgencyLevel, getUrgencyFromDeadline } from '@/lib/status/urgency';
 *
 * // From days remaining
 * const level = getUrgencyLevel(5); // "urgent"
 *
 * // From deadline string
 * const level = getUrgencyFromDeadline("2024-12-31"); // calculates days first
 *
 * // With completion status
 * const level = getUrgencyLevelWithStatus({
 *   daysUntil: 5,
 *   isCompleted: false,
 * }); // "urgent"
 * ```
 */

import { differenceInDays, parseISO, startOfDay } from "date-fns";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Standard urgency thresholds used across the application.
 * These values are the single source of truth for urgency calculations.
 */
export const URGENCY_THRESHOLDS = {
  /** Days remaining to be considered urgent (≤7 days) */
  URGENT_DAYS: 7,
  /** Days remaining to be considered soon (≤30 days) */
  SOON_DAYS: 30,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Basic urgency levels for deadlines (3-level system).
 * Used in most UI components.
 */
export type UrgencyLevel = "urgent" | "soon" | "normal";

/**
 * Extended urgency levels including overdue status (4-level system).
 * Used in dashboard and email notifications.
 */
export type UrgencyLevelExtended = "overdue" | "urgent" | "soon" | "normal";

/**
 * Urgency levels with completion status (4-level system).
 * Used for RFI/RFE entries that can be marked as completed.
 */
export type UrgencyLevelWithCompletion = "completed" | "urgent" | "soon" | "normal";

/**
 * Full urgency levels with all possible states (5-level system).
 * Combines overdue and completion tracking.
 */
export type UrgencyLevelFull = "completed" | "overdue" | "urgent" | "soon" | "normal";

/**
 * Urgency configuration for styling components.
 */
export interface UrgencyConfig {
  /** CSS class for background color */
  bgColor: string;
  /** CSS class for text color */
  textColor: string;
  /** CSS variable reference */
  cssVar: string;
  /** Hex color for emails */
  hexColor: string;
  /** Hex background color for emails */
  hexBgColor: string;
  /** Display label */
  label: string;
}

// ============================================================================
// URGENCY CONFIGURATION
// ============================================================================

/**
 * Complete styling configuration for each urgency level.
 * Use this for consistent styling across UI and email.
 */
export const URGENCY_CONFIG: Record<UrgencyLevelFull, UrgencyConfig> = {
  completed: {
    bgColor: "bg-[var(--urgency-completed)]",
    textColor: "text-[var(--urgency-completed)]",
    cssVar: "var(--urgency-completed)",
    hexColor: "#059669", // Emerald-600
    hexBgColor: "#D1FAE5", // Emerald-100
    label: "Complete",
  },
  overdue: {
    bgColor: "bg-[var(--urgency-overdue)]",
    textColor: "text-[var(--urgency-overdue)]",
    cssVar: "var(--urgency-overdue)",
    hexColor: "#991B1B", // Red-800
    hexBgColor: "#FEE2E2", // Red-100
    label: "Overdue",
  },
  urgent: {
    bgColor: "bg-[var(--urgency-urgent)]",
    textColor: "text-[var(--urgency-urgent)]",
    cssVar: "var(--urgency-urgent)",
    hexColor: "#DC2626", // Red-600
    hexBgColor: "#FEF2F2", // Red-50
    label: "Urgent",
  },
  soon: {
    bgColor: "bg-[var(--urgency-soon)]",
    textColor: "text-[var(--urgency-soon)]",
    cssVar: "var(--urgency-soon)",
    hexColor: "#EA580C", // Orange-600
    hexBgColor: "#FFF7ED", // Orange-50
    label: "Soon",
  },
  normal: {
    bgColor: "bg-[var(--urgency-normal)]",
    textColor: "text-[var(--urgency-normal)]",
    cssVar: "var(--urgency-normal)",
    hexColor: "#2563EB", // Blue-600
    hexBgColor: "#EFF6FF", // Blue-50
    label: "On Track",
  },
};

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate basic urgency level from days remaining.
 *
 * @param daysUntil - Number of days until deadline (can be negative for overdue)
 * @returns UrgencyLevel - "urgent" | "soon" | "normal"
 *
 * @example
 * getUrgencyLevel(3);  // "urgent" (≤7 days)
 * getUrgencyLevel(15); // "soon" (8-30 days)
 * getUrgencyLevel(45); // "normal" (30+ days)
 * getUrgencyLevel(-5); // "urgent" (overdue treated as urgent in basic mode)
 */
export function getUrgencyLevel(daysUntil: number): UrgencyLevel {
  if (daysUntil <= URGENCY_THRESHOLDS.URGENT_DAYS) return "urgent";
  if (daysUntil <= URGENCY_THRESHOLDS.SOON_DAYS) return "soon";
  return "normal";
}

/**
 * Calculate extended urgency level including overdue status.
 *
 * @param daysUntil - Number of days until deadline
 * @returns UrgencyLevelExtended - "overdue" | "urgent" | "soon" | "normal"
 *
 * @example
 * getUrgencyLevelExtended(-5);  // "overdue"
 * getUrgencyLevelExtended(3);   // "urgent"
 * getUrgencyLevelExtended(15);  // "soon"
 * getUrgencyLevelExtended(45);  // "normal"
 */
export function getUrgencyLevelExtended(daysUntil: number): UrgencyLevelExtended {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= URGENCY_THRESHOLDS.URGENT_DAYS) return "urgent";
  if (daysUntil <= URGENCY_THRESHOLDS.SOON_DAYS) return "soon";
  return "normal";
}

/**
 * Calculate urgency level with completion status.
 * Used for RFI/RFE entries that can be marked as submitted.
 *
 * @param options - Object containing daysUntil and isCompleted
 * @returns UrgencyLevelWithCompletion - "completed" | "urgent" | "soon" | "normal"
 *
 * @example
 * getUrgencyLevelWithStatus({ daysUntil: 5, isCompleted: true });  // "completed"
 * getUrgencyLevelWithStatus({ daysUntil: 5, isCompleted: false }); // "urgent"
 */
export function getUrgencyLevelWithStatus(options: {
  daysUntil: number;
  isCompleted: boolean;
}): UrgencyLevelWithCompletion {
  if (options.isCompleted) return "completed";
  return getUrgencyLevel(options.daysUntil);
}

/**
 * Calculate full urgency level with both overdue and completion states.
 *
 * @param options - Object containing daysUntil and isCompleted
 * @returns UrgencyLevelFull - "completed" | "overdue" | "urgent" | "soon" | "normal"
 *
 * @example
 * getUrgencyLevelFull({ daysUntil: -5, isCompleted: true });  // "completed"
 * getUrgencyLevelFull({ daysUntil: -5, isCompleted: false }); // "overdue"
 * getUrgencyLevelFull({ daysUntil: 5, isCompleted: false });  // "urgent"
 */
export function getUrgencyLevelFull(options: {
  daysUntil: number;
  isCompleted: boolean;
}): UrgencyLevelFull {
  if (options.isCompleted) return "completed";
  if (options.daysUntil < 0) return "overdue";
  if (options.daysUntil <= URGENCY_THRESHOLDS.URGENT_DAYS) return "urgent";
  if (options.daysUntil <= URGENCY_THRESHOLDS.SOON_DAYS) return "soon";
  return "normal";
}

// ============================================================================
// DEADLINE-BASED FUNCTIONS
// ============================================================================

/**
 * Calculate days remaining until a deadline date.
 *
 * @param deadline - ISO date string (YYYY-MM-DD)
 * @returns Number of days until deadline (negative if overdue)
 *
 * @example
 * getDaysUntilDeadline("2024-12-31"); // 5 (if today is Dec 26)
 * getDaysUntilDeadline("2024-12-20"); // -6 (if today is Dec 26)
 */
export function getDaysUntilDeadline(deadline: string): number {
  const today = startOfDay(new Date());
  const deadlineDate = startOfDay(parseISO(deadline));
  return differenceInDays(deadlineDate, today);
}

/**
 * Calculate urgency level directly from a deadline date string.
 *
 * @param deadline - ISO date string (YYYY-MM-DD)
 * @returns UrgencyLevel - "urgent" | "soon" | "normal"
 *
 * @example
 * getUrgencyFromDeadline("2024-12-31"); // depends on current date
 */
export function getUrgencyFromDeadline(deadline: string): UrgencyLevel {
  const daysUntil = getDaysUntilDeadline(deadline);
  return getUrgencyLevel(daysUntil);
}

/**
 * Calculate extended urgency level from deadline date.
 *
 * @param deadline - ISO date string (YYYY-MM-DD)
 * @returns UrgencyLevelExtended - "overdue" | "urgent" | "soon" | "normal"
 */
export function getUrgencyFromDeadlineExtended(deadline: string): UrgencyLevelExtended {
  const daysUntil = getDaysUntilDeadline(deadline);
  return getUrgencyLevelExtended(daysUntil);
}

// ============================================================================
// RFI/RFE SPECIFIC FUNCTIONS
// ============================================================================

/**
 * Calculate urgency level for RFI/RFE entries.
 * Includes completion status based on response submitted date.
 *
 * @param dueDate - Due date for the RFI/RFE response
 * @param submittedDate - Date response was submitted (if any)
 * @returns UrgencyLevelWithCompletion - "completed" | "urgent" | "soon" | "normal"
 *
 * @example
 * getRfiRfeUrgency("2024-12-31", "2024-12-25"); // "completed"
 * getRfiRfeUrgency("2024-12-31", undefined);     // urgency based on days
 */
export function getRfiRfeUrgency(
  dueDate: string | undefined,
  submittedDate: string | undefined
): UrgencyLevelWithCompletion {
  if (submittedDate) return "completed";
  if (!dueDate) return "normal";

  const daysUntil = getDaysUntilDeadline(dueDate);
  return getUrgencyLevel(daysUntil);
}

// ============================================================================
// STYLING HELPER FUNCTIONS
// ============================================================================

/**
 * Get CSS class for urgency dot/indicator background.
 *
 * @param level - Any urgency level
 * @returns CSS class string for background color
 */
export function getUrgencyDotClass(level: UrgencyLevelFull): string {
  return URGENCY_CONFIG[level].bgColor;
}

/**
 * Get hex color for urgency level (for emails and non-CSS contexts).
 *
 * @param level - Any urgency level
 * @returns Hex color string
 */
export function getUrgencyHexColor(level: UrgencyLevelFull): string {
  return URGENCY_CONFIG[level].hexColor;
}

/**
 * Get hex background color for urgency level (for emails).
 *
 * @param level - Any urgency level
 * @returns Hex background color string
 */
export function getUrgencyHexBgColor(level: UrgencyLevelFull): string {
  return URGENCY_CONFIG[level].hexBgColor;
}

/**
 * Get display label for urgency level.
 *
 * @param level - Any urgency level
 * @returns Human-readable label
 */
export function getUrgencyLabel(level: UrgencyLevelFull): string {
  return URGENCY_CONFIG[level].label;
}

/**
 * Get complete urgency configuration for a level.
 *
 * @param level - Any urgency level
 * @returns UrgencyConfig object with all styling info
 */
export function getUrgencyConfig(level: UrgencyLevelFull): UrgencyConfig {
  return URGENCY_CONFIG[level];
}
