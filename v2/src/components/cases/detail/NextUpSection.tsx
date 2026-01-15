"use client";

/**
 * NextUpSection Component
 *
 * Displays the next action and upcoming deadline for a case with polished animations.
 *
 * Features:
 * - Visual stage progress indicator (PWD -> Recruitment -> ETA 9089 -> I-140)
 * - Smart next action calculation based on case state
 * - Urgency-based color coding for deadlines
 * - Animated elements using Framer Motion
 * - Responsive design with neobrutalist styling
 *
 * @example
 * ```tsx
 * <NextUpSection caseData={caseData} />
 * ```
 */

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// Import extracted utilities
import {
  getStageIndex,
  calculateNextAction,
  calculateNextDeadline,
  type NextUpCaseData,
} from "./next-up-section.utils";

// Import extracted components
import {
  containerVariants,
  itemVariants,
  StageProgressIndicator,
  NextActionCard,
  DeadlineCountdown,
} from "./next-up-section.components";

// ============================================================================
// TYPES
// ============================================================================

import type { Id } from "@/../convex/_generated/dataModel";

export interface NextUpSectionProps {
  /**
   * Case data containing status and date information
   */
  caseData: NextUpCaseData;

  /**
   * Case ID for quick-edit mutations (optional for backwards compatibility)
   */
  caseId?: Id<"cases">;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// Re-export types for consumers
export type { NextUpCaseData, NextAction, Deadline } from "./next-up-section.utils";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NextUpSection({ caseData, caseId, className }: NextUpSectionProps) {
  const currentStage = getStageIndex(caseData.caseStatus);
  const nextAction = calculateNextAction(caseData);
  const nextDeadline = calculateNextDeadline(caseData);

  // Don't render if case is closed and complete
  if (caseData.caseStatus === "closed") {
    return null;
  }

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "rounded-lg border-2 border-border bg-card p-4 sm:p-6 shadow-hard",
        className
      )}
      aria-labelledby="next-up-heading"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <h2
          id="next-up-heading"
          className="font-heading text-lg sm:text-xl font-bold"
        >
          What&apos;s Next
        </h2>
      </motion.div>

      {/* Stage Progress */}
      <div className="mb-6">
        <StageProgressIndicator currentStage={currentStage} />
      </div>

      {/* Content Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Next Action */}
        <AnimatePresence mode="wait">
          {nextAction && (
            <div className="sm:col-span-1">
              <NextActionCard
                action={nextAction}
                caseId={caseId}
                caseData={caseData}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Deadline Countdown */}
        <AnimatePresence mode="wait">
          {nextDeadline && (
            <div className="sm:col-span-1">
              <DeadlineCountdown deadline={nextDeadline} />
            </div>
          )}
        </AnimatePresence>

        {/* Empty state when no deadline */}
        {!nextDeadline && nextAction && (
          <motion.div
            variants={itemVariants}
            className="sm:col-span-1 p-4 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center"
          >
            <span className="text-sm text-muted-foreground">
              No upcoming deadlines
            </span>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
