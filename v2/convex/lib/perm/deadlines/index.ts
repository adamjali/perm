/**
 * Deadline Extraction and Supersession Module
 *
 * Central module for determining which deadlines are active and extracting
 * deadline information from cases.
 *
 * This module is the SINGLE SOURCE OF TRUTH for deadline supersession logic.
 * All components that need deadline information should import from here.
 *
 * @module
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  DeadlineType,
  RfiEntry,
  RfeEntry,
  AdditionalRecruitmentMethod,
  CaseDataForDeadlines,
  ExtractedDeadline,
  DeadlineActiveStatus,
  SupersessionReason,
} from "./types";

export { DEADLINE_LABELS, SUPERSESSION_REASONS } from "./types";

// ============================================================================
// SUPERSESSION LOGIC
// ============================================================================

export {
  isDeadlineActive,
  getActiveRfiEntry,
  getActiveRfeEntry,
  hasAnyActiveDeadline,
} from "./isDeadlineActive";

// ============================================================================
// DEADLINE EXTRACTION
// ============================================================================

export {
  extractActiveDeadlines,
  getActiveDeadlineTypes,
  shouldRemindForDeadline,
  daysBetween,
  getTodayISO,
} from "./extractActiveDeadlines";
