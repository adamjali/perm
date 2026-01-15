/**
 * Notification Helper Functions
 *
 * Pure helper functions for generating notification content, calculating priority,
 * and determining when notifications should be sent.
 *
 * All functions are testable without database dependencies.
 *
 * @see /perm_flow.md - Source of truth for PERM workflow
 * @see ./deadlineEnforcementHelpers.ts - Related deadline enforcement logic
 * @see ../schema.ts - Notification schema definition
 * @module
 */

import {
  generateClosureTitle,
  type DeadlineViolation,
} from "./deadlineEnforcementHelpers";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notification types supported by the system.
 * Matches schema.notifications.type union.
 */
export type NotificationType =
  | "deadline_reminder"
  | "status_change"
  | "rfe_alert"
  | "rfi_alert"
  | "system"
  | "auto_closure";

/**
 * Priority levels for notifications.
 * Matches schema.notifications.priority union.
 */
export type PriorityLevel = "low" | "normal" | "high" | "urgent";

/**
 * Deadline types that can trigger notifications.
 * Matches schema.notifications.deadlineType values.
 */
export type DeadlineNotificationType =
  | "pwd_expiration"
  | "rfi_due"
  | "rfe_due"
  | "filing_window_opens"
  | "recruitment_window"
  | "eta9089_expiration"
  | "i140_filing_deadline";

/**
 * Context for generating notification titles and messages.
 */
export interface NotificationContext {
  /** Type of deadline (for deadline_reminder and related types) */
  deadlineType?: DeadlineNotificationType;
  /** Days until deadline (negative = overdue) */
  daysUntilDeadline?: number;
  /** New case status (for status_change) */
  newStatus?: string;
  /** Employer name for case identification */
  employerName?: string;
  /** Beneficiary identifier for case identification */
  beneficiaryIdentifier?: string;
  /** Full case label (e.g., "John D. at Acme Corp") */
  caseLabel?: string;
  /** Deadline violation info (for auto_closure) */
  violation?: DeadlineViolation;
  /** Deadline date in ISO format */
  deadlineDate?: string;
}

/**
 * User notification preferences subset for email/push decision logic.
 * Matches relevant fields from schema.userProfiles.
 */
export interface UserNotificationPrefs {
  /** Master switch for email notifications */
  emailNotificationsEnabled: boolean;
  /** Whether to send deadline reminder emails */
  emailDeadlineReminders: boolean;
  /** Whether to send status update emails */
  emailStatusUpdates: boolean;
  /** Whether to send RFE alert emails */
  emailRfeAlerts: boolean;
  /** Whether to send RFI alert emails (same pref as RFE) */
  // Note: Schema uses emailRfeAlerts for both RFI and RFE
  /** Master switch for push notifications */
  pushNotificationsEnabled: boolean;
  /** Whether quiet hours are enabled */
  quietHoursEnabled: boolean;
  /** Quiet hours start time (HH:MM format) */
  quietHoursStart?: string;
  /** Quiet hours end time (HH:MM format) */
  quietHoursEnd?: string;
  /** User's timezone (IANA format) */
  timezone: string;
}

/**
 * Icon names for notification UI display.
 */
export type NotificationIcon =
  | "clock"
  | "arrow-right"
  | "alert-circle"
  | "alert-triangle"
  | "x-circle"
  | "info";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format days until deadline as human-readable text.
 */
function formatDaysUntil(days: number): string {
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`;
  }
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `in ${days} days`;
  if (days <= 14) return `in ${Math.ceil(days / 7)} weeks`;
  if (days <= 30) return `in ${days} days`;
  return `in ${Math.ceil(days / 30)} months`;
}

/**
 * Format a case status for display in notifications.
 *
 * @param status - Case status string (pwd, recruitment, etc.)
 * @returns Human-readable status name
 *
 * @example
 * formatCaseStatus("pwd"); // "PWD"
 * formatCaseStatus("eta9089"); // "ETA 9089"
 */
export function formatCaseStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pwd: "PWD",
    recruitment: "Recruitment",
    eta9089: "ETA 9089",
    i140: "I-140",
    closed: "Closed",
  };
  return statusMap[status] || status;
}

/**
 * Build UserNotificationPrefs object from a user profile.
 * Centralizes the default value logic to avoid duplication across mutations.
 *
 * @param userProfile - Partial user profile or null/undefined
 * @returns UserNotificationPrefs with defaults applied
 *
 * @example
 * const prefs = buildUserNotificationPrefs(userProfile);
 * if (shouldSendEmail("status_change", "normal", prefs)) { ... }
 */
export function buildUserNotificationPrefs(
  userProfile: Partial<UserNotificationPrefs> | null | undefined
): UserNotificationPrefs {
  return {
    emailNotificationsEnabled: userProfile?.emailNotificationsEnabled ?? true,
    emailDeadlineReminders: userProfile?.emailDeadlineReminders ?? true,
    emailStatusUpdates: userProfile?.emailStatusUpdates ?? true,
    emailRfeAlerts: userProfile?.emailRfeAlerts ?? true,
    pushNotificationsEnabled: userProfile?.pushNotificationsEnabled ?? false,
    quietHoursEnabled: userProfile?.quietHoursEnabled ?? false,
    quietHoursStart: userProfile?.quietHoursStart,
    quietHoursEnd: userProfile?.quietHoursEnd,
    timezone: userProfile?.timezone ?? "America/New_York",
  };
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate a notification title based on type and context.
 *
 * @param type - Notification type
 * @param context - Context for title generation
 * @returns Human-readable notification title
 *
 * @example
 * generateNotificationTitle("deadline_reminder", {
 *   deadlineType: "pwd_expiration",
 *   daysUntilDeadline: 7
 * });
 * // "PWD Expiration in 7 days"
 */
export function generateNotificationTitle(
  type: NotificationType,
  context: NotificationContext
): string {
  switch (type) {
    case "deadline_reminder": {
      const deadlineLabel = context.deadlineType
        ? formatDeadlineType(context.deadlineType)
        : "Deadline";

      if (context.daysUntilDeadline !== undefined) {
        // Handle labels that already end with "Due" (e.g., "RFI Response Due")
        const labelEndsDue = deadlineLabel.endsWith("Due");

        if (context.daysUntilDeadline < 0) {
          return `${deadlineLabel} Overdue`;
        }
        if (context.daysUntilDeadline === 0) {
          return labelEndsDue
            ? `${deadlineLabel} Today`
            : `${deadlineLabel} Due Today`;
        }
        if (context.daysUntilDeadline === 1) {
          return `${deadlineLabel} Tomorrow`;
        }
        return `${deadlineLabel} in ${context.daysUntilDeadline} days`;
      }
      return `${deadlineLabel} Reminder`;
    }

    case "status_change": {
      const statusLabel = context.newStatus
        ? formatCaseStatus(context.newStatus)
        : "Updated";
      return `Case Status Updated to ${statusLabel}`;
    }

    case "rfi_alert": {
      if (context.daysUntilDeadline !== undefined) {
        if (context.daysUntilDeadline < 0) {
          return "RFI Response Overdue";
        }
        if (context.daysUntilDeadline <= 7) {
          return `RFI Response Due ${formatDaysUntil(context.daysUntilDeadline)}`;
        }
        return `RFI Response Due in ${context.daysUntilDeadline} days`;
      }
      return "RFI Response Due Soon";
    }

    case "rfe_alert": {
      if (context.daysUntilDeadline !== undefined) {
        if (context.daysUntilDeadline < 0) {
          return "RFE Response Overdue";
        }
        if (context.daysUntilDeadline <= 7) {
          return `RFE Response Due ${formatDaysUntil(context.daysUntilDeadline)}`;
        }
        return `RFE Response Due in ${context.daysUntilDeadline} days`;
      }
      return "RFE Response Due Soon";
    }

    case "auto_closure": {
      if (context.violation) {
        return generateClosureTitle(context.violation);
      }
      return "Case Automatically Closed";
    }

    case "system":
      return "System Notification";

    default:
      return "Notification";
  }
}

/**
 * Generate a notification message body based on type and context.
 *
 * @param type - Notification type
 * @param context - Context for message generation
 * @returns Human-readable notification message
 *
 * @example
 * generateNotificationMessage("deadline_reminder", {
 *   deadlineType: "pwd_expiration",
 *   daysUntilDeadline: 7,
 *   caseLabel: "John D. at Acme Corp",
 *   deadlineDate: "2024-12-31"
 * });
 * // "PWD for John D. at Acme Corp expires on December 31, 2024. Take action to avoid case closure."
 */
export function generateNotificationMessage(
  type: NotificationType,
  context: NotificationContext
): string {
  const caseLabel =
    context.caseLabel ||
    (context.employerName && context.beneficiaryIdentifier
      ? `${context.beneficiaryIdentifier} at ${context.employerName}`
      : "this case");

  const formattedDate = context.deadlineDate
    ? new Date(context.deadlineDate + "T00:00:00Z").toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }
      )
    : undefined;

  switch (type) {
    case "deadline_reminder": {
      const deadlineLabel = context.deadlineType
        ? formatDeadlineType(context.deadlineType)
        : "The deadline";

      if (context.daysUntilDeadline !== undefined && context.daysUntilDeadline < 0) {
        const daysOverdue = Math.abs(context.daysUntilDeadline);
        return `${deadlineLabel} for ${caseLabel} is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue. Immediate action required.`;
      }

      if (formattedDate) {
        if (context.daysUntilDeadline === 0) {
          return `${deadlineLabel} for ${caseLabel} is due today (${formattedDate}). Take action immediately.`;
        }
        if (context.daysUntilDeadline === 1) {
          return `${deadlineLabel} for ${caseLabel} is due tomorrow (${formattedDate}). Take action soon.`;
        }
        return `${deadlineLabel} for ${caseLabel} is due on ${formattedDate}. Plan accordingly.`;
      }

      return `${deadlineLabel} for ${caseLabel} is approaching. Review the case for details.`;
    }

    case "status_change": {
      const statusLabel = context.newStatus
        ? formatCaseStatus(context.newStatus)
        : "a new status";
      return `Case for ${caseLabel} has moved to ${statusLabel}. Review the case for updated deadlines and required actions.`;
    }

    case "rfi_alert": {
      if (context.daysUntilDeadline !== undefined) {
        if (context.daysUntilDeadline < 0) {
          return `RFI response for ${caseLabel} is overdue. The DOL response deadline has passed. Submit response immediately.`;
        }
        if (context.daysUntilDeadline === 0) {
          return `RFI response for ${caseLabel} is due today. Submit your response to the DOL immediately.`;
        }
        if (context.daysUntilDeadline === 1) {
          return `RFI response for ${caseLabel} is due tomorrow. Prepare and submit your response soon.`;
        }
      }
      if (formattedDate) {
        return `RFI response for ${caseLabel} is due on ${formattedDate}. Prepare your response to the DOL.`;
      }
      return `RFI response for ${caseLabel} is due soon. Review the case for the response deadline.`;
    }

    case "rfe_alert": {
      if (context.daysUntilDeadline !== undefined) {
        if (context.daysUntilDeadline < 0) {
          return `RFE response for ${caseLabel} is overdue. The USCIS response deadline has passed. Submit response immediately.`;
        }
        if (context.daysUntilDeadline === 0) {
          return `RFE response for ${caseLabel} is due today. Submit your response to USCIS immediately.`;
        }
        if (context.daysUntilDeadline === 1) {
          return `RFE response for ${caseLabel} is due tomorrow. Prepare and submit your response soon.`;
        }
      }
      if (formattedDate) {
        return `RFE response for ${caseLabel} is due on ${formattedDate}. Prepare your response to USCIS.`;
      }
      return `RFE response for ${caseLabel} is due soon. Review the case for the response deadline.`;
    }

    case "auto_closure": {
      if (context.violation) {
        return `Case for ${caseLabel} has been automatically closed: ${context.violation.reason}`;
      }
      return `Case for ${caseLabel} has been automatically closed due to a missed deadline.`;
    }

    case "system":
      return "You have a new system notification. Check the notification center for details.";

    default:
      return "You have a new notification.";
  }
}

/**
 * Calculate the priority level based on days until deadline and notification type.
 *
 * Priority rules:
 * - urgent: overdue (< 0 days) or <= 7 days
 * - high: 8-14 days
 * - normal: 15-30 days
 * - low: 30+ days
 * - RFI/RFE alerts are always at least "high" priority
 *
 * @param daysUntil - Days until deadline (negative = overdue)
 * @param type - Notification type
 * @returns Priority level
 *
 * @example
 * calculatePriority(5, "deadline_reminder"); // "urgent"
 * calculatePriority(20, "deadline_reminder"); // "normal"
 * calculatePriority(45, "rfi_alert"); // "high" (RFI is always at least high)
 */
export function calculatePriority(
  daysUntil: number,
  type: NotificationType
): PriorityLevel {
  // RFI/RFE alerts are always at least high priority
  const isRfiRfe = type === "rfi_alert" || type === "rfe_alert";
  const minPriority: PriorityLevel = isRfiRfe ? "high" : "low";

  // Calculate base priority from days until deadline
  let basePriority: PriorityLevel;

  if (daysUntil < 0) {
    // Overdue
    basePriority = "urgent";
  } else if (daysUntil <= 7) {
    basePriority = "urgent";
  } else if (daysUntil <= 14) {
    basePriority = "high";
  } else if (daysUntil <= 30) {
    basePriority = "normal";
  } else {
    basePriority = "low";
  }

  // Priority order for comparison
  const priorityOrder: PriorityLevel[] = ["low", "normal", "high", "urgent"];
  const basePriorityIndex = priorityOrder.indexOf(basePriority);
  const minPriorityIndex = priorityOrder.indexOf(minPriority);

  // Return the higher of basePriority and minPriority
  return basePriorityIndex >= minPriorityIndex ? basePriority : minPriority;
}

/**
 * Get the icon name for a notification type.
 *
 * Icon meanings:
 * - clock: Time-based reminder (deadline)
 * - arrow-right: Status transition
 * - alert-circle: RFI alert (DOL request)
 * - alert-triangle: RFE alert (USCIS request)
 * - x-circle: Case closure
 * - info: General system info
 *
 * @param type - Notification type
 * @returns Icon name for UI display
 *
 * @example
 * getNotificationIcon("deadline_reminder"); // "clock"
 * getNotificationIcon("rfe_alert"); // "alert-triangle"
 */
export function getNotificationIcon(type: NotificationType): NotificationIcon {
  switch (type) {
    case "deadline_reminder":
      return "clock";
    case "status_change":
      return "arrow-right";
    case "rfi_alert":
      return "alert-circle";
    case "rfe_alert":
      return "alert-triangle";
    case "auto_closure":
      return "x-circle";
    case "system":
      return "info";
    default:
      return "info";
  }
}

/**
 * Format a deadline type as a human-readable string.
 *
 * @param deadlineType - Deadline type from schema
 * @returns Human-readable deadline name
 *
 * @example
 * formatDeadlineType("pwd_expiration"); // "PWD Expiration"
 * formatDeadlineType("eta9089_expiration"); // "ETA 9089 Expiration"
 */
export function formatDeadlineType(
  deadlineType: DeadlineNotificationType
): string {
  switch (deadlineType) {
    case "pwd_expiration":
      return "PWD Expiration";
    case "rfi_due":
      return "RFI Response Due";
    case "rfe_due":
      return "RFE Response Due";
    case "filing_window_opens":
      return "Filing Window Opens";
    case "recruitment_window":
      return "Recruitment Window";
    case "eta9089_expiration":
      return "ETA 9089 Expiration";
    case "i140_filing_deadline":
      return "I-140 Filing Deadline";
    default:
      return deadlineType;
  }
}

/**
 * Parse a time string (HH:MM) to minutes since midnight.
 */
function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * Check if current time is within quiet hours.
 *
 * Handles overnight quiet hours (e.g., 22:00 to 08:00).
 *
 * @param currentTime - Current time in HH:MM format
 * @param quietStart - Quiet hours start in HH:MM format
 * @param quietEnd - Quiet hours end in HH:MM format
 * @returns true if within quiet hours
 */
function isWithinQuietHours(
  currentTime: string,
  quietStart: string,
  quietEnd: string
): boolean {
  const current = parseTimeToMinutes(currentTime);
  const start = parseTimeToMinutes(quietStart);
  const end = parseTimeToMinutes(quietEnd);

  if (current === null || start === null || end === null) {
    return false;
  }

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    // Quiet hours span midnight
    return current >= start || current < end;
  }

  // Normal case (e.g., 09:00 to 17:00)
  return current >= start && current < end;
}

/**
 * Determine whether an email should be sent for a notification.
 *
 * Checks:
 * 1. Master email switch is enabled
 * 2. Type-specific preference is enabled
 * 3. Not within quiet hours (if enabled)
 *
 * @param notificationType - Type of notification
 * @param priority - Notification priority
 * @param userPrefs - User notification preferences
 * @param currentTimeInTimezone - Current time in user's timezone (HH:MM format)
 * @returns true if email should be sent
 *
 * @example
 * shouldSendEmail("deadline_reminder", "urgent", {
 *   emailNotificationsEnabled: true,
 *   emailDeadlineReminders: true,
 *   quietHoursEnabled: false,
 *   // ...other prefs
 * }, "10:30");
 * // true
 */
export function shouldSendEmail(
  notificationType: NotificationType,
  priority: PriorityLevel,
  userPrefs: UserNotificationPrefs,
  currentTimeInTimezone?: string
): boolean {
  // Check master switch
  if (!userPrefs.emailNotificationsEnabled) {
    return false;
  }

  // Check type-specific preferences
  switch (notificationType) {
    case "deadline_reminder":
      if (!userPrefs.emailDeadlineReminders) return false;
      break;

    case "status_change":
      if (!userPrefs.emailStatusUpdates) return false;
      break;

    case "rfi_alert":
      // RFI uses same pref as RFE (emailRfeAlerts covers both)
      if (!userPrefs.emailRfeAlerts) return false;
      break;

    case "rfe_alert":
      if (!userPrefs.emailRfeAlerts) return false;
      break;

    case "auto_closure":
      // Auto-closure always sends email if master switch is on
      // (critical notification)
      break;

    case "system":
      // System notifications follow general preferences
      // Use status updates preference as fallback
      if (!userPrefs.emailStatusUpdates) return false;
      break;
  }

  // Check quiet hours (skip for urgent priority - always deliver urgent)
  if (
    priority !== "urgent" &&
    userPrefs.quietHoursEnabled &&
    userPrefs.quietHoursStart &&
    userPrefs.quietHoursEnd &&
    currentTimeInTimezone
  ) {
    if (
      isWithinQuietHours(
        currentTimeInTimezone,
        userPrefs.quietHoursStart,
        userPrefs.quietHoursEnd
      )
    ) {
      return false;
    }
  }

  return true;
}
