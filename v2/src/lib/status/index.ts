/**
 * Status Utilities Module
 *
 * Centralized exports for all status-related utilities.
 *
 * @module lib/status
 */

// Urgency calculation and styling
export {
  // Constants
  URGENCY_THRESHOLDS,
  URGENCY_CONFIG,

  // Types
  type UrgencyLevel,
  type UrgencyLevelExtended,
  type UrgencyLevelWithCompletion,
  type UrgencyLevelFull,
  type UrgencyConfig,

  // Core calculation functions
  getUrgencyLevel,
  getUrgencyLevelExtended,
  getUrgencyLevelWithStatus,
  getUrgencyLevelFull,

  // Deadline-based functions
  getDaysUntilDeadline,
  getUrgencyFromDeadline,
  getUrgencyFromDeadlineExtended,

  // RFI/RFE specific
  getRfiRfeUrgency,

  // Styling helpers
  getUrgencyDotClass,
  getUrgencyHexColor,
  getUrgencyHexBgColor,
  getUrgencyLabel,
  getUrgencyConfig,
} from "./urgency";
