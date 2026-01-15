/**
 * ActionChainProgress Component
 *
 * Visual progress display for multi-step AI tool execution chains.
 * Shows a vertical timeline of actions with status indicators, approval buttons,
 * and collapsible completed steps.
 *
 * Features:
 * - Animated step cards with status icons (pending, executing, done, error, waiting_approval)
 * - Connector lines between steps showing progress
 * - Individual and bulk approval/deny buttons for permission requests
 * - Collapsible completed steps for long chains
 * - Spring animations using motion.dev
 *
 * @module components/chat/ActionChainProgress
 */
'use client';

import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, Check, X, Clock, Lock, ChevronDown, ChevronUp,
  RefreshCw, Archive, Trash2, Calendar, Search, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { springConfig, STAGGER_DELAY } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

// Step state interface
interface ActionStep {
  id: string;
  toolName: string;
  status: 'pending' | 'executing' | 'done' | 'error' | 'waiting_approval';
  arguments?: Record<string, unknown>;
  result?: unknown;
  duration?: number;
  error?: string;
  preview?: {
    count?: number;
    description?: string;
  };
}

interface ActionChainProgressProps {
  steps: ActionStep[];
  onApprove?: (stepId: string) => void;
  onDeny?: (stepId: string) => void;
  onApproveAll?: () => void;
  onDenyAll?: () => void;
}

// Tool icon mapping
const TOOL_ICONS: Record<string, typeof Search> = {
  queryCases: Search,
  bulkUpdateStatus: RefreshCw,
  bulkArchiveCases: Archive,
  bulkDeleteCases: Trash2,
  bulkCalendarSync: Calendar,
  // Add more as needed
};

// Tool display names
const TOOL_NAMES: Record<string, string> = {
  queryCases: 'Query Cases',
  bulkUpdateStatus: 'Bulk Update Status',
  bulkArchiveCases: 'Bulk Archive Cases',
  bulkDeleteCases: 'Bulk Delete Cases',
  bulkCalendarSync: 'Bulk Calendar Sync',
};

// Status icon component with animations
function StatusIcon({ status }: { status: ActionStep['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <Clock className="h-4 w-4 text-muted-foreground" />
      );
    case 'executing':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-4 w-4 text-primary" />
        </motion.div>
      );
    case 'done':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <Check className="h-4 w-4 text-green-600" />
        </motion.div>
      );
    case 'error':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <X className="h-4 w-4 text-red-600" />
        </motion.div>
      );
    case 'waiting_approval':
      return (
        <Lock className="h-4 w-4 text-amber-600" />
      );
    default:
      return null;
  }
}

// Connector line between steps
function ConnectorLine({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="flex justify-center py-1">
      <motion.div
        className={cn(
          'w-0.5 h-6',
          isComplete ? 'bg-green-500' : 'bg-border'
        )}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        style={{ originY: 0 }}
      />
    </div>
  );
}

// Individual step card
function StepCard({
  step,
  index,
  onApprove,
  onDeny
}: {
  step: ActionStep;
  index: number;
  onApprove?: () => void;
  onDeny?: () => void;
}) {
  const Icon = TOOL_ICONS[step.toolName] || Database;
  const displayName = TOOL_NAMES[step.toolName] || step.toolName;

  const borderColor = {
    pending: 'border-l-muted-foreground',
    executing: 'border-l-primary',
    done: 'border-l-green-500',
    error: 'border-l-red-500',
    waiting_approval: 'border-l-amber-500',
  }[step.status];

  const bgColor = step.status === 'error'
    ? 'bg-red-50'
    : step.status === 'waiting_approval'
    ? 'bg-amber-50'
    : 'bg-card';

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={springConfig}
      className={cn(
        'border-2 border-border border-l-4 shadow-hard-sm',
        borderColor,
        bgColor
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {index + 1}
          </span>
          <Icon className="h-4 w-4" />
          <span className="font-medium text-sm">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          {step.duration && (
            <span className="text-xs text-muted-foreground font-mono">
              {step.duration}ms
            </span>
          )}
          <StatusIcon status={step.status} />
        </div>
      </div>

      {/* Content - show preview or result */}
      {(step.preview || step.result || step.error) && (
        <div className="px-3 py-2">
          {step.preview && (
            <p className="text-sm text-muted-foreground">
              {step.preview.description || `${step.preview.count} items`}
            </p>
          )}
          {step.result !== undefined && (
            <p className="text-sm text-muted-foreground">
              {typeof step.result === 'object' && step.result !== null
                ? ((step.result as { message?: string })?.message || JSON.stringify(step.result))
                : String(step.result)}
            </p>
          )}
          {step.error && (
            <motion.p
              className="text-sm text-red-600"
              initial={{ x: 0 }}
              animate={{ x: [0, -4, 4, -4, 4, 0] }}
              transition={{ duration: 0.4 }}
            >
              {step.error}
            </motion.p>
          )}
        </div>
      )}

      {/* Approval buttons for waiting_approval status */}
      {step.status === 'waiting_approval' && onApprove && onDeny && (
        <div className="flex gap-2 px-3 py-2 border-t border-border bg-muted/50">
          <Button
            size="sm"
            variant="default"
            onClick={onApprove}
            className="flex-1"
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDeny}
            className="flex-1"
          >
            <X className="h-3 w-3 mr-1" />
            Deny
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// Main component
export function ActionChainProgress({
  steps,
  onApprove,
  onDeny,
  onApproveAll,
  onDenyAll,
}: ActionChainProgressProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const completedSteps = steps.filter(s => s.status === 'done');
  const pendingApproval = steps.filter(s => s.status === 'waiting_approval');
  const showCollapse = completedSteps.length > 3;

  // Show bulk approval buttons if multiple steps waiting
  const showBulkApproval = pendingApproval.length > 1 && onApproveAll && onDenyAll;

  return (
    <motion.div
      className="space-y-0"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: STAGGER_DELAY - 0.02 }, // 0.08 as per plan
        },
      }}
    >
      {/* Bulk approval header */}
      {showBulkApproval && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-3 py-2 mb-2 border-2 border-amber-500 bg-amber-50 shadow-hard-sm"
        >
          <span className="text-sm font-medium">
            {pendingApproval.length} actions waiting for approval
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={onApproveAll}>
              Approve All
            </Button>
            <Button size="sm" variant="outline" onClick={onDenyAll}>
              Deny All
            </Button>
          </div>
        </motion.div>
      )}

      {/* Collapse toggle for many completed steps */}
      {showCollapse && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="h-3 w-3" />
              Show {completedSteps.length} completed steps
            </>
          ) : (
            <>
              <ChevronUp className="h-3 w-3" />
              Collapse completed steps
            </>
          )}
        </button>
      )}

      {/* Steps */}
      <AnimatePresence mode="popLayout">
        {steps.map((step, index) => {
          // Skip collapsed completed steps
          if (isCollapsed && step.status === 'done' && index < steps.length - 3) {
            return null;
          }

          const prevStep = index > 0 ? steps[index - 1] : null;
          const showConnector = index > 0 && !(isCollapsed && prevStep?.status === 'done');

          return (
            <motion.div key={step.id} layout>
              {showConnector && (
                <ConnectorLine isComplete={prevStep?.status === 'done'} />
              )}
              <StepCard
                step={step}
                index={index}
                onApprove={onApprove ? () => onApprove(step.id) : undefined}
                onDeny={onDeny ? () => onDeny(step.id) : undefined}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

export type { ActionStep, ActionChainProgressProps };
