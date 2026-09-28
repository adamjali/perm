// @vitest-environment jsdom
/**
 * useChatWithPersistence Hook Tests
 *
 * Tests for the chat persistence hook that combines AI SDK with Convex.
 *
 * Key behaviors:
 * - Initializes with empty state
 * - Updates input value
 * - Exposes required actions
 * - Handles status mapping from AI SDK
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// File-default mock implementations. Kept as named factories so beforeEach can
// restore them: vi.clearAllMocks() only clears call history, NOT the
// mockImplementation/mockReturnValue overrides individual tests install. Without
// re-applying these, a test that overrides useQuery/useMutation/useChat (e.g.
// the conversation-deleted test forces useQuery -> null) leaks that stub into
// whatever test runs next, which is order-dependent under sequence.shuffle (CI).
const defaultUseChat = () => ({
  messages: [],
  setMessages: vi.fn(),
  sendMessage: vi.fn(),
  status: 'ready',
  error: null,
  stop: vi.fn(),
});

const defaultUseMutation = () => vi.fn().mockResolvedValue('mock-id');

// useQuery returns different values based on what's being queried.
const defaultUseQuery = (queryType: unknown, args: { id?: unknown; conversationId?: unknown } | 'skip') => {
  // If args is 'skip', return undefined (loading/skipped state)
  if (args === 'skip') return undefined;
  // For conversation.get with an ID, return a mock conversation object
  // This prevents the "clear stale conversationId" effect from triggering
  if (queryType === 'get' && args?.id) {
    return { _id: args.id, userId: 'mock-user-id', createdAt: Date.now() };
  }
  // For conversationMessages.list, return empty array
  if (args?.conversationId) {
    return [];
  }
  // Default: return null
  return null;
};

// Mock AI SDK
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => defaultUseChat()),
}));

// Mock Convex React
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => defaultUseMutation()),
  useQuery: vi.fn((queryType, args) => defaultUseQuery(queryType, args)),
}));

// Mock AuthContext
vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuthContext: vi.fn(() => ({
    isSigningOut: false,
    userId: 'mock-user-id',
    isLoading: false,
    isAuthenticated: true,
  })),
}));

// Mock the API import
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    conversations: {
      create: 'create',
      get: 'get',
    },
    conversationMessages: {
      createUserMessage: 'createUserMessage',
      createAssistantMessage: 'createAssistantMessage',
      list: 'list',
      getMostRecent: 'getMostRecent',
    },
  },
}));

describe('useChatWithPersistence', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore file-default implementations. clearAllMocks() only resets call
    // history, so any per-test mockReturnValue/mockImplementation override would
    // otherwise persist into the next test (order-dependent under shuffle).
    const { useChat } = await import('@ai-sdk/react');
    const { useMutation, useQuery } = await import('convex/react');
    vi.mocked(useChat).mockImplementation(() => defaultUseChat() as never);
    vi.mocked(useMutation).mockImplementation(() => defaultUseMutation() as never);
    vi.mocked(useQuery).mockImplementation(
      (queryType: unknown, args: unknown) =>
        defaultUseQuery(queryType, args as Parameters<typeof defaultUseQuery>[1]) as never,
    );
  });

  it('initializes with empty state', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    expect(result.current.conversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.status).toBe('ready');
  });

  it('updates input value', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    act(() => {
      result.current.setInput('Hello');
    });

    expect(result.current.input).toBe('Hello');
  });

  it('exposes required actions', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    expect(typeof result.current.handleSend).toBe('function');
    expect(typeof result.current.startNewConversation).toBe('function');
    expect(typeof result.current.selectConversation).toBe('function');
    expect(typeof result.current.stop).toBe('function');
  });

  it('accepts initial conversation ID in options', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const mockConversationId = 'test-conversation-id' as never;

    const { result } = renderHook(() =>
      useChatWithPersistence({ conversationId: mockConversationId })
    );

    expect(result.current.conversationId).toBe(mockConversationId);
  });

  it('clears input after setInput', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    act(() => {
      result.current.setInput('Test message');
    });

    expect(result.current.input).toBe('Test message');

    act(() => {
      result.current.setInput('');
    });

    expect(result.current.input).toBe('');
  });

  it('does not have error initially', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    expect(result.current.error).toBeNull();
  });

  it('does not have streaming content when ready', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    expect(result.current.streamingContent).toBeUndefined();
  });

  it('exposes conversation query result', async () => {
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    const { result } = renderHook(() => useChatWithPersistence());

    // With no conversationId, query is skipped and returns undefined
    expect(result.current.conversation).toBeUndefined();
  });

  // C2: client must NOT persist a turn that finished with isAbort/isDisconnect/isError.
  // AI SDK v6 fires onFinish for those too; persisting would write a truncated/error
  // turn as a clean assistant message and poison downstream summarization context.
  describe('onFinish persistence guard (C2)', () => {
    afterEach(async () => {
      // Restore the file-level default mocks (mockImplementation persists past
      // vi.clearAllMocks, which only clears call history).
      const { useChat } = await import('@ai-sdk/react');
      const { useMutation } = await import('convex/react');
      vi.mocked(useChat).mockImplementation(
        () =>
          ({
            messages: [],
            setMessages: vi.fn(),
            sendMessage: vi.fn(),
            status: 'ready',
            error: null,
            stop: vi.fn(),
          }) as any,
      );
      vi.mocked(useMutation).mockImplementation(() => vi.fn().mockResolvedValue('mock-id') as any);
    });

    const setupCaptureOnFinish = async () => {
      const { useChat } = await import('@ai-sdk/react');
      const { useMutation } = await import('convex/react');

      // Distinct mock for createAssistantMessage so we can assert on it precisely.
      const createAssistantMessage = vi.fn().mockResolvedValue('assistant-id');
      vi.mocked(useMutation).mockImplementation((ref: unknown) =>
        (ref === 'createAssistantMessage'
          ? createAssistantMessage
          : vi.fn().mockResolvedValue('mock-id')) as any,
      );

      let capturedOnFinish:
        | ((arg: {
            message: { parts: Array<{ type: string; text?: string }> };
            isAbort?: boolean;
            isDisconnect?: boolean;
            isError?: boolean;
          }) => Promise<void> | void)
        | undefined;
      vi.mocked(useChat).mockImplementation((opts: unknown) => {
        capturedOnFinish = (opts as { onFinish?: typeof capturedOnFinish }).onFinish;
        return {
          messages: [],
          setMessages: vi.fn(),
          sendMessage: vi.fn(),
          status: 'ready',
          error: null,
          stop: vi.fn(),
        } as any;
      });

      const { useChatWithPersistence } = await import('../useChatWithPersistence');
      const mockConversationId = 'conv-c2' as never;
      renderHook(() => useChatWithPersistence({ conversationId: mockConversationId }));

      return { createAssistantMessage, getOnFinish: () => capturedOnFinish };
    };

    const goodMessage = { parts: [{ type: 'text', text: 'real answer' }] };

    it.each([
      ['isAbort', { isAbort: true }],
      ['isDisconnect', { isDisconnect: true }],
      ['isError', { isError: true }],
    ])('does NOT persist when %s is true', async (_label, flags) => {
      const { createAssistantMessage, getOnFinish } = await setupCaptureOnFinish();
      const onFinish = getOnFinish();
      expect(onFinish).toBeTypeOf('function');
      await act(async () => {
        await onFinish!({ message: goodMessage, ...(flags as object) });
      });
      expect(createAssistantMessage).not.toHaveBeenCalled();
    });

    it('DOES persist a clean, successful turn', async () => {
      const { createAssistantMessage, getOnFinish } = await setupCaptureOnFinish();
      const onFinish = getOnFinish();
      await act(async () => {
        await onFinish!({
          message: goodMessage,
          isAbort: false,
          isDisconnect: false,
          isError: false,
        });
      });
      expect(createAssistantMessage).toHaveBeenCalledTimes(1);
      expect(createAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'real answer' }),
      );
    });
  });

  describe('one list, stable ids (2026-09-28: no vanish, no duplicate)', () => {
    type SdkMsg = { id: string; role: 'user' | 'assistant'; parts: Array<{ type: string; text?: string }> };
    const conv = 'conv-live' as never;
    let sdk: { messages: SdkMsg[]; status: string };
    let persisted: Array<{ _id: string; role: string; content: string; createdAt: number }>;
    let sendMessage: ReturnType<typeof vi.fn>;
    let stop: ReturnType<typeof vi.fn>;

    const setup = async () => {
      const { useChat } = await import('@ai-sdk/react');
      const { useQuery } = await import('convex/react');
      sdk = { messages: [], status: 'ready' };
      persisted = [];
      sendMessage = vi.fn();
      stop = vi.fn();
      vi.mocked(useChat).mockImplementation(
        () =>
          ({
            messages: sdk.messages,
            setMessages: vi.fn(),
            sendMessage,
            regenerate: vi.fn(),
            clearError: vi.fn(),
            status: sdk.status,
            error: null,
            stop,
          }) as never,
      );
      vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
        if (args === 'skip') return undefined;
        if (ref === 'get') return { _id: conv, userId: 'u', createdAt: 1 };
        if (ref === 'list') return persisted;
        return null;
      }) as never);
      const { useChatWithPersistence } = await import('../useChatWithPersistence');
      return renderHook(() => useChatWithPersistence({ conversationId: conv }));
    };

    const text = (t: string) => [{ type: 'text', text: t }];
    const ids = (r: { current: { messages: Array<{ id: string }> } }) => r.current.messages.map((m) => m.id);

    it('keeps a streamed reply on screen under one id, streaming through saved, never twice', async () => {
      const { result, rerender } = await setup();
      persisted = [{ _id: 'old-1', role: 'user', content: 'earlier', createdAt: 1 }];
      rerender();
      act(() => result.current.setInput('hi'));
      await act(async () => {
        await result.current.handleSend();
      });
      expect(sendMessage).toHaveBeenCalledTimes(1);

      sdk.messages = [
        { id: 'u1', role: 'user', parts: text('hi') },
        { id: 'a1', role: 'assistant', parts: text('Hello th') },
      ];
      sdk.status = 'streaming';
      rerender();
      expect(ids(result)).toEqual(['old-1', 'u1', 'a1']);
      expect(result.current.messages[2]).toMatchObject({ isStreaming: true, isLive: true });

      // The stream ends: the reply must not vanish in the gap before it is saved.
      sdk.messages = [sdk.messages[0]!, { id: 'a1', role: 'assistant', parts: text('Hello there') }];
      sdk.status = 'ready';
      rerender();
      expect(ids(result)).toEqual(['old-1', 'u1', 'a1']);
      expect(result.current.messages[2]).toMatchObject({ content: 'Hello there', isStreaming: false });

      // Saved copies arrive (the saved text even differs): still once each, same ids.
      persisted = [
        ...persisted,
        { _id: 'p-u1', role: 'user', content: 'hi', createdAt: 2 },
        { _id: 'p-a1', role: 'assistant', content: 'Hello there ', createdAt: 3 },
      ];
      rerender();
      expect(ids(result)).toEqual(['old-1', 'u1', 'a1']);
    });

    it('never shows the internal mode-change or continuation messages', async () => {
      const { result, rerender } = await setup();
      act(() => result.current.setInput('go'));
      await act(async () => {
        await result.current.handleSend();
      });
      sdk.messages = [
        { id: 'u1', role: 'user', parts: text('go') },
        { id: 'm1', role: 'user', parts: text('[System: Action mode changed from OFF to AUTO. Please respond according to the new mode.]') },
        { id: 'c1', role: 'user', parts: text('[Tool execution completed for call_1]') },
        { id: 'd1', role: 'user', parts: text('[User denied tool execution: call_2]') },
        { id: 'a1', role: 'assistant', parts: text('Done.') },
      ];
      rerender();
      expect(ids(result)).toEqual(['u1', 'a1']);
    });

    it('separates the text of a reply that ran in steps', async () => {
      const { result, rerender } = await setup();
      act(() => result.current.setInput('check'));
      await act(async () => {
        await result.current.handleSend();
      });
      sdk.messages = [
        { id: 'u1', role: 'user', parts: text('check') },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Let me check.' }, { type: 'step-start' }, { type: 'text', text: 'Here is what I found.' }] },
      ];
      rerender();
      expect(result.current.messages.at(-1)?.content).toBe('Let me check.\n\nHere is what I found.');
    });

    it('does not start a second turn while a reply is in progress', async () => {
      const { result, rerender } = await setup();
      sdk.status = 'streaming';
      rerender();
      act(() => result.current.setInput('another'));
      await act(async () => {
        await result.current.handleSend();
      });
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('stop keeps the partial reply on screen and marks it stopped', async () => {
      const { result, rerender } = await setup();
      act(() => result.current.setInput('hi'));
      await act(async () => {
        await result.current.handleSend();
      });
      sdk.messages = [
        { id: 'u1', role: 'user', parts: text('hi') },
        { id: 'a1', role: 'assistant', parts: text('Half an ans') },
      ];
      sdk.status = 'streaming';
      rerender();
      act(() => result.current.stop());
      expect(stop).toHaveBeenCalledTimes(1);
      sdk.status = 'ready';
      rerender();
      expect(result.current.messages.at(-1)).toMatchObject({ id: 'a1', content: 'Half an ans', wasStopped: true });
    });
  });

  it('clears conversationId when conversation is deleted (query returns null)', async () => {
    // This test verifies the edge case where:
    // 1. User has an active conversation (conversationId is set)
    // 2. User deletes the conversation from ChatHistory
    // 3. The conversation query returns null (deleted)
    // 4. The hook should clear the stale conversationId

    const { useQuery } = await import('convex/react');
    const { useChatWithPersistence } = await import('../useChatWithPersistence');

    // Start with a valid conversation
    const mockConversationId = 'test-conversation-id' as never;

    const { result, rerender } = renderHook(() =>
      useChatWithPersistence({ conversationId: mockConversationId })
    );

    // Initially, conversationId should be set
    expect(result.current.conversationId).toBe(mockConversationId);

    // Now simulate the conversation being deleted by making useQuery return null
    vi.mocked(useQuery).mockReturnValue(null);

    // Rerender to trigger the useEffect
    rerender();

    // After rerender with conversation=null, conversationId should be cleared
    expect(result.current.conversationId).toBeNull();
  });
});
