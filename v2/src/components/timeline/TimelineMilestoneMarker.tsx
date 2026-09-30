/**
 * TimelineMilestoneMarker Component
 * Renders a milestone marker on the timeline grid with tooltip and navigation.
 *
 * Features:
 * - 12px circle with 3px black border
 * - Background color from milestone.color
 * - Absolute positioned at percentage
 * - Hover: scale animation with spring physics (1 -> 1.3)
 * - Click: navigate to case detail page
 * - Animated tooltip fade-in
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
import type { Milestone } from "@/lib/timeline/types";

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
   * Vertical offset in px from the row's middle, for markers moved into a
   * lane so they do not cover a neighbour (see assignMarkerLanes).
   */
  offsetY?: number;

  /**
   * Nearby milestones with no lane of their own (see foldedMarkers). This
   * marker shows their count as "+N" and lists them in its tooltip.
   */
  folded?: Milestone[];

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
  offsetY = 0,
  folded = [],
  className,
}: TimelineMilestoneMarkerProps) {
  const clampedPosition = clampPosition(position);
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
        "absolute top-1/2 cursor-pointer",
        className
      )}
      style={{
        left: `${clampedPosition}%`,
        top: offsetY ? `calc(50% + ${offsetY}px)` : undefined,
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
      aria-label={`${[milestone, ...folded].map((m) => `${m.label}: ${formatISODate(m.date)}`).join("; ")}${onNavigate ? " - Click to view case" : ""}`}
    >
      {/* Milestone marker: a square, like every other mark in the app */}
      <motion.div
        className={cn(
          "size-4",
          "border-2 border-foreground",
          "shadow-hard-sm",
          // Dashed border for calculated milestones
          milestone.isCalculated && "border-dashed"
        )}
        style={{ backgroundColor: milestone.color }}
        initial={{ scale: 1 }}
        animate={{ scale: isHovered ? 1.3 : 1 }}
        whileTap={{ scale: 1.1 }}
        transition={springConfig}
      />

      {folded.length > 0 && (
        <span
          aria-hidden="true"
          data-folded-count
          className="absolute left-full top-1/2 ml-1 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center border-2 border-foreground bg-background px-0.5 text-xs font-bold leading-none text-foreground"
        >
          +{folded.length}
        </span>
      )}

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
              {[milestone, ...folded].map((m) => (
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
