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
  caseId: string;

  /**
   * Callback when milestone is clicked for navigation
   */
  onNavigate?: (caseId: string) => void;

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
  className,
}: TimelineMilestoneMarkerProps) {
  const clampedPosition = clampPosition(position);
  const [isHovered, setIsHovered] = React.useState(false);

  // Handle click navigation
  const handleClick = React.useCallback(() => {
    if (onNavigate) {
      onNavigate(caseId);
    }
  }, [onNavigate, caseId]);

  // Handle keyboard navigation (Enter/Space)
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && onNavigate) {
        event.preventDefault();
        onNavigate(caseId);
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
      aria-label={`${milestone.label}: ${formatISODate(milestone.date)}${onNavigate ? " - Click to view case" : ""}`}
    >
      {/* Milestone dot with spring scale animation - 16px size */}
      <motion.div
        className={cn(
          "w-4 h-4 rounded-full",
          "border-[3px] border-foreground",
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

      {/* Tooltip - animated fade-in with spring */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={cn(
              "absolute bottom-full left-1/2 mb-3",
              "px-2 py-1.5 bg-foreground text-background text-xs font-medium",
              "whitespace-nowrap shadow-hard-sm",
              "pointer-events-none z-50",
              "border-2 border-foreground"
            )}
            initial={{ opacity: 0, y: 4, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 4, x: "-50%" }}
            transition={{ duration: 0.15 }}
          >
            {/* Label on first line */}
            <div className="font-semibold">{milestone.label}</div>
            {/* Formatted date on second line */}
            <div className="text-xs opacity-80">{formatISODate(milestone.date)}</div>

            {/* Arrow pointer */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2
              border-4 border-transparent border-t-foreground"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
