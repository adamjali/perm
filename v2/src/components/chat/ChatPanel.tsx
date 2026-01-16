'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, History, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { ActionModeToggle, type ActionMode } from './ActionModeToggle';
import { springConfig } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { usePrevious } from '@/hooks/usePrevious';
import type { ToolConfirmationState } from '@/lib/ai/tool-confirmation-types';

interface ToolCall {
  tool: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  executedAt?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}

/**
 * Props for the ChatPanel component
 */
interface ChatPanelProps {
  /** Array of chat messages to display */
  messages: Message[];
  /** Current value of the input field */
  input: string;
  /** Callback when input value changes */
  onInputChange: (value: string) => void;
  /** Callback when user sends a message */
  onSend: () => void;
  /** Callback to stop/cancel AI response generation */
  onStop?: () => void;
  /** Callback when user closes the chat panel */
  onClose: () => void;
  /** Current chat status */
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  /** Content being streamed (for typewriter effect) */
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
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  onClose,
  status,
  streamingContent,
  onOpenHistory,
  actionMode = 'confirm',
  onActionModeChange,
  actionModeLoading = false,
  confirmations: _confirmations,
  getConfirmation,
  onApproveConfirmation,
  onDenyConfirmation,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Track if this is the initial mount (for stagger animation)
  const [isInitialMount, setIsInitialMount] = useState(true);
  // Hide messages briefly on open so scroll can complete first
  const [showMessages, setShowMessages] = useState(false);
  // Track if user has scrolled up (to pause autoscroll)
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Get previous messages to detect new ones (state-based, safe during render)
  const previousMessages = usePrevious(messages);
  const previousMessageIds = useMemo(
    () => new Set(previousMessages?.map((m) => m.id) ?? []),
    [previousMessages]
  );

  // Detect when user scrolls away from bottom (to pause autoscroll)
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Consider "at bottom" if within 100px of bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    setUserHasScrolled(!isAtBottom);
  }, []);

  // Reset userHasScrolled when user sends a new message (optimistic message appears)
  useEffect(() => {
    const hasOptimisticUserMessage = messages.some(
      (m) => m.role === 'user' && m.id.startsWith('optimistic-')
    );
    if (hasOptimisticUserMessage) {
      setUserHasScrolled(false);
    }
  }, [messages]);

  // On mount: scroll instantly, then reveal messages with slight delay
  useEffect(() => {
    // Scroll to bottom immediately (no animation on initial load)
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    // Show messages after scroll completes
    const showTimer = setTimeout(() => setShowMessages(true), 0);
    // Mark initial mount complete for animation purposes
    const mountTimer = setTimeout(() => setIsInitialMount(false), 350);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(mountTimer);
    };
  }, []);

  // Auto-scroll to bottom on new messages (after initial mount)
  // Skip if user has scrolled up to read history
  useEffect(() => {
    if (showMessages && !userHasScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, showMessages, userHasScrolled]);

  // Auto-scroll during typewriter animation (streaming-assistant message)
  // The typewriter reveals text gradually, so we need to scroll as content grows
  // Skip if user has scrolled up to read history
  // Only scroll while actively streaming (not after completion during typewriter catch-up)
  useEffect(() => {
    const hasActiveTypewriter = messages.some((m) => m.id === 'streaming-assistant' && m.isStreaming);
    if (!hasActiveTypewriter || !showMessages || userHasScrolled) return;

    const interval = setInterval(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150); // Scroll every 150ms while typewriter is active

    return () => clearInterval(interval);
  }, [messages, showMessages, userHasScrolled]);

  const isProcessing = status === 'submitted' || status === 'streaming';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.95 }}
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
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold text-sm">PERM Assistant</h2>
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
              className="h-8 w-8"
              aria-label="View history"
            >
              <History className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Start a conversation</p>
            <p className="text-xs mt-1 opacity-70">
              Ask about PERM process, deadlines, or the app
            </p>
          </div>
        ) : (
          <div className="space-y-4" style={{ opacity: showMessages ? 1 : 0 }}>
            {messages.map((message, index) => {
              // Check if this message existed in the previous render cycle
              // New messages won't be in previousMessageIds until after this render commits
              const wasSeenBefore = previousMessageIds.has(message.id);

              // Only apply stagger delay on initial mount, after messages become visible
              const animationDelay = isInitialMount && showMessages ? index * 0.05 : 0;
              // New messages (not seen before, not initial mount) appear instantly
              const skipAnimation = !wasSeenBefore && !isInitialMount;

              return (
                <motion.div
                  key={message.id}
                  initial={skipAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...springConfig,
                    delay: animationDelay,
                  }}
                >
                  <ChatMessage
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                    isStreaming={message.isStreaming}
                    toolCalls={message.toolCalls}
                    getConfirmation={getConfirmation}
                    onApproveConfirmation={onApproveConfirmation}
                    onDenyConfirmation={onDenyConfirmation}
                  />
                </motion.div>
              );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
              {status === 'submitted' && <TypingIndicator />}
            </AnimatePresence>

            {/* Error message */}
            <AnimatePresence>
              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-none"
                >
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Having trouble connecting
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Our AI services are experiencing high demand. Please try again in a moment.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
        disabled={false}
        isProcessing={isProcessing}
        placeholder={isProcessing ? 'Thinking...' : 'Type a message...'}
      />
    </motion.div>
  );
}
