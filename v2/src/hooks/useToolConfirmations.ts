/**
 * useToolConfirmations Hook
 *
 * Central state management for tool confirmation flows.
 * Tracks pending confirmations, handles approve/deny actions,
 * and executes tools after user approval.
 *
 * @module hooks/useToolConfirmations
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  ConfirmationStatus,
  ToolConfirmationState,
  PermissionRequestResult,
} from '@/lib/ai/tool-confirmation-types';
import { extractPermissionRequest } from '@/lib/ai/tool-confirmation-types';

// ============================================================================
// Types
// ============================================================================

interface UseToolConfirmationsOptions {
  /** Called when a tool execution completes successfully */
  onExecutionComplete?: (toolCallId: string, result: unknown) => void;
  /** Called when a tool execution fails */
  onExecutionError?: (toolCallId: string, error: string) => void;
  /** Called to persist tool result to database (for page refresh resilience) */
  onPersistResult?: (
    toolCallId: string,
    result: string,
    status: 'success' | 'error'
  ) => Promise<void>;
}

interface UseToolConfirmationsReturn {
  /** Read-only map of toolCallId to confirmation state (prevents external mutation) */
  confirmations: ReadonlyMap<string, Readonly<ToolConfirmationState>>;
  /** Check if a tool call has a pending confirmation */
  hasPendingConfirmation: (toolCallId: string) => boolean;
  /** Get confirmation state for a tool call */
  getConfirmation: (toolCallId: string) => ToolConfirmationState | undefined;
  /** Register a new confirmation from a tool result */
  registerConfirmation: (toolCallId: string, resultString: string) => boolean;
  /** Register confirmation from parsed data (for streaming) */
  registerConfirmationFromData: (data: PermissionRequestResult) => void;
  /** Approve a pending confirmation */
  approve: (toolCallId: string) => Promise<void>;
  /** Deny a pending confirmation */
  deny: (toolCallId: string) => Promise<void>;
  /** Clear all confirmations (e.g., on conversation change) */
  clearAll: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Delay (ms) before transitioning from 'approved' to 'executing' state.
 * Provides a brief visual feedback window for the approval animation.
 */
const APPROVAL_TO_EXECUTING_DELAY_MS = 100;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Central state management hook for tool confirmation flows.
 *
 * Manages the lifecycle of tool confirmations:
 * pending → approved → executing → done/error (or pending → denied)
 *
 * @param options - Configuration options
 * @param options.onExecutionComplete - Callback when tool execution succeeds
 * @param options.onExecutionError - Callback when tool execution fails
 * @returns Object with confirmation state and control functions
 *
 * @example
 * ```tsx
 * function ToolCallList({ toolCalls }) {
 *   const {
 *     getConfirmation,
 *     registerConfirmation,
 *     approve,
 *     deny,
 *   } = useToolConfirmations({
 *     onExecutionComplete: (id, result) => console.log('Done:', result),
 *     onExecutionError: (id, error) => console.error('Failed:', error),
 *   });
 *
 *   // Register confirmations from tool results
 *   toolCalls.forEach((tc) => {
 *     if (tc.result) registerConfirmation(tc.id, tc.result);
 *   });
 *
 *   // Get state and render UI
 *   const state = getConfirmation(toolCallId);
 *   if (state?.status === 'pending') {
 *     return <ConfirmationUI onApprove={() => approve(id)} onDeny={() => deny(id)} />;
 *   }
 * }
 * ```
 */
export function useToolConfirmations(
  options: UseToolConfirmationsOptions = {}
): UseToolConfirmationsReturn {
  const { onExecutionComplete, onExecutionError, onPersistResult } = options;

  // State: Map of toolCallId -> ToolConfirmationState
  const [confirmations, setConfirmations] = useState<Map<string, ToolConfirmationState>>(
    () => new Map()
  );

  // Ref to track in-flight executions (prevents double-execution)
  const executingRef = useRef<Set<string>>(new Set());

  /**
   * Check if a tool call has a pending confirmation
   */
  const hasPendingConfirmation = useCallback(
    (toolCallId: string): boolean => {
      const state = confirmations.get(toolCallId);
      return state?.status === 'pending';
    },
    [confirmations]
  );

  /**
   * Get confirmation state for a tool call
   */
  const getConfirmation = useCallback(
    (toolCallId: string): ToolConfirmationState | undefined => {
      return confirmations.get(toolCallId);
    },
    [confirmations]
  );

  /**
   * Register a new confirmation from a tool result string
   * @returns true if a confirmation was registered, false otherwise
   */
  const registerConfirmation = useCallback(
    (toolCallId: string, resultString: string): boolean => {
      const request = extractPermissionRequest(resultString);
      if (!request) return false;

      // Don't re-register if already exists
      if (confirmations.has(toolCallId)) return true;

      setConfirmations((prev) => {
        const next = new Map(prev);
        next.set(toolCallId, {
          toolCallId: request.toolCallId || toolCallId,
          toolName: request.toolName,
          arguments: request.arguments,
          description: request.description,
          permissionType: request.permissionType,
          status: 'pending',
        });
        return next;
      });

      return true;
    },
    [confirmations]
  );

  /**
   * Register confirmation from already-parsed data (for streaming)
   */
  const registerConfirmationFromData = useCallback(
    (data: PermissionRequestResult): void => {
      const toolCallId = data.toolCallId;

      // Don't re-register if already exists
      setConfirmations((prev) => {
        if (prev.has(toolCallId)) return prev;

        const next = new Map(prev);
        next.set(toolCallId, {
          toolCallId,
          toolName: data.toolName,
          arguments: data.arguments,
          description: data.description,
          permissionType: data.permissionType,
          status: 'pending',
        });
        return next;
      });
    },
    []
  );

  /**
   * Update confirmation status
   *
   * Uses type assertion to construct properly-typed state objects.
   * This is safe because we're the sole manager of state transitions
   * and ensure correct properties are passed for each status.
   */
  const updateStatus = useCallback(
    (
      toolCallId: string,
      status: ConfirmationStatus,
      extra?: { error?: string; endTime?: number; startTime?: number }
    ): void => {
      setConfirmations((prev) => {
        const existing = prev.get(toolCallId);
        if (!existing) return prev;

        const next = new Map(prev);
        // Construct new state - type assertion is safe because callers
        // always provide correct extra fields for each status transition
        const newState = {
          toolCallId: existing.toolCallId,
          toolName: existing.toolName,
          arguments: existing.arguments,
          description: existing.description,
          permissionType: existing.permissionType,
          status,
          ...extra,
        } as ToolConfirmationState;
        next.set(toolCallId, newState);
        return next;
      });
    },
    []
  );

  /**
   * Approve a pending confirmation and execute the tool
   */
  const approve = useCallback(
    async (toolCallId: string): Promise<void> => {
      const state = confirmations.get(toolCallId);
      if (!state || state.status !== 'pending') return;

      // Prevent double-execution
      if (executingRef.current.has(toolCallId)) return;
      executingRef.current.add(toolCallId);

      // Update to approved -> executing
      updateStatus(toolCallId, 'approved');
      const startTime = Date.now();

      // Briefly show 'approved' state before transitioning to 'executing'
      setTimeout(() => {
        updateStatus(toolCallId, 'executing', { startTime });
      }, APPROVAL_TO_EXECUTING_DELAY_MS);

      try {
        // Call the execute endpoint
        const response = await fetch('/api/chat/execute-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolCallId: state.toolCallId,
            toolName: state.toolName,
            arguments: state.arguments,
          }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          const errorMsg = result.error || 'Execution failed';
          updateStatus(toolCallId, 'error', {
            error: errorMsg,
            startTime,
            endTime: Date.now(),
          });

          // Persist error result to database - await to ensure it's saved before any refresh
          try {
            await onPersistResult?.(
              state.toolCallId,
              JSON.stringify({ error: errorMsg, executedAt: Date.now() }),
              'error'
            );
          } catch (persistErr) {
            console.error('[useToolConfirmations] Failed to persist error result:', persistErr);
          }

          onExecutionError?.(toolCallId, errorMsg);
        } else {
          updateStatus(toolCallId, 'done', { startTime, endTime: Date.now() });

          // Persist success result to database - await to ensure it's saved before any refresh
          try {
            await onPersistResult?.(
              state.toolCallId,
              JSON.stringify(result),
              'success'
            );
          } catch (persistErr) {
            console.error('[useToolConfirmations] Failed to persist success result:', persistErr);
          }

          onExecutionComplete?.(toolCallId, result);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Network error';
        updateStatus(toolCallId, 'error', {
          error: errorMsg,
          startTime,
          endTime: Date.now(),
        });

        // Persist error result to database - await to ensure it's saved before any refresh
        try {
          await onPersistResult?.(
            state.toolCallId,
            JSON.stringify({ error: errorMsg, executedAt: Date.now() }),
            'error'
          );
        } catch (persistErr) {
          console.error('[useToolConfirmations] Failed to persist network error:', persistErr);
        }

        onExecutionError?.(toolCallId, errorMsg);
      } finally {
        executingRef.current.delete(toolCallId);
      }
    },
    [confirmations, updateStatus, onExecutionComplete, onExecutionError, onPersistResult]
  );

  /**
   * Deny a pending confirmation
   */
  const deny = useCallback(
    async (toolCallId: string): Promise<void> => {
      const state = confirmations.get(toolCallId);
      if (!state || state.status !== 'pending') return;

      updateStatus(toolCallId, 'denied');

      // Persist denial to database - await to ensure it's saved before any refresh
      // Using 'error' status since 'denied' isn't a valid DB status
      try {
        await onPersistResult?.(
          state.toolCallId,
          JSON.stringify({ denied: true, deniedAt: Date.now() }),
          'error'
        );
      } catch (persistErr) {
        console.error('[useToolConfirmations] Failed to persist denial:', persistErr);
      }
    },
    [confirmations, updateStatus, onPersistResult]
  );

  /**
   * Clear all confirmations
   */
  const clearAll = useCallback((): void => {
    setConfirmations(new Map());
    executingRef.current.clear();
  }, []);

  return {
    confirmations,
    hasPendingConfirmation,
    getConfirmation,
    registerConfirmation,
    registerConfirmationFromData,
    approve,
    deny,
    clearAll,
  };
}
