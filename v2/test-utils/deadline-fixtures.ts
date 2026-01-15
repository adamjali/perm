/**
 * Deadline Widget Test Fixtures
 * Reusable test data for deadline widget testing.
 *
 * Provides:
 * - createMockDeadlineItem() factory with sensible defaults
 * - Specialized factories for each urgency level
 * - createMockDeadlineGroups() for full deadline data
 * - URGENCY_STYLES constants for testing styling
 */

import type {
  DeadlineItem,
  DeadlineGroups,
  UrgencyGroup,
} from "../convex/lib/dashboardTypes";
import type { Id } from "../convex/_generated/dataModel";

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Factory for creating mock deadline items with sensible defaults.
 * All overrides are optional - factory provides complete valid data.
 *
 * CRITICAL: Uses actual type property names from dashboardTypes.ts:
 * - `type` not `deadlineType`
 * - `label` not `deadlineLabel`
 *
 * @example
 * const deadline = createMockDeadlineItem({
 *   daysUntil: -5,
 *   urgency: "overdue"
 * });
 */
export function createMockDeadlineItem(
  overrides: Partial<DeadlineItem> = {}
): DeadlineItem {
  const baseItem: DeadlineItem = {
    caseId: "case_test123" as Id<"cases">,
    caseNumber: "CASE-2024-001",
    employerName: "Tech Corp Inc",
    beneficiaryName: "John Smith",
    type: "pwd_expiration",
    label: "PWD Expires",
    dueDate: "2024-02-15",
    daysUntil: 5,
    urgency: "thisWeek",
    caseStatus: "pwd",
    progressStatus: "working",
  };

  return { ...baseItem, ...overrides };
}

/**
 * Factory for creating overdue deadline
 */
export function createOverdueDeadline(
  overrides: Partial<DeadlineItem> = {}
): DeadlineItem {
  return createMockDeadlineItem({
    daysUntil: -3,
    urgency: "overdue",
    label: "PWD Expired",
    ...overrides,
  });
}

/**
 * Factory for creating this week deadline
 */
export function createThisWeekDeadline(
  overrides: Partial<DeadlineItem> = {}
): DeadlineItem {
  return createMockDeadlineItem({
    daysUntil: 5,
    urgency: "thisWeek",
    ...overrides,
  });
}

/**
 * Factory for creating this month deadline
 */
export function createThisMonthDeadline(
  overrides: Partial<DeadlineItem> = {}
): DeadlineItem {
  return createMockDeadlineItem({
    daysUntil: 20,
    urgency: "thisMonth",
    ...overrides,
  });
}

/**
 * Factory for creating later deadline
 */
export function createLaterDeadline(
  overrides: Partial<DeadlineItem> = {}
): DeadlineItem {
  return createMockDeadlineItem({
    daysUntil: 45,
    urgency: "later",
    ...overrides,
  });
}

/**
 * Factory for creating full deadline groups with realistic data
 */
export function createMockDeadlineGroups(
  overrides: Partial<DeadlineGroups> = {}
): DeadlineGroups {
  const defaults: DeadlineGroups = {
    overdue: [
      createOverdueDeadline({
        caseId: "case_001" as Id<"cases">,
        caseNumber: "CASE-001",
        daysUntil: -5,
      }),
      createOverdueDeadline({
        caseId: "case_002" as Id<"cases">,
        caseNumber: "CASE-002",
        daysUntil: -2,
      }),
    ],
    thisWeek: [
      createThisWeekDeadline({
        caseId: "case_003" as Id<"cases">,
        caseNumber: "CASE-003",
        daysUntil: 2,
      }),
      createThisWeekDeadline({
        caseId: "case_004" as Id<"cases">,
        caseNumber: "CASE-004",
        daysUntil: 5,
      }),
      createThisWeekDeadline({
        caseId: "case_005" as Id<"cases">,
        caseNumber: "CASE-005",
        daysUntil: 7,
      }),
    ],
    thisMonth: [
      createThisMonthDeadline({
        caseId: "case_006" as Id<"cases">,
        caseNumber: "CASE-006",
        daysUntil: 15,
      }),
      createThisMonthDeadline({
        caseId: "case_007" as Id<"cases">,
        caseNumber: "CASE-007",
        daysUntil: 25,
      }),
    ],
    later: [
      createLaterDeadline({
        caseId: "case_008" as Id<"cases">,
        caseNumber: "CASE-008",
        daysUntil: 45,
      }),
    ],
    totalCount: 8,
  };

  return {
    ...defaults,
    ...overrides,
    // Recalculate totalCount if any groups were overridden
    totalCount:
      (overrides.overdue?.length ?? defaults.overdue.length) +
      (overrides.thisWeek?.length ?? defaults.thisWeek.length) +
      (overrides.thisMonth?.length ?? defaults.thisMonth.length) +
      (overrides.later?.length ?? defaults.later.length),
  };
}

/**
 * Factory for empty deadline groups
 */
export function createEmptyDeadlineGroups(): DeadlineGroups {
  return {
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
    totalCount: 0,
  };
}

/**
 * Factory for deadline groups with many items (for overflow testing).
 * Creates N deadlines with sequential case numbers.
 *
 * @example
 * const manyOverdue = createManyDeadlinesGroup(10, "overdue");
 * // Creates CASE-001 through CASE-010
 */
export function createManyDeadlinesGroup(
  count: number,
  urgency: UrgencyGroup
): DeadlineItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockDeadlineItem({
      caseId: `case_${String(i + 1).padStart(3, "0")}` as Id<"cases">,
      caseNumber: `CASE-${String(i + 1).padStart(3, "0")}`,
      urgency,
      daysUntil: urgency === "overdue" ? -(i + 1) : i + 1,
    })
  );
}

// ============================================================================
// URGENCY STYLING CONSTANTS
// ============================================================================

/**
 * Urgency styling expectations for testing.
 * These match the expected Tailwind classes used in components.
 *
 * Source: .planning/phases/20-dashboard/20-03-PLAN.md
 */
export const URGENCY_STYLES = {
  overdue: {
    border: "border-red-600",
    bg: "bg-red-50",
    badge: "bg-red-600",
    text: "text-red-600",
  },
  thisWeek: {
    border: "border-orange-500",
    bg: "bg-orange-50",
    badge: "bg-orange-500",
    text: "text-orange-600",
  },
  thisMonth: {
    border: "border-yellow-500",
    bg: "bg-yellow-50",
    badge: "bg-yellow-500",
    text: "text-yellow-600",
  },
  later: {
    border: "border-green-600",
    bg: "bg-green-50",
    badge: "bg-green-600",
    text: "text-green-600",
  },
} as const;

// ============================================================================
// COMMON SCENARIOS
// ============================================================================

/**
 * Common deadline scenarios for testing
 */
export const deadlineScenarios = {
  /**
   * Empty - no deadlines (new user)
   */
  empty: createEmptyDeadlineGroups(),

  /**
   * Single overdue - urgent action needed
   */
  singleOverdue: createMockDeadlineGroups({
    overdue: [createOverdueDeadline({ caseNumber: "URGENT-001" })],
    thisWeek: [],
    thisMonth: [],
    later: [],
  }),

  /**
   * Balanced - realistic mix of all urgency levels
   */
  balanced: createMockDeadlineGroups(),

  /**
   * High volume - many items per group (for overflow testing)
   */
  highVolume: createMockDeadlineGroups({
    overdue: createManyDeadlinesGroup(8, "overdue"),
    thisWeek: createManyDeadlinesGroup(12, "thisWeek"),
    thisMonth: createManyDeadlinesGroup(10, "thisMonth"),
    later: createManyDeadlinesGroup(15, "later"),
  }),

  /**
   * Only later - all deadlines far in future
   */
  allLater: createMockDeadlineGroups({
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    later: createManyDeadlinesGroup(5, "later"),
  }),
};
