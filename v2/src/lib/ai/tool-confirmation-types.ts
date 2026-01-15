/**
 * Tool Confirmation Types
 *
 * Central type definitions for the tool confirmation flow.
 * Used by tool-result-summary, useToolConfirmations hook, and UI components.
 *
 * @module tool-confirmation-types
 */

import type { PermissionLevel } from './tool-permissions';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Status of a tool confirmation request
 */
export type ConfirmationStatus =
  | 'pending'    // Awaiting user decision
  | 'approved'   // User approved, about to execute
  | 'denied'     // User denied the action
  | 'executing'  // Currently executing the tool
  | 'done'       // Execution completed successfully
  | 'error';     // Execution failed

/**
 * Result from a tool that requires permission
 * This is what the backend returns when requiresConfirmation() returns true
 */
export interface PermissionRequestResult {
  requiresPermission: true;
  permissionType: PermissionLevel;
  toolName: string;
  toolCallId: string;
  arguments: Record<string, unknown>;
  description: string;
}

/**
 * Result from a tool that executed successfully
 */
export interface ToolSuccessResult {
  requiresPermission?: false;
  [key: string]: unknown;
}

/**
 * Result from a tool that failed
 */
export interface ToolErrorResult {
  error: string;
  requiresPermission?: false;
  [key: string]: unknown;
}

/**
 * Union of all possible tool result types
 */
export type ParsedToolResult =
  | PermissionRequestResult
  | ToolSuccessResult
  | ToolErrorResult;

// ============================================================================
// Confirmation State
// ============================================================================

/**
 * Base fields shared by all confirmation states
 */
interface ToolConfirmationBase {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  description: string;
  permissionType: PermissionLevel;
}

/**
 * State when awaiting user decision
 */
interface PendingConfirmationState extends ToolConfirmationBase {
  status: 'pending';
}

/**
 * State when user approved (brief transition state)
 */
interface ApprovedConfirmationState extends ToolConfirmationBase {
  status: 'approved';
}

/**
 * State when user denied the action
 */
interface DeniedConfirmationState extends ToolConfirmationBase {
  status: 'denied';
}

/**
 * State when currently executing the tool
 */
interface ExecutingConfirmationState extends ToolConfirmationBase {
  status: 'executing';
  startTime: number;
}

/**
 * State when execution completed successfully
 */
interface DoneConfirmationState extends ToolConfirmationBase {
  status: 'done';
  startTime?: number;
  endTime: number;
}

/**
 * State when execution failed
 */
interface ErrorConfirmationState extends ToolConfirmationBase {
  status: 'error';
  error: string;
  startTime?: number;
  endTime: number;
}

/**
 * Discriminated union for tool confirmation state machine
 *
 * Each status has precisely defined required fields:
 * - pending: No timing info needed
 * - approved: No timing info needed (brief transition)
 * - denied: No timing info needed
 * - executing: startTime required
 * - done: endTime required
 * - error: error message and endTime required
 *
 * This enforces correct state transitions at the type level.
 */
export type ToolConfirmationState =
  | PendingConfirmationState
  | ApprovedConfirmationState
  | DeniedConfirmationState
  | ExecutingConfirmationState
  | DoneConfirmationState
  | ErrorConfirmationState;

/**
 * Read-only map of tool call ID to confirmation state
 * Use this type for exposing confirmations from hooks (prevents external mutation)
 */
export type ConfirmationStateMap = ReadonlyMap<string, Readonly<ToolConfirmationState>>;

// ============================================================================
// Confirmation State Helpers
// ============================================================================

/**
 * Check if confirmation has timing info (executing, done, or error states)
 */
export function hasTimingInfo(
  state: ToolConfirmationState
): state is ExecutingConfirmationState | DoneConfirmationState | ErrorConfirmationState {
  return state.status === 'executing' || state.status === 'done' || state.status === 'error';
}

/**
 * Check if confirmation has an error (only error state)
 */
export function hasError(state: ToolConfirmationState): state is ErrorConfirmationState {
  return state.status === 'error';
}

/**
 * Safely get duration from a confirmation state
 * Returns undefined if timing info is not available
 */
export function getConfirmationDuration(state: ToolConfirmationState | undefined): number | undefined {
  if (!state) return undefined;
  if (state.status === 'done' && state.endTime && state.startTime) {
    return state.endTime - state.startTime;
  }
  if (state.status === 'error' && state.endTime && state.startTime) {
    return state.endTime - state.startTime;
  }
  return undefined;
}

/**
 * Safely get error message from a confirmation state
 * Returns undefined if not in error state
 */
export function getConfirmationError(state: ToolConfirmationState | undefined): string | undefined {
  if (!state) return undefined;
  return state.status === 'error' ? state.error : undefined;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a parsed result is a permission request
 */
export function isPermissionRequest(
  result: ParsedToolResult
): result is PermissionRequestResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'requiresPermission' in result &&
    result.requiresPermission === true
  );
}

/**
 * Check if a parsed result is an error
 */
export function isToolError(
  result: ParsedToolResult
): result is ToolErrorResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof result.error === 'string'
  );
}

/**
 * Check if a parsed result indicates failure (error or success: false)
 */
export function isToolFailure(result: ParsedToolResult): boolean {
  if (isToolError(result)) return true;
  if ('success' in result && result.success === false) return true;
  return false;
}

// ============================================================================
// Parsing Utilities
// ============================================================================

/**
 * Safely parse a JSON result string into a typed result
 *
 * @param resultString - JSON string from tool output
 * @returns Parsed result or null if parsing fails
 */
export function parseToolResultString(
  resultString: string | undefined
): ParsedToolResult | null {
  if (!resultString) return null;

  try {
    return JSON.parse(resultString) as ParsedToolResult;
  } catch {
    return null;
  }
}

/**
 * Extract permission request from a tool result if present
 *
 * @param resultString - JSON string from tool output
 * @returns PermissionRequestResult or null
 */
export function extractPermissionRequest(
  resultString: string | undefined
): PermissionRequestResult | null {
  const parsed = parseToolResultString(resultString);
  if (parsed && isPermissionRequest(parsed)) {
    return parsed;
  }
  return null;
}
