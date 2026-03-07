'use client';

import { useState, useEffect, useRef } from 'react';
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
  toolCalls?: ToolCall[];
  /** Get confirmation state for a tool call ID */
  getConfirmation?: (toolCallId: string) => ToolConfirmationState | undefined;
  /** Approve a pending tool confirmation */
  onApproveConfirmation?: (toolCallId: string) => Promise<void>;
  /** Deny a pending tool confirmation */
  onDenyConfirmation?: (toolCallId: string) => void;
}

// Characters to reveal per tick for smooth typewriter effect
const CHARS_PER_TICK = 3;
// Milliseconds between each tick
const TICK_INTERVAL = 15;

export function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming = false,
  toolCalls,
  getConfirmation,
  onApproveConfirmation,
  onDenyConfirmation,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const [displayedLength, setDisplayedLength] = useState(isStreaming ? 0 : content.length);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevContentRef = useRef(content);

  // Typewriter effect - runs while streaming OR while catching up.
  // IMPORTANT: displayedLength is NOT in the dependency array. Including it caused
  // cascading re-renders (React error #185 "Maximum update depth exceeded") because
  // every interval tick changed displayedLength → re-triggered the effect → cleared
  // and recreated the interval. The interval self-manages via functional setState.
  useEffect(() => {
    // If content changed completely (new message), reset
    if (content !== prevContentRef.current && !content.startsWith(prevContentRef.current)) {
      setDisplayedLength(isStreaming ? 0 : content.length);
    }
    prevContentRef.current = content;

    // Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Start typewriter interval - it self-clears when caught up
    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        if (prev >= content.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return prev;
        }
        return Math.min(prev + CHARS_PER_TICK, content.length);
      });
    }, TICK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isStreaming, content]);

  const displayedContent = content.slice(0, displayedLength);
  const isTyping = displayedLength < content.length;

  // Only show tool calls for assistant messages
  const hasToolCalls = !isUser && toolCalls && toolCalls.length > 0;
  // Show message bubble if there's content OR if we're streaming (shows cursor)
  const showBubble = content.length > 0 || isStreaming || isTyping;

  return (
    <div
      className={cn(
        'flex flex-col w-full gap-2',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {/* Message bubble - only show if there's content or actively streaming */}
      {showBubble && (
        <div
          className={cn(
            'max-w-[85%] rounded-none border-2 px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground border-primary shadow-hard-sm'
              : 'bg-card text-card-foreground border-border shadow-hard-sm'
          )}
        >
          {/* Message content with markdown rendering */}
          <div className="text-sm">
            <ChatMarkdown content={displayedContent} isUser={isUser} />
            {(isStreaming || isTyping) && (
              <span className="inline-block ml-1 w-2 h-4 bg-current animate-blink" />
            )}
          </div>

          {/* Timestamp */}
          {timestamp && (
            <div
              className={cn(
                'mt-2 font-mono text-xs opacity-60',
                isUser ? 'text-right' : 'text-left'
              )}
            >
              {format(timestamp, 'h:mm a')}
            </div>
          )}
        </div>
      )}

      {/* Tool calls (assistant messages only) */}
      {hasToolCalls && (
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
