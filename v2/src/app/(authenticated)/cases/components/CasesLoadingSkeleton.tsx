/**
 * Loading skeleton for the cases page initial load.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function CasesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div
        className="flex items-center justify-between animate-in fade-in fill-mode-forwards"
        style={{ animationDuration: "0.2s" }}
      >
        <div>
          <Skeleton variant="line" className="w-32 h-10 mb-2" />
          <Skeleton variant="line" className="w-48 h-6" />
        </div>
        <Skeleton variant="block" className="w-32 h-10" />
      </div>

      {/* Filter Bar Skeleton */}
      <div
        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards"
        style={{ animationDelay: "50ms", animationDuration: "0.3s" }}
      >
        <Skeleton variant="block" className="h-40" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards"
            style={{
              animationDelay: `${100 + i * 50}ms`,
              animationDuration: "0.3s",
            }}
          >
            <Skeleton variant="block" className="h-64 mt-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
