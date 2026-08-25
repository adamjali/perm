/**
 * Changelog Loading Skeleton
 */

import { Skeleton } from "@/components/ui";

export default function ChangelogLoading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="border-b-2 border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
          <Skeleton variant="line" className="mb-4 h-6 w-20" />
          <Skeleton variant="line" className="mb-4 h-12 w-60" />
          <Skeleton variant="line" className="h-6 w-96" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-2 border-border bg-card p-6 shadow-hard">
              <Skeleton variant="line" className="mb-2 h-4 w-32" />
              <Skeleton variant="line" className="mb-4 h-8 w-80" />
              <Skeleton variant="line" className="mb-2 h-4 w-full" />
              <Skeleton variant="line" className="mb-2 h-4 w-full" />
              <Skeleton variant="line" className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
