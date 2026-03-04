import { captureError, type ErrorContext } from "@/lib/sentry";
import { toast } from "@/lib/toast";

interface OperationErrorOptions {
  /** Static user-facing message */
  userMessage: string;
  /** Sentry context for captureError */
  context?: ErrorContext;
  /** Toast level — defaults to "error" */
  level?: "error" | "warning";
  /** If true, suppress toast (capture only) */
  silent?: boolean;
}

/** Check if error is a Convex validation rejection (expected behavior, not a bug) */
function isExpectedValidationError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("Validation failed:");
}

export function handleOperationError(
  error: unknown,
  options: OperationErrorOptions
): void {
  const { userMessage, context, level = "error", silent = false } = options;

  // Don't report expected validation rejections to Sentry/PostHog —
  // these are business rule enforcement, not bugs
  if (!isExpectedValidationError(error)) {
    captureError(error, context);
  }

  if (!silent) {
    if (level === "warning") {
      toast.warning(userMessage);
    } else {
      toast.error(userMessage);
    }
  }
}
