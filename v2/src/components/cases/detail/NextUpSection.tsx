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
  caseData: NextUpCaseData;
  caseId?: Id<"cases">;
  className?: string;
  /** Hide the stage progress indicator (when rendered elsewhere) */
  showStageProgress?: boolean;
}

// Re-export types for consumers
export type { NextUpCaseData, NextAction, Deadline } from "./next-up-section.utils";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NextUpSection({ caseData, caseId, className, showStageProgress = true }: NextUpSectionProps) {
  const currentStage = getStageIndex(caseData.caseStatus);
  const nextAction = calculateNextAction(caseData);
  const nextDeadline = calculateNextDeadline(caseData);

  // Don't render if case is closed and complete
  if (caseData.caseStatus === "closed") {
    return null;
  }

  return (
    <div className={cn("next-up-caution shadow-hard", className)}>
      {/* Caution tape — top */}
      <div className="hazard-strip-yellow" aria-hidden="true" />

      <motion.section
        variants={containerVariants}
        initial={false}
        animate="visible"
        className="bg-card p-4 sm:p-6"
        aria-labelledby="next-up-heading"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <h2
            id="next-up-heading"
            className="font-heading text-lg sm:text-xl font-bold"
          >
            What&apos;s Next
          </h2>
        </motion.div>

        {/* Stage Progress (can be hidden when rendered elsewhere) */}
        {showStageProgress && (
          <div className="mb-6">
            <StageProgressIndicator currentStage={currentStage} />
          </div>
        )}

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
              className="sm:col-span-1 p-4 border-2 border-dashed border-border bg-muted/30 flex items-center justify-center"
            >
              <span className="text-sm text-muted-foreground">
                No upcoming deadlines
              </span>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* Caution tape — bottom */}
      <div className="hazard-strip-yellow" aria-hidden="true" />
    </div>
  );
}
