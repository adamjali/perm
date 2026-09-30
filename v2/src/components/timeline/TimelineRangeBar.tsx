/**
 * TimelineRangeBar Component
 * Renders a semi-transparent date range bar on the timeline grid.
 *
 * Features:
 * - Outlined band in the stage colour over a 30% fill, 12px tall
 * - Tooltip with the date range, mounted only while hovered
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
   * The band's vertical centre in px from the top of its container. Omitted,
   * it sits at the middle of the row (the timeline page, one band per row);
   * the case page stacks several bands per stage lane in slots.
   */
  centerY?: number;

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
  centerY,
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
        "absolute top-1/2 -translate-y-1/2 h-3 group cursor-default",
        className
      )}
      style={{
        left: `${clampedStart}%`,
        width: `${width}%`,
        ...(centerY !== undefined ? { top: `${centerY}px` } : {}),
        zIndex: isHovered ? Z_INDEX.rangeBarHovered : Z_INDEX.rangeBar,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="img"
      aria-label={`${rangeBar.label}: ${formatISODate(rangeBar.startDate)} to ${formatISODate(rangeBar.endDate)}`}
    >
      {/* The visible bar - opacity only on this element, not the container */}
      {/* A band in the stage colour: a clear outline over a light fill, so it
          reads as that stage instead of a pastel */}
      <div
        className="absolute inset-0 border-2"
        style={{
          borderColor: rangeBar.color,
          backgroundColor: `color-mix(in srgb, ${rangeBar.color} 30%, transparent)`,
        }}
      />

      {/* Hover tooltip, mounted only while hovered: an invisible one still
          widens the scroll area, and on a phone the case timeline scrolled
          33px past its last month because of it (Sep 30 2026) */}
      {isHovered && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-3",
            "px-2 py-1.5 bg-foreground text-background text-sm font-medium",
            "whitespace-nowrap shadow-hard-sm",
            "pointer-events-none z-[45]",
            "border-2 border-foreground"
          )}
        >
          <div className="font-semibold">{rangeBar.label}</div>
          <div className="text-sm opacity-80">
            {formatISODate(rangeBar.startDate)} - {formatISODate(rangeBar.endDate)}
          </div>
        </div>
      )}
    </div>
  );
}
