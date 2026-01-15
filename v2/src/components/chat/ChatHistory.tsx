/**
 * ChatHistory Component
 *
 * Slide-out panel showing conversation list.
 * Allows switching between conversations and creating new ones.
 *
 * @module components/chat/ChatHistory
 */

'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { X, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { springConfig } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuthContext } from '@/lib/contexts/AuthContext';

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: Id<'conversations'> | null;
  onSelectConversation: (id: Id<'conversations'>) => void;
  onNewConversation: () => void;
}

export function ChatHistory({
  isOpen,
  onClose,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ChatHistoryProps) {
  const { isSigningOut } = useAuthContext();

  // Skip query during sign-out to prevent "not authenticated" errors
  const conversations = useQuery(
    api.conversations.list,
    isSigningOut ? 'skip' : {}
  );
  const deleteConversation = useMutation(api.conversations.deleteConversation);
  const deleteAllConversations = useMutation(api.conversations.deleteAll);

  const handleDeleteAll = async () => {
    if (
      conversations &&
      conversations.length > 0 &&
      confirm(
        `Delete all ${conversations.length} conversation${conversations.length > 1 ? 's' : ''} permanently? This cannot be undone.`
      )
    ) {
      await deleteAllConversations({});
      onNewConversation();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-[60]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={springConfig}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-[61]',
              'w-80 max-w-[85vw]',
              'bg-background border-l-2 border-border shadow-hard-lg',
              'flex flex-col'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-border">
              <h2 className="font-heading font-semibold">Chat History</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* New Conversation Button */}
            <div className="p-4 border-b-2 border-border">
              <Button
                onClick={() => {
                  onNewConversation();
                  onClose();
                }}
                className="w-full shadow-hard-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!conversations || conversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv._id}
                    className={cn(
                      'group relative p-3 border-2 cursor-pointer',
                      'transition-all duration-150',
                      conv._id === currentConversationId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                    onClick={() => {
                      onSelectConversation(conv._id);
                      onClose();
                    }}
                  >
                    <div className="pr-16">
                      <p className="font-medium text-sm truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(conv.updatedAt, { addSuffix: true })}
                      </p>
                    </div>

                    {/* Delete Action */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this conversation permanently?')) {
                            deleteConversation({ id: conv._id });
                          }
                        }}
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Delete All Footer */}
            {conversations && conversations.length > 0 && (
              <div className="p-4 border-t-2 border-border">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDeleteAll}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Conversations
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
