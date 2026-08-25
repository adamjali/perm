"use client";

import { motion } from "motion/react";
import { Clock, Info, Lightning as Zap } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  PROCESSING_TIMES_AS_OF,
  PROCESSING_TIMES_SOURCE_URL,
  formatMonthRange,
  getI140ProcessingTime,
  getPremiumBusinessDays,
  type I140Category,
} from "@/lib/processing-times/i140ProcessingTimes";
import { formatAsOf } from "@/lib/dolFormat";

export interface ProcessingTimeEstimateProps {
  /** Petition category recorded on the case. */
  category: I140Category;
  /** Whether premium processing is selected. */
  isPremiumProcessing: boolean;
  className?: string;
  /** Single-line variant for tight spaces. */
  compact?: boolean;
}

/**
 * USCIS I-140 processing times for a category.
 *
 * Shows the subtypes rather than one figure, because within a category they
 * diverge enormously: EB-1 runs 15.5 months for an outstanding professor and
 * 34.5 for extraordinary ability. An earlier version showed one number per
 * category per service center and was wrong by up to 4x.
 *
 * Service center is deliberately not an input. USCIS reports I-140 under a
 * single office, so offering the choice implied a precision the source does
 * not have.
 */
export function ProcessingTimeEstimate({
  category,
  isPremiumProcessing,
  className,
  compact = false,
}: ProcessingTimeEstimateProps) {
  const range = getI140ProcessingTime(category);
  const premiumDays = getPremiumBusinessDays(category);

  if (!category) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 border-border bg-muted/30 p-3 text-sm text-muted-foreground",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>Choose a petition category to see USCIS processing times.</span>
        </div>
      </div>
    );
  }

  if (!range) return null;

  const tone = isPremiumProcessing
    ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
    : "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20";

  if (compact) {
    return (
      <div className={cn("rounded-md border-2 px-3 py-2", tone, className)}>
        <div className="flex items-center gap-2">
          {isPremiumProcessing ? (
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          ) : (
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          )}
          <span className="text-sm font-medium">
            {isPremiumProcessing
              ? premiumDays
                ? `${premiumDays} business days`
                : "15 or 45 business days, by subcategory"
              : formatMonthRange(range.lowMonths, range.highMonths)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("rounded-lg border-2 p-4", tone, className)}
    >
      <div className="mb-3 flex items-center gap-2">
        {isPremiumProcessing ? (
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        ) : (
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold">
          {isPremiumProcessing ? "Premium processing" : "USCIS processing time"}
        </span>
      </div>

      {isPremiumProcessing ? (
        <div>
          <p className="text-lg font-bold">
            {premiumDays
              ? `${premiumDays} business days`
              : "15 or 45 business days"}
          </p>
          {/* EB-1 is the case that breaks a single number: E11 and E12 get 15
              business days, E13 gets 45. */}
          {!premiumDays ? (
            <ul className="mt-2 space-y-1 text-sm">
              {range.subtypes.map((s) => (
                <li key={s.code} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{s.label}</span>{" "}
                  <span className="font-medium tabular-nums">
                    {s.premiumBusinessDays} days
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div>
          <p className="text-lg font-bold tabular-nums">
            {formatMonthRange(range.lowMonths, range.highMonths)}
          </p>
          {/* Always list the subtypes when a category has more than one: the
              spread within EB-1 and EB-3 is wider than the gap between them. */}
          {range.subtypes.length > 1 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {range.subtypes.map((s) => (
                <li key={s.code} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{s.label}</span>{" "}
                  <span className="font-medium tabular-nums">
                    {formatMonthRange(s.lowMonths, s.highMonths)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          {isPremiumProcessing
            ? "Premium processing guarantees a first review inside the window. It doesn’t guarantee approval, and the clock restarts if USCIS issues a request for evidence."
            : "The lower figure is where half of cases finish, the upper where 93% do."}{" "}
          USCIS published these on {formatAsOf(PROCESSING_TIMES_AS_OF)}.{" "}
          <a
            href={PROCESSING_TIMES_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Check the current figures
          </a>
          .
        </p>
      </div>
    </motion.div>
  );
}

export default ProcessingTimeEstimate;
