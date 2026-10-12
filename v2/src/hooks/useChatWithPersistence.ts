"use client";

// DECLARED, not inherited. This module uses useState, so it is a client module
// in every sense. Without the annotation it works only while every path to
// it crosses somebody else's `"use client"` boundary first: move a boundary
// anywhere above it and this lands on the server, where the API does not
// exist. See lib/ai/page-context.tsx for the failure that causes.

/**
 * useChatWithPersistence Hook
 *
 * AI SDK streaming plus Convex persistence, displayed as ONE list with stable
 * identities.
 *
 * WHERE EACH MESSAGE COMES FROM. A message sent or received in this session
 * is shown from the AI SDK, from its first streamed word to the end, keyed by
 * the SDK's own id; the saved copy in Convex is never swapped in for it,
 * because a swap makes the reply vanish, replay as one block, jump, and print
 * twice whenever the saved text differs from the streamed text. Everything
 * older comes from Convex. Session membership is decided once, when
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
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useAuthContext } from '@/lib/contexts/AuthContext';
import { type PageContext, serializePageContext } from '@/lib/ai/page-context';
import { rateLimitFrom, formatWait, type CutShort } from '@/lib/ai/limits';
import { summarizeToolResult } from '@/components/chat/tool-result-summary';
import { HISTORY_FOR_MODEL } from '@/lib/ai/chatTurn';

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

// Saved turns sent to the model ahead of the session's own (HISTORY_FOR_MODEL
// in chatTurn.ts). The SDK holds only this session's messages, so after a
// reload the model saw none of the conversation it was asked to continue
// ("yes, update it" had nothing to refer to). The summary covers anything older.
const HISTORY_MESSAGE_CHARS = 4_000;

type PersistedMessage = {
  _id: string;
  role: string;
  content: string;
  toolCalls?: Array<{ tool: string; result?: string; status?: 'pending' | 'success' | 'error' }>;
};

/** One saved tool call as a line the model can read (not a call to answer). */
function toolNote(tc: NonNullable<PersistedMessage['toolCalls']>[number]): string {
  const outcome =
    tc.status === 'pending'
      ? 'shown for confirmation, not answered'
      : summarizeToolResult(tc.tool, tc.result) || (tc.status === 'error' ? 'failed' : 'done');
  return `[Earlier action ${tc.tool}: ${outcome}]`;
}

/** The newest saved turns as plain text messages for the model. */
export function historyForModel(persisted: readonly PersistedMessage[]): UIMessage[] {
  const out: UIMessage[] = [];
  for (const m of persisted.slice(-HISTORY_FOR_MODEL)) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const notes = m.role === 'assistant' ? (m.toolCalls ?? []).map(toolNote) : [];
    const text = [m.content.slice(0, HISTORY_MESSAGE_CHARS), ...notes].filter(Boolean).join('\n\n').trim();
    if (!text) continue;
    out.push({ id: m._id, role: m.role, parts: [{ type: 'text', text }] });
  }
  return out;
}

/** The tool calls in a message that actually ran (not a card still waiting). */
function ranToolCalls(message: UIMessage | undefined): ToolCallDisplay[] {
  if (!message || message.role !== 'assistant') return [];
  return toolCallsOf(message).filter((tc) => tc.status !== 'pending');
}

/** An error the panel reads like the route's (chatErrorText parses the JSON). */
function panelError(error: unknown, fallback: string): Error {
  const limit = rateLimitFrom(error);
  const body = limit
    ? { error: 'rate_limited', message: `Too many new conversations in a short time. Try again in ${formatWait(limit.retryAfterMs)}.` }
    : { error: 'send_failed', message: fallback };
  return new Error(JSON.stringify(body));
}

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
  // A failure before the request was sent (a new conversation couldn't be made).
  const [localError, setLocalError] = useState<Error | null>(null);

  const { isSigningOut } = useAuthContext();
  const streamStartTime = useRef<number | null>(null);
  const conversationIdRef = useRef<Id<'conversations'> | null>(conversationId);
  // The conversation the request in flight belongs to, fixed when it's sent:
  // read at the reply's end, a switch mid-stream saved the reply (and its
  // cards) into the conversation switched to.
  const requestConversationRef = useRef<Id<'conversations'> | null>(null);
  // The saved turns sent ahead of the session's own (historyForModel).
  const historyRef = useRef<UIMessage[]>([]);
  // A send is between its first line and the request going out (a new
  // conversation is created in between): a second Enter must not start another.
  const sendingRef = useRef(false);

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
      const currentConversationId = requestConversationRef.current;
      if (!currentConversationId) return;

      const toolCalls = toolCallsOf(message).map(({ toolCallId: _id, ...tc }) => ({
        ...tc,
        executedAt: tc.status !== 'pending' ? Date.now() : undefined,
      }));

      // onFinish also fires on a stop, a dropped connection and a failure. Such
      // a reply is saved only when an action in it had already run, marked
      // incomplete, so the action is on record after a reload and in the
      // summaries; a reply with nothing done is left out, as before.
      const interrupted = isAbort || isDisconnect || isError;
      if (interrupted && !toolCalls.some((tc) => tc.status !== 'pending')) return;

      const cutShort = (message.metadata as { cutShort?: CutShort } | undefined)?.cutShort;
      try {
        await createAssistantMessage({
          conversationId: currentConversationId,
          content: textOf(message),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          metadata: {
            processingTimeMs: Date.now() - (streamStartTime.current ?? Date.now()),
            // Saved with the reply, so reopening the chat still says it was cut short.
            ...(cutShort ? { cutShort } : {}),
            ...(interrupted ? { incomplete: true } : {}),
          },
        });
      } catch (err) {
        console.error('[Chat] Failed to save the reply:', err instanceof Error ? err.message : err);
      }
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

  // The status, readable from callbacks without re-creating them.
  const statusRef = useRef<ChatStatus>('ready');

  /** Forget the session: a different conversation, or none. */
  const resetSession = useCallback(() => {
    // A reply still streaming ends here; its own conversation keeps whatever
    // ran (onFinish, requestConversationRef), and none of it lands in the next.
    if (statusRef.current === 'submitted' || statusRef.current === 'streaming') void stop();
    setAIMessages([]);
    setOptimisticMessage(null);
    setHistory(null);
    setStoppedIds(new Set());
    setLocalError(null);
    historyRef.current = [];
  }, [setAIMessages, stop]);

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
    return localError ? 'error'
      : (error && !isRenderingError) ? 'error'
      : aiStatus === 'streaming' ? 'streaming'
      : aiStatus === 'submitted' ? 'submitted'
      : 'ready';
  }, [aiStatus, error, localError]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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
        // Saved after a stop or a failure because an action in it had run.
        wasStopped: (m.metadata as { incomplete?: boolean } | undefined)?.incomplete === true,
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
      // The saved turns from before this session; the route puts them ahead
      // of the session's own messages (historyForModel).
      history: historyRef.current,
    }),
    [options.pageContext]
  );

  const isBusy = status === 'submitted' || status === 'streaming';

  /**
   * Fix the history boundary before this session's first send, of any kind,
   * and the saved turns the model gets with every request of the session.
   */
  const ensureHistory = useCallback(() => {
    if (history) return;
    if (persistedMessages) {
      setHistory({ ids: new Set(persistedMessages.map((m) => m._id as string)) });
      historyRef.current = historyForModel(persistedMessages as unknown as PersistedMessage[]);
    } else {
      setHistory({ before: Date.now() - 5_000 });
      historyRef.current = [];
    }
  }, [history, persistedMessages]);

  /** Send one user message; `fromInput` clears the composer as it goes. */
  const sendUserText = useCallback(async (text: string, fromInput: boolean) => {
    const messageContent = text.trim();
    // One turn at a time: a second send mid-stream interleaves two replies,
    // and one during the first send's wait for a new conversation made two.
    if (!messageContent || isBusy || sendingRef.current) return;
    sendingRef.current = true;
    setLocalError(null);

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
      try {
        activeConversationId = await startNewConversation();
      } catch (err) {
        // Nothing was sent: put the words back and say why.
        sendingRef.current = false;
        setOptimisticMessage(null);
        if (fromInput) setInput(messageContent);
        setLocalError(panelError(err, 'The chat couldn’t start a new conversation. Try again in a moment.'));
        return;
      }
    }

    streamStartTime.current = Date.now();
    requestConversationRef.current = activeConversationId;
    sendMessage(
      { text: messageContent, metadata: { createdAt: Date.now() } },
      { body: requestBody(activeConversationId) }
    );
    sendingRef.current = false;

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
  // A continuation sent while a reply is still streaming waits for it to end:
  // two requests at once pushed the first reply twice and saved the card as
  // still waiting, so it could be approved again after a reload.
  const queuedContinuation = useRef<{ text: string; conversationId: Id<'conversations'> } | null>(null);

  const sendContinuation = useCallback(
    (options?: { text?: string }) => {
      const activeConversationId = conversationIdRef.current;
      if (!options?.text || !activeConversationId) return;
      if (statusRef.current === 'submitted' || statusRef.current === 'streaming') {
        queuedContinuation.current = { text: options.text, conversationId: activeConversationId };
        return;
      }
      ensureHistory();
      streamStartTime.current = Date.now();
      requestConversationRef.current = activeConversationId;
      sendMessage({ text: options.text }, { body: requestBody(activeConversationId) });
    },
    [ensureHistory, sendMessage, requestBody]
  );

  useEffect(() => {
    const queued = queuedContinuation.current;
    if (!queued || (status !== 'ready' && status !== 'error')) return;
    queuedContinuation.current = null;
    // Only into the conversation it was meant for.
    if (queued.conversationId !== conversationIdRef.current) return;
    sendContinuation({ text: queued.text });
  }, [status, sendContinuation]);

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
    // Nothing went out (a new conversation couldn't be made): send it again.
    if (localError) {
      setLocalError(null);
      void sendUserText(input, true);
      return;
    }
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId) return;
    clearError();
    // Actions that already ran stay done: regenerating would drop the reply
    // they're in and let the model run them again (a second createCase). Carry
    // on from them instead, telling the model which ran.
    const ran = ranToolCalls(sdkMessagesRef.current[sdkMessagesRef.current.length - 1]);
    if (ran.length > 0) {
      sendContinuation({
        text: `[System: Your last reply was interrupted after these actions had already run: ${ran
          .map((tc) => tc.tool)
          .join(', ')}. Do not run them again. Finish the reply from where it stopped.]`,
      });
      return;
    }
    streamStartTime.current = Date.now();
    requestConversationRef.current = activeConversationId;
    void regenerate({ body: requestBody(activeConversationId) });
  }, [localError, sendUserText, input, clearError, sendContinuation, regenerate, requestBody]);

  return {
    // State
    conversationId,
    conversation,
    messages: displayMessages,
    input,
    status,
    error: localError ?? error,
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
