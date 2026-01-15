/**
 * Activity & Deadline Test Fixtures
 * Reusable test data for Recent Activity and Upcoming Deadlines widgets.
 *
 * Provides:
 * - createMockActivityItem() - Factory for single activity item
 * - createMockActivityList() - Factory for list of activity items
 * - createEmptyActivityList() - Empty array factory
 * - createMockUpcomingDeadlines() - Factory for upcoming deadlines (next 30 days)
 * - Common activity action types
 * - Date helper functions
 */

import type {
  RecentActivityItem,
  CaseStatus,
  ProgressStatus,
} from "@/convex/lib/dashboardTypes";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Get timestamp N minutes ago
 */
export function minutesAgo(minutes: number): number {
  return now() - minutes * 60 * 1000;
}

/**
 * Get timestamp N hours ago
 */
export function hoursAgo(hours: number): number {
  return now() - hours * 60 * 60 * 1000;
}

/**
 * Get timestamp N days ago
 */
export function daysAgo(days: number): number {
  return now() - days * 24 * 60 * 60 * 1000;
}

// ============================================================================
// ACTIVITY ACTION TYPES
// ============================================================================

/**
 * Common activity action types
 * These match the actual actions tracked in the system
 */
export const ACTIVITY_ACTIONS = {
  created: "Case created",
  updated: "Case updated",
  statusChanged: "Status changed",
  pwdFiled: "PWD filed",
  pwdApproved: "PWD approved",
  recruitmentStarted: "Recruitment started",
  recruitmentCompleted: "Recruitment completed",
  eta9089Filed: "ETA 9089 filed",
  eta9089Certified: "ETA 9089 certified",
  rfiReceived: "RFI received",
  rfiSubmitted: "RFI response submitted",
  rfeReceived: "RFE received",
  rfeSubmitted: "RFE response submitted",
  i140Filed: "I-140 filed",
  i140Approved: "I-140 approved",
  archived: "Case archived",
} as const;

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create mock activity item with sensible defaults.
 * All overrides are optional - factory provides complete valid data.
 *
 * CRITICAL: Uses actual type property names from dashboardTypes.ts:
 * - `id` (Id<"cases">) not `caseId`
 * - `beneficiaryIdentifier` not `beneficiaryName`
 * - `timestamp` (number) not `updatedAt` (string)
 *
 * @example
 * const activity = createMockActivityItem({
 *   action: "PWD filed",
 *   timestamp: hoursAgo(2)
 * });
 */
export function createMockActivityItem(
  overrides: Partial<RecentActivityItem> = {}
): RecentActivityItem {
  const baseItem: RecentActivityItem = {
    id: "case_test123" as Id<"cases">,
    caseNumber: "CASE-2024-001",
    employerName: "Tech Corp Inc",
    beneficiaryIdentifier: "TEST-001",
    action: ACTIVITY_ACTIONS.updated,
    timestamp: hoursAgo(1),
    caseStatus: "pwd",
    progressStatus: "working",
  };

  return { ...baseItem, ...overrides };
}

/**
 * Create list of mock activity items with realistic defaults.
 * Items are ordered by timestamp (most recent first).
 *
 * @param count - Number of activity items to create (default: 5)
 *
 * @example
 * const recentActivity = createMockActivityList(10);
 * // Creates 10 items with varied actions and timestamps
 */
export function createMockActivityList(count: number = 5): RecentActivityItem[] {
  const actions = Object.values(ACTIVITY_ACTIONS);
  const statuses: CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140", "closed"];
  const progressStatuses: ProgressStatus[] = ["working", "filed", "approved", "under_review", "rfi_rfe"];

  return Array.from({ length: count }, (_, i) => {
    // Create varied timing (most recent first)
    const timestamp = i === 0 ? minutesAgo(5) : hoursAgo(i);

    return createMockActivityItem({
      id: `case_${String(i + 1).padStart(3, "0")}` as Id<"cases">,
      caseNumber: `CASE-${String(2024 - i).padStart(3, "0")}`,
      employerName: `Company ${String.fromCharCode(65 + i)} Inc`,
      beneficiaryIdentifier: `BEN-${String(i + 1).padStart(3, "0")}`,
      action: actions[i % actions.length],
      timestamp,
      caseStatus: statuses[i % statuses.length],
      progressStatus: progressStatuses[i % progressStatuses.length],
    });
  });
}

/**
 * Create empty activity list
 */
export function createEmptyActivityList(): RecentActivityItem[] {
  return [];
}

// ============================================================================
// UPCOMING DEADLINES HELPERS
// ============================================================================

/**
 * Get date N days from now as ISO string (YYYY-MM-DD) in UTC.
 *
 * Uses UTC date methods to ensure consistent results regardless of
 * local timezone. This matches the backend's date calculations.
 */
export function daysFromNowISO(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Upcoming deadline item structure
 * These are displayed in the "Upcoming Deadlines" widget (next 30 days)
 *
 * NOTE: These match the actual DeadlineItem type from dashboardTypes.ts
 * - Uses `label` (not `deadlineLabel`)
 * - Uses `beneficiaryName` (not `beneficiaryIdentifier`)
 * - Uses `type` (not `deadlineType`)
 * - Includes `urgency` property
 */
export interface UpcomingDeadline {
  caseId: Id<"cases">;
  caseNumber?: string;
  employerName: string;
  beneficiaryName: string;
  type: string;
  label: string;
  dueDate: string; // ISO date string (YYYY-MM-DD)
  daysUntil: number;
  urgency: "overdue" | "thisWeek" | "thisMonth" | "later";
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
}

/**
 * Common deadline types for upcoming deadlines
 */
export const UPCOMING_DEADLINE_TYPES = {
  pwdExpiration: { type: "pwd_expiration", label: "PWD Expires" },
  rfiDue: { type: "rfi_due", label: "RFI Response Due" },
  rfeDue: { type: "rfe_due", label: "RFE Response Due" },
  eta9089Expiration: { type: "eta9089_expiration", label: "ETA 9089 Expires" },
  i140FilingDeadline: { type: "i140_filing_deadline", label: "I-140 Filing Deadline" },
  recruitmentWindowCloses: { type: "recruitment_window", label: "Recruitment Window Closes" },
} as const;

/**
 * Create mock upcoming deadline with sensible defaults.
 *
 * @example
 * const deadline = createMockUpcomingDeadline({
 *   daysUntil: 15,
 *   label: "PWD Expires"
 * });
 */
export function createMockUpcomingDeadline(
  overrides: Partial<UpcomingDeadline> = {}
): UpcomingDeadline {
  const daysUntil = overrides.daysUntil ?? 7;
  // Calculate urgency based on daysUntil
  const urgency: UpcomingDeadline["urgency"] =
    daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "thisWeek" : daysUntil <= 30 ? "thisMonth" : "later";

  const baseItem: UpcomingDeadline = {
    caseId: "case_test123" as Id<"cases">,
    caseNumber: "CASE-2024-001",
    employerName: "Tech Corp Inc",
    beneficiaryName: "TEST-001",
    type: UPCOMING_DEADLINE_TYPES.pwdExpiration.type,
    label: UPCOMING_DEADLINE_TYPES.pwdExpiration.label,
    dueDate: daysFromNowISO(daysUntil),
    daysUntil,
    urgency,
    caseStatus: "pwd",
    progressStatus: "filed",
  };

  return { ...baseItem, ...overrides };
}

/**
 * Create list of mock upcoming deadlines (next 30 days).
 * Items are ordered by dueDate (soonest first).
 *
 * @param count - Number of deadline items to create (default: 5)
 *
 * @example
 * const upcomingDeadlines = createMockUpcomingDeadlines(8);
 * // Creates 8 items with varied deadlines spread over next 30 days
 */
export function createMockUpcomingDeadlines(count: number = 5): UpcomingDeadline[] {
  const deadlineTypes = Object.values(UPCOMING_DEADLINE_TYPES);
  const statuses: CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140"];
  const progressStatuses: ProgressStatus[] = ["filed", "approved", "under_review", "rfi_rfe"];

  return Array.from({ length: count }, (_, i) => {
    // Spread deadlines across next 30 days
    const daysUntil = Math.floor((i + 1) * (30 / count));
    const deadlineType = deadlineTypes[i % deadlineTypes.length];

    return createMockUpcomingDeadline({
      caseId: `case_deadline_${String(i + 1).padStart(3, "0")}` as Id<"cases">,
      caseNumber: `CASE-DL-${String(i + 1).padStart(3, "0")}`,
      employerName: `Deadline Co ${String.fromCharCode(65 + i)}`,
      beneficiaryName: `DL-${String(i + 1).padStart(3, "0")}`,
      type: deadlineType.type,
      label: deadlineType.label,
      daysUntil,
      dueDate: daysFromNowISO(daysUntil),
      caseStatus: statuses[i % statuses.length],
      progressStatus: progressStatuses[i % progressStatuses.length],
    });
  })
    .sort((a, b) => a.daysUntil - b.daysUntil); // Sort by soonest first
}

/**
 * Create empty upcoming deadlines list
 */
export function createEmptyUpcomingDeadlines(): UpcomingDeadline[] {
  return [];
}

// ============================================================================
// PRESET SCENARIOS
// ============================================================================

/**
 * Common activity scenarios for testing
 */
export const activityScenarios = {
  /**
   * Empty - no recent activity (new user)
   */
  empty: createEmptyActivityList(),

  /**
   * Single item - one recent update
   */
  single: createMockActivityList(1),

  /**
   * Typical - 5 recent activities (default dashboard view)
   */
  typical: createMockActivityList(5),

  /**
   * High volume - many recent updates
   */
  highVolume: createMockActivityList(15),

  /**
   * PWD focused - all recent activity in PWD stage
   */
  pwdFocused: Array.from({ length: 5 }, (_, i) =>
    createMockActivityItem({
      id: `case_pwd_${i + 1}` as Id<"cases">,
      caseNumber: `PWD-${String(i + 1).padStart(3, "0")}`,
      action: i === 0 ? ACTIVITY_ACTIONS.pwdApproved : ACTIVITY_ACTIONS.pwdFiled,
      timestamp: hoursAgo(i),
      caseStatus: "pwd",
      progressStatus: i === 0 ? "approved" : "filed",
    })
  ),

  /**
   * Mixed stages - activity across all case stages
   */
  mixedStages: [
    createMockActivityItem({
      id: "case_001" as Id<"cases">,
      caseNumber: "I140-001",
      action: ACTIVITY_ACTIONS.i140Approved,
      timestamp: minutesAgo(30),
      caseStatus: "i140",
      progressStatus: "approved",
    }),
    createMockActivityItem({
      id: "case_002" as Id<"cases">,
      caseNumber: "ETA-002",
      action: ACTIVITY_ACTIONS.eta9089Certified,
      timestamp: hoursAgo(2),
      caseStatus: "eta9089",
      progressStatus: "approved",
    }),
    createMockActivityItem({
      id: "case_003" as Id<"cases">,
      caseNumber: "REC-003",
      action: ACTIVITY_ACTIONS.recruitmentCompleted,
      timestamp: hoursAgo(5),
      caseStatus: "recruitment",
      progressStatus: "approved",
    }),
    createMockActivityItem({
      id: "case_004" as Id<"cases">,
      caseNumber: "PWD-004",
      action: ACTIVITY_ACTIONS.pwdFiled,
      timestamp: hoursAgo(12),
      caseStatus: "pwd",
      progressStatus: "filed",
    }),
    createMockActivityItem({
      id: "case_005" as Id<"cases">,
      caseNumber: "NEW-005",
      action: ACTIVITY_ACTIONS.created,
      timestamp: daysAgo(1),
      caseStatus: "pwd",
      progressStatus: "working",
    }),
  ],
};

/**
 * Common upcoming deadline scenarios for testing
 */
export const upcomingDeadlineScenarios = {
  /**
   * Empty - no upcoming deadlines
   */
  empty: createEmptyUpcomingDeadlines(),

  /**
   * Minimal - single upcoming deadline
   */
  minimal: createMockUpcomingDeadlines(1),

  /**
   * Typical - 5 upcoming deadlines (default dashboard view)
   */
  typical: createMockUpcomingDeadlines(5),

  /**
   * High volume - many upcoming deadlines
   */
  highVolume: createMockUpcomingDeadlines(12),

  /**
   * Urgent only - all deadlines within 7 days
   */
  urgentOnly: Array.from({ length: 4 }, (_, i) =>
    createMockUpcomingDeadline({
      caseId: `case_urgent_${i + 1}` as Id<"cases">,
      caseNumber: `URG-${String(i + 1).padStart(3, "0")}`,
      daysUntil: i + 1, // 1-4 days
    })
  ),

  /**
   * Mixed urgency - deadlines across all urgency levels
   */
  mixedUrgency: [
    createMockUpcomingDeadline({
      caseId: "case_001" as Id<"cases">,
      caseNumber: "URG-001",
      type: UPCOMING_DEADLINE_TYPES.rfiDue.type,
      label: UPCOMING_DEADLINE_TYPES.rfiDue.label,
      daysUntil: 2,
      caseStatus: "eta9089",
      progressStatus: "rfi_rfe",
    }),
    createMockUpcomingDeadline({
      caseId: "case_002" as Id<"cases">,
      caseNumber: "SOON-002",
      type: UPCOMING_DEADLINE_TYPES.pwdExpiration.type,
      label: UPCOMING_DEADLINE_TYPES.pwdExpiration.label,
      daysUntil: 15,
      caseStatus: "pwd",
      progressStatus: "filed",
    }),
    createMockUpcomingDeadline({
      caseId: "case_003" as Id<"cases">,
      caseNumber: "NORM-003",
      type: UPCOMING_DEADLINE_TYPES.eta9089Expiration.type,
      label: UPCOMING_DEADLINE_TYPES.eta9089Expiration.label,
      daysUntil: 28,
      caseStatus: "eta9089",
      progressStatus: "approved",
    }),
  ],
};
