/**
 * ChatWidgetConnected Component
 *
 * Fully connected chat widget with:
 * - AI SDK streaming
 * - Convex persistence
 * - History access
 * - Mobile responsiveness
 * - Action mode toggle (off/confirm/auto)
 * - Tool orchestration (navigation + confirmations)
 *
 * @module components/chat/ChatWidgetConnected
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ChatWidget } from './ChatWidget';
import { ChatHistory } from './ChatHistory';
import { type ActionMode } from './ActionModeToggle';
import { useChatWithPersistence } from '@/hooks/useChatWithPersistence';
import { useToolOrchestrator } from '@/hooks/useToolOrchestrator';
import { useAuthContext } from '@/lib/contexts/AuthContext';
import { usePageContext } from '@/lib/ai/page-context';

export function ChatWidgetConnected() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [actionModeLoading, setActionModeLoading] = useState(false);
  const { isSigningOut } = useAuthContext();

  // Get current page context for AI awareness
  const pageContext = usePageContext();

  // Get most recent conversation to resume
  // Skip query during sign-out to prevent "not authenticated" errors
  const recentConversation = useQuery(
    api.conversationMessages.getMostRecent,
    isSigningOut ? 'skip' : {}
  );

  // Get current action mode from user profile
  const actionMode = useQuery(
    api.users.getActionMode,
    isSigningOut ? 'skip' : {}
  ) as ActionMode | undefined;

  // Mutation to update action mode
  const updateActionMode = useMutation(api.users.updateActionMode);

  // Mutation to persist tool execution results (for page refresh resilience)
  const updateToolCallResult = useMutation(api.conversationMessages.updateToolCallResult);

  // Handle action mode change with optimistic update
  const handleActionModeChange = useCallback(
    async (newMode: ActionMode) => {
      setActionModeLoading(true);
      try {
        await updateActionMode({ actionMode: newMode });
      } finally {
        setActionModeLoading(false);
      }
    },
    [updateActionMode]
  );

  const {
    conversationId,
    messages,
    input,
    status,
    error: _error,
    streamingContent,
    setInput,
    handleSend,
    startNewConversation,
    selectConversation,
    sendMessage,
    stop,
  } = useChatWithPersistence({
    conversationId: recentConversation?._id,
    actionMode: actionMode,
    pageContext: pageContext,
  });

  // Callback to persist tool execution results to Convex
  // This ensures confirmations don't reappear after page refresh
  const handlePersistToolResult = useCallback(
    async (
      toolCallId: string,
      result: string,
      status: 'success' | 'error'
    ): Promise<void> => {
      // Need a conversationId to update the message
      if (!conversationId) {
        console.warn('[ChatWidget] Cannot persist tool result: no conversationId');
        return;
      }

      console.log('[ChatWidget] Persisting tool result:', { toolCallId, status, conversationId });

      try {
        const success = await updateToolCallResult({
          conversationId,
          toolCallId,
          result,
          status,
        });

        if (success) {
          console.log('[ChatWidget] Tool result persisted successfully');
        } else {
          console.warn('[ChatWidget] Tool result persistence returned false - tool call not found in DB. This may be a timing issue.');
        }
      } catch (err) {
        // Log but don't throw - persistence is best-effort
        console.error('[ChatWidget] Failed to persist tool result:', err);
      }
    },
    [conversationId, updateToolCallResult]
  );

  // Adapter for sendMessage to match orchestrator's expected signature
  // AI SDK's sendMessage has a complex signature; orchestrator expects simple { text? }
  const sendContinuationMessage = useCallback(
    (options?: { text?: string }) => {
      if (options?.text) {
        sendMessage({ text: options.text });
      }
    },
    [sendMessage]
  );

  // Memoize orchestrator messages to prevent unnecessary re-renders
  const orchestratorMessages = useMemo(() => messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    isStreaming: m.isStreaming,
    toolCalls: m.toolCalls,
  })), [messages]);

  // Tool orchestrator - handles navigation and confirmations
  const {
    confirmations,
    getConfirmation,
    approveConfirmation,
    denyConfirmation,
    clearConfirmations,
  } = useToolOrchestrator({
    messages: orchestratorMessages,
    status,
    sendMessage: sendContinuationMessage,
    onPersistResult: handlePersistToolResult,
  });

  // Clear confirmations when conversation changes
  useEffect(() => {
    clearConfirmations();
  }, [conversationId, clearConfirmations]);

  // Initialize with most recent conversation when it loads
  useEffect(() => {
    if (recentConversation && !isInitialized && !conversationId) {
      selectConversation(recentConversation._id);
      setIsInitialized(true);
    }
  }, [recentConversation, isInitialized, conversationId, selectConversation]);

  return (
    <>
      <ChatWidget
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onStop={stop}
        status={status}
        streamingContent={streamingContent}
        onOpenHistory={() => setIsHistoryOpen(true)}
        actionMode={actionMode ?? 'confirm'}
        onActionModeChange={handleActionModeChange}
        actionModeLoading={actionModeLoading || actionMode === undefined}
        // Tool confirmation handlers from orchestrator
        confirmations={confirmations}
        getConfirmation={getConfirmation}
        onApproveConfirmation={approveConfirmation}
        onDenyConfirmation={denyConfirmation}
      />

      <ChatHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentConversationId={conversationId}
        onSelectConversation={selectConversation}
        onNewConversation={startNewConversation}
      />
    </>
  );
}
