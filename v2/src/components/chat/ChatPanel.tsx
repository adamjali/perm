'use client';

import { Fragment, useRef, useEffect, useId, useLayoutEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react';
import { ArrowDownIcon, ChatTextIcon, ClockCounterClockwiseIcon as History, InfoIcon, WarningIcon as AlertTriangle, XIcon } from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { ActionModeToggle, type ActionMode } from './ActionModeToggle';
import { ChatCompactionDivider } from './ChatCompactionDivider';
import { NotLegalAdviceNotice } from '@/components/legal/NotLegalAdviceNotice';
import { springConfig } from '@/lib/motion';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus goes into the panel when it opens: the message box on a desk; on a
  // phone the panel itself, so the keyboard doesn't jump up over it unasked.
  const [focusInput] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches === true
  );
  useEffect(() => {
    if (!focusInput) panelRef.current?.focus();
  }, [focusInput]);

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

  const isProcessing = status === 'submitted' || status === 'streaming';
  const errorText = chatErrorText(error ?? undefined);
  // Actions in the interrupted reply already ran; Try again carries on from
  // them (useChatWithPersistence retry) and the panel says so.
  const actionsRan =
    lastMessage?.role === 'assistant' && (lastMessage.toolCalls ?? []).some((tc) => tc.status !== 'pending');

  // The latest page of messages; earlier ones on request.
  const [pageSize, setPageSize] = useState(MESSAGE_PAGE);
  const firstShown = Math.max(0, messages.length - pageSize);
  const shownMessages = firstShown > 0 ? messages.slice(firstShown) : messages;
  // Waiting for the first word: the reply has not produced a message yet.
  const showTyping = status === 'submitted' || (status === 'streaming' && lastMessage?.role !== 'assistant');

  return (
    // reducedMotion="user": the spinners and the typing dots hold still for
    // anyone whose system asks for less motion.
    <MotionConfig reducedMotion="user">
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      // Escape closes the panel (a menu or tooltip inside takes it first).
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.stopPropagation();
          onClose();
        }
      }}
      // It rises into place when opened (round 2, Oct 15 2026); a fade alone
      // under reduced motion.
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
      transition={springConfig}
      className={cn(
        // ph-no-capture: PostHog's automatic click capture records the text of
        // what's clicked, and here that is the person's own conversation.
        'ph-no-capture focus:outline-none',
        'fixed z-[60]',
        // Mobile: full screen
        'inset-0 md:inset-auto',
        // Desktop: positioned bottom-right
        'md:bottom-[calc(5rem_+_env(safe-area-inset-bottom,0px))] md:right-[calc(1rem_+_env(safe-area-inset-right,0px))]',
        'md:w-[380px] md:h-[560px] md:max-h-[80vh]',
        'flex flex-col',
        'bg-background border-2 border-black md:shadow-hard-lg',
        'overflow-hidden'
      )}
    >
      {/* Header */}
      {/* An ink title bar; `dark` resolves its tokens to the dark theme. */}
      <div className="dark flex items-center justify-between px-3 py-2 border-b-2 border-black bg-[#141414] text-foreground gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ChatTextIcon className="h-5 w-5 text-primary" />
          <h2 id={titleId} className="font-heading font-semibold text-sm max-[389px]:sr-only">PERM Assistant</h2>
        </div>

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

      {/* What the assistant may do: three labelled, coloured modes and a line
          saying what the chosen one means. */}
      {onActionModeChange && (
        <ActionModeToggle
          mode={actionMode}
          onChange={onActionModeChange}
          // Not while a reply is running: a mode change then started a
          // second request beside it.
          disabled={actionModeLoading || isProcessing}
        />
      )}

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
                      initial={!initialIds.has(message.id) && !reduceMotion ? { opacity: 0, y: 6 } : false}
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
                        confirmationsBusy={isProcessing}
                      />
                      {/* A cap ended this reply: say which, and offer to go on
                          while it is still the latest turn. */}
                      {message.cutShort && !message.isStreaming && (
                        <div className="mt-2 flex items-start gap-2 bg-tint p-2.5 text-sm border-2 border-border">
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
              <AnimatePresence initial={false}>
                {showTyping && <TypingIndicator />}
              </AnimatePresence>

              {/* Error message */}
              <AnimatePresence initial={false}>
                {status === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    role="alert"
                    className="flex items-start gap-3 p-3 bg-destructive/10 border-2 border-destructive"
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-destructive">
                        {errorText.title}
                      </p>{" "}
                      <p className="text-sm text-destructive mt-1 break-words">
                        {errorText.detail}
                      </p>{" "}
                      {actionsRan && (
                        <p className="text-sm text-destructive mt-1">
                          The actions above already ran. Try again carries on from them without running them again.
                        </p>
                      )}
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
        <AnimatePresence initial={false}>
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
        autoFocus={focusInput}
      />
    </motion.div>
    </MotionConfig>
  );
}
