/**
 * TimelineRangeBar Component
 * Renders a semi-transparent date range bar on the timeline grid.
 *
 * Features:
 * - Semi-transparent bar (opacity 0.3)
 * - Height: 8px, vertically centered
 * - Color from rangeBar.color
 * - Rounded ends (2px border-radius)
 * - CSS-based tooltip with date range
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/utils/date";
import { clampPosition } from "@/lib/timeline/positioning";
import { Z_INDEX } from "@/lib/timeline/constants";
import type { RangeBar } from "@/lib/timeline/types";

// ============================================================================
// Types
// ============================================================================

export interface TimelineRangeBarProps {
  /**
   * The range bar data
   */
  rangeBar: RangeBar;

  /**
   * Start position as percentage (0-100) from left
   */
  startPosition: number;

  /**
   * End position as percentage (0-100) from left
   */
  endPosition: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * TimelineRangeBar Component
 *
 * Renders a semi-transparent bar between two dates on the timeline.
 * Shows date range in tooltip on hover.
 *
 * @example
 * ```tsx
 * <TimelineRangeBar
 *   rangeBar={{ label: "Job Order Period", startDate: "2024-03-01", endDate: "2024-04-15", ... }}
 *   startPosition={20}
 *   endPosition={45}
 * />
 * ```
 */
export function TimelineRangeBar({
  rangeBar,
  startPosition,
  endPosition,
  className,
}: TimelineRangeBarProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const clampedStart = clampPosition(startPosition);
  const clampedEnd = clampPosition(endPosition);
  const width = Math.max(0, clampedEnd - clampedStart);

  if (width <= 0) return null;

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-2 group cursor-default",
        className
      )}
      style={{
        left: `${clampedStart}%`,
        width: `${width}%`,
        zIndex: isHovered ? Z_INDEX.rangeBarHovered : Z_INDEX.rangeBar,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="img"
      aria-label={`${rangeBar.label}: ${formatISODate(rangeBar.startDate)} to ${formatISODate(rangeBar.endDate)}`}
    >
      {/* The visible bar - opacity only on this element, not the container */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          backgroundColor: rangeBar.color,
          opacity: 0.3,
        }}
      />

      {/* Hover tooltip - NOT affected by bar opacity */}
      {/* z-[45] ensures tooltip appears above milestone dots (z-40) but below milestone tooltips (z-50) */}
      <div
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-3",
          "px-2.5 py-1.5 bg-foreground text-background text-xs font-medium",
          "whitespace-nowrap shadow-xl",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-150",
          "pointer-events-none z-[45]",
          "border-2 border-foreground rounded-lg"
        )}
      >
        {/* Label on first line */}
        <div className="font-semibold">{rangeBar.label}</div>
        {/* Date range on second line */}
        <div className="text-xs opacity-80">
          {formatISODate(rangeBar.startDate)} - {formatISODate(rangeBar.endDate)}
        </div>

        {/* Arrow pointer */}
        <div
          className="absolute top-full left-1/2 -translate-x-1/2
          border-4 border-transparent border-t-foreground"
        />
      </div>
    </div>
  );
}
