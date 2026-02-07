'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { type ActionMode } from './ActionModeToggle';
import { springConfig } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type { ToolConfirmationState } from '@/lib/ai/tool-confirmation-types';

interface ChatWidgetProps {
  messages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;
  input?: string;
  onInputChange?: (value: string) => void;
  onSend?: () => void;
  onStop?: () => void;
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
}

export function ChatWidget({
  messages = [],
  input = '',
  onInputChange = () => {},
  onSend = () => {},
  onStop,
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
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={springConfig}
            className="fixed bottom-20 right-4 z-[60]"
            data-tour="chat-bubble"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className={cn(
                'h-14 w-14 rounded-none p-0',
                'bg-primary hover:bg-primary/90',
                'border-2 border-border shadow-hard',
                'transition-transform duration-150',
                'hover:-translate-y-1 active:translate-y-0'
              )}
              aria-label="Open chat"
            >
              <MessageSquare className="h-6 w-6" />
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
          />
        )}
      </AnimatePresence>
    </>
  );
}
