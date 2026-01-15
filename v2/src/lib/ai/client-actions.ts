/**
 * Client Action Type Definitions
 *
 * Defines types for actions that the AI chatbot can request the frontend to execute.
 * These actions are returned from tool execute functions and handled by the client.
 *
 * IMPORTANT: Navigation tools are AUTONOMOUS (no permission needed per 28-CONTEXT.md).
 * They return clientAction objects that the frontend executes immediately.
 *
 * @module client-actions
 */

// =============================================================================
// Action Types
// =============================================================================

/**
 * All supported client action types
 */
export type ClientActionType =
  | 'navigate'
  | 'viewCase'
  | 'scrollTo'
  | 'refreshPage';

// =============================================================================
// Base Action Interface
// =============================================================================

/**
 * Base interface for all client actions
 */
export interface ClientAction {
  type: ClientActionType;
  payload: Record<string, unknown>;
}

// =============================================================================
// Specific Action Interfaces
// =============================================================================

/**
 * Navigate to a page in the application
 */
export interface NavigateAction extends ClientAction {
  type: 'navigate';
  payload: {
    path: string;
    reason?: string;
  };
}

/**
 * Navigate to view a specific case
 */
export interface ViewCaseAction extends ClientAction {
  type: 'viewCase';
  payload: {
    caseId: string;
    section?: 'overview' | 'timeline' | 'edit';
  };
}

/**
 * Scroll to a specific target on the current page
 */
export interface ScrollToAction extends ClientAction {
  type: 'scrollTo';
  payload: {
    target: string;
    smooth?: boolean;
  };
}

/**
 * Refresh the current page
 */
export interface RefreshPageAction extends ClientAction {
  type: 'refreshPage';
  payload: {
    reason?: string;
  };
}

// =============================================================================
// Union Type for All Actions
// =============================================================================

/**
 * Union type of all possible client actions
 */
export type AnyClientAction =
  | NavigateAction
  | ViewCaseAction
  | ScrollToAction
  | RefreshPageAction;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a ClientAction
 *
 * @param value - Value to check
 * @returns True if the value is a ClientAction
 *
 * @example
 * ```ts
 * const result = toolResult;
 * if (isClientAction(result.clientAction)) {
 *   executeAction(result.clientAction);
 * }
 * ```
 */
export function isClientAction(value: unknown): value is ClientAction {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'payload' in value &&
    typeof (value as ClientAction).type === 'string' &&
    typeof (value as ClientAction).payload === 'object'
  );
}

/**
 * Type guard to check if a value is a NavigateAction
 */
export function isNavigateAction(value: unknown): value is NavigateAction {
  return isClientAction(value) && value.type === 'navigate';
}

/**
 * Type guard to check if a value is a ViewCaseAction
 */
export function isViewCaseAction(value: unknown): value is ViewCaseAction {
  return isClientAction(value) && value.type === 'viewCase';
}

/**
 * Type guard to check if a value is a ScrollToAction
 */
export function isScrollToAction(value: unknown): value is ScrollToAction {
  return isClientAction(value) && value.type === 'scrollTo';
}

/**
 * Type guard to check if a value is a RefreshPageAction
 */
export function isRefreshPageAction(value: unknown): value is RefreshPageAction {
  return isClientAction(value) && value.type === 'refreshPage';
}

// =============================================================================
// Tool Result Interface
// =============================================================================

/**
 * Result from a navigation tool execution
 * Contains the success status, optional client action, and message
 */
export interface NavigationToolResult {
  success: boolean;
  clientAction?: ClientAction;
  message: string;
  error?: string;
}

/**
 * Type guard to check if a tool result contains a client action
 */
export function hasClientAction(
  result: unknown
): result is { clientAction: ClientAction } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'clientAction' in result &&
    isClientAction((result as { clientAction: unknown }).clientAction)
  );
}
