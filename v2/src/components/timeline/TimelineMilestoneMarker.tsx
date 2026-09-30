/**
 * TimelineMilestoneMarker Component
 * Renders a milestone marker on the timeline grid with tooltip and navigation.
 *
 * - A 16px square in the stage's colour, or a 22px square with a count when
 *   several dates sit too close to tell apart (see groupMarkers): coloured
 *   when they share a stage, plain when they don't.
 * - Placed at a percentage, clamped 12px inside each edge so a square is
 *   never half hidden.
 * - Hover or tap lists every date it holds; click opens the case.
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 */

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/utils/date";
import { clampPosition } from "@/lib/timeline/positioning";
import { Z_INDEX } from "@/lib/timeline/constants";
import { STAGE_ON_FILL, type Milestone } from "@/lib/timeline/types";

// ============================================================================
// Types
// ============================================================================

export interface TimelineMilestoneMarkerProps {
  /**
   * The milestone to display
   */
  milestone: Milestone;

  /**
   * Position as percentage (0-100) from left
   */
  position: number;

  /**
   * Case ID for navigation
   */
  caseId?: string;

  /**
   * Callback when milestone is clicked for navigation
   */
  onNavigate?: (caseId: string) => void;

  /**
   * The other dates drawn in this same square because they sit too close to
   * tell apart (see groupMarkers). The square then shows how many dates it
   * holds, and its tooltip lists every one.
   */
  grouped?: Milestone[];

  /**
   * Additional CSS classes
   */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * TimelineMilestoneMarker Component
 *
 * Renders a single milestone as a colored dot on the timeline grid.
 * Supports navigation to case detail on click.
 *
 * @example
 * ```tsx
 * <TimelineMilestoneMarker
 *   milestone={{ label: "PWD Filed", date: "2024-01-15", color: "#0066FF", ... }}
 *   position={25}
 *   caseId="abc123"
 *   onNavigate={(id) => router.push(`/cases/${id}`)}
 * />
 * ```
 */
// Spring configuration for snappy animations
const springConfig = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

export function TimelineMilestoneMarker({
  milestone,
  position,
  caseId,
  onNavigate,
  grouped = [],
  className,
}: TimelineMilestoneMarkerProps) {
  const clampedPosition = clampPosition(position);
  const all = [milestone, ...grouped];
  const oneStage = all.every((m) => m.stage === milestone.stage);
  const [isHovered, setIsHovered] = React.useState(false);

  // Handle click navigation
  const handleClick = React.useCallback(() => {
    if (onNavigate) {
      if (caseId) onNavigate(caseId);
    }
  }, [onNavigate, caseId]);

  // Handle keyboard navigation (Enter/Space)
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && onNavigate) {
        event.preventDefault();
        if (caseId) onNavigate(caseId);
      }
    },
    [onNavigate, caseId]
  );

  return (
    <div
      className={cn(
        // Kept a square's half-width inside each edge, or a date at the start
        // of the range is half hidden under the sticky names (Sep 30 2026).
        // Shifts a mark by at most a few px there; the tooltip gives the date.
        // The clamp lives in the class and the position in --x, because an
        // inline clamp() is dropped by some renderers (happy-dom among them).
        "absolute top-1/2 cursor-pointer left-[clamp(12px,var(--x),calc(100%_-_12px))]",
        className
      )}
      style={{
        ["--x" as string]: `${clampedPosition}%`,
        transform: "translate(-50%, -50%)",
        zIndex: isHovered ? Z_INDEX.milestoneHovered : Z_INDEX.milestone,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={onNavigate ? 0 : undefined}
      role={onNavigate ? "button" : "img"}
      aria-label={`${all.map((m) => `${m.label}: ${formatISODate(m.date)}`).join("; ")}${onNavigate ? " - Click to view case" : ""}`}
    >
      {/* Milestone marker: a square, like every other mark in the app */}
      {/* Milestone marker: a square, like every other mark in the app. A
          square holding several dates is larger and says how many; it takes
          the stage colour when they share one, and is plain when they don't. */}
      <motion.div
        className={cn(
          all.length > 1 ? "flex size-[22px] items-center justify-center" : "size-4",
          "border-2 border-foreground",
          "shadow-hard-sm",
          // Dashed border for calculated milestones
          all.length === 1 && milestone.isCalculated && "border-dashed",
          all.length > 1 && !oneStage && "bg-background text-foreground"
        )}
        style={
          all.length === 1 || oneStage
            ? { backgroundColor: milestone.color, color: STAGE_ON_FILL[milestone.stage] }
            : undefined
        }
        initial={{ scale: 1 }}
        animate={{ scale: isHovered ? 1.3 : 1 }}
        whileTap={{ scale: 1.1 }}
        transition={springConfig}
      >
        {all.length > 1 && (
          <span aria-hidden="true" data-group-count className="text-sm font-bold leading-none">
            {all.length}
          </span>
        )}
      </motion.div>

      {/* Tooltip - animated fade-in with spring */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={cn(
              "absolute bottom-full left-1/2 mb-3",
              "px-2 py-1.5 bg-foreground text-background text-sm font-medium",
              "whitespace-nowrap shadow-hard-sm",
              "pointer-events-none z-50",
              "border-2 border-foreground"
            )}
            initial={{ opacity: 0, y: 4, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 4, x: "-50%" }}
            transition={{ duration: 0.15 }}
          >
            <div className="space-y-1">
              {all.map((m) => (
                <div key={`${m.field}-${m.date}`}>
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-sm opacity-80">{formatISODate(m.date)}</div>
                </div>
              ))}
            </div>

            {/* Arrow pointer */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2
              border-2 border-transparent border-t-foreground"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
