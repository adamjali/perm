/**
 * useClientActions Hook
 *
 * Hook for executing client-side actions returned by AI chat tools.
 * Handles navigation, scrolling, and page refresh actions.
 *
 * IMPORTANT: Navigation actions are AUTONOMOUS (no permission needed).
 * They execute immediately when detected in tool results.
 *
 * @module useClientActions
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { ClientAction, AnyClientAction } from '@/lib/ai/client-actions';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of executing a client action
 */
export interface ActionExecutionResult {
  success: boolean;
  error?: string;
}

/**
 * Options for the useClientActions hook
 */
export interface UseClientActionsOptions {
  /**
   * Callback fired before an action is executed
   * Return false to cancel the action
   */
  onBeforeAction?: (action: ClientAction) => boolean | Promise<boolean>;

  /**
   * Callback fired after an action is executed
   */
  onAfterAction?: (action: ClientAction, result: ActionExecutionResult) => void;
}

/**
 * Return type of the useClientActions hook
 */
export interface UseClientActionsReturn {
  /**
   * Execute a single client action
   */
  executeAction: (action: ClientAction) => Promise<ActionExecutionResult>;

  /**
   * Execute multiple client actions in sequence
   */
  executeActions: (actions: ClientAction[]) => Promise<ActionExecutionResult[]>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for executing client-side actions from AI chat tools
 *
 * @param options - Configuration options
 * @returns Object with executeAction and executeActions functions
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { executeAction } = useClientActions({
 *     onAfterAction: (action, result) => {
 *       console.log(`Action ${action.type} completed:`, result);
 *     },
 *   });
 *
 *   // When tool result contains clientAction
 *   if (hasClientAction(toolResult)) {
 *     await executeAction(toolResult.clientAction);
 *   }
 * }
 * ```
 */
export function useClientActions(
  options: UseClientActionsOptions = {}
): UseClientActionsReturn {
  const router = useRouter();
  const { onBeforeAction, onAfterAction } = options;

  /**
   * Execute a single client action
   */
  const executeAction = useCallback(
    async (action: ClientAction): Promise<ActionExecutionResult> => {
      // Check if action should proceed
      if (onBeforeAction) {
        const shouldProceed = await onBeforeAction(action);
        if (!shouldProceed) {
          return { success: false, error: 'Action cancelled by onBeforeAction' };
        }
      }

      let result: ActionExecutionResult;

      try {
        switch (action.type) {
          case 'navigate': {
            const { path } = action.payload as { path: string };
            router.push(path);
            result = { success: true };
            break;
          }

          case 'viewCase': {
            const { caseId, section } = action.payload as {
              caseId: string;
              section?: string;
            };
            const path =
              section === 'edit'
                ? `/cases/${caseId}/edit`
                : section === 'timeline'
                  ? `/cases/${caseId}/timeline`
                  : `/cases/${caseId}`;
            router.push(path);
            result = { success: true };
            break;
          }

          case 'scrollTo': {
            const { target, smooth = true } = action.payload as {
              target: string;
              smooth?: boolean;
            };
            const scrollBehavior = smooth ? 'smooth' : 'auto';

            // Handle special targets
            if (target === 'top') {
              window.scrollTo({ top: 0, behavior: scrollBehavior });
              result = { success: true };
              break;
            }

            if (target === 'bottom') {
              window.scrollTo({
                top: document.body.scrollHeight,
                behavior: scrollBehavior,
              });
              result = { success: true };
              break;
            }

            // Try to find element by data attribute first
            const elementByData = document.querySelector(
              `[data-scroll-target="${target}"]`
            );
            if (elementByData) {
              elementByData.scrollIntoView({ behavior: scrollBehavior });
              result = { success: true };
              break;
            }

            // Try by ID as fallback
            const elementById = document.getElementById(target);
            if (elementById) {
              elementById.scrollIntoView({ behavior: scrollBehavior });
              result = { success: true };
              break;
            }

            // Element not found
            result = {
              success: false,
              error: `Scroll target "${target}" not found on page`,
            };
            break;
          }

          case 'refreshPage': {
            router.refresh();
            result = { success: true };
            break;
          }

          default: {
            result = {
              success: false,
              error: `Unknown action type: ${(action as AnyClientAction).type}`,
            };
          }
        }
      } catch (error) {
        result = {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }

      // Call after action callback
      if (onAfterAction) {
        onAfterAction(action, result);
      }

      return result;
    },
    [router, onBeforeAction, onAfterAction]
  );

  /**
   * Execute multiple client actions in sequence
   */
  const executeActions = useCallback(
    async (actions: ClientAction[]): Promise<ActionExecutionResult[]> => {
      const results: ActionExecutionResult[] = [];

      for (const action of actions) {
        const result = await executeAction(action);
        results.push(result);

        // Stop on first failure
        if (!result.success) {
          break;
        }
      }

      return results;
    },
    [executeAction]
  );

  return {
    executeAction,
    executeActions,
  };
}
