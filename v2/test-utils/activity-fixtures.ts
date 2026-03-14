import type {
  RecentActivityItem,
  CaseStatus,
  ProgressStatus,
} from "@/convex/lib/dashboardTypes";
import type { Id } from "@/convex/_generated/dataModel";

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

/** ISO date string N days from now (UTC) */
export function daysFromNowISO(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

export interface UpcomingDeadline {
  caseId: Id<"cases">;
  caseNumber?: string;
  employerName: string;
  beneficiaryName: string;
  type: string;
  label: string;
  dueDate: string;
  daysUntil: number;
  urgency: "overdue" | "thisWeek" | "thisMonth" | "later";
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
}

export const UPCOMING_DEADLINE_TYPES = {
  pwdExpiration: { type: "pwd_expiration", label: "PWD Expires" },
  rfiDue: { type: "rfi_due", label: "RFI Response Due" },
  rfeDue: { type: "rfe_due", label: "RFE Response Due" },
  eta9089Expiration: { type: "eta9089_expiration", label: "ETA 9089 Expires" },
  i140FilingDeadline: { type: "i140_filing_deadline", label: "I-140 Filing Deadline" },
  recruitmentWindowCloses: { type: "recruitment_window", label: "Recruitment Window Closes" },
} as const;

export function createMockUpcomingDeadline(
  overrides: Partial<UpcomingDeadline> = {}
): UpcomingDeadline {
  const daysUntil = overrides.daysUntil ?? 7;
  const urgency: UpcomingDeadline["urgency"] =
    daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "thisWeek" : daysUntil <= 30 ? "thisMonth" : "later";

  return {
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
    ...overrides,
  };
}

export function createMockUpcomingDeadlines(count: number = 5): UpcomingDeadline[] {
  const deadlineTypes = Object.values(UPCOMING_DEADLINE_TYPES);
  const statuses: CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140"];
  const progressStatuses: ProgressStatus[] = ["filed", "approved", "under_review", "rfi_rfe"];

  return Array.from({ length: count }, (_, i) => {
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
  }).sort((a, b) => a.daysUntil - b.daysUntil);
}

export function createEmptyUpcomingDeadlines(): UpcomingDeadline[] { return []; }

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

export const upcomingDeadlineScenarios = {
  empty: createEmptyUpcomingDeadlines(),
  minimal: createMockUpcomingDeadlines(1),
  typical: createMockUpcomingDeadlines(5),
  highVolume: createMockUpcomingDeadlines(12),
  urgentOnly: Array.from({ length: 4 }, (_, i) =>
    createMockUpcomingDeadline({
      caseId: `case_urgent_${i + 1}` as Id<"cases">,
      caseNumber: `URG-${String(i + 1).padStart(3, "0")}`,
      daysUntil: i + 1,
    })
  ),
  mixedUrgency: [
    createMockUpcomingDeadline({ caseId: "case_001" as Id<"cases">, caseNumber: "URG-001", type: UPCOMING_DEADLINE_TYPES.rfiDue.type, label: UPCOMING_DEADLINE_TYPES.rfiDue.label, daysUntil: 2, caseStatus: "eta9089", progressStatus: "rfi_rfe" }),
    createMockUpcomingDeadline({ caseId: "case_002" as Id<"cases">, caseNumber: "SOON-002", type: UPCOMING_DEADLINE_TYPES.pwdExpiration.type, label: UPCOMING_DEADLINE_TYPES.pwdExpiration.label, daysUntil: 15, caseStatus: "pwd", progressStatus: "filed" }),
    createMockUpcomingDeadline({ caseId: "case_003" as Id<"cases">, caseNumber: "NORM-003", type: UPCOMING_DEADLINE_TYPES.eta9089Expiration.type, label: UPCOMING_DEADLINE_TYPES.eta9089Expiration.label, daysUntil: 28, caseStatus: "eta9089", progressStatus: "approved" }),
  ],
};
