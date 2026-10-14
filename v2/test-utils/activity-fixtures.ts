import type {
  RecentActivityItem,
  CaseStatus,
  ProgressStatus,
} from "@convex/lib/dashboardTypes";
import type { Id } from "@convex/_generated/dataModel";

export function now(): number { return Date.now(); }
export function minutesAgo(minutes: number): number { return now() - minutes * 60 * 1000; }
export function hoursAgo(hours: number): number { return now() - hours * 60 * 60 * 1000; }
export function daysAgo(days: number): number { return now() - days * 24 * 60 * 60 * 1000; }

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

export function createMockActivityItem(
  overrides: Partial<RecentActivityItem> = {}
): RecentActivityItem {
  return {
    id: "case_test123" as Id<"cases">,
    caseNumber: "CASE-2024-001",
    employerName: "Tech Corp Inc",
    beneficiaryIdentifier: "TEST-001",
    positionTitle: "Software Engineer",
    action: ACTIVITY_ACTIONS.updated,
    timestamp: hoursAgo(1),
    caseStatus: "pwd",
    progressStatus: "working",
    ...overrides,
  };
}

export function createMockActivityList(count: number = 5): RecentActivityItem[] {
  const actions = Object.values(ACTIVITY_ACTIONS);
  const statuses: CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140", "closed"];
  const progressStatuses: ProgressStatus[] = ["working", "filed", "approved", "under_review", "rfi_rfe"];

  return Array.from({ length: count }, (_, i) =>
    createMockActivityItem({
      id: `case_${String(i + 1).padStart(3, "0")}` as Id<"cases">,
      caseNumber: `CASE-${String(2024 - i).padStart(3, "0")}`,
      employerName: `Company ${String.fromCharCode(65 + i)} Inc`,
      beneficiaryIdentifier: `BEN-${String(i + 1).padStart(3, "0")}`,
      positionTitle: `Position ${String.fromCharCode(65 + i)}`,
      action: actions[i % actions.length],
      timestamp: i === 0 ? minutesAgo(5) : hoursAgo(i),
      caseStatus: statuses[i % statuses.length],
      progressStatus: progressStatuses[i % progressStatuses.length],
    })
  );
}

export function createEmptyActivityList(): RecentActivityItem[] { return []; }

export const activityScenarios = {
  empty: createEmptyActivityList(),
  single: createMockActivityList(1),
  typical: createMockActivityList(5),
  highVolume: createMockActivityList(15),
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
  mixedStages: [
    createMockActivityItem({ id: "case_001" as Id<"cases">, caseNumber: "I140-001", action: ACTIVITY_ACTIONS.i140Approved, timestamp: minutesAgo(30), caseStatus: "i140", progressStatus: "approved" }),
    createMockActivityItem({ id: "case_002" as Id<"cases">, caseNumber: "ETA-002", action: ACTIVITY_ACTIONS.eta9089Certified, timestamp: hoursAgo(2), caseStatus: "eta9089", progressStatus: "approved" }),
    createMockActivityItem({ id: "case_003" as Id<"cases">, caseNumber: "REC-003", action: ACTIVITY_ACTIONS.recruitmentCompleted, timestamp: hoursAgo(5), caseStatus: "recruitment", progressStatus: "approved" }),
    createMockActivityItem({ id: "case_004" as Id<"cases">, caseNumber: "PWD-004", action: ACTIVITY_ACTIONS.pwdFiled, timestamp: hoursAgo(12), caseStatus: "pwd", progressStatus: "filed" }),
    createMockActivityItem({ id: "case_005" as Id<"cases">, caseNumber: "NEW-005", action: ACTIVITY_ACTIONS.created, timestamp: daysAgo(1), caseStatus: "pwd", progressStatus: "working" }),
  ],
};
