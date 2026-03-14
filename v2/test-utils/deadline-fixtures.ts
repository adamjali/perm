import type {
  DeadlineItem,
  DeadlineGroups,
  UrgencyGroup,
} from "../convex/lib/dashboardTypes";
import type { Id } from "../convex/_generated/dataModel";

export function createMockDeadlineItem(
  overrides: Partial<DeadlineItem> = {}
): DeadlineItem {
  return {
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
    ...overrides,
  };
}

export function createOverdueDeadline(overrides: Partial<DeadlineItem> = {}): DeadlineItem {
  return createMockDeadlineItem({ daysUntil: -3, urgency: "overdue", label: "PWD Expired", ...overrides });
}

export function createThisWeekDeadline(overrides: Partial<DeadlineItem> = {}): DeadlineItem {
  return createMockDeadlineItem({ daysUntil: 5, urgency: "thisWeek", ...overrides });
}

export function createThisMonthDeadline(overrides: Partial<DeadlineItem> = {}): DeadlineItem {
  return createMockDeadlineItem({ daysUntil: 20, urgency: "thisMonth", ...overrides });
}

export function createLaterDeadline(overrides: Partial<DeadlineItem> = {}): DeadlineItem {
  return createMockDeadlineItem({ daysUntil: 45, urgency: "later", ...overrides });
}

export function createMockDeadlineGroups(overrides: Partial<DeadlineGroups> = {}): DeadlineGroups {
  const defaults: DeadlineGroups = {
    overdue: [
      createOverdueDeadline({ caseId: "case_001" as Id<"cases">, caseNumber: "CASE-001", daysUntil: -5 }),
      createOverdueDeadline({ caseId: "case_002" as Id<"cases">, caseNumber: "CASE-002", daysUntil: -2 }),
    ],
    thisWeek: [
      createThisWeekDeadline({ caseId: "case_003" as Id<"cases">, caseNumber: "CASE-003", daysUntil: 2 }),
      createThisWeekDeadline({ caseId: "case_004" as Id<"cases">, caseNumber: "CASE-004", daysUntil: 5 }),
      createThisWeekDeadline({ caseId: "case_005" as Id<"cases">, caseNumber: "CASE-005", daysUntil: 7 }),
    ],
    thisMonth: [
      createThisMonthDeadline({ caseId: "case_006" as Id<"cases">, caseNumber: "CASE-006", daysUntil: 15 }),
      createThisMonthDeadline({ caseId: "case_007" as Id<"cases">, caseNumber: "CASE-007", daysUntil: 25 }),
    ],
    later: [
      createLaterDeadline({ caseId: "case_008" as Id<"cases">, caseNumber: "CASE-008", daysUntil: 45 }),
    ],
    totalCount: 8,
  };

  return {
    ...defaults,
    ...overrides,
    totalCount:
      (overrides.overdue?.length ?? defaults.overdue.length) +
      (overrides.thisWeek?.length ?? defaults.thisWeek.length) +
      (overrides.thisMonth?.length ?? defaults.thisMonth.length) +
      (overrides.later?.length ?? defaults.later.length),
  };
}

export function createEmptyDeadlineGroups(): DeadlineGroups {
  return { overdue: [], thisWeek: [], thisMonth: [], later: [], totalCount: 0 };
}

/** Create N deadlines for overflow testing */
export function createManyDeadlinesGroup(count: number, urgency: UrgencyGroup): DeadlineItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockDeadlineItem({
      caseId: `case_${String(i + 1).padStart(3, "0")}` as Id<"cases">,
      caseNumber: `CASE-${String(i + 1).padStart(3, "0")}`,
      urgency,
      daysUntil: urgency === "overdue" ? -(i + 1) : i + 1,
    })
  );
}

export const URGENCY_STYLES = {
  overdue: { border: "border-red-600", bg: "bg-red-50", badge: "bg-red-600", text: "text-red-600" },
  thisWeek: { border: "border-orange-500", bg: "bg-orange-50", badge: "bg-orange-500", text: "text-orange-600" },
  thisMonth: { border: "border-yellow-500", bg: "bg-yellow-50", badge: "bg-yellow-500", text: "text-yellow-600" },
  later: { border: "border-green-600", bg: "bg-green-50", badge: "bg-green-600", text: "text-green-600" },
} as const;

export const deadlineScenarios = {
  empty: createEmptyDeadlineGroups(),
  singleOverdue: createMockDeadlineGroups({
    overdue: [createOverdueDeadline({ caseNumber: "URGENT-001" })],
    thisWeek: [], thisMonth: [], later: [],
  }),
  balanced: createMockDeadlineGroups(),
  highVolume: createMockDeadlineGroups({
    overdue: createManyDeadlinesGroup(8, "overdue"),
    thisWeek: createManyDeadlinesGroup(12, "thisWeek"),
    thisMonth: createManyDeadlinesGroup(10, "thisMonth"),
    later: createManyDeadlinesGroup(15, "later"),
  }),
  allLater: createMockDeadlineGroups({
    overdue: [], thisWeek: [], thisMonth: [],
    later: createManyDeadlinesGroup(5, "later"),
  }),
};
