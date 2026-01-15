'use client';

/**
 * ToolCallCard Component
 *
 * Displays tool invocations in chat with beautiful neobrutalist styling.
 * Shows tool name, icon, input summary, and result summary.
 *
 * Design: Neobrutalist (PERM Tracker v2)
 * - 2px black borders
 * - Hard shadows (2px 2px 0px)
 * - JetBrains Mono for technical text
 * - Motion animations (spring physics)
 *
 * States:
 * - pending: Shimmer effect + spinner
 * - success: Green accent + checkmark
 * - error: Red accent + X icon
 *
 * Permission Flow:
 * - If tool result contains `requiresPermission: true`, renders InChatConfirmationCard
 * - User can approve/deny; on approve, executes tool via /api/chat/execute-tool
 */

import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springConfig } from '@/lib/animations';
import {
  getToolColor,
  getToolDisplayName,
  getToolLoadingMessage,
  TOOL_ICONS,
} from './tool-icons';
import { Search } from 'lucide-react';
import {
  summarizeToolResult,
  summarizeToolArgs,
  isToolDenied,
  type ToolCall,
} from './tool-result-summary';
import {
  extractPermissionRequest,
  getConfirmationDuration,
  getConfirmationError,
  type PermissionRequestResult,
  type ConfirmationStatus,
  type ToolConfirmationState,
} from '@/lib/ai/tool-confirmation-types';
import { useToolConfirmations } from '@/hooks/useToolConfirmations';
import { InChatConfirmationCard } from './InChatConfirmationCard';

interface ToolCallCardProps {
  tool: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
  executedAt?: number;
  /** Start time for duration calculation */
  startTime?: number;
}

/**
 * Renders the appropriate icon for a tool
 * Declared outside component to avoid re-creation during render
 */
function ToolIcon({ tool, className }: { tool: string; className?: string }) {
  const IconComponent = TOOL_ICONS[tool] ?? Search;
  return <IconComponent className={className} />;
}

export function ToolCallCard({
  tool,
  arguments: args,
  result,
  status,
  executedAt,
  startTime,
}: ToolCallCardProps) {
  const toolColor = getToolColor(tool);
  const displayName = getToolDisplayName(tool);
  const loadingMessage = getToolLoadingMessage(tool);

  // Get summarized data
  const argSummary = summarizeToolArgs(tool, args);
  const resultSummary = status === 'success' ? summarizeToolResult(tool, result) : '';

  // Check if this is a permission request (returns true even when status is 'pending')
  const permissionRequest = result ? extractPermissionRequest(result) : null;
  const isAwaitingConfirmation = permissionRequest !== null;

  // Check if this tool was denied by the user (persisted as 'error' status with denied marker)
  const wasDenied = status === 'error' && isToolDenied(result);

  // Calculate duration if we have timestamps
  const duration =
    startTime && executedAt ? `${executedAt - startTime}ms` : executedAt ? '' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springConfig}
      className={cn(
        // Base styles - neobrutalist
        'relative overflow-hidden',
        'border-2 border-border rounded-none',
        'bg-card shadow-hard-sm',
        // Status-specific border colors
        status === 'success' && 'border-l-green-500 border-l-4',
        status === 'error' && !wasDenied && 'border-l-red-500 border-l-4',
        wasDenied && 'border-l-muted-foreground border-l-4 opacity-60',
        status === 'pending' && isAwaitingConfirmation && 'border-l-amber-500 border-l-4',
        status === 'pending' && !isAwaitingConfirmation && 'border-l-primary border-l-4'
      )}
    >
      {/* Shimmer overlay for pending state */}
      {status === 'pending' && (
        <div className="absolute inset-0 pointer-events-none animate-shimmer" />
      )}

      <div className="p-3 space-y-2">
        {/* Header: Icon, Name, Status, Duration */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Tool Icon */}
            <div className={cn('flex-shrink-0', toolColor)}>
              <ToolIcon tool={tool} className="h-4 w-4" />
            </div>

            {/* Tool Name */}
            <span className="font-mono text-xs font-medium truncate">
              {displayName}
            </span>
          </div>

          {/* Status indicator + Duration */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Duration badge */}
            {duration && status === 'success' && (
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                {duration}
              </span>
            )}

            {/* Status icon */}
            <StatusIcon status={status} isDenied={wasDenied} />
          </div>
        </div>

        {/* Arguments summary (inline) */}
        {argSummary.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {argSummary.map(({ key, value }) => (
              <span key={key} className="font-mono text-[11px]">
                <span className="text-muted-foreground">{key}:</span>{' '}
                <span className="text-foreground">{value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Result summary or loading message */}
        <div className="flex items-center gap-1.5">
          {status === 'pending' && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "text-xs italic",
                isAwaitingConfirmation
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {isAwaitingConfirmation ? 'Awaiting confirmation...' : loadingMessage}
            </motion.span>
          )}

          {status === 'success' && resultSummary && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, ...springConfig }}
              className="text-xs font-medium text-green-700 dark:text-green-400"
            >
              {resultSummary}
            </motion.span>
          )}

          {status === 'error' && !wasDenied && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, ...springConfig }}
              className="text-xs font-medium text-red-700 dark:text-red-400"
            >
              {result ? summarizeToolResult(tool, result) || 'Error occurred' : 'Error occurred'}
            </motion.span>
          )}

          {wasDenied && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, ...springConfig }}
              className="text-xs text-muted-foreground"
            >
              Action denied by user
            </motion.span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Status icon component with animations
 */
function StatusIcon({
  status,
  isDenied = false,
}: {
  status: 'pending' | 'success' | 'error';
  isDenied?: boolean;
}) {
  // Spinning loader for pending state
  if (status === 'pending') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="text-primary"
      >
        <Loader2 className="h-3.5 w-3.5" />
      </motion.div>
    );
  }

  // Spring animation for result icons
  const springTransition = { type: 'spring' as const, stiffness: 500, damping: 25 };
  const Icon = status === 'success' ? CheckCircle : XCircle;
  const className = status === 'success'
    ? 'text-green-600 dark:text-green-400'
    : isDenied
      ? 'text-muted-foreground'
      : 'text-red-600 dark:text-red-400';

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={springTransition}
      className={className}
    >
      <Icon className="h-3.5 w-3.5" />
    </motion.div>
  );
}

// ============================================================================
// Tool Call with Confirmation Support
// ============================================================================

interface ToolCallWithConfirmationProps {
  toolCall: ToolCall;
  permissionRequest: PermissionRequestResult | null;
  confirmationStatus: ConfirmationStatus | null;
  onApprove: () => void;
  onDeny: () => void;
  confirmationDuration?: number;
  confirmationError?: string;
}

/**
 * Renders either InChatConfirmationCard (for permission requests) or ToolCallCard
 */
function ToolCallWithConfirmation({
  toolCall,
  permissionRequest,
  confirmationStatus,
  onApprove,
  onDeny,
  confirmationDuration,
  confirmationError,
}: ToolCallWithConfirmationProps) {
  // If this is a permission request, render the confirmation card
  if (permissionRequest && confirmationStatus) {
    return (
      <InChatConfirmationCard
        toolName={permissionRequest.toolName}
        toolCallId={permissionRequest.toolCallId}
        arguments={permissionRequest.arguments}
        description={permissionRequest.description}
        isDestructive={permissionRequest.permissionType === 'destructive'}
        status={confirmationStatus}
        onApprove={onApprove}
        onDeny={onDeny}
        duration={confirmationDuration}
        error={confirmationError}
      />
    );
  }

  // Otherwise, render the standard tool call card
  return (
    <ToolCallCard
      tool={toolCall.tool}
      arguments={toolCall.arguments}
      result={toolCall.result}
      status={toolCall.status}
      executedAt={toolCall.executedAt}
    />
  );
}

// ============================================================================
// Tool Call List (with confirmation system)
// ============================================================================

interface ToolCallListProps {
  toolCalls: ToolCall[];
  /** Get confirmation state for a tool call ID - from orchestrator */
  getConfirmation?: (toolCallId: string) => ToolConfirmationState | undefined;
  /** Approve a pending confirmation - from orchestrator */
  onApproveConfirmation?: (toolCallId: string) => Promise<void>;
  /** Deny a pending confirmation - from orchestrator */
  onDenyConfirmation?: (toolCallId: string) => void;
}

/**
 * Container for multiple tool calls with stagger animation.
 * Automatically detects permission requests and renders InChatConfirmationCard.
 *
 * When confirmation handlers are passed from the orchestrator, uses those for
 * centralized state management. Falls back to local useToolConfirmations if
 * no handlers are provided (backwards compatibility).
 */
export function ToolCallList({
  toolCalls,
  getConfirmation: externalGetConfirmation,
  onApproveConfirmation,
  onDenyConfirmation,
}: ToolCallListProps) {
  // Fallback to local confirmation state if no external handlers provided
  // This maintains backwards compatibility for standalone usage
  const localConfirmations = useToolConfirmations();

  // Use external handlers if provided, otherwise fall back to local
  const getConfirmation = externalGetConfirmation ?? localConfirmations.getConfirmation;
  const approve = onApproveConfirmation ?? localConfirmations.approve;
  const deny = onDenyConfirmation ?? localConfirmations.deny;
  const registerConfirmation = localConfirmations.registerConfirmation;

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.08,
          },
        },
      }}
      className="space-y-2 mt-3"
    >
      {toolCalls.map((tc, index) => {
        // Generate a stable key for this tool call
        const toolCallKey = `${tc.tool}-${index}`;

        // Check if this tool result contains a permission request
        const permissionRequest = tc.result
          ? extractPermissionRequest(tc.result)
          : null;

        // If it's a permission request, ensure it's registered (for local fallback)
        if (permissionRequest && tc.result && !externalGetConfirmation) {
          const toolCallId = permissionRequest.toolCallId || toolCallKey;
          registerConfirmation(toolCallId, tc.result);
        }

        // Get confirmation state (if any)
        const toolCallId = permissionRequest?.toolCallId || toolCallKey;
        const confirmation = getConfirmation(toolCallId);

        // Determine the confirmation status to display
        // If no confirmation state exists but we have a permission request, default to 'pending'
        // IMPORTANT: Also check tc.status - if the DB says 'success' or 'error', the tool already
        // executed and we should NOT show the pending confirmation (fixes page refresh issue)
        const confirmationStatus: ConfirmationStatus | null = confirmation
          ? confirmation.status
          : permissionRequest && tc.status === 'pending'
            ? 'pending'
            : null;

        return (
          <motion.div
            key={toolCallKey}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={springConfig}
          >
            <ToolCallWithConfirmation
              toolCall={tc}
              permissionRequest={permissionRequest}
              confirmationStatus={confirmationStatus}
              onApprove={() => approve(toolCallId)}
              onDeny={() => deny(toolCallId)}
              confirmationDuration={getConfirmationDuration(confirmation)}
              confirmationError={getConfirmationError(confirmation)}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export type { ToolCall };
