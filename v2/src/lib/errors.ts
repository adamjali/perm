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

export function handleOperationError(
  error: unknown,
  options: OperationErrorOptions
): void {
  const { userMessage, context, level = "error", silent = false } = options;

  captureError(error, context);

  if (!silent) {
    if (level === "warning") {
      toast.warning(userMessage);
    } else {
      toast.error(userMessage);
    }
  }
}
