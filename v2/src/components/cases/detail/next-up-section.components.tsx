"use client";

/**
 * NextUpSection Sub-Components
 *
 * Extracted components for stage progress, action cards, and deadline display.
 * Includes inline quick-edit functionality for action cards.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  FileText,
  Briefcase,
  FileCheck,
  Award,
} from "lucide-react";
import type { Id } from "@/../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  getUrgencyLevel,
  getUrgencyColors,
  type NextAction,
  type Deadline,
  type NextUpCaseData,
} from "./next-up-section.utils";
import { QuickEditFields, isEditableAction, isWaitingAction, isComplexAction } from "./quick-edit";
import { formatISODate } from "@/lib/utils/date";

// ============================================================================
// STAGE CONFIGURATION
// ============================================================================

export const STAGES = [
  { id: "pwd", label: "PWD", icon: FileText },
  { id: "recruitment", label: "Recruitment", icon: Briefcase },
  { id: "eta9089", label: "ETA 9089", icon: FileCheck },
  { id: "i140", label: "I-140", icon: Award },
] as const;

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

export const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
      staggerChildren: 0.05,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.12 },
  },
};

export const stageVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (index: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: 0.05 + index * 0.03,
      type: "spring" as const,
      stiffness: 600,
      damping: 25,
    },
  }),
};

// Static highlight variants (no pulsing animation)
export const highlightVariants = {
  highlight: {
    scale: 1,
    opacity: 1,
  },
};

export const glowVariants = {
  glow: {
    boxShadow: "0 0 0 4px rgba(46, 204, 64, 0.2)",
  },
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface StageProgressIndicatorProps {
  currentStage: number;
}

/**
 * Stage progress indicator showing current position in PERM process
 */
export function StageProgressIndicator({ currentStage }: StageProgressIndicatorProps) {
  return (
    <motion.div
      variants={itemVariants}
      className="flex items-center justify-between gap-1 sm:gap-2"
      role="progressbar"
      aria-valuenow={currentStage}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-label="Case progress through PERM stages"
    >
      {STAGES.map((stage, index) => {
        const isCompleted = index < currentStage;
        const isCurrent = index === currentStage;
        const isPending = index > currentStage;
        const Icon = stage.icon;

        return (
          <React.Fragment key={stage.id}>
            <motion.div
              custom={index}
              variants={stageVariants}
              className="flex flex-col items-center gap-1"
            >
              <motion.div
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary/20 border-primary text-primary",
                  isPending && "bg-muted border-border text-muted-foreground"
                )}
                animate={isCurrent ? "glow" : undefined}
                variants={glowVariants}
              >
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/20"
                    animate="highlight"
                    variants={highlightVariants}
                  />
                )}
                <Icon className="h-4 w-4 sm:h-5 sm:w-5 relative z-10" />
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </motion.div>
                )}
              </motion.div>
              <span
                className={cn(
                  "text-xs font-medium text-center",
                  isCurrent && "text-primary font-semibold",
                  isPending && "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </motion.div>

            {/* Connector line */}
            {index < STAGES.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.1 + index * 0.03, duration: 0.15 }}
                className={cn(
                  "flex-1 h-0.5 min-w-[16px] sm:min-w-[24px] origin-left",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </motion.div>
  );
}

// ============================================================================
// EXPAND/COLLAPSE ANIMATION VARIANTS
// ============================================================================

const expandVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    marginTop: 0,
  },
  expanded: {
    height: "auto",
    opacity: 1,
    marginTop: 12,
    transition: {
      height: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.15, delay: 0.05 },
    },
  },
};

const arrowVariants = {
  collapsed: { rotate: 0 },
  expanded: { rotate: 90 },
};

// ============================================================================
// NEXT ACTION CARD
// ============================================================================

export interface NextActionCardProps {
  /** The action to display */
  action: NextAction;
  /** Case ID for mutations (required for quick-edit) */
  caseId?: Id<"cases">;
  /** Full case data for validation constraints */
  caseData?: NextUpCaseData;
  /** Callback when action is completed via quick-edit */
  onActionComplete?: () => void;
}

/**
 * Next action card with inline quick-edit functionality.
 *
 * Features:
 * - Click to expand/collapse for editable actions
 * - Inline form fields with auto-save on blur
 * - Waiting actions show info only (no expand)
 * - Complex actions link to full edit form
 * - Smooth animations with Framer Motion
 */
export function NextActionCard({
  action,
  caseId,
  caseData,
  onActionComplete,
}: NextActionCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const urgencyColors = getUrgencyColors(action.urgency);

  // Determine if this action can be expanded
  const canExpand = caseId && caseData && (
    isEditableAction(action.action) ||
    isWaitingAction(action.action) ||
    isComplexAction(action.action)
  );

  // Handle card click
  const handleClick = useCallback(() => {
    if (!canExpand) return;
    setIsExpanded(prev => !prev);
  }, [canExpand]);

  // Handle navigation to full form
  const handleNavigateToForm = useCallback(() => {
    if (!caseId) return;
    router.push(`/cases/${caseId}/edit`);
  }, [caseId, router]);

  // Handle action complete (close card and let parent handle refresh)
  const handleComplete = useCallback(() => {
    setIsExpanded(false);
    onActionComplete?.();
  }, [onActionComplete]);

  return (
    <motion.div
      variants={itemVariants}
      layout
      transition={{ layout: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } }}
      className={cn(
        "rounded-lg border-2 border-border bg-card overflow-hidden",
        "shadow-hard-sm transition-shadow duration-100",
        canExpand && "cursor-pointer",
        isExpanded && "shadow-hard border-primary/50"
      )}
    >
      {/* Header - Always visible */}
      <motion.div
        onClick={handleClick}
        whileHover={canExpand && !isExpanded ? { scale: 1.01, y: -1 } : undefined}
        whileTap={canExpand ? { scale: 0.99 } : undefined}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className={cn("p-4", canExpand && "hover:bg-muted/30")}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg border-2",
              urgencyColors.bg,
              urgencyColors.text,
              urgencyColors.border
            )}
          >
            {action.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-heading font-semibold text-base">
                {action.action}
              </h4>
              {action.urgency !== "normal" && (
                <span
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium rounded border",
                    urgencyColors.bg,
                    urgencyColors.text,
                    urgencyColors.border
                  )}
                >
                  {action.urgency === "overdue"
                    ? "Overdue"
                    : action.urgency === "urgent"
                      ? "Urgent"
                      : "Soon"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {action.description}
            </p>
          </div>

          {/* Expand/Collapse indicator */}
          {canExpand ? (
            <motion.div
              variants={arrowVariants}
              animate={isExpanded ? "expanded" : "collapsed"}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          ) : (
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </motion.div>

      {/* Expandable Content */}
      <AnimatePresence initial={false}>
        {isExpanded && canExpand && caseId && caseData && (
          <motion.div
            key="content"
            variants={expandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              <QuickEditFields
                actionName={action.action}
                caseId={caseId}
                caseData={caseData}
                onComplete={handleComplete}
                onNavigateToForm={handleNavigateToForm}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface DeadlineCountdownProps {
  deadline: Deadline;
}

/**
 * Deadline countdown display
 */
export function DeadlineCountdown({ deadline }: DeadlineCountdownProps) {
  const urgency = getUrgencyLevel(deadline.daysUntil);
  const urgencyColors = getUrgencyColors(urgency);
  const _isUrgent = urgency === "urgent" || urgency === "overdue"; // Reserved for future pulse animation

  // Format date for display (using ISO parser to avoid timezone issues)
  const formattedDate = formatISODate(deadline.date);

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "p-4 rounded-lg border-2",
        urgencyColors.border,
        urgencyColors.bg
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className={cn("h-5 w-5", urgencyColors.text)} />
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              {deadline.label}
            </div>
            <div className="text-xs text-muted-foreground">{formattedDate}</div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn("text-2xl font-heading font-bold", urgencyColors.text)}
          >
            {deadline.daysUntil < 0 ? (
              <span>-{Math.abs(deadline.daysUntil)}</span>
            ) : deadline.daysUntil === 0 ? (
              <span>Today</span>
            ) : (
              deadline.daysUntil
            )}
          </div>
          {deadline.daysUntil !== 0 && (
            <div className={cn("text-xs", urgencyColors.text)}>
              {deadline.daysUntil < 0 ? "days overdue" : "days left"}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
