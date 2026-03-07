/**
 * Case Detail Page Loading State
 * Suspense fallback for case detail/view page.
 *
 * Shows skeleton placeholders matching the tabbed manila folder layout:
 * - Page header with back button and actions
 * - Status bar with badges
 * - Inline timeline section
 * - Tab bar + folder body with field grid
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function CaseDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Back button */}
          <Skeleton variant="block" className="w-11 h-11 shrink-0" />
          {/* Title */}
          <div className="min-w-0 flex-1">
            <Skeleton variant="line" className="w-48 h-7 mb-2" />
            <Skeleton variant="line" className="w-32 h-5" />
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="w-11 h-11" />
          <Skeleton variant="block" className="w-11 h-11" />
        </div>
      </div>

      {/* Status Bar Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton variant="block" className="w-20 h-6" />
        <Skeleton variant="block" className="w-24 h-6" />
        <Skeleton variant="line" className="w-40 h-5" />
      </div>

      {/* Inline Timeline Section Skeleton */}
      <div className="border-2 border-border bg-card p-3 sm:p-4 shadow-hard-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Skeleton variant="line" className="w-28 h-6" />
          <Skeleton variant="block" className="w-40 h-9" />
        </div>
        <div className="flex items-center gap-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton variant="circle" className="w-8 h-8" />
              <Skeleton variant="line" className="w-16 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar Skeleton (manila folder tabs) */}
      <div className="flex gap-0">
        {["Overview", "Recruit", "ETA 9089", "I-140", "Docs", "Notes"].map((tab) => (
          <Skeleton key={tab} variant="block" className="h-10 w-24 sm:w-28" />
        ))}
      </div>

      {/* Folder Body Skeleton */}
      <div className="border-2 border-border bg-card p-4 sm:p-6 shadow-hard-sm -mt-6">
        {/* Detail cards */}
        <div className="space-y-4">
          {/* Card 1 */}
          <div className="border-2 border-border p-4">
            <Skeleton variant="line" className="w-32 h-5 mb-3" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton variant="line" className="w-20 h-3" />
                  <Skeleton variant="line" className="w-32 h-5" />
                </div>
              ))}
            </div>
          </div>
          {/* Card 2 */}
          <div className="border-2 border-border p-4">
            <Skeleton variant="line" className="w-28 h-5 mb-3" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton variant="line" className="w-20 h-3" />
                  <Skeleton variant="line" className="w-32 h-5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
