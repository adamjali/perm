/**
 * Cases Page Loading State
 * Suspense fallback for cases page.
 *
 * Shows skeleton placeholders for:
 * - Page header (title + subtitle + action buttons)
 * - Filter bar with controls
 * - Case cards grid (6 cards matching CaseCard layout)
 *
 * Phase: 21 (Case List)
 * Created: 2025-12-24
 * Updated: 2025-12-27 - Improved skeletons to match actual CaseCard layout
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Case Card Skeleton
 * Matches the manila folder metaphor of CaseCard with folder tab
 */
function CaseCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="relative mt-8 animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards"
      style={{ animationDelay: `${100 + index * 50}ms`, animationDuration: "0.3s" }}
    >
      {/* Folder Tab Skeleton */}
      <div className="absolute -top-4 left-6 w-28 h-5 z-10">
        <Skeleton variant="block" className="w-full h-full" />
      </div>

      {/* Folder Body */}
      <div className="border-2 border-border bg-[var(--manila)] shadow-hard p-6 pt-10 min-h-[180px]">
        {/* Left color bar skeleton */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5">
          <Skeleton variant="block" className="w-full h-full" />
        </div>

        {/* Header: Employer + Position */}
        <div className="mb-3">
          <Skeleton variant="line" className="w-3/4 h-6 mb-2" />
          <Skeleton variant="line" className="w-1/2 h-4" />
        </div>

        {/* Deadline row */}
        <div className="flex items-center gap-2 mb-3">
          <Skeleton variant="circle" className="w-2.5 h-2.5" />
          <Skeleton variant="line" className="w-48 h-4" />
        </div>

        {/* Progress status badge */}
        <div className="mb-3">
          <Skeleton variant="block" className="w-24 h-6" />
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/20">
          <Skeleton variant="block" className="flex-1 h-8" />
          <Skeleton variant="block" className="w-16 h-8" />
          <Skeleton variant="block" className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
}

export default function CasesLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div
        className="flex items-center justify-between animate-in fade-in fill-mode-forwards"
        style={{ animationDuration: "0.2s" }}
      >
        <div>
          <Skeleton variant="line" className="w-24 h-10 mb-2" />
          <Skeleton variant="line" className="w-32 h-5" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="block" className="w-28 h-10" />
          <Skeleton variant="block" className="w-32 h-10" />
          <Skeleton variant="block" className="w-24 h-10" />
          <Skeleton variant="block" className="w-32 h-12" />
        </div>
      </div>

      {/* Filter Bar Skeleton - More detailed */}
      <div
        className="rounded-lg border-2 border-border bg-card p-4 shadow-hard-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards"
        style={{ animationDelay: "50ms", animationDuration: "0.3s" }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Search input */}
          <div className="flex-1 min-w-[200px]">
            <Skeleton variant="block" className="h-10" />
          </div>
          {/* Filter dropdowns */}
          <Skeleton variant="block" className="w-32 h-10" />
          <Skeleton variant="block" className="w-32 h-10" />
          <Skeleton variant="block" className="w-28 h-10" />
          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <Skeleton variant="block" className="w-36 h-10" />
            <Skeleton variant="block" className="w-10 h-10" />
          </div>
        </div>
      </div>

      {/* Case Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <CaseCardSkeleton key={i} index={i} />
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div
        className="flex items-center justify-between py-4 animate-in fade-in fill-mode-forwards"
        style={{ animationDelay: "400ms", animationDuration: "0.3s" }}
      >
        <Skeleton variant="line" className="w-32 h-5" />
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="w-10 h-10" />
          <Skeleton variant="block" className="w-10 h-10" />
          <Skeleton variant="block" className="w-10 h-10" />
          <Skeleton variant="block" className="w-10 h-10" />
        </div>
        <Skeleton variant="block" className="w-24 h-10" />
      </div>
    </div>
  );
}
