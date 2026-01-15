/**
 * Notifications Page Loading State
 * Suspense fallback for notifications page.
 *
 * Shows skeleton placeholders for:
 * - Page header (title + subtitle + bulk action buttons)
 * - Notification tabs
 * - Grouped notification list
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Notification Item Skeleton
 * Matches the notification list item layout
 */
function NotificationItemSkeleton({ index }: { index: number }) {
  return (
    <div
      className="flex items-start gap-4 p-4 border-b-2 border-black/10 dark:border-white/10 last:border-b-0"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Priority color bar */}
      <Skeleton className="w-1.5 h-16" />

      {/* Icon */}
      <Skeleton className="h-10 w-10 shrink-0" />

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton variant="line" className="h-5 w-3/4" />
          <Skeleton variant="line" className="h-3 w-12" />
        </div>
        <Skeleton variant="line" className="h-4 w-full" />
        <Skeleton variant="line" className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function NotificationsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Skeleton variant="line" className="w-40 h-10 mb-2" />
          <Skeleton variant="line" className="w-64 h-5" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="block" className="w-36 h-10" />
          <Skeleton variant="block" className="w-32 h-10" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex flex-wrap gap-2 border-b-2 border-black dark:border-white/50 pb-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="block" className="w-24 h-10" />
        ))}
      </div>

      {/* Notification Groups Skeleton */}
      <div className="space-y-6">
        {/* Group 1 */}
        <div>
          <Skeleton variant="line" className="h-4 w-16 mb-3" />
          <div className="border-2 border-black dark:border-white/50 shadow-hard">
            {Array.from({ length: 3 }).map((_, i) => (
              <NotificationItemSkeleton key={i} index={i} />
            ))}
          </div>
        </div>

        {/* Group 2 */}
        <div>
          <Skeleton variant="line" className="h-4 w-20 mb-3" />
          <div className="border-2 border-black dark:border-white/50 shadow-hard">
            {Array.from({ length: 2 }).map((_, i) => (
              <NotificationItemSkeleton key={i} index={i + 3} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
