'use client';

import { Fragment, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowDownIcon, ChatTextIcon, ClockCounterClockwiseIcon as History, InfoIcon, WarningIcon as AlertTriangle, XIcon } from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { ActionModeToggle, ACTION_MODE_NOTICE, type ActionMode } from './ActionModeToggle';
import { ChatCompactionDivider } from './ChatCompactionDivider';
import { NotLegalAdviceNotice } from '@/components/legal/NotLegalAdviceNotice';
import { springConfig } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type { ToolConfirmationState } from '@/lib/ai/tool-confirmation-types';
import type { DisplayMessage } from '@/hooks/useChatWithPersistence';
import { chatErrorText, cutShortNotice } from '@/lib/ai/limits';

/**
 * Props for the ChatPanel component
 */
interface ChatPanelProps {
  /** Array of chat messages to display */
  messages: DisplayMessage[];
  /** Current value of the input field */
  input: string;
  /** Callback when input value changes */
  onInputChange: (value: string) => void;
  /** Callback when user sends a message */
  onSend: () => void;
  /** Callback to stop/cancel AI response generation */
  onStop?: () => void;
  /** Try the failed turn again */
  onRetry?: () => void;
  /** Pick up a reply a cap cut short (sends "Continue") */
  onContinue?: () => void;
  /**
   * The failed turn's error. The server's own refusal text (a per-address
   * limit with its wait, a busy site) is shown instead of the generic line.
   */
  error?: Error | null;
  /** Callback when user closes the chat panel */
  onClose: () => void;
  /** Current chat status */
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  /** Kept for callers; following the stream no longer needs it. */
  streamingContent?: string;
  /** Callback to open conversation history */
  onOpenHistory?: () => void;
  /** Current action mode for the chatbot */
  actionMode?: ActionMode;
  /** Callback when action mode changes */
  onActionModeChange?: (mode: ActionMode) => void;
  /** Whether the action mode toggle is loading */
  actionModeLoading?: boolean;
  /** Tool confirmation state from orchestrator (read-only) */
  confirmations?: ReadonlyMap<string, Readonly<ToolConfirmationState>>;
  /** Get confirmation for a tool call */
  getConfirmation?: (toolCallId: string) => ToolConfirmationState | undefined;
  /** Approve a pending confirmation */
  onApproveConfirmation?: (toolCallId: string) => Promise<void>;
  /** Deny a pending confirmation */
  onDenyConfirmation?: (toolCallId: string) => void;
  /**
   * Summary metadata for the compaction divider. When present and
   * `messageCountAtSummary > 0`, a ChatCompactionDivider renders inline in the
   * message list at that index (between the archived prefix and the verbatim tail).
   */
  summaryMetadata?: {
    messageCountAtSummary: number;
    summary: string;
    facts?: string | null;
  };
}

/** Within this many px of the end counts as "at the bottom". */
const AT_BOTTOM_PX = 8;

/**
 * Messages drawn at once. A conversation grows with every turn, so the panel
 * shows the latest page and a button, with the count, for the earlier ones.
 */
const MESSAGE_PAGE = 60;

/**
 * Follow the conversation's end while the reader is there, and let go the
 * moment they scroll away.
 *
 * The old panel called smooth scrollIntoView every 150 ms while a reply
 * streamed, so a reader who scrolled up was pulled back down before they could
 * read anything: "it doesn't let me scroll while it's loading". Here, any
 * upward wheel, touch drag or key releases the hold at once; reaching the
 * bottom again re-takes it. Following is an instant scrollTop write driven by
 * the content's own size, so it never animates against the reader.
 */
function useStickToBottom() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const lastTop = useRef(0);
  const [showJump, setShowJump] = useState(false);

  const distanceFromBottom = () => {
    const el = scrollRef.current;
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;
  };

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastTop.current = el.scrollTop;
  }, []);

  const release = useCallback(() => {
    stuck.current = false;
  }, []);

  // Reader intent, read from input rather than from scroll position, so a
  // reply growing at the same moment cannot win the race.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) release();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') release();
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchmove', release, { passive: true });
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', release);
      el.removeEventListener('keydown', onKey);
    };
  }, [release]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = distanceFromBottom();
    if (distance <= AT_BOTTOM_PX) stuck.current = true;
    // A drag of the scrollbar moves up without a wheel or touch event.
    else if (el.scrollTop < lastTop.current - 2) stuck.current = false;
    lastTop.current = el.scrollTop;
    setShowJump(!stuck.current && distance > 80);
  }, []);

  // Follow content growth (streamed text, tool cards, images) while stuck.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (stuck.current) toBottom();
      else setShowJump(distanceFromBottom() > 80);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [toBottom]);

  /** Take the hold and go to the end (a new message of the reader's own). */
  const stick = useCallback(() => {
    stuck.current = true;
    setShowJump(false);
    toBottom();
  }, [toBottom]);

  /** The "Jump to latest" button. */
  const jump = useCallback(() => {
    stuck.current = true;
    setShowJump(false);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  return { scrollRef, contentRef, onScroll, showJump, stick, jump, toBottom };
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  onRetry,
  onContinue,
  error,
  onClose,
  status,
  onOpenHistory,
  actionMode = 'confirm',
  onActionModeChange,
  actionModeLoading = false,
  confirmations: _confirmations,
  getConfirmation,
  onApproveConfirmation,
  onDenyConfirmation,
  summaryMetadata,
}: ChatPanelProps) {
  const { scrollRef, contentRef, onScroll, showJump, stick, jump, toBottom } = useStickToBottom();
  const reduceMotion = useReducedMotion();

  // Messages present when the panel opened render still; only messages that
  // arrive while it is open fade in.
  const [initialIds] = useState(() => new Set(messages.map((m) => m.id)));

  // Open at the end, before the first paint.
  useLayoutEffect(() => {
    toBottom();
  }, [toBottom]);

  // A message of the reader's own takes them to the end.
  const lastMessage = messages[messages.length - 1];
  const lastUserId = lastMessage?.role === 'user' ? lastMessage.id : null;
  useEffect(() => {
    if (lastUserId) stick();
  }, [lastUserId, stick]);

  // Name the new mode for a few seconds after it changes (touch has no hover).
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const prevMode = useRef(actionMode);
  useEffect(() => {
    if (prevMode.current === actionMode) return;
    prevMode.current = actionMode;
    setModeNotice(ACTION_MODE_NOTICE[actionMode]);
    const t = setTimeout(() => setModeNotice(null), 3500);
    return () => clearTimeout(t);
  }, [actionMode]);

  const isProcessing = status === 'submitted' || status === 'streaming';
  const errorText = chatErrorText(error ?? undefined);

  // The latest page of messages; earlier ones on request.
  const [pageSize, setPageSize] = useState(MESSAGE_PAGE);
  const firstShown = Math.max(0, messages.length - pageSize);
  const shownMessages = firstShown > 0 ? messages.slice(firstShown) : messages;
  // Waiting for the first word: the reply has not produced a message yet.
  const showTyping = status === 'submitted' || (status === 'streaming' && lastMessage?.role !== 'assistant');

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
      transition={springConfig}
      className={cn(
        'fixed z-[60]',
        // Mobile: full screen
        'inset-0 md:inset-auto',
        // Desktop: positioned bottom-right
        'md:bottom-20 md:right-4',
        'md:w-[380px] md:h-[560px] md:max-h-[80vh]',
        'flex flex-col',
        'bg-background border-2 border-border shadow-hard-lg',
        'overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-border bg-muted gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ChatTextIcon className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold text-sm max-[389px]:sr-only">PERM Assistant</h2>
        </div>

        {/* Action Mode Toggle (icons only, portal tooltip) */}
        {onActionModeChange && (
          <ActionModeToggle
            mode={actionMode}
            onChange={onActionModeChange}
            disabled={actionModeLoading}
          />
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {onOpenHistory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenHistory}
              className="h-11 w-11 md:h-8 md:w-8"
              aria-label="View history"
            >
              <History className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-11 w-11 md:h-8 md:w-8"
            aria-label="Close chat"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* The mode just chosen, named */}
      <AnimatePresence>
        {modeNotice && (
          <motion.p
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="px-3 py-2 text-sm border-b-2 border-border bg-background overflow-hidden"
          >
            {modeNotice}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          tabIndex={0}
          aria-label="Conversation"
          className="h-full overflow-y-auto overscroll-contain p-4 focus:outline-none"
        >
          {/* Always mounted, so the size watcher follows a first conversation too. */}
          <div ref={contentRef} className="min-h-full flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
              <ChatTextIcon className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">Start a conversation</p>{" "}
              <p className="text-sm mt-1">
                Ask about PERM process, deadlines, or the app
              </p>
            </div>
          ) : (
            <div className="space-y-4" aria-live="polite" aria-busy={isProcessing}>
              {firstShown > 0 && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPageSize((n) => n + MESSAGE_PAGE)}
                    className="h-11 md:h-9 shadow-hard-sm"
                  >
                    {firstShown > MESSAGE_PAGE
                      ? `Show ${MESSAGE_PAGE} earlier messages (${firstShown} left)`
                      : `Show ${firstShown} earlier ${firstShown === 1 ? 'message' : 'messages'}`}
                  </Button>
                </div>
              )}
              {shownMessages.map((message, pageIndex) => {
                // Position in the whole conversation (the divider's count and
                // "is this the latest turn" both need it).
                const index = firstShown + pageIndex;
                // Compaction seam: the divider sits between the archived prefix
                // (< messageCountAtSummary) and the verbatim tail.
                const showDividerBefore =
                  summaryMetadata !== undefined &&
                  summaryMetadata.messageCountAtSummary > 0 &&
                  summaryMetadata.messageCountAtSummary < messages.length &&
                  index === summaryMetadata.messageCountAtSummary;
                const isNew = !initialIds.has(message.id) && !reduceMotion;

                return (
                  <Fragment key={message.id}>
                    {showDividerBefore && (
                      <ChatCompactionDivider
                        messageCount={summaryMetadata!.messageCountAtSummary}
                        summary={summaryMetadata!.summary}
                        facts={summaryMetadata!.facts}
                      />
                    )}
                    <motion.div
                      initial={isNew ? { opacity: 0, y: 6 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <ChatMessage
                        role={message.role}
                        content={message.content}
                        timestamp={message.timestamp}
                        isStreaming={message.isStreaming}
                        animateText={message.isLive === true && message.role === 'assistant'}
                        wasStopped={message.wasStopped}
                        toolCalls={message.toolCalls}
                        getConfirmation={getConfirmation}
                        onApproveConfirmation={onApproveConfirmation}
                        onDenyConfirmation={onDenyConfirmation}
                      />
                      {/* A cap ended this reply: say which, and offer to go on
                          while it is still the latest turn. */}
                      {message.cutShort && !message.isStreaming && (
                        <div className="mt-2 flex items-start gap-2 border-2 border-border bg-muted p-2.5 text-sm">
                          <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p>{cutShortNotice(message.cutShort)}</p>{" "}
                            {onContinue && index === messages.length - 1 && status === 'ready' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={onContinue}
                                className="mt-2 h-11 md:h-9 shadow-hard-sm"
                              >
                                Continue
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </Fragment>
                );
              })}

              {/* Typing indicator */}
              <AnimatePresence>
                {showTyping && <TypingIndicator />}
              </AnimatePresence>

              {/* Error message */}
              <AnimatePresence>
                {status === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    role="alert"
                    className="flex items-start gap-3 p-3 bg-destructive/10 border-2 border-destructive rounded-none"
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-destructive">
                        {errorText.title}
                      </p>{" "}
                      <p className="text-sm text-destructive mt-1 break-words">
                        {errorText.detail}
                      </p>
                      {onRetry && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={onRetry}
                          className="mt-2 h-11 md:h-9 shadow-hard-sm"
                        >
                          Try again
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          </div>
        </div>

        {/* Newer content below while the reader is scrolled up */}
        <AnimatePresence>
          {showJump && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2"
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={jump}
                className="h-11 md:h-9 gap-1.5 bg-background shadow-hard-sm"
              >
                <ArrowDownIcon className="h-4 w-4" />
                Jump to latest
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Not-legal-advice disclaimer — quiet footnote above the composer */}
      <NotLegalAdviceNotice variant="chat" />

      {/* Input Area */}
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
        disabled={false}
        isProcessing={isProcessing}
        placeholder={isProcessing ? 'Answering…' : 'Type a message...'}
      />
    </motion.div>
  );
}
