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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock AI SDK
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    setMessages: vi.fn(),
    sendMessage: vi.fn(),
    status: 'ready',
    error: null,
    stop: vi.fn(),
  })),
}));

// Mock Convex React - useQuery returns different values based on what's being queried
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn().mockResolvedValue('mock-id')),
  useQuery: vi.fn((queryType, args) => {
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
  }),
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
  beforeEach(() => {
    vi.clearAllMocks();
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
