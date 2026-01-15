/**
 * Hooks - Centralized Exports
 *
 * @example
 * ```ts
 * import { useDebounce, useDebouncedCallback } from '@/hooks';
 * ```
 */

// Debounce hooks
export {
  useDebounce,
  useDebouncedCallback,
  useLeadingDebouncedCallback,
} from "./use-debounce";

// Form calculation hooks
export { useFormCalculations } from "./useFormCalculations";

// Date field validation
export { useDateFieldValidation } from "./useDateFieldValidation";

// Derived dates
export { useDerivedDates } from "./useDerivedDates";

// Navigation loading state
export { useNavigationLoading } from "./useNavigationLoading";

// Collapsible section state
export { useSectionState } from "./useSectionState";

// Unsaved changes detection
export { useUnsavedChanges } from "./useUnsavedChanges";

// Case form submission logic
export {
  useCaseFormSubmit,
  type UseCaseFormSubmitOptions,
  type UseCaseFormSubmitResult,
} from "./use-case-form-submit";

// Notification toast display
export { useNotificationToasts } from "./useNotificationToasts";

// Chat with persistence (AI SDK + Convex)
export {
  useChatWithPersistence,
  type ChatStatus,
} from "./useChatWithPersistence";

// Client actions execution (AI chatbot navigation/scroll/refresh)
export {
  useClientActions,
  type ActionExecutionResult,
  type UseClientActionsOptions,
  type UseClientActionsReturn,
} from "./useClientActions";
