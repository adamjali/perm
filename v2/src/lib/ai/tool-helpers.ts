/**
 * Shared helpers for chat tool execution.
 * Eliminates repeated patterns across 30+ tool implementations.
 */

import { fetchQuery } from 'convex/nextjs';
import { api } from '@/../convex/_generated/api';
import {
  requiresConfirmation,
  getToolPermission,
  isToolAllowed,
  type ActionMode,
  type PermissionLevel,
} from './tool-permissions';

/** AI instruction shown with every confirmation card */
export const CONFIRMATION_AI_INSTRUCTION =
  'A confirmation card is now visible. Briefly explain what action this card will perform. Do NOT retry this tool - the user will click Approve or Cancel on the card.';

/**
 * Build a confirmation response for tools that require user approval.
 * Replaces ~7 repeated fields across 14+ tool implementations.
 */
export function buildConfirmationResponse(
  toolName: string,
  toolCallId: string,
  params: unknown,
  description: string,
  options?: {
    warning?: string;
    preview?: Record<string, unknown>;
    permissionType?: PermissionLevel;
  }
) {
  return {
    requiresPermission: true,
    permissionType: options?.permissionType || getToolPermission(toolName),
    toolName,
    toolCallId,
    arguments: params,
    description,
    ...(options?.warning && { warning: options.warning }),
    ...(options?.preview && { preview: options.preview }),
    _ai_instruction: CONFIRMATION_AI_INSTRUCTION,
  };
}

/**
 * Build a "disabled" response when a tool is blocked by action mode.
 */
export function buildDisabledResponse(error: string, feature?: string) {
  return {
    error,
    suggestion: feature
      ? `Actions are currently turned off. Enable actions in settings to ${feature}.`
      : 'Actions are currently turned off. Enable actions in settings.',
  };
}

/**
 * Build an error response from a caught exception.
 */
export function buildToolError(toolName: string, error: unknown) {
  console.error(`[Chat API] ${toolName} error:`, error);
  return {
    error: `Failed to ${toolName.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`,
    suggestion: error instanceof Error ? error.message : 'Please try again',
  };
}

/**
 * Check if a tool is allowed and return disabled response if not.
 * Returns null if the tool is allowed.
 */
export function checkToolAllowed(
  toolName: string,
  actionMode: ActionMode,
  disabledMessage: string,
  feature?: string
): ReturnType<typeof buildDisabledResponse> | null {
  if (!isToolAllowed(toolName, actionMode)) {
    return buildDisabledResponse(disabledMessage, feature);
  }
  return null;
}

/**
 * Check if a tool needs confirmation and return the confirmation response if so.
 * Returns null if no confirmation needed (tool can proceed).
 */
export function checkNeedsConfirmation(
  toolName: string,
  actionMode: ActionMode,
  toolCallId: string,
  params: unknown,
  description: string,
  options?: {
    warning?: string;
    preview?: Record<string, unknown>;
    permissionType?: PermissionLevel;
  }
): ReturnType<typeof buildConfirmationResponse> | null {
  if (requiresConfirmation(toolName, actionMode)) {
    return buildConfirmationResponse(toolName, toolCallId, params, description, options);
  }
  return null;
}

/**
 * Validate that a string is a plausible Convex document ID.
 * Rejects MongoDB ObjectIds (24 hex chars) and empty strings.
 * Returns an error response object if invalid, null if valid.
 */
export function validateConvexId(
  value: unknown,
  label = 'ID'
): { error: string; suggestion: string } | null {
  if (typeof value !== 'string' || value.length === 0) {
    return {
      error: `Invalid ${label}: expected a non-empty string`,
      suggestion: `Please provide a valid ${label}.`,
    };
  }
  // MongoDB ObjectIds are exactly 24 hex chars — AI sometimes hallucinates these
  if (/^[0-9a-f]{24}$/.test(value)) {
    return {
      error: `Invalid ${label}: "${value}" is not a valid case ID`,
      suggestion: `The ID appears to be in the wrong format. Use the queryCases tool to find the correct case ID.`,
    };
  }
  return null;
}

/**
 * Resolve bulk case IDs from "all" flag or explicit list.
 * Shared across bulkUpdateStatus, bulkArchiveCases, bulkDeleteCases, bulkCalendarSync.
 */
export async function resolveBulkCaseIds(
  params: { all?: boolean; caseIds?: string[]; filterByStatus?: string },
  token: string,
  options?: { idsOnly?: boolean; toolName?: string }
): Promise<string[]> {
  let caseIds = params.caseIds || [];
  // Validate explicit caseIds from AI (skip if fetching via all=true, those come from Convex)
  if (!params.all && caseIds.length > 0) {
    for (const id of caseIds) {
      const error = validateConvexId(id, 'case ID');
      if (error) {
        throw new Error(error.error);
      }
    }
  }
  if (params.all) {
    if (options?.toolName) {
      console.log(`[Chat API] ${options.toolName}: all=true, fetching all case IDs`);
    }
    const queryParams: Record<string, unknown> = options?.idsOnly ? { idsOnly: true } : {};
    if (params.filterByStatus) queryParams.caseStatus = params.filterByStatus;
    const queryResult = await fetchQuery(api.chatCaseData.queryCases, queryParams, { token });
    if ('cases' in queryResult && Array.isArray(queryResult.cases)) {
      caseIds = queryResult.cases.map((c) => String((c as Record<string, unknown>)._id));
      if (options?.toolName) {
        console.log(`[Chat API] ${options.toolName}: found ${caseIds.length} cases`);
      }
    }
  }
  return caseIds;
}
