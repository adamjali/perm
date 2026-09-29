"use client";

// DECLARED, not inherited (2026-09-01). This module uses useState, so it is a
// client module in every sense except the annotation. It worked without one
// only because every path that reached it happened to cross somebody else's
// `"use client"` boundary first, which made it a latent trap: move a boundary
// anywhere above it and this lands on the server, where the API does not exist.
// See lib/ai/page-context.tsx for the failure this actually caused.

/**
 * useChatWithPersistence Hook
 *
 * AI SDK streaming plus Convex persistence, displayed as ONE list with stable
 * identities.
 *
 * WHERE EACH MESSAGE COMES FROM (rebuilt 2026-09-28). A message sent or
 * received in this session is shown from the AI SDK, from its first streamed
 * word to the end, keyed by the SDK's own id; the saved copy in Convex is never
 * swapped in for it. Everything older comes from Convex. The earlier design
 * showed a streaming message, hid it when the stream ended, re-showed it from
 * an "optimistic" copy once onFinish ran, then swapped in the Convex copy after
 * a typewriter-length timer: the reply vanished for a moment, replayed as one
 * block, jumped again on the swap, and printed twice whenever the saved text
 * differed from the streamed text. Session membership is decided once, when
 * the session's first message is sent: the Convex ids present then are
 * history, everything later is the session's own.
 *
 * @module hooks/useChatWithPersistence
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuthContext } from '@/lib/contexts/AuthContext';
import { type PageContext, serializePageContext } from '@/lib/ai/page-context';
import type { CutShort } from '@/lib/ai/limits';

interface UseChatWithPersistenceOptions {
  conversationId?: Id<'conversations'>;
  onConversationCreated?: (id: Id<'conversations'>) => void;
  actionMode?: 'off' | 'confirm' | 'auto';
  pageContext?: PageContext;
}

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

/** Tool call as the UI shows it, live or persisted. */
export type ToolCallDisplay = {
  tool: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  executedAt?: number;
  /** The SDK's id for a live call; absent on persisted ones. */
  toolCallId?: string;
};

export type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  /** Sent or received in this session (shown from the AI SDK, not Convex). */
  isLive?: boolean;
  /** The reply was cut short with the stop button. */
  wasStopped?: boolean;
  /**
   * A cap ended the reply (the route's finish metadata): "length" for the
   * output cap, "steps" for the tool-step cap. Live replies only: the saved
   * copy's metadata has no field for it.
   */
  cutShort?: CutShort;
  toolCalls?: ToolCallDisplay[];
};

/**
 * Messages the app writes into the conversation for the model's benefit only:
 * a mode change, and the orchestrator's continuation after a confirmation.
 * They are sent to the API and never shown.
 */
const INTERNAL_MESSAGE = /^\[(System:|Tool execution (completed|failed) for |User denied tool execution)/;

export function isInternalMessageText(text: string): boolean {
  return INTERNAL_MESSAGE.test(text.trimStart());
}

/**
 * Determine tool call status from AI SDK output
 * Centralizes status logic to avoid duplication
 */
function determineToolStatus(
  state: string | undefined,
  output: Record<string, unknown> | undefined
): 'pending' | 'success' | 'error' {
  if (state === 'output-error') return 'error';
  if (state === 'output-available' && output !== undefined) {
    if (typeof output === 'object' && 'error' in output && output.error !== undefined) return 'error';
    if (output.success === false) return 'error';
    // Permission request stays pending (UI shows confirmation card)
    if (output.requiresPermission === true) return 'pending';
    return 'success';
  }
  // input-streaming, input-available, approval-requested, ...
  return 'pending';
}

/**
 * The message's text. A reply that runs in steps (text, a tool call, more
 * text) carries one text part per step; joined with nothing, one step's last
 * sentence ran into the next one's first ("Let me check.Here's what I found").
 */
function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

function toolCallsOf(message: UIMessage): ToolCallDisplay[] {
  const toolCalls: ToolCallDisplay[] = [];
  for (const part of message.parts ?? []) {
    // AI SDK tool parts are 'tool-{name}' or 'dynamic-tool'
    if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') continue;
    const toolPart = part as {
      type: string;
      toolCallId: string;
      toolName?: string;
      input?: unknown;
      output?: unknown;
      state?: string;
    };
    const output = toolPart.output as Record<string, unknown> | undefined;
    const status = determineToolStatus(toolPart.state, output);
    toolCalls.push({
      tool: toolPart.toolName ?? part.type.replace('tool-', ''),
      arguments: JSON.stringify(toolPart.input ?? {}),
      result: toolPart.output !== undefined ? JSON.stringify(toolPart.output) : undefined,
      status,
      toolCallId: toolPart.toolCallId,
    });
  }
  return toolCalls;
}

/** Which Convex messages are history for the current session. */
type HistoryBoundary = { ids: Set<string> } | { before: number };

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
  // Shown only in the gap before the SDK has the message (a new conversation
  // is created first); dropped the moment the SDK's copy exists.
  const [optimisticMessage, setOptimisticMessage] = useState<OptimisticMessage | null>(null);
  const [history, setHistory] = useState<HistoryBoundary | null>(null);
  const [stoppedIds, setStoppedIds] = useState<ReadonlySet<string>>(() => new Set());

  const { isSigningOut } = useAuthContext();
  const streamStartTime = useRef<number | null>(null);
  const conversationIdRef = useRef<Id<'conversations'> | null>(conversationId);

  const createConversation = useMutation(api.conversations.create);
  const createUserMessage = useMutation(api.conversationMessages.createUserMessage);
  const createAssistantMessage = useMutation(api.conversationMessages.createAssistantMessage);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Skip queries during sign-out to prevent "not authenticated" errors
  const conversation = useQuery(
    api.conversations.get,
    conversationId && !isSigningOut ? { id: conversationId } : 'skip'
  );
  const persistedMessages = useQuery(
    api.conversationMessages.list,
    conversationId && !isSigningOut ? { conversationId } : 'skip'
  );

  const {
    messages: sdkMessages,
    setMessages: setAIMessages,
    sendMessage,
    regenerate,
    clearError,
    status: aiStatus,
    error,
    stop,
  } = useAIChat({
    // id intentionally omitted - changing it mid-request breaks status tracking
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    // One UI update per 50 ms while streaming, instead of one per token.
    throttle: 50,
    onFinish: async ({ message, isAbort, isDisconnect, isError }) => {
      // onFinish also fires on abort/disconnect/error. Persisting those would
      // write a truncated or garbage assistant turn as a clean one, corrupting
      // history and the compaction summaries built from it.
      if (isAbort || isDisconnect || isError) return;

      const currentConversationId = conversationIdRef.current;
      if (!currentConversationId) return;

      const toolCalls = toolCallsOf(message).map(({ toolCallId: _id, ...tc }) => ({
        ...tc,
        executedAt: tc.status !== 'pending' ? Date.now() : undefined,
      }));

      const cutShort = (message.metadata as { cutShort?: CutShort } | undefined)?.cutShort;
      await createAssistantMessage({
        conversationId: currentConversationId,
        content: textOf(message),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: {
          processingTimeMs: Date.now() - (streamStartTime.current ?? Date.now()),
          // Saved with the reply, so reopening the chat still says it was cut short.
          ...(cutShort ? { cutShort } : {}),
        },
      });
    },
    onError: (err) => {
      const errAny = err as { status?: number; statusCode?: number; cause?: { message?: string } | string; responseBody?: unknown };
      console.error('[Chat] AI SDK error:', {
        message: err.message,
        name: err.name,
        conversationId: conversationIdRef.current,
        status: errAny?.status || errAny?.statusCode,
        cause: typeof errAny?.cause === 'object' ? errAny.cause?.message : errAny?.cause,
        responseBody: errAny?.responseBody,
      });
      setOptimisticMessage(null);
    },
  });

  /** Forget the session: a different conversation, or none. */
  const resetSession = useCallback(() => {
    setAIMessages([]);
    setOptimisticMessage(null);
    setHistory(null);
    setStoppedIds(new Set());
  }, [setAIMessages]);

  // The current conversation was deleted (from ChatHistory): drop it.
  useEffect(() => {
    // undefined = loading/skipped; null = does not exist
    if (conversationId && conversation === null) {
      setConversationId(null);
      conversationIdRef.current = null;
      resetSession();
    }
  }, [conversationId, conversation, resetSession]);

  // Switching conversations starts a fresh session.
  const prevConversationIdRef = useRef<Id<'conversations'> | null>(null);
  useEffect(() => {
    const prev = prevConversationIdRef.current;
    // A null -> id change is the session's own new conversation, not a switch.
    if (prev !== null && prev !== conversationId) resetSession();
    prevConversationIdRef.current = conversationId;
  }, [conversationId, resetSession]);

  // Tell the model when the action mode changes mid-conversation. Internal:
  // sent with the next request, never displayed (isInternalMessageText).
  const prevActionModeRef = useRef<string | undefined>(options.actionMode);
  const sdkMessagesRef = useRef(sdkMessages);
  useEffect(() => {
    sdkMessagesRef.current = sdkMessages;
  });
  useEffect(() => {
    const currentMode = options.actionMode;
    const prevMode = prevActionModeRef.current;
    if (prevMode && currentMode && prevMode !== currentMode && sdkMessagesRef.current.length > 0) {
      const modeLabels = { off: 'OFF', confirm: 'CONFIRM', auto: 'AUTO' };
      setAIMessages((prev) => [
        ...prev,
        {
          id: `mode-change-${Date.now()}`,
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: `[System: Action mode changed from ${modeLabels[prevMode as keyof typeof modeLabels]} to ${modeLabels[currentMode]}. Please respond according to the new mode.]` }],
        },
      ]);
    }
    prevActionModeRef.current = currentMode;
  }, [options.actionMode, setAIMessages]);

  // AI SDK can hit React's update limit during rapid streaming ("Maximum update
  // depth exceeded"); that is a rendering error, not an API failure.
  const status: ChatStatus = useMemo(() => {
    const isRenderingError = error?.message?.includes('Maximum update depth');
    return (error && !isRenderingError) ? 'error'
      : aiStatus === 'streaming' ? 'streaming'
      : aiStatus === 'submitted' ? 'submitted'
      : 'ready';
  }, [aiStatus, error]);

  // Drop the optimistic message once the SDK holds the real one.
  useEffect(() => {
    if (!optimisticMessage) return;
    const inSdk = sdkMessages.some(
      (m) => m.role === 'user' && textOf(m) === optimisticMessage.content
    );
    if (inSdk) setOptimisticMessage(null);
  }, [sdkMessages, optimisticMessage]);

  const displayMessages = useMemo((): DisplayMessage[] => {
    const messages: DisplayMessage[] = [];

    // History from Convex: everything, until this session sends; then only
    // what existed at that moment.
    for (const m of persistedMessages ?? []) {
      if (history) {
        const isHistory = 'ids' in history ? history.ids.has(m._id) : m.createdAt < history.before;
        if (!isHistory) continue;
      }
      messages.push({
        id: m._id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt,
        isLive: false,
        cutShort:
          m.role === 'assistant'
            ? (m.metadata as { cutShort?: CutShort } | undefined)?.cutShort
            : undefined,
        toolCalls: m.toolCalls as ToolCallDisplay[] | undefined,
      });
    }

    // This session, from the SDK, in order, with stable ids.
    const last = sdkMessages[sdkMessages.length - 1];
    for (const m of sdkMessages) {
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      const content = textOf(m);
      if (m.role === 'user' && isInternalMessageText(content)) continue;
      const toolCalls = m.role === 'assistant' ? toolCallsOf(m) : [];
      const isStreaming = m === last && m.role === 'assistant' && status === 'streaming';
      // An assistant turn with nothing to show yet is covered by the typing
      // indicator; an empty bubble would flash in and out.
      if (m.role === 'assistant' && !content && toolCalls.length === 0 && !isStreaming) continue;
      const metadata = m.metadata as { createdAt?: number; cutShort?: CutShort } | undefined;
      messages.push({
        id: m.id,
        role: m.role,
        content,
        // Stamped when sent (user, below) or when the reply began (the route).
        timestamp: metadata?.createdAt,
        isStreaming,
        isLive: true,
        wasStopped: stoppedIds.has(m.id),
        cutShort: m.role === 'assistant' ? metadata?.cutShort : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    }

    if (optimisticMessage) messages.push(optimisticMessage);
    return messages;
  }, [persistedMessages, history, sdkMessages, status, stoppedIds, optimisticMessage]);

  // Text of the reply being streamed (kept for callers that scroll on it).
  const streamingContent = useMemo(() => {
    if (status !== 'streaming') return undefined;
    const last = sdkMessages[sdkMessages.length - 1];
    return last?.role === 'assistant' ? textOf(last) : undefined;
  }, [sdkMessages, status]);

  const startNewConversation = useCallback(async () => {
    const id = await createConversation({});
    setConversationId(id);
    options.onConversationCreated?.(id);
    return id;
  }, [createConversation, options]);

  const selectConversation = useCallback((id: Id<'conversations'>) => {
    setConversationId(id);
  }, []);

  const requestBody = useCallback(
    (activeConversationId: Id<'conversations'>) => ({
      conversationId: activeConversationId,
      pageContext: options.pageContext ? serializePageContext(options.pageContext) : undefined,
    }),
    [options.pageContext]
  );

  const isBusy = status === 'submitted' || status === 'streaming';

  /** Fix the history boundary before this session's first send, of any kind. */
  const ensureHistory = useCallback(() => {
    if (history) return;
    setHistory(
      persistedMessages
        ? { ids: new Set(persistedMessages.map((m) => m._id as string)) }
        : { before: Date.now() - 5_000 }
    );
  }, [history, persistedMessages]);

  /** Send one user message; `fromInput` clears the composer as it goes. */
  const sendUserText = useCallback(async (text: string, fromInput: boolean) => {
    const messageContent = text.trim();
    // One turn at a time: a second send mid-stream interleaves two replies.
    if (!messageContent || isBusy) return;

    flushSync(() => {
      setOptimisticMessage({
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      });
      if (fromInput) setInput('');
    });

    ensureHistory();

    let activeConversationId = conversationId;
    if (!activeConversationId) {
      activeConversationId = await startNewConversation();
    }

    streamStartTime.current = Date.now();
    sendMessage(
      { text: messageContent, metadata: { createdAt: Date.now() } },
      { body: requestBody(activeConversationId) }
    );

    // Persist the user message in parallel with the AI request.
    createUserMessage({
      conversationId: activeConversationId,
      content: messageContent,
    }).catch((err: unknown) => {
      console.error('[Chat] Failed to persist user message:', err);
    });
  }, [isBusy, ensureHistory, conversationId, startNewConversation, sendMessage, requestBody, createUserMessage]);

  const handleSend = useCallback(() => sendUserText(input, true), [sendUserText, input]);

  /**
   * Pick up a reply a cap cut short. Sent as a visible "Continue" from the
   * person, so the model sees the request and the conversation reads plainly;
   * whatever is half-typed in the composer stays there.
   */
  const continueReply = useCallback(() => sendUserText('Continue', false), [sendUserText]);

  /**
   * An internal message for the model (the orchestrator's continuation after a
   * confirmation). Carries the conversation like any send, and is never shown.
   */
  const sendContinuation = useCallback(
    (options?: { text?: string }) => {
      const activeConversationId = conversationIdRef.current;
      if (!options?.text || !activeConversationId) return;
      ensureHistory();
      streamStartTime.current = Date.now();
      sendMessage({ text: options.text }, { body: requestBody(activeConversationId) });
    },
    [ensureHistory, sendMessage, requestBody]
  );

  /** Stop the reply: keep what streamed, marked as stopped (never saved). */
  const handleStop = useCallback(() => {
    const last = sdkMessagesRef.current[sdkMessagesRef.current.length - 1];
    if (last?.role === 'assistant') {
      setStoppedIds((prev) => new Set(prev).add(last.id));
    }
    void stop();
  }, [stop]);

  /** Try the failed turn again. */
  const retry = useCallback(() => {
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId) return;
    clearError();
    streamStartTime.current = Date.now();
    void regenerate({ body: requestBody(activeConversationId) });
  }, [clearError, regenerate, requestBody]);

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
    stop: handleStop,
    retry,
    continueReply,

    // For tool orchestration - continuation messages
    sendContinuation,
  };
}
