/**
 * Dashboard Module
 * Re-exports all dashboard helpers and types.
 */

// Export all types
export type {
  UrgencyGroup,
  CaseStatus,
  ProgressStatus,
  DeadlineType,
  DeadlineItem,
  DeadlineGroups,
  ProgressBreakdown,
  PwdBreakdown,
  RecruitmentBreakdown,
  Eta9089Breakdown,
  I140Breakdown,
  StatusCount,
  DashboardSummary,
  RecentActivityItem,
} from "./dashboardTypes";

// Export all helper functions
export {
  calculateUrgency,
  sortByUrgency,
  extractDeadlines,
  groupDeadlinesByUrgency,
  buildPwdSubtext,
  buildRecruitmentSubtext,
  buildEta9089Subtext,
  buildI140Subtext,
} from "./dashboardHelpers";
