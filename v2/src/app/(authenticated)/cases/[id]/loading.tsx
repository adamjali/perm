/**
 * Case Detail Page Loading State
 * Suspense fallback for case detail/view page.
 *
 * Shows skeleton placeholders for:
 * - Page header with back button and actions
 * - Status bar with badges
 * - Inline timeline section
 * - Case detail sections grid (matching CaseDetailSection layout)
 *
 * Phase: 23 (Case Detail/Timeline)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Improved to match actual section layouts
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Section Skeleton
 * Matches CaseDetailSection layout with icon, title, and content
 */
function SectionSkeleton({
  className,
  rows = 2,
  cols = 2,
}: {
  className?: string;
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className={`rounded-lg border-2 border-border bg-card p-4 shadow-hard-sm ${className || ""}`}
    >
      {/* Section header with icon and title */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circle" className="w-5 h-5" />
        <Skeleton variant="line" className="w-32 h-6" />
        <div className="flex-1" />
        <Skeleton variant="circle" className="w-5 h-5" />
      </div>
      {/* Content grid */}
      <div
        className={`grid gap-4 ${cols === 2 ? "md:grid-cols-2" : ""}`}
      >
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton variant="line" className="w-20 h-3" />
            <Skeleton variant="line" className="w-32 h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <div className="rounded-lg border-2 border-border bg-card p-3 sm:p-4 shadow-hard-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Skeleton variant="line" className="w-28 h-6" />
          <Skeleton variant="block" className="w-40 h-9" />
        </div>
        {/* Timeline visualization placeholder */}
        <div className="flex items-center gap-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton variant="circle" className="w-8 h-8" />
              <Skeleton variant="line" className="w-16 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Sections Grid Skeleton */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Basic Info Section - Full Width */}
        <div className="lg:col-span-2">
          <SectionSkeleton rows={2} cols={2} />
        </div>

        {/* PWD Section */}
        <SectionSkeleton rows={2} cols={2} />

        {/* ETA 9089 Section */}
        <SectionSkeleton rows={2} cols={2} />

        {/* Recruitment Section - Full Width */}
        <div className="lg:col-span-2">
          <SectionSkeleton rows={3} cols={2} />
        </div>

        {/* I-140 Section */}
        <SectionSkeleton rows={2} cols={2} />

        {/* RFI/RFE Section */}
        <SectionSkeleton rows={2} cols={1} />
      </div>

      {/* Footer Metadata Skeleton */}
      <div className="border-t border-border pt-4 flex flex-wrap gap-4">
        <Skeleton variant="line" className="w-32 h-4" />
        <Skeleton variant="line" className="w-36 h-4" />
      </div>
    </div>
  );
}
