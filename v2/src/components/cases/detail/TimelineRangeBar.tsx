"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/utils/date";
import type { RangeBar } from "@/lib/timeline";

// ============================================================================
// TYPES
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
// COMPONENT
// ============================================================================

/**
 * TimelineRangeBar Component
 *
 * Renders a semi-transparent bar between two dates on the timeline.
 * Features:
 * - Semi-transparent bar with stage color at 0.3 opacity
 * - 8px height, rounded ends
 * - Centered vertically in timeline
 * - Hover tooltip showing date range
 *
 * @example
 * ```tsx
 * <TimelineRangeBar
 *   rangeBar={{ label: "Job Order Period", startDate: "2024-03-01", ... }}
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
  // Clamp positions to valid range
  const clampedStart = Math.max(0, Math.min(100, startPosition));
  const clampedEnd = Math.max(0, Math.min(100, endPosition));

  // Calculate width from positions
  const width = Math.max(0, clampedEnd - clampedStart);

  // Don't render if width is 0 or negative
  if (width <= 0) {
    return null;
  }

  // Calculate tooltip alignment based on bar center position
  // Near left edge (< 25%): align left so tooltip doesn't extend past container
  // Near right edge (> 75%): align right
  // Otherwise: center
  const centerPosition = (clampedStart + clampedEnd) / 2;
  const tooltipAlignment = centerPosition < 25
    ? "left"
    : centerPosition > 75
      ? "right"
      : "center";

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-2 group",
        "cursor-pointer",
        // Elevate z-index on hover to ensure tooltip appears above everything
        "z-10 hover:z-[100]",
        className
      )}
      style={{
        left: `${clampedStart}%`,
        width: `${width}%`,
      }}
      role="img"
      aria-label={`${rangeBar.label}: ${formatISODate(rangeBar.startDate)} to ${formatISODate(rangeBar.endDate)}`}
    >
      {/* The visible bar - opacity only on this element, not the container */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: rangeBar.color,
          opacity: 0.3,
        }}
      />

      {/* Hover tooltip - position-aware to avoid edge clipping */}
      <div
        className={cn(
          "absolute bottom-full mb-3",
          "px-2.5 py-1.5 bg-foreground text-background text-xs font-medium",
          "whitespace-nowrap rounded-lg shadow-xl",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-150",
          "pointer-events-none",
          // Position based on bar center location
          tooltipAlignment === "left" && "left-0",
          tooltipAlignment === "right" && "right-0",
          tooltipAlignment === "center" && "left-1/2 -translate-x-1/2"
        )}
      >
        {rangeBar.label}
        <span className="mx-1.5 opacity-60">|</span>
        {formatISODate(rangeBar.startDate)} - {formatISODate(rangeBar.endDate)}
        {/* Arrow pointer - also position-aware */}
        <div
          className={cn(
            "absolute top-full border-4 border-transparent border-t-foreground",
            tooltipAlignment === "left" && "left-4",
            tooltipAlignment === "right" && "right-4",
            tooltipAlignment === "center" && "left-1/2 -translate-x-1/2"
          )}
        />
      </div>
    </div>
  );
}
