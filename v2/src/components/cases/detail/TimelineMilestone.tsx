"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/utils/date";
import type { Milestone } from "@/lib/timeline";

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineMilestoneProps {
  /**
   * The milestone to display
   */
  milestone: Milestone;

  /**
   * Position as percentage (0-100) from left
   */
  position: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TimelineMilestone Component
 *
 * Renders a single milestone as a colored dot on the timeline.
 * Features:
 * - 12px colored circle with 3px black border
 * - Positioned absolutely based on percentage
 * - Hover: scale 1.5x, show tooltip with label + date
 * - CSS-based tooltip using group-hover pattern
 *
 * @example
 * ```tsx
 * <TimelineMilestone
 *   milestone={{ label: "PWD Filed", date: "2024-01-15", color: "#0066FF", ... }}
 *   position={25}
 * />
 * ```
 */
export function TimelineMilestone({
  milestone,
  position,
  className,
}: TimelineMilestoneProps) {
  // Clamp position to valid range
  const clampedPosition = Math.max(0, Math.min(100, position));

  // Calculate tooltip alignment based on position
  // Near left edge (< 25%): align left so tooltip doesn't extend past container
  // Near right edge (> 75%): align right
  // Otherwise: center
  const tooltipAlignment = clampedPosition < 25
    ? "left"
    : clampedPosition > 75
      ? "right"
      : "center";

  return (
    <div
      className={cn(
        "absolute top-1/2 group",
        "cursor-pointer",
        // Elevate z-index on hover to ensure tooltip appears above everything
        "z-10 hover:z-[100]",
        className
      )}
      style={{
        left: `${clampedPosition}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Milestone dot - 16px size for better visibility */}
      <div
        className={cn(
          "w-4 h-4 rounded-full border-[3px] border-foreground",
          "transition-transform duration-150 ease-out",
          "group-hover:scale-150",
          milestone.isCalculated && "border-dashed"
        )}
        style={{ backgroundColor: milestone.color }}
        role="img"
        aria-label={`${milestone.label}: ${formatISODate(milestone.date)}`}
      />

      {/* Tooltip - appears on hover, position-aware to avoid edge clipping */}
      <div
        className={cn(
          "absolute bottom-full mb-3",
          "px-2.5 py-1.5 bg-foreground text-background text-xs font-medium",
          "whitespace-nowrap rounded-lg shadow-xl",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-150",
          "pointer-events-none",
          // Position based on milestone location
          tooltipAlignment === "left" && "left-0",
          tooltipAlignment === "right" && "right-0",
          tooltipAlignment === "center" && "left-1/2 -translate-x-1/2"
        )}
      >
        {milestone.label}
        <span className="mx-1.5 opacity-60">|</span>
        {formatISODate(milestone.date)}
        {/* Arrow pointer - also position-aware */}
        <div
          className={cn(
            "absolute top-full border-4 border-transparent border-t-foreground",
            tooltipAlignment === "left" && "left-2",
            tooltipAlignment === "right" && "right-2",
            tooltipAlignment === "center" && "left-1/2 -translate-x-1/2"
          )}
        />
      </div>
    </div>
  );
}
