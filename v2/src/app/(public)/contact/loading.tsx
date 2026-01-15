/**
 * Contact Page Skeleton Loading
 *
 * Skeleton loading state for contact page.
 *
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function ContactLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        {/* Title */}
        <Skeleton className="h-10 w-48 mb-4" />
        {/* Subtitle */}
        <Skeleton className="h-5 w-80 mb-8" />

        <div className="space-y-8">
          {/* Email section */}
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-6 w-20 mb-1" />
              <Skeleton className="h-4 w-64 mb-2" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>

          {/* Feature Requests section */}
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-6 w-56 mb-1" />
              <Skeleton className="h-4 w-72 mb-2" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>

          {/* Bug Reports section */}
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-4 w-64 mb-2" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>

        {/* Response time box */}
        <div className="mt-12 rounded-lg border-2 border-black bg-muted p-6 shadow-hard-sm dark:border-white">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Back link */}
        <div className="mt-8 flex justify-center">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}
