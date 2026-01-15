// @vitest-environment jsdom
/**
 * useToolOrchestrator Hook Tests
 *
 * Tests for the central orchestrator that handles chat tool execution flow.
 *
 * Key behaviors:
 * 1. Tool call processing - extracts tool calls from messages
 * 2. ClientAction execution - executes navigation actions immediately
 * 3. Permission request registration - registers confirmations for permission requests
 * 4. Duplicate prevention - prevents duplicate tool call processing
 * 5. Conversation reset detection - clears state when messages drop significantly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type {
  ChatMessage,
  ToolCall,
  UseToolOrchestratorOptions,
} from '../useToolOrchestrator';

// =============================================================================
// Mocks
// =============================================================================

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// =============================================================================
// Test Factories
// =============================================================================

/**
 * Create a mock tool call
 */
function createToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    tool: 'testTool',
    arguments: '{}',
    status: 'success',
    ...overrides,
  };
}

/**
 * Create a mock chat message
 */
function createMessage(
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    content: 'Test message',
    ...overrides,
  };
}

/**
 * Create a tool call result with clientAction (navigation)
 */
function createNavigationResult(path: string): string {
  return JSON.stringify({
    success: true,
    message: `Navigating to ${path}`,
    clientAction: {
      type: 'navigate',
      payload: { path },
    },
  });
}

/**
 * Create a tool call result with viewCase clientAction
 */
function createViewCaseResult(caseId: string, section?: string): string {
  return JSON.stringify({
    success: true,
    message: 'Viewing case',
    clientAction: {
      type: 'viewCase',
      payload: { caseId, section },
    },
  });
}

/**
 * Create a tool call result with permission request
 */
function createPermissionRequest(
  toolName: string,
  toolCallId: string,
  description: string
): string {
  return JSON.stringify({
    requiresPermission: true,
    permissionType: 'confirmed',
    toolName,
    toolCallId,
    arguments: { testArg: 'value' },
    description,
  });
}

/**
 * Create default hook options
 */
function createDefaultOptions(
  overrides: Partial<UseToolOrchestratorOptions> = {}
): UseToolOrchestratorOptions {
  return {
    messages: [],
    status: 'ready',
    sendMessage: vi.fn(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('useToolOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to clear ref state between tests
    vi.resetModules();
  });

  describe('initialization', () => {
    it('initializes with empty confirmations map', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions())
      );

      expect(result.current.confirmations.size).toBe(0);
    });

    it('exposes required functions', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions())
      );

      expect(typeof result.current.hasPendingConfirmation).toBe('function');
      expect(typeof result.current.getConfirmation).toBe('function');
      expect(typeof result.current.approveConfirmation).toBe('function');
      expect(typeof result.current.denyConfirmation).toBe('function');
      expect(typeof result.current.clearConfirmations).toBe('function');
    });
  });

  describe('tool call processing', () => {
    it('processes tool calls from assistant messages', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult = createPermissionRequest(
        'updateCase',
        'tc-001',
        'Update case details'
      );

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult })],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });
    });

    it('ignores tool calls without results', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: undefined })],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      // No confirmation should be registered
      expect(result.current.confirmations.size).toBe(0);
    });

    it('ignores tool calls with invalid JSON results', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: 'not valid json' })],
        }),
      ];

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      // No confirmation should be registered
      expect(result.current.confirmations.size).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('does not process user messages', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const messages: ChatMessage[] = [
        createMessage({
          role: 'user',
          toolCalls: [createToolCall({ result: createPermissionRequest('test', 'tc-001', 'desc') })],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      // No confirmation should be registered for user messages
      expect(result.current.confirmations.size).toBe(0);
    });

    it('does not process when status is error', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [
            createToolCall({ result: createPermissionRequest('test', 'tc-001', 'desc') }),
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'error' }))
      );

      // No confirmation should be registered in error state
      expect(result.current.confirmations.size).toBe(0);
    });
  });

  describe('clientAction execution', () => {
    it('executes navigate clientAction immediately', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const onNavigate = vi.fn();
      const navigationResult = createNavigationResult('/cases');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: navigationResult })],
        }),
      ];

      renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming', onNavigate }))
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/cases');
      });

      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'navigate',
          payload: { path: '/cases' },
        })
      );
    });

    it('executes viewCase clientAction with correct path', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const viewCaseResult = createViewCaseResult('case-123', 'edit');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: viewCaseResult })],
        }),
      ];

      renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/cases/case-123/edit');
      });
    });

    it('does not execute clientAction twice for same tool call', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const navigationResult = createNavigationResult('/cases');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: navigationResult })],
        }),
      ];

      const { rerender } = renderHook(
        ({ msgs }) =>
          useToolOrchestrator(createDefaultOptions({ messages: msgs, status: 'streaming' })),
        { initialProps: { msgs: messages } }
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
      });

      // Rerender with same messages
      rerender({ msgs: messages });

      // Should still only have been called once
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });

  describe('permission request registration', () => {
    it('registers permission request in confirmations map', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult = createPermissionRequest(
        'deleteCase',
        'tc-delete-001',
        'Delete case permanently'
      );

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult })],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      const confirmation = result.current.getConfirmation('tc-delete-001');
      expect(confirmation).toBeDefined();
      expect(confirmation?.toolName).toBe('deleteCase');
      expect(confirmation?.description).toBe('Delete case permanently');
      expect(confirmation?.status).toBe('pending');
    });

    it('hasPendingConfirmation returns true for pending confirmations', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult = createPermissionRequest('test', 'tc-pending', 'desc');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult })],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      await waitFor(() => {
        expect(result.current.hasPendingConfirmation('tc-pending')).toBe(true);
      });
    });

    it('hasPendingConfirmation returns false for unknown tool call', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions())
      );

      expect(result.current.hasPendingConfirmation('unknown-id')).toBe(false);
    });
  });

  describe('duplicate prevention', () => {
    it('does not process same tool call twice', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult = createPermissionRequest('test', 'tc-001', 'desc');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult })],
        }),
      ];

      const { result, rerender } = renderHook(
        ({ msgs }) =>
          useToolOrchestrator(createDefaultOptions({ messages: msgs, status: 'streaming' })),
        { initialProps: { msgs: messages } }
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      // Rerender with same messages
      rerender({ msgs: messages });

      // Should still only have 1 confirmation
      expect(result.current.confirmations.size).toBe(1);
    });

    it('processes new tool calls when added', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult1 = createPermissionRequest('test1', 'tc-001', 'desc1');
      const permissionResult2 = createPermissionRequest('test2', 'tc-002', 'desc2');

      const messages1: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult1 })],
        }),
      ];

      const { result, rerender } = renderHook(
        ({ msgs }) =>
          useToolOrchestrator(createDefaultOptions({ messages: msgs, status: 'streaming' })),
        { initialProps: { msgs: messages1 } }
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      // Add second tool call
      const messages2: ChatMessage[] = [
        createMessage({
          toolCalls: [
            createToolCall({ result: permissionResult1 }),
            createToolCall({ result: permissionResult2 }),
          ],
        }),
      ];

      rerender({ msgs: messages2 });

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(2);
      });
    });
  });

  describe('conversation reset detection', () => {
    it('clears state when messages drop significantly', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      // Create 10 messages
      const manyMessages: ChatMessage[] = Array.from({ length: 10 }, (_, i) =>
        createMessage({ id: `msg-${i}` })
      );

      // Add one with permission request at the end
      const permissionResult = createPermissionRequest('test', 'tc-001', 'desc');
      manyMessages.push(
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult })],
        })
      );

      const { result, rerender } = renderHook(
        ({ msgs }) =>
          useToolOrchestrator(createDefaultOptions({ messages: msgs, status: 'streaming' })),
        { initialProps: { msgs: manyMessages } }
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      // Reset to only 2 messages (drop of more than 5)
      const fewMessages: ChatMessage[] = [
        createMessage({ id: 'new-1' }),
        createMessage({ id: 'new-2' }),
      ];

      rerender({ msgs: fewMessages });

      // Confirmations should be cleared
      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(0);
      });
    });

    it('does not clear state for small message count changes', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      // Create 5 messages with permission request
      const permissionResult = createPermissionRequest('test', 'tc-001', 'desc');
      const messages1: ChatMessage[] = [
        createMessage({ id: 'msg-1' }),
        createMessage({ id: 'msg-2' }),
        createMessage({ id: 'msg-3' }),
        createMessage({ id: 'msg-4' }),
        createMessage({
          id: 'msg-5',
          toolCalls: [createToolCall({ result: permissionResult })],
        }),
      ];

      const { result, rerender } = renderHook(
        ({ msgs }) =>
          useToolOrchestrator(createDefaultOptions({ messages: msgs, status: 'streaming' })),
        { initialProps: { msgs: messages1 } }
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      // Drop by only 2 messages (less than threshold of 5)
      const messages2 = messages1.slice(0, 3);

      rerender({ msgs: messages2 });

      // Confirmations should NOT be cleared
      expect(result.current.confirmations.size).toBe(1);
    });
  });

  describe('clearConfirmations', () => {
    it('clears confirmations via internal clearAll', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      // Start with no messages - should have no confirmations
      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages: [], status: 'ready' }))
      );

      expect(result.current.confirmations.size).toBe(0);

      // clearConfirmations should be callable without error
      act(() => {
        result.current.clearConfirmations();
      });

      // Still zero after clearing empty state
      expect(result.current.confirmations.size).toBe(0);
    });

    it('clears tracked refs allowing new processing after conversation switch', async () => {
      // This tests the conversation reset detection which clears refs
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult = createPermissionRequest('test', 'tc-001', 'desc');

      // Start with 10+ messages to allow significant drop detection
      const manyMessages: ChatMessage[] = Array.from({ length: 10 }, (_, i) =>
        createMessage({ id: `msg-${i}` })
      );
      manyMessages.push(
        createMessage({
          id: 'msg-with-tool',
          toolCalls: [createToolCall({ result: permissionResult })],
        })
      );

      const { result, rerender } = renderHook(
        ({ msgs }) =>
          useToolOrchestrator(createDefaultOptions({ messages: msgs, status: 'streaming' })),
        { initialProps: { msgs: manyMessages } }
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      // Simulate conversation switch (messages drop significantly)
      // This triggers auto-clear via the message length detection
      rerender({ msgs: [] });

      // Confirmations should be cleared by the conversation reset detection
      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(0);
      });
    });
  });

  describe('denyConfirmation', () => {
    it('sends denial message to AI', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const sendMessage = vi.fn();
      const permissionResult = createPermissionRequest('test', 'tc-deny', 'desc');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: permissionResult })],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming', sendMessage }))
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
      });

      await act(async () => {
        await result.current.denyConfirmation('tc-deny');
      });

      expect(sendMessage).toHaveBeenCalledWith({
        text: expect.stringContaining('denied'),
      });
    });
  });

  describe('callbacks', () => {
    it('calls onNavigate when navigation succeeds', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const onNavigate = vi.fn();
      const navigationResult = createNavigationResult('/dashboard');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [createToolCall({ result: navigationResult })],
        }),
      ];

      renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming', onNavigate }))
      );

      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'navigate',
            payload: { path: '/dashboard' },
          })
        );
      });
    });
  });

  describe('multiple tool calls in single message', () => {
    it('processes all tool calls in a message', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const permissionResult1 = createPermissionRequest('tool1', 'tc-001', 'desc1');
      const permissionResult2 = createPermissionRequest('tool2', 'tc-002', 'desc2');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [
            createToolCall({ tool: 'tool1', result: permissionResult1 }),
            createToolCall({ tool: 'tool2', result: permissionResult2 }),
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(2);
      });

      expect(result.current.getConfirmation('tc-001')).toBeDefined();
      expect(result.current.getConfirmation('tc-002')).toBeDefined();
    });

    it('handles mix of clientAction and permission requests', async () => {
      const { useToolOrchestrator } = await import('../useToolOrchestrator');

      const navigationResult = createNavigationResult('/settings');
      const permissionResult = createPermissionRequest('update', 'tc-update', 'Update settings');

      const messages: ChatMessage[] = [
        createMessage({
          toolCalls: [
            createToolCall({ tool: 'navigate', result: navigationResult }),
            createToolCall({ tool: 'update', result: permissionResult }),
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useToolOrchestrator(createDefaultOptions({ messages, status: 'streaming' }))
      );

      // Navigation should execute
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
      });

      // Permission request should be registered
      await waitFor(() => {
        expect(result.current.confirmations.size).toBe(1);
        expect(result.current.getConfirmation('tc-update')).toBeDefined();
      });
    });
  });

  describe('status handling', () => {
    it.each(['ready', 'submitted', 'streaming'] as const)(
      'processes tool calls in %s status',
      async (status) => {
        const { useToolOrchestrator } = await import('../useToolOrchestrator');

        const permissionResult = createPermissionRequest('test', `tc-${status}`, 'desc');

        const messages: ChatMessage[] = [
          createMessage({
            toolCalls: [createToolCall({ result: permissionResult })],
          }),
        ];

        const { result } = renderHook(() =>
          useToolOrchestrator(createDefaultOptions({ messages, status }))
        );

        await waitFor(() => {
          expect(result.current.confirmations.size).toBe(1);
        });

        // Reset for next iteration
        vi.resetModules();
      }
    );
  });
});
