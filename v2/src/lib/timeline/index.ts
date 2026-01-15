/**
 * Timeline utilities for case visualization.
 *
 * @module timeline
 */

// Types
export type {
  Milestone,
  RangeBar,
  Stage,
  MilestoneConfig,
  CaseWithDates,
  RfiEntry,
  RfeEntry,
} from "./types";

// Constants
export { STAGE_COLORS, MILESTONE_CONFIG } from "./types";

// Functions
export {
  extractMilestones,
  extractRangeBars,
  calculateReadyToFileDate,
  calculateRecruitmentExpiresDate,
  extractRfiDeadlines,
  extractRfeDeadlines,
} from "./milestones";
