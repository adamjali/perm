/**
 * Case Detail Components
 *
 * Tabbed manila folder layout with read-only display tabs,
 * timeline visualizations, and interactive notes/documents.
 */

// Timeline components
export { InlineCaseTimeline } from "./InlineCaseTimeline";
export type { InlineCaseTimelineProps } from "./InlineCaseTimeline";

export { TimelineMilestone } from "./TimelineMilestone";
export type { TimelineMilestoneProps } from "./TimelineMilestone";

export { TimelineRangeBar } from "./TimelineRangeBar";
export type { TimelineRangeBarProps } from "./TimelineRangeBar";

// Tabbed layout components
export { CaseDetailTabs, TabPanel } from "./CaseDetailTabs";
export type { TabId } from "./CaseDetailTabs";
export { OverviewTab } from "./OverviewTab";
export { RecruitmentTab } from "./RecruitmentTab";
export { ETA9089Tab } from "./ETA9089Tab";
export { I140Tab } from "./I140Tab";
export { DocumentsTab } from "./DocumentsTab";
export { NotesTab } from "./NotesTab";
export { QuickStatsPanel } from "./QuickStatsPanel";
export { VerticalTimeline } from "./VerticalTimeline";
export { WindowCard } from "./WindowCard";
export type { CaseDetailData } from "./case-detail-types";
