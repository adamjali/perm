'use client';

/**
 * InChatConfirmationCard Component
 *
 * Permission confirmation card that appears inline in chat flow for action tools.
 * Users must approve/deny tool executions before they run.
 *
 * Design: Neobrutalist (PERM Tracker v2)
 * - 2px black borders
 * - Hard shadows (4px 4px 0px)
 * - JetBrains Mono for technical text
 * - Forest Green accent (#228B22)
 * - Motion animations (spring physics)
 *
 * States:
 * - pending: Shimmer effect, Forest Green border
 * - approved: Green left border, checkmark icon
 * - denied: Gray styling, X icon
 * - executing: Spinner, pulsing border
 * - done: Green styling, duration badge
 * - error: Red styling, error message
 */

import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { springConfig } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import {
  getToolColor,
  getToolDisplayName,
  TOOL_ICONS,
} from './tool-icons';
import { Search } from 'lucide-react';
import type { ConfirmationStatus } from '@/lib/ai/tool-confirmation-types';

// Re-export for backwards compatibility
export type { ConfirmationStatus };

// ============================================================================
// Types
// ============================================================================

export interface InChatConfirmationCardProps {
  /** Tool identifier */
  toolName: string;
  /** Unique tool call ID */
  toolCallId: string;
  /** Tool arguments as key-value pairs */
  arguments: Record<string, unknown>;
  /** Human-readable description of what the tool will do */
  description: string;
  /** Whether this is a destructive action (delete, etc.) */
  isDestructive?: boolean;
  /** Current status of the confirmation/execution */
  status: ConfirmationStatus;
  /** Callback when user approves the action */
  onApprove: () => void;
  /** Callback when user denies the action */
  onDeny: () => void;
  /** Execution duration in ms (shown after done) */
  duration?: number;
  /** Error message (shown when status is error) */
  error?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Renders the appropriate icon for a tool
 */
function ToolIcon({ tool, className }: { tool: string; className?: string }) {
  const IconComponent = TOOL_ICONS[tool] ?? Search;
  return <IconComponent className={className} />;
}

/**
 * Status icon component with animations
 */
function StatusIcon({ status }: { status: ConfirmationStatus }) {
  // No icon for pending - waiting for user action
  if (status === 'pending') return null;

  // Spinning loader for executing state
  if (status === 'executing') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="text-primary"
      >
        <Loader2 className="h-4 w-4" />
      </motion.div>
    );
  }

  // Spring animation config for result icons
  const springTransition = { type: 'spring' as const, stiffness: 500, damping: 25 };

  // Determine icon and color based on status
  const iconConfig = {
    approved: { Icon: CheckCircle, className: 'text-green-600 dark:text-green-400' },
    done: { Icon: CheckCircle, className: 'text-green-600 dark:text-green-400' },
    denied: { Icon: XCircle, className: 'text-muted-foreground' },
    error: { Icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  }[status];

  if (!iconConfig) return null;

  const { Icon, className } = iconConfig;
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={springTransition}
      className={className}
    >
      <Icon className="h-4 w-4" />
    </motion.div>
  );
}

/**
 * Format argument value for display
 */
function formatArgValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value.length > 30 ? `${value.slice(0, 30)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return '{...}';
  return String(value);
}

// ============================================================================
// Main Component
// ============================================================================

export function InChatConfirmationCard({
  toolName,
  toolCallId: _toolCallId,
  arguments: args,
  description,
  isDestructive = false,
  status,
  onApprove,
  onDeny,
  duration,
  error,
}: InChatConfirmationCardProps) {
  const toolColor = getToolColor(toolName);
  const displayName = getToolDisplayName(toolName);
  const argEntries = Object.entries(args).slice(0, 4); // Limit displayed args

  // Show buttons only in pending state
  const showButtons = status === 'pending';

  // Border styles by status
  const BORDER_STYLES: Record<ConfirmationStatus, string> = {
    pending: 'border-l-primary border-l-4',
    approved: 'border-l-green-500 border-l-4',
    done: 'border-l-green-500 border-l-4',
    executing: 'border-l-primary border-l-4 animate-pulse',
    denied: 'border-l-muted-foreground border-l-4 opacity-60',
    error: 'border-l-red-500 border-l-4',
  };

  // Destructive pending state overrides default pending style
  const borderStyles = isDestructive && status === 'pending'
    ? 'border-l-red-500 border-l-4'
    : BORDER_STYLES[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={springConfig}
      className={cn(
        // Base styles - neobrutalist
        'relative overflow-hidden',
        'border-2 border-border rounded-none',
        'bg-card shadow-hard',
        // Status-specific border
        borderStyles
      )}
    >
      {/* Shimmer overlay for pending state */}
      {status === 'pending' && (
        <div className="absolute inset-0 pointer-events-none animate-shimmer" />
      )}

      <div className="p-4 space-y-3">
        {/* Header: Icon, Name, Status, Duration */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Tool Icon */}
            <div
              className={cn(
                'flex-shrink-0 p-1.5 border-2 border-border',
                isDestructive && status === 'pending'
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                  : toolColor
              )}
            >
              <ToolIcon tool={toolName} className="h-4 w-4" />
            </div>

            {/* Tool Name */}
            <span className="font-heading font-bold text-sm truncate">
              {displayName}
            </span>

            {/* Destructive warning icon */}
            {isDestructive && status === 'pending' && (
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
          </div>

          {/* Status indicator + Duration */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Duration badge */}
            {duration !== undefined && status === 'done' && (
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 border border-border">
                {duration}ms
              </span>
            )}

            {/* Status icon */}
            <StatusIcon status={status} />
          </div>
        </div>

        {/* Arguments (mono font) */}
        {argEntries.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 bg-muted/50 border border-border">
            {argEntries.map(([key, value]) => (
              <span key={key} className="font-mono text-[11px]">
                <span className="text-muted-foreground">{key}:</span>{' '}
                <span className="text-foreground">{formatArgValue(value)}</span>
              </span>
            ))}
            {Object.keys(args).length > 4 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                +{Object.keys(args).length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-foreground leading-relaxed">
          &ldquo;{description}&rdquo;
        </p>

        {/* Error message */}
        <AnimatePresence>
          {status === 'error' && error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status messages for non-pending states */}
        <AnimatePresence>
          {status === 'executing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground italic"
            >
              Executing action...
            </motion.div>
          )}
          {status === 'approved' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-green-700 dark:text-green-400 font-medium"
            >
              Action approved
            </motion.div>
          )}
          {status === 'denied' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground"
            >
              Action denied by user
            </motion.div>
          )}
          {status === 'done' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-green-700 dark:text-green-400 font-medium"
            >
              Action completed successfully
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <AnimatePresence>
          {showButtons && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: 0.1, ...springConfig }}
              className="flex items-center justify-end gap-2 pt-2 border-t border-border"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onDeny}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                variant={isDestructive ? 'destructive' : 'default'}
                size="sm"
                onClick={onApprove}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status transition animation - scale pulse */}
      {(status === 'approved' || status === 'done') && (
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
