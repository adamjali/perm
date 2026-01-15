/**
 * Timeline Components Index
 * Barrel exports for timeline visualization components.
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 */

export { TimelineGrid } from "./TimelineGrid";
export type { TimelineCaseData, TimelineRfiRfeEntry } from "./TimelineGrid";
export { TimelineHeader } from "./TimelineHeader";
export { TimelineRow } from "./TimelineRow";
export { TimelineControls } from "./TimelineControls";
export { TimelineLegend } from "./TimelineLegend";
export { TimelineMilestoneMarker } from "./TimelineMilestoneMarker";
export type { TimelineMilestoneMarkerProps } from "./TimelineMilestoneMarker";
export { TimelineRangeBar } from "./TimelineRangeBar";
export type { TimelineRangeBarProps } from "./TimelineRangeBar";
export { CaseSelectionModal } from "./CaseSelectionModal";
export type { CaseForSelection, CaseSelectionModalProps } from "./CaseSelectionModal";
export { CaseSelectionItem } from "./CaseSelectionItem";
export type { CaseSelectionItemProps } from "./CaseSelectionItem";
export { default as useCaseSelection } from "./useCaseSelection";
export type {
  SortOption,
  FilterOption,
  UseCaseSelectionOptions,
  UseCaseSelectionReturn,
} from "./useCaseSelection";
