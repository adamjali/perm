"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Clock, Zap, Calendar, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getI140ProcessingTime,
  getI140CompletionDateRange,
  formatProcessingTimeRange,
  formatCompletionDateRange,
  type I140Category,
  type ServiceCenter,
} from "@/lib/processing-times/i140ProcessingTimes";

// ============================================================================
// TYPES
// ============================================================================

export interface ProcessingTimeEstimateProps {
  /** I-140 category (EB-1, EB-2, EB-2-NIW, EB-3) */
  category: I140Category;
  /** USCIS Service Center */
  serviceCenter: ServiceCenter;
  /** Whether premium processing is selected */
  isPremiumProcessing: boolean;
  /** Filing date (to calculate estimated completion) */
  filingDate?: string;
  /** Additional className */
  className?: string;
  /** Compact mode for smaller display */
  compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProcessingTimeEstimate Component
 *
 * Displays I-140 processing time estimates based on:
 * - Category (EB-1, EB-2, EB-2-NIW, EB-3)
 * - Service Center (Texas, Nebraska, California, Vermont)
 * - Premium Processing toggle
 *
 * Shows:
 * - Time range (median to 93rd percentile)
 * - Estimated completion dates if filing date provided
 * - Premium processing note when selected
 */
export function ProcessingTimeEstimate({
  category,
  serviceCenter,
  isPremiumProcessing,
  filingDate,
  className,
  compact = false,
}: ProcessingTimeEstimateProps) {
  // Get processing time data
  const processingTime = getI140ProcessingTime(
    category,
    serviceCenter,
    isPremiumProcessing
  );

  const completionDates =
    filingDate && processingTime
      ? getI140CompletionDateRange(
          category,
          serviceCenter,
          filingDate,
          isPremiumProcessing
        )
      : null;

  // If no data available, show placeholder
  if (!category || !serviceCenter) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 border-border bg-muted/30 p-3 text-sm text-muted-foreground",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Select category and service center to see processing time estimates</span>
        </div>
      </div>
    );
  }

  if (!processingTime) {
    return null;
  }

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-md border-2 px-3 py-2",
          isPremiumProcessing
            ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"
            : "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPremiumProcessing ? (
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
            <span className="text-sm font-medium">
              {isPremiumProcessing ? "15 business days" : formatProcessingTimeRange(processingTime)}
            </span>
          </div>
          {completionDates && (
            <span className="text-xs text-muted-foreground">
              Est: {formatCompletionDateRange(completionDates)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-lg border-2 p-4",
        isPremiumProcessing
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"
          : "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isPremiumProcessing ? (
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        ) : (
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        )}
        <span className="font-semibold text-sm">
          {isPremiumProcessing ? "Premium Processing" : "Processing Time Estimate"}
        </span>
      </div>

      {/* Time Range */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {isPremiumProcessing ? "Guaranteed Review" : "Expected Time"}
          </span>
          <p className="font-bold text-lg">
            {isPremiumProcessing
              ? "15 business days"
              : formatProcessingTimeRange(processingTime)}
          </p>
        </div>
        {completionDates && (
          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Est. Completion
            </span>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{formatCompletionDateRange(completionDates)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          {isPremiumProcessing
            ? "Premium Processing guarantees initial review within 15 business days but does not guarantee approval."
            : "Times based on USCIS data. 50% processed by median, 93% by max."}
        </p>
      </div>
    </motion.div>
  );
}

export default ProcessingTimeEstimate;
