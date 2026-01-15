/**
 * Calendar Page Loading State
 * Suspense fallback for calendar page.
 *
 * Shows skeleton placeholders for:
 * - Page header (title, subtitle)
 * - Calendar toolbar (navigation, view buttons)
 * - Calendar grid (weekday headers, date cells with event placeholders)
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2025-12-28
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton variant="line" className="w-32 h-10 mb-2" />
          <Skeleton variant="line" className="w-56 h-5" />
        </div>
      </div>

      {/* Toolbar skeleton - matches react-big-calendar toolbar layout */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        {/* Navigation buttons (Today, Back, Next) */}
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="w-20 h-10" />
          <Skeleton variant="block" className="w-24 h-10" />
          <Skeleton variant="block" className="w-20 h-10" />
        </div>

        {/* Month/Year label */}
        <Skeleton variant="line" className="w-40 h-8" />

        {/* View buttons (Month, Week, Day) */}
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="w-20 h-10" />
          <Skeleton variant="block" className="w-20 h-10" />
          <Skeleton variant="block" className="w-20 h-10" />
        </div>
      </div>

      {/* Calendar grid skeleton */}
      <div className="flex-1 border-2 border-border bg-card shadow-hard">
        {/* Weekday header row */}
        <div className="grid grid-cols-7 border-b-2 border-border bg-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-3 text-center border-r border-border last:border-r-0"
            >
              <Skeleton variant="line" className="w-8 h-5 mx-auto" />
            </div>
          ))}
        </div>

        {/* Calendar weeks (5 rows for typical month view) */}
        {Array.from({ length: 5 }).map((_, weekIndex) => (
          <div
            key={weekIndex}
            className="grid grid-cols-7 border-b border-border last:border-b-0"
            style={{ animationDelay: `${weekIndex * 50}ms` }}
          >
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div
                key={dayIndex}
                className="min-h-24 p-2 border-r border-border last:border-r-0"
              >
                {/* Date number */}
                <Skeleton variant="line" className="w-6 h-5 mb-2" />

                {/* Event placeholders - vary by position for visual interest */}
                {(weekIndex + dayIndex) % 3 === 0 && (
                  <Skeleton variant="block" className="w-full h-6 mb-1" />
                )}
                {(weekIndex * 7 + dayIndex) % 5 === 0 && (
                  <Skeleton variant="block" className="w-full h-6" />
                )}
                {(weekIndex + dayIndex) % 7 === 2 && (
                  <Skeleton variant="block" className="w-3/4 h-6" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
