"use client";

// DECLARED, not inherited. This module uses useEffect, so it is a client module
// in every sense. Without the annotation it works only while every path to
// it crosses somebody else's `"use client"` boundary first: move a boundary
// anywhere above it and this lands on the server, where the API does not
// exist. See lib/ai/page-context.tsx for the failure that causes.

/**
 * useToolOrchestrator Hook
 *
 * Central orchestrator for chat tool execution flow.
 *
 * Responsibilities:
 * 1. Extract tool calls from streaming messages
 * 2. Execute autonomous clientActions immediately (navigation)
 * 3. Queue confirmed tools for user approval
 * 4. Feed all tool results back to AI
 *
 * Architecture:
 * - Uses useClientActions for navigation execution
 * - Uses useToolConfirmations for permission flow
 * - Bridges AI SDK streaming with tool execution
 *
 * @module hooks/useToolOrchestrator
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { captureError } from '@/lib/sentry';
import { useClientActions } from './useClientActions';
import { useToolConfirmations } from './useToolConfirmations';
import { hasClientAction, type ClientAction } from '@/lib/ai/client-actions';
import {
  extractPermissionRequest,
  type ToolConfirmationState,
} from '@/lib/ai/tool-confirmation-types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Threshold for detecting conversation reset.
 * If message count drops by more than this amount, we assume a new conversation started.
 */
const CONVERSATION_RESET_THRESHOLD = 5;

// =============================================================================
// Types
// =============================================================================

/**
 * Tool call structure from chat messages
 */
export interface ToolCall {
  tool: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  executedAt?: number;
}

/**
 * Message structure from chat
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  /**
   * Sent or received in this session. Only a live message's navigation runs:
   * reopening a saved conversation must not replay an old "go to case X".
   */
  isLive?: boolean;
  toolCalls?: ToolCall[];
}

/**
 * Options for the useToolOrchestrator hook
 */
export interface UseToolOrchestratorOptions {
  /** Current chat messages */
  messages: ChatMessage[];
  /** Current chat status */
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  /** Function to send a message to continue the AI conversation */
  sendMessage: (options?: { text?: string }) => void;
  /** Callback when navigation occurs */
  onNavigate?: (action: ClientAction) => void;
  /** Callback when tool execution completes */
  onToolComplete?: (toolCallId: string, result: unknown) => void;
  /** Callback when tool execution fails */
  onToolError?: (toolCallId: string, error: string) => void;
  /** Callback to persist tool result to database (for page refresh resilience) */
  onPersistResult?: (
    toolCallId: string,
    result: string,
    status: 'success' | 'error'
  ) => Promise<void>;
}

/**
 * Return type for useToolOrchestrator
 */
export interface UseToolOrchestratorReturn {
  /** Read-only map of pending confirmations (prevents external mutation) */
  confirmations: ReadonlyMap<string, Readonly<ToolConfirmationState>>;
  /** Check if a tool call has pending confirmation */
  hasPendingConfirmation: (toolCallId: string) => boolean;
  /** Get confirmation state for a tool call */
  getConfirmation: (toolCallId: string) => ToolConfirmationState | undefined;
  /** Approve a pending confirmation */
  approveConfirmation: (toolCallId: string) => Promise<void>;
  /** Deny a pending confirmation */
  denyConfirmation: (toolCallId: string) => void;
  /** Clear all confirmations (on conversation change) */
  clearConfirmations: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Central orchestrator for chat tool execution
 *
 * @example
 * ```tsx
 * const {
 *   confirmations,
 *   approveConfirmation,
 *   denyConfirmation,
 * } = useToolOrchestrator({
 *   messages,
 *   status,
 *   sendMessage,
 * });
 * ```
 */
export function useToolOrchestrator(
  options: UseToolOrchestratorOptions
): UseToolOrchestratorReturn {
  const {
    messages,
    status,
    sendMessage,
    onNavigate,
    onToolComplete,
    onToolError,
    onPersistResult,
  } = options;

  // Track which tool calls have been processed to prevent duplicates
  const processedToolCalls = useRef<Set<string>>(new Set());

  // Track which clientActions have been executed to prevent duplicates
  const executedClientActions = useRef<Set<string>>(new Set());

  // Client actions hook for navigation
  const { executeAction } = useClientActions({
    onAfterAction: (action, result) => {
      if (result.success) {
        onNavigate?.(action);
      }
    },
  });

  // Tool confirmations hook for permission flow
  const {
    confirmations,
    hasPendingConfirmation,
    getConfirmation,
    registerConfirmation,
    approve: internalApprove,
    deny: internalDeny,
    clearAll,
  } = useToolConfirmations({
    onExecutionComplete: (toolCallId, result) => {
      onToolComplete?.(toolCallId, result);

      // Feed result back to AI by sending a continuation message
      // The AI will see the tool result in its context and respond appropriately
      sendMessage({
        text: `[Tool execution completed for ${toolCallId}]`,
      });
    },
    onExecutionError: (toolCallId, error) => {
      onToolError?.(toolCallId, error);

      // Feed error back to AI
      sendMessage({
        text: `[Tool execution failed for ${toolCallId}: ${error}]`,
      });
    },
    // Persist results to database for page refresh resilience
    onPersistResult,
  });

  /**
   * Process a tool call - extract clientAction or permission request
   */
  const processToolCall = useCallback(
    (toolCall: ToolCall, index: number, message: ChatMessage) => {
      // The card's fallback id (ToolCallList): name + position in the message.
      const toolCallKey = `${toolCall.tool}-${index}`;
      // Processed-ness is per MESSAGE. Keyed on name + position alone, the
      // second "navigate" (or second permission request for the same tool) in a
      // conversation matched the first and was silently skipped.
      const processedKey = `${message.id}:${index}`;

      if (processedToolCalls.current.has(processedKey)) {
        return;
      }

      // Skip if no result yet
      if (!toolCall.result) {
        return;
      }

      // Mark as processed
      processedToolCalls.current.add(processedKey);

      // Parse the result
      let parsedResult: unknown;
      try {
        parsedResult = JSON.parse(toolCall.result);
      } catch (error) {
        // Not valid JSON - log for debugging and skip
        console.warn(
          `[useToolOrchestrator] Failed to parse tool result as JSON`,
          { toolName: toolCall.tool, toolCallKey, error }
        );
        captureError(error, { operation: 'parseToolResult' });
        return;
      }

      // Check for clientAction (navigation) - execute immediately
      if (hasClientAction(parsedResult)) {
        // History: the action already ran when the message was new.
        if (message.isLive === false) return;
        const actionKey = `${processedKey}-${parsedResult.clientAction.type}`;

        // Prevent duplicate execution
        if (!executedClientActions.current.has(actionKey)) {
          executedClientActions.current.add(actionKey);

          // Execute navigation immediately for smooth UX
          executeAction(parsedResult.clientAction);
        }
        return;
      }

      // Check for permission request - register for confirmation
      const permissionRequest = extractPermissionRequest(toolCall.result);
      if (permissionRequest) {
        const confirmationId = permissionRequest.toolCallId || toolCallKey;
        registerConfirmation(confirmationId, toolCall.result);
        return;
      }

      // Regular tool result - feed back to AI if it's a success/error
      // (This happens automatically through the streaming flow)
    },
    [executeAction, registerConfirmation]
  );

  /**
   * Process all tool calls in streaming messages
   * Runs on every message update during streaming
   */
  useEffect(() => {
    // Process during streaming, ready, or submitted (covers all active states)
    // This ensures we catch clientActions as soon as they appear
    if (status === 'error') {
      return;
    }

    // Find the last assistant message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return;
    }

    // Process each tool call
    if (lastMessage.toolCalls) {
      lastMessage.toolCalls.forEach((tc, index) => {
        processToolCall(tc, index, lastMessage);
      });
    }
  }, [messages, status, processToolCall]);

  /**
   * Clear processed tool calls when conversation changes
   * Detected by checking if messages array is reset
   */
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    // If messages dropped significantly, conversation likely changed
    if (messages.length < prevMessagesLength.current - CONVERSATION_RESET_THRESHOLD) {
      processedToolCalls.current.clear();
      executedClientActions.current.clear();
      clearAll();
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, clearAll]);

  /**
   * Deny a confirmation and notify AI
   */
  const denyConfirmation = useCallback(
    async (toolCallId: string) => {
      await internalDeny(toolCallId);
      sendMessage({ text: `[User denied tool execution: ${toolCallId}]` });
    },
    [internalDeny, sendMessage]
  );

  /**
   * Clear all confirmations and tracked state (for conversation switching)
   */
  const clearConfirmations = useCallback(() => {
    processedToolCalls.current.clear();
    executedClientActions.current.clear();
    clearAll();
  }, [clearAll]);

  return {
    confirmations,
    hasPendingConfirmation,
    getConfirmation,
    approveConfirmation: internalApprove, // Direct passthrough - no wrapper needed
    denyConfirmation,
    clearConfirmations,
  };
}
