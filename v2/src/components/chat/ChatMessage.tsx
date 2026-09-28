'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ToolCallList, type ToolCall } from './ToolCallCard';
import { ChatMarkdown } from './ChatMarkdown';
import type { ToolConfirmationState } from '@/lib/ai/tool-confirmation-types';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  /**
   * Reveal text smoothly as it arrives (a live assistant reply). History and
   * the reader's own messages show at once.
   */
  animateText?: boolean;
  /** The reply was cut short with the stop button. */
  wasStopped?: boolean;
  toolCalls?: ToolCall[];
  /** Get confirmation state for a tool call ID */
  getConfirmation?: (toolCallId: string) => ToolConfirmationState | undefined;
  /** Approve a pending tool confirmation */
  onApproveConfirmation?: (toolCallId: string) => Promise<void>;
  /** Deny a pending tool confirmation */
  onDenyConfirmation?: (toolCallId: string) => void;
}

/**
 * Text revealed at the pace it arrives, one animation frame at a time.
 *
 * The step grows with the backlog (a sixth of what is waiting, at least two
 * characters), so a big chunk catches up within a few frames and a trickle
 * reads smoothly: the displayed text never falls seconds behind the stream the
 * way a fixed 3-characters-per-15 ms typewriter did. It runs on the same
 * component from the first word to the last, so the end of the stream only
 * lets it finish; it never restarts or jumps to a block.
 */
export function useSmoothText(content: string, enabled: boolean): string {
  const [shown, setShown] = useState(() => (enabled ? 0 : content.length));
  const shownRef = useRef(shown);
  const contentRef = useRef(content);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    contentRef.current = content;
    // Not animating, or the tab is hidden (no frames will run): show it all.
    if (!enabled || (typeof document !== 'undefined' && document.hidden)) {
      shownRef.current = content.length;
      setShown(content.length);
      return;
    }
    // Text that no longer extends what is shown (a rewrite): keep the common part.
    if (shownRef.current > content.length) {
      shownRef.current = content.length;
      setShown(content.length);
    }
    if (frame.current !== null || shownRef.current >= content.length) return;

    const tick = () => {
      const target = contentRef.current.length;
      const backlog = target - shownRef.current;
      if (backlog <= 0) {
        frame.current = null;
        return;
      }
      shownRef.current = Math.min(target, shownRef.current + Math.max(2, Math.ceil(backlog / 6)));
      setShown(shownRef.current);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [content, enabled]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  return content.slice(0, shown);
}

/** Markdown re-renders only when its own text changes. */
const MessageMarkdown = memo(ChatMarkdown);

export function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming = false,
  animateText = false,
  wasStopped = false,
  toolCalls,
  getConfirmation,
  onApproveConfirmation,
  onDenyConfirmation,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const reduceMotion = useReducedMotion();
  // Decided once, at mount: only a message that is live then animates.
  const [animate] = useState(() => animateText && isStreaming && !reduceMotion);
  const displayed = useSmoothText(content, animate);
  const isRevealing = displayed.length < content.length;

  const hasToolCalls = !isUser && toolCalls && toolCalls.length > 0;
  const showBubble = content.length > 0 || isStreaming;
  const showCaret = isStreaming || isRevealing;

  return (
    <div
      className={cn(
        'flex flex-col w-full gap-2',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {showBubble && (
        <div
          className={cn(
            'max-w-[85%] rounded-none border-2 px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground border-primary shadow-hard-sm'
              : 'bg-card text-card-foreground border-border shadow-hard-sm'
          )}
        >
          <div className="text-base md:text-sm break-words">
            <MessageMarkdown content={displayed} isUser={isUser} />
            {showCaret && (
              <span
                aria-hidden="true"
                className="inline-block ml-0.5 w-2 h-4 align-text-bottom bg-current opacity-60"
              />
            )}
          </div>

          {(timestamp || wasStopped) && (
            <div
              className={cn(
                'mt-2 flex items-center gap-2 font-mono text-xs opacity-70',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              {timestamp && <span>{format(timestamp, 'h:mm a')}</span>}
              {wasStopped && <span>Stopped</span>}
            </div>
          )}
        </div>
      )}

      {/* Tool calls (assistant messages only) */}
      {hasToolCalls && getConfirmation && onApproveConfirmation && onDenyConfirmation && (
        <div className="max-w-[85%] w-full">
          <ToolCallList
            toolCalls={toolCalls}
            getConfirmation={getConfirmation}
            onApproveConfirmation={onApproveConfirmation}
            onDenyConfirmation={onDenyConfirmation}
          />
        </div>
      )}
    </div>
  );
}
