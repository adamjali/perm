/**
 * Demo Page Skeleton Loading
 *
 * Skeleton loading state for the interactive demo page.
 * Shows placeholder sections matching the demo page layout.
 *
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function DemoLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner Skeleton */}
      <div className="border-b-4 border-primary bg-primary/10 px-4 py-3">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
        {/* Stats Grid Skeleton */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-brutalist p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left Column - Cases Grid */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card-brutalist p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Skeleton className="h-6 w-40 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full mb-3" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Calendar & Timeline */}
          <div className="space-y-6">
            {/* Mini Calendar Skeleton */}
            <div className="card-brutalist p-4">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-48 w-full" />
            </div>

            {/* Mini Timeline Skeleton */}
            <div className="card-brutalist p-4">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section Skeleton */}
      <section className="mt-16 bg-primary py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-8">
          <Skeleton className="mx-auto h-10 w-80 mb-4 bg-black/20" />
          <Skeleton className="mx-auto h-5 w-96 mb-8 bg-black/20" />
          <div className="flex justify-center gap-4">
            <Skeleton className="h-14 w-48 bg-black/20" />
            <Skeleton className="h-14 w-40 bg-black/20" />
          </div>
        </div>
      </section>
    </div>
  );
}
