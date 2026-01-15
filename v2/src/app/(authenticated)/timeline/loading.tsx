/**
 * Timeline Page Loading State
 * Suspense fallback for timeline page.
 *
 * Shows skeleton placeholders for:
 * - TimelineControls header (title, time range, zoom, case selector)
 * - TimelineGrid with month headers and case rows
 * - TimelineLegend footer
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Improved to match actual TimelineGrid layout
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  // Generate month columns (6 months by default)
  const monthCount = 6;

  return (
    <div className="flex flex-col h-full">
      {/* Header Controls Skeleton - matches TimelineControls layout */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4 sm:gap-3">
          {/* Title */}
          <Skeleton variant="line" className="w-32 h-10" />

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Time range dropdown */}
            <Skeleton variant="block" className="w-32 h-10" />
            {/* Zoom control */}
            <Skeleton variant="block" className="w-24 h-10" />
            {/* Case selector */}
            <Skeleton variant="block" className="w-36 h-10" />
          </div>
        </div>

        {/* Subtitle */}
        <div className="flex items-center gap-3 mt-2">
          <Skeleton variant="line" className="w-40 h-5" />
        </div>
      </div>

      {/* Main Timeline Grid Skeleton */}
      <div className="flex-1 overflow-hidden min-h-[400px] border-2 border-border rounded-lg bg-card">
        {/* Month Headers Row */}
        <div className="flex border-b-2 border-border">
          {/* Case name column header */}
          <div className="w-48 shrink-0 p-3 border-r-2 border-border bg-muted/50">
            <Skeleton variant="line" className="w-20 h-5" />
          </div>
          {/* Month columns */}
          <div className="flex-1 flex">
            {Array.from({ length: monthCount }).map((_, i) => (
              <div
                key={i}
                className="flex-1 p-2 border-r border-border last:border-r-0 text-center"
              >
                <Skeleton variant="line" className="w-16 h-5 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Case Rows */}
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex border-b border-border last:border-b-0"
            style={{ animationDelay: `${rowIndex * 50}ms` }}
          >
            {/* Case name cell */}
            <div className="w-48 shrink-0 p-3 border-r-2 border-border bg-muted/30">
              <Skeleton variant="line" className="w-32 h-5 mb-1" />
              <Skeleton variant="line" className="w-24 h-4" />
            </div>
            {/* Timeline bar cell */}
            <div className="flex-1 p-2 relative">
              {/* Stage range bar skeleton */}
              <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-6">
                <Skeleton
                  variant="block"
                  className="h-full"
                  style={{ width: `${40 + rowIndex * 10}%` }}
                />
              </div>
              {/* Milestone markers skeleton */}
              <div className="absolute top-1/2 -translate-y-1/2 flex gap-4 left-8">
                {Array.from({ length: 2 + (rowIndex % 2) }).map((_, j) => (
                  <Skeleton
                    key={j}
                    variant="circle"
                    className="w-3 h-3"
                    style={{ marginLeft: `${j * 40 + 10}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend Skeleton - matches TimelineLegend layout */}
      <div className="mt-6">
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 p-4 rounded-lg border-2 border-border bg-card shadow-hard-sm">
          {/* Stage legend items */}
          {["PWD", "Recruitment", "ETA 9089", "I-140"].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton variant="block" className="w-4 h-4" />
              <Skeleton variant="line" className="w-16 h-4" />
            </div>
          ))}
          {/* Milestone legend items */}
          {["Filed", "Approved"].map((label, i) => (
            <div key={`m-${i}`} className="flex items-center gap-2">
              <Skeleton variant="circle" className="w-3 h-3" />
              <Skeleton variant="line" className="w-14 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
