/**
 * Sentry Utility Functions
 *
 * Centralized error tracking and observability helpers.
 * Wraps Sentry SDK with application-specific context.
 *
 * @example
 * ```ts
 * import { captureError, addBreadcrumb } from "@/lib/sentry";
 *
 * try {
 *   await updateCase(caseId, data);
 * } catch (error) {
 *   captureError(error, { resourceId: caseId, operation: "updateCase" });
 *   throw error;
 * }
 * ```
 */

import * as Sentry from "@sentry/nextjs";

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorContext {
  /** Unique identifier for the affected resource */
  resourceId?: string;
  /** Name of the operation that failed */
  operation?: string;
  /** Additional context tags */
  tags?: Record<string, string>;
  /** Extra data to attach to the event */
  extra?: Record<string, unknown>;
}

export type BreadcrumbCategory =
  | "navigation"
  | "ui.click"
  | "form"
  | "validation"
  | "mutation"
  | "query"
  | "auth";

export interface BreadcrumbData {
  category: BreadcrumbCategory;
  message: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}

// ============================================================================
// ERROR CAPTURE
// ============================================================================

/**
 * Capture an exception with standardized context.
 *
 * @param error - The error to capture
 * @param context - Additional context for the error
 */
export function captureError(
  error: unknown,
  context?: ErrorContext
): string | undefined {
  const eventId = Sentry.captureException(error, {
    tags: {
      ...(context?.operation && { operation: context.operation }),
      ...(context?.resourceId && { resourceId: context.resourceId }),
      ...context?.tags,
    },
    extra: context?.extra,
  });

  return eventId;
}

/**
 * Capture a message (non-error event).
 *
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: ErrorContext
): string | undefined {
  const eventId = Sentry.captureMessage(message, {
    level,
    tags: {
      ...(context?.operation && { operation: context.operation }),
      ...(context?.resourceId && { resourceId: context.resourceId }),
      ...context?.tags,
    },
    extra: context?.extra,
  });

  return eventId;
}

// ============================================================================
// BREADCRUMBS
// ============================================================================

/**
 * Add a breadcrumb for debugging.
 * Breadcrumbs are attached to subsequent error reports.
 *
 * @param data - Breadcrumb data
 */
export function addBreadcrumb(data: BreadcrumbData): void {
  Sentry.addBreadcrumb({
    category: data.category,
    message: data.message,
    level: data.level ?? "info",
    data: data.data,
  });
}

/**
 * Add a validation error breadcrumb.
 */
export function trackValidationError(
  formName: string,
  errorCount: number,
  fields?: string[]
): void {
  addBreadcrumb({
    category: "validation",
    message: `Validation failed for "${formName}" with ${errorCount} error(s)`,
    level: "warning",
    data: { formName, errorCount, fields },
  });
}

// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set the current user context for error reports.
 *
 * @param user - User information
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
} | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}
