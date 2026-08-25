/**
 * Privacy Page Skeleton Loading
 *
 * Skeleton loading state for privacy policy page.
 *
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function PrivacyLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        {/* Title */}
        <Skeleton className="h-10 w-64 mb-2" />
        {/* Date */}
        <Skeleton className="h-5 w-96 mb-8" />

        {/* Sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <div>
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Section 2 */}
          <div>
            <Skeleton className="h-8 w-56 mb-4" />
            <Skeleton className="h-6 w-40 mb-3" />
            <div className="space-y-2 ml-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <Skeleton className="h-8 w-52 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <div className="space-y-2 ml-4 mt-4">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Section 4 */}
          <div>
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* Section 5 */}
          <div>
            <Skeleton className="h-8 w-56 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <div className="space-y-2 ml-4 mt-4">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* More sections */}
          <div>
            <Skeleton className="h-8 w-44 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>

        {/* Back link */}
        <div className="mt-12 flex justify-center">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}
