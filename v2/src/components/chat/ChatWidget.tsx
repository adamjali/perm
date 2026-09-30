'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatTextIcon } from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { type ActionMode } from './ActionModeToggle';
import { springConfig } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type { ToolConfirmationState } from '@/lib/ai/tool-confirmation-types';
import type { DisplayMessage } from '@/hooks/useChatWithPersistence';

interface ChatWidgetProps {
  messages?: DisplayMessage[];
  input?: string;
  onInputChange?: (value: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  /** Try the failed turn again */
  onRetry?: () => void;
  /** Pick up a reply a cap cut short */
  onContinue?: () => void;
  /** The failed turn's error (its own text is shown) */
  error?: Error | null;
  status?: 'ready' | 'submitted' | 'streaming' | 'error';
  streamingContent?: string;
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
  /** Summary metadata for the compaction divider (passed through to ChatPanel) */
  summaryMetadata?: {
    messageCountAtSummary: number;
    summary: string;
    facts?: string | null;
  };
}

export function ChatWidget({
  messages = [],
  input = '',
  onInputChange = () => {},
  onSend = () => {},
  onStop,
  onRetry,
  onContinue,
  error,
  status = 'ready',
  streamingContent,
  onOpenHistory,
  actionMode = 'confirm',
  onActionModeChange,
  actionModeLoading = false,
  confirmations,
  getConfirmation,
  onApproveConfirmation,
  onDenyConfirmation,
  summaryMetadata,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for external open requests (e.g. from onboarding checklist)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-chat-widget', handleOpen);
    return () => window.removeEventListener('open-chat-widget', handleOpen);
  }, []);

  return (
    <>
      {/* Floating Bubble. initial={false}: the bubble present at page load
          renders in place. Its scale(0) start shipped in the server HTML, so
          the bubble was invisible until the scripts ran and then popped in;
          it still scales in and out when the chat panel closes and opens. */}
      <AnimatePresence initial={false}>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={springConfig}
            // Anchored to the corner, lifted over a bottom bar when one shows
            // (--bottom-bar-h, published by usePublishBottomBar). z-40 keeps
            // dialogs, menus and the phone nav (z-50) drawn over it.
            className="fixed right-4 bottom-[calc(var(--bottom-bar-h,0px)+1rem)] z-40 transition-[bottom] duration-150 motion-reduce:transition-none md:right-6 md:bottom-[calc(var(--bottom-bar-h,0px)+1.5rem)]"
            data-tour="chat-bubble"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className={cn(
                'h-14 w-14 rounded-none p-0',
                'bg-primary/80 hover:bg-primary',
                'border-2 border-border shadow-hard',
                'transition-transform duration-150',
                'hover:-translate-y-1 active:translate-y-0'
              )}
              aria-label="Open chat"
            >
              <ChatTextIcon className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <ChatPanel
            messages={messages}
            input={input}
            onInputChange={onInputChange}
            onSend={onSend}
            onStop={onStop}
            onRetry={onRetry}
            onContinue={onContinue}
            error={error}
            onClose={() => setIsOpen(false)}
            status={status}
            streamingContent={streamingContent}
            onOpenHistory={onOpenHistory}
            actionMode={actionMode}
            onActionModeChange={onActionModeChange}
            actionModeLoading={actionModeLoading}
            confirmations={confirmations}
            getConfirmation={getConfirmation}
            onApproveConfirmation={onApproveConfirmation}
            onDenyConfirmation={onDenyConfirmation}
            summaryMetadata={summaryMetadata}
          />
        )}
      </AnimatePresence>
    </>
  );
}
