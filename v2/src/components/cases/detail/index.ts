/**
 * Case Detail Section Components
 *
 * Read-only display sections for the case detail page.
 * Uses neobrutalist styling with collapsible sections.
 */

// Base wrapper component
export { CaseDetailSection, DetailField } from "./CaseDetailSection";
export type { CaseDetailSectionProps, DetailFieldProps } from "./CaseDetailSection";

// Section components
export { BasicInfoSection } from "./BasicInfoSection";
export type { BasicInfoSectionProps } from "./BasicInfoSection";

export { PWDSection } from "./PWDSection";
export type { PWDSectionProps } from "./PWDSection";

export { RecruitmentSection } from "./RecruitmentSection";
export type { RecruitmentSectionProps } from "./RecruitmentSection";

export { ETA9089Section } from "./ETA9089Section";
export type { ETA9089SectionProps } from "./ETA9089Section";

export { I140Section } from "./I140Section";
export type { I140SectionProps } from "./I140Section";

export { RFIRFESection } from "./RFIRFESection";
export type { RFIRFESectionProps, RFIEntry, RFEEntry } from "./RFIRFESection";

// Timeline components
export { InlineCaseTimeline } from "./InlineCaseTimeline";
export type { InlineCaseTimelineProps } from "./InlineCaseTimeline";

export { TimelineMilestone } from "./TimelineMilestone";
export type { TimelineMilestoneProps } from "./TimelineMilestone";

export { TimelineRangeBar } from "./TimelineRangeBar";
export type { TimelineRangeBarProps } from "./TimelineRangeBar";
