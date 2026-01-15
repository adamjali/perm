/**
 * useChatWithPersistence Hook
 *
 * Combines AI SDK streaming with Convex persistence.
 *
 * Features:
 * - Real-time streaming via AI SDK
 * - Automatic message persistence to Convex
 * - Conversation creation/selection
 * - Status tracking (ready, submitted, streaming, error)
 *
 * @module hooks/useChatWithPersistence
 */

'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuthContext } from '@/lib/contexts/AuthContext';
import { type PageContext, serializePageContext } from '@/lib/ai/page-context';

interface UseChatWithPersistenceOptions {
  conversationId?: Id<'conversations'>;
  onConversationCreated?: (id: Id<'conversations'>) => void;
  actionMode?: 'off' | 'confirm' | 'auto';
  pageContext?: PageContext;
}

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

// Tool call display type (used for both streaming and persisted messages)
type ToolCallDisplay = {
  tool: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  executedAt?: number;
};

/**
 * Determine tool call status from AI SDK output
 * Centralizes status logic to avoid duplication
 */
function determineToolStatus(
  state: string | undefined,
  output: Record<string, unknown> | undefined
): 'pending' | 'success' | 'error' {
  // Explicit error state
  if (state === 'output-error') return 'error';

  // Check output content for success/error
  if (state === 'output-available' && output !== undefined) {
    // Error in output
    if (typeof output === 'object' && 'error' in output && output.error !== undefined) {
      return 'error';
    }
    // Explicit failure
    if (output.success === false) {
      return 'error';
    }
    // Permission request stays pending (UI shows confirmation dialog)
    if (output.requiresPermission === true) {
      return 'pending';
    }
    return 'success';
  }

  // All other states: input-streaming, input-available, approval-requested, etc.
  return 'pending';
}

// Optimistic message type for immediate display
interface OptimisticMessage {
  id: string;
  role: 'user';
  content: string;
  timestamp: number;
}

export function useChatWithPersistence(options: UseChatWithPersistenceOptions = {}) {

  const [conversationId, setConversationId] = useState<Id<'conversations'> | null>(
    options.conversationId ?? null
  );
  const [input, setInput] = useState('');
  // Optimistic user message - shows immediately before Convex confirms
  const [optimisticMessage, setOptimisticMessage] = useState<OptimisticMessage | null>(null);
  // Optimistic assistant content - keeps content visible until Convex confirms
  const [optimisticAssistantContent, setOptimisticAssistantContent] = useState<string | null>(null);

  // Get sign-out state to skip queries during sign-out
  const { isSigningOut } = useAuthContext();

  // Track streaming start time for processing duration
  const streamStartTime = useRef<number | null>(null);

  // Ref to track current conversationId for async callbacks (prevents stale closure)
  const conversationIdRef = useRef<Id<'conversations'> | null>(conversationId);

  // Convex mutations
  const createConversation = useMutation(api.conversations.create);
  const createUserMessage = useMutation(api.conversationMessages.createUserMessage);
  const createAssistantMessage = useMutation(api.conversationMessages.createAssistantMessage);

  // Keep conversationId ref synced with state for async callback access
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Convex queries - skip during sign-out to prevent "not authenticated" errors
  const conversation = useQuery(
    api.conversations.get,
    conversationId && !isSigningOut ? { id: conversationId } : 'skip'
  );
  const persistedMessages = useQuery(
    api.conversationMessages.list,
    conversationId && !isSigningOut ? { conversationId } : 'skip'
  );

  // AI SDK chat hook
  // We use setMessages to clear AI SDK state when conversation changes
  const {
    messages: streamingMessages,
    setMessages: setAIMessages,
    sendMessage,
    status: aiStatus,
    error,
    stop,
  } = useAIChat({
    // id intentionally omitted - changing it mid-request breaks status tracking
    // We manually clear messages instead when conversation changes
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onFinish: async ({ message }) => {
      // Use ref to get current conversationId (prevents stale closure)
      const currentConversationId = conversationIdRef.current;
      if (!currentConversationId) return;

      // Extract text content from message parts
      const content = message.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');

      // Extract tool calls from message parts
      // AI SDK v5 uses 'tool-{toolName}' or 'dynamic-tool' type for tool parts
      // with state: 'input-available' | 'output-available' | 'output-error' etc.
      // See: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-structure
      const toolCalls: Array<{
        tool: string;
        arguments: string;
        result?: string;
        status: 'pending' | 'success' | 'error';
        executedAt?: number;
      }> = [];

      for (const part of message.parts) {
        // Tool parts have type like 'tool-{name}' or 'dynamic-tool'
        const partType = part.type;
        if (partType.startsWith('tool-') || partType === 'dynamic-tool') {
          // Cast to access tool-specific properties
          const toolPart = part as {
            type: string;
            toolCallId: string;
            toolName?: string;
            input?: unknown;
            output?: unknown;
            state?: string;
            errorText?: string;
          };

          // Get tool name from toolName prop (dynamic-tool) or from type (tool-{name})
          const toolName = toolPart.toolName ?? partType.replace('tool-', '');
          const output = toolPart.output as Record<string, unknown> | undefined;
          const status = determineToolStatus(toolPart.state, output);

          toolCalls.push({
            tool: toolName,
            arguments: JSON.stringify(toolPart.input ?? {}),
            result: toolPart.output !== undefined ? JSON.stringify(toolPart.output) : undefined,
            status,
            executedAt: status !== 'pending' ? Date.now() : undefined,
          });
        }
      }

      // Keep assistant content visible while saving to Convex (prevents flash)
      // useEffect will clear when Convex query updates with the persisted message
      setOptimisticAssistantContent(content);

      // Persist assistant message to Convex
      await createAssistantMessage({
        conversationId: currentConversationId,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: {
          processingTimeMs: Date.now() - (streamStartTime.current ?? Date.now()),
        },
      });
    },
    onError: (err) => {
      // Log error with context for debugging
      console.error('[Chat] AI SDK error:', {
        message: err.message,
        name: err.name,
        conversationId: conversationIdRef.current,
      });
      // Clear optimistic states on error to prevent stale UI
      setOptimisticMessage(null);
      setOptimisticAssistantContent(null);
    },
  });

  // Clear AI SDK messages when conversation is deleted
  // This handles the edge case where user deletes the current conversation
  // from ChatHistory, then returns to ChatPanel and tries to send a message
  useEffect(() => {
    // conversation === undefined means loading/skipped (don't act yet)
    // conversation === null means the conversation doesn't exist (was deleted)
    if (conversationId && conversation === null) {
      setConversationId(null);
      conversationIdRef.current = null;
      // Clear any optimistic state that referenced the deleted conversation
      setOptimisticMessage(null);
      setOptimisticAssistantContent(null);
      // Clear AI SDK messages so stale context isn't sent to API
      setAIMessages([]);
    }
  }, [conversationId, conversation, setAIMessages]);

  // Clear AI SDK messages when conversation changes (switching conversations or starting fresh)
  // This prevents stale messages from being sent to the API
  const prevConversationIdRef = useRef<Id<'conversations'> | null>(null);
  useEffect(() => {
    // Skip on initial mount (prevConversationIdRef.current is null)
    if (prevConversationIdRef.current !== null && prevConversationIdRef.current !== conversationId) {
      // Conversation changed - clear AI SDK messages
      setAIMessages([]);
      setOptimisticMessage(null);
      setOptimisticAssistantContent(null);
    }
    prevConversationIdRef.current = conversationId;
  }, [conversationId, setAIMessages]);

  // Inject a system-like message when action mode changes mid-conversation
  // This tells the AI the mode changed so it doesn't follow old response patterns
  const prevActionModeRef = useRef<string | undefined>(options.actionMode);
  useEffect(() => {
    const currentMode = options.actionMode;
    const prevMode = prevActionModeRef.current;

    // Only inject if mode actually changed (not initial mount) and we have messages
    if (prevMode && currentMode && prevMode !== currentMode && streamingMessages.length > 0) {
      const modeLabels = { off: 'OFF', confirm: 'CONFIRM', auto: 'AUTO' };
      // Append a user message that informs the AI of the change
      setAIMessages(prev => [
        ...prev,
        {
          id: `mode-change-${Date.now()}`,
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: `[System: Action mode changed from ${modeLabels[prevMode as keyof typeof modeLabels]} to ${modeLabels[currentMode]}. Please respond according to the new mode.]` }],
          createdAt: new Date(),
        }
      ]);
    }
    prevActionModeRef.current = currentMode;
  }, [options.actionMode, setAIMessages, streamingMessages.length]);

  // Map AI SDK status to our status type
  // NOTE: AI SDK v5 can hit React's update limit during rapid streaming, triggering
  // "Maximum update depth exceeded" errors. These are React rendering errors, NOT
  // actual API failures - the request completes successfully. We ignore these errors.
  const status: ChatStatus = useMemo(() => {
    // Ignore React rendering errors - they don't indicate API failures
    const isRenderingError = error?.message?.includes('Maximum update depth');

    return (error && !isRenderingError) ? 'error'
      : aiStatus === 'streaming' ? 'streaming'
      : aiStatus === 'submitted' ? 'submitted'
      : 'ready';
  }, [aiStatus, error]);

  // Clear optimistic user message when Convex confirms it's persisted
  useEffect(() => {
    if (!persistedMessages || !optimisticMessage) return;

    const userPersisted = persistedMessages.some(
      (m) => m.role === 'user' && m.content === optimisticMessage.content
    );
    if (userPersisted) {
      setOptimisticMessage(null);
    }
  }, [persistedMessages, optimisticMessage]);

  // Clear optimistic assistant content AFTER a delay to allow typewriter to finish
  // This prevents key change from 'streaming-assistant' to Convex ID mid-typewriter
  useEffect(() => {
    if (!persistedMessages || !optimisticAssistantContent) return;

    const assistantPersisted = persistedMessages.some(
      (m) => m.role === 'assistant' && m.content === optimisticAssistantContent
    );
    if (assistantPersisted) {
      // Calculate delay based on content length: 3 chars per 15ms tick
      // Add buffer for safety
      const typewriterDuration = Math.ceil(optimisticAssistantContent.length / 3) * 15;
      const delay = Math.min(typewriterDuration + 500, 10000); // Max 10 seconds

      const timer = setTimeout(() => {
        setOptimisticAssistantContent(null);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [persistedMessages, optimisticAssistantContent]);

  // Get current streaming content (extracted to separate memo for syncing)
  const extractedStreamingContent = useMemo(() => {
    const lastMessage = streamingMessages[streamingMessages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return null;

    // AI SDK v5 uses parts array
    return lastMessage.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') ?? null;
  }, [streamingMessages]);

  // Extract tool calls from streaming messages in REAL-TIME (not just onFinish)
  // This allows the UI to show tool call cards with loading state during execution
  const extractedStreamingToolCalls = useMemo((): ToolCallDisplay[] => {
    const lastMessage = streamingMessages[streamingMessages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return [];

    const toolCalls: ToolCallDisplay[] = [];

    for (const part of lastMessage.parts ?? []) {
      const partType = part.type;
      if (partType.startsWith('tool-') || partType === 'dynamic-tool') {
        const toolPart = part as {
          type: string;
          toolCallId: string;
          toolName?: string;
          input?: unknown;
          output?: unknown;
          state?: string;
          errorText?: string;
        };

        const toolName = toolPart.toolName ?? partType.replace('tool-', '');
        const output = toolPart.output as Record<string, unknown> | undefined;
        const status = determineToolStatus(toolPart.state, output);

        toolCalls.push({
          tool: toolName,
          arguments: JSON.stringify(toolPart.input ?? {}),
          result: toolPart.output !== undefined ? JSON.stringify(toolPart.output) : undefined,
          status,
          // executedAt is set in onFinish when persisting, not needed during streaming display
        });
      }
    }

    return toolCalls;
  }, [streamingMessages]);

  // NOTE: We intentionally do NOT sync streaming content to optimistic state continuously.
  // The onFinish callback sets optimisticAssistantContent when streaming completes.
  // Continuous syncing causes "Maximum update depth exceeded" errors because each
  // streaming chunk triggers a state update, which triggers re-renders, etc.
  // Any flash between streaming end and onFinish is minimal and acceptable.

  // Current streaming content - only non-null while actively streaming
  const currentStreamingContent = status === 'streaming' ? extractedStreamingContent : null;

  // Convert persisted messages to display format, including optimistic and streaming
  const displayMessages = useMemo(() => {
    const messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp?: number;
      isStreaming?: boolean;
      toolCalls?: ToolCallDisplay[];
    }> = [];

    // Track tool calls from the persisted message we're skipping
    // This ensures tool calls don't flash/disappear during streaming → persisted transition
    let skippedPersistedToolCalls: ToolCallDisplay[] | undefined;

    // Add persisted messages
    // Skip persisted assistant that matches optimistic to keep 'streaming-assistant' key stable
    if (persistedMessages) {
      for (const m of persistedMessages) {
        if (
          optimisticAssistantContent &&
          m.role === 'assistant' &&
          m.content === optimisticAssistantContent
        ) {
          // Save tool calls from skipped message for use in streaming-assistant
          skippedPersistedToolCalls = m.toolCalls as ToolCallDisplay[] | undefined;
          continue; // Skip - will be added as streaming-assistant below
        }
        messages.push({
          id: m._id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.createdAt,
          // Include tool calls if present (cast to display type)
          toolCalls: m.toolCalls as ToolCallDisplay[] | undefined,
        });
      }
    }

    // Add optimistic user message if not yet in persisted (prevents duplicate)
    if (optimisticMessage) {
      const alreadyPersisted = messages.some(
        (m) => m.role === 'user' && m.content === optimisticMessage.content
      );
      if (!alreadyPersisted) {
        messages.push(optimisticMessage);
      }
    }

    // Add streaming OR optimistic assistant content (stable ID for smooth transition)
    // Note: persisted version with matching content is skipped above, so no duplicate check needed
    //
    // CRITICAL: Only show streaming-assistant when:
    // 1. Actively streaming (status === 'streaming') - shows real-time content + tool calls
    // 2. OR we have optimistic content (onFinish ran, waiting for Convex to confirm)
    //
    // After Convex confirms and typewriter catches up, optimisticAssistantContent clears
    // and we stop showing streaming-assistant, only showing the persisted message.
    // This prevents duplicate tool call cards.
    const assistantContent = currentStreamingContent ?? optimisticAssistantContent;
    const hasStreamingToolCalls = status === 'streaming' && extractedStreamingToolCalls.length > 0;

    // Use streaming tool calls during streaming, then fall back to persisted tool calls
    // This prevents tool cards from flashing/disappearing during the transition
    const toolCallsToShow = hasStreamingToolCalls
      ? extractedStreamingToolCalls
      : skippedPersistedToolCalls;

    // Only show streaming-assistant if actively streaming OR waiting for Convex to confirm
    const shouldShowStreamingAssistant =
      status === 'streaming' || optimisticAssistantContent !== null;

    if ((assistantContent || hasStreamingToolCalls || toolCallsToShow) && shouldShowStreamingAssistant) {
      messages.push({
        id: 'streaming-assistant', // Stable ID so component isn't replaced
        role: 'assistant',
        content: assistantContent ?? '', // Empty string if only tool calls
        isStreaming: status === 'streaming',
        // Use streaming tool calls during streaming, persisted afterwards
        toolCalls: toolCallsToShow,
      });
    }

    return messages;
  }, [persistedMessages, optimisticMessage, optimisticAssistantContent, currentStreamingContent, status, extractedStreamingToolCalls]);

  // Keep streamingContent for backwards compatibility
  const streamingContent = currentStreamingContent ?? undefined;

  // Create new conversation
  const startNewConversation = useCallback(async () => {
    const id = await createConversation({});
    setConversationId(id);
    options.onConversationCreated?.(id);
    return id;
  }, [createConversation, options]);

  // Select existing conversation
  const selectConversation = useCallback((id: Id<'conversations'>) => {
    setConversationId(id);
  }, []);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const messageContent = input.trim();

    // Use flushSync to force React to render the optimistic message IMMEDIATELY
    // before sendMessage triggers the typing indicator
    flushSync(() => {
      setOptimisticMessage({
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      });
      setInput('');
    });

    // Create conversation if needed (must happen before sendMessage)
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      activeConversationId = await startNewConversation();
    }

    // Track timing
    streamStartTime.current = Date.now();

    // Start AI request with conversationId and pageContext in body
    // This enables caching, context optimization, and page awareness on the API side
    sendMessage(
      { text: messageContent },
      {
        body: {
          conversationId: activeConversationId,
          pageContext: options.pageContext
            ? serializePageContext(options.pageContext)
            : undefined,
        },
      }
    );

    // Save user message to Convex (fire and forget - don't await)
    // This runs in parallel with the AI request
    createUserMessage({
      conversationId: activeConversationId,
      content: messageContent,
    });
  }, [input, conversationId, startNewConversation, createUserMessage, sendMessage, options.pageContext]);

  return {
    // State
    conversationId,
    conversation,
    messages: displayMessages,
    input,
    status,
    error,
    streamingContent,

    // Actions
    setInput,
    handleSend,
    startNewConversation,
    selectConversation,
    stop,

    // For tool orchestration - allows sending continuation messages
    sendMessage,
  };
}
