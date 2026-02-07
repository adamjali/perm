/**
 * Blog Loading Skeleton
 */

import { Skeleton } from "@/components/ui";

export default function BlogLoading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="border-b-2 border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-20">
          <Skeleton variant="line" className="mb-4 h-6 w-20" />
          <Skeleton variant="line" className="mb-4 h-12 w-80" />
          <Skeleton variant="line" className="h-6 w-96" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-2 border-border bg-card shadow-hard">
              <Skeleton variant="block" className="aspect-[16/9] w-full" />
              <div className="p-5">
                <Skeleton variant="line" className="mb-2 h-4 w-24" />
                <Skeleton variant="line" className="mb-2 h-6 w-full" />
                <Skeleton variant="line" className="mb-4 h-4 w-full" />
                <Skeleton variant="line" className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
