/**
 * Home Page Skeleton Loading
 *
 * Skeleton loading state for the landing page.
 * Shows placeholder sections matching the home page layout.
 *
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <>
      {/* Hero Section Skeleton */}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1400px] items-center px-4 py-12 sm:px-8 sm:py-16 lg:py-20">
          <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left column - Text content */}
            <div className="flex flex-col gap-6">
              {/* Eyebrow */}
              <Skeleton className="h-5 w-64" />
              {/* Headline */}
              <div className="space-y-2">
                <Skeleton className="h-12 w-full sm:h-16" />
                <Skeleton className="h-12 w-3/4 sm:h-16" />
              </div>
              {/* Subheadline */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
              </div>
              {/* CTAs */}
              <div className="flex flex-wrap gap-4 pt-4">
                <Skeleton className="h-14 w-48" />
                <Skeleton className="h-14 w-40" />
              </div>
              {/* Trust signal */}
              <Skeleton className="h-4 w-72" />
            </div>
            {/* Right column - Hero image placeholder */}
            <div className="relative">
              <Skeleton className="aspect-[4/3] w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip Skeleton */}
      <div className="border-y-4 border-black bg-black py-4 dark:border-white">
        <div className="flex items-center justify-center gap-8">
          <Skeleton className="h-6 w-32 bg-white/20" />
          <Skeleton className="h-6 w-32 bg-white/20" />
          <Skeleton className="h-6 w-32 bg-white/20" />
          <Skeleton className="h-6 w-32 bg-white/20" />
        </div>
      </div>

      {/* Journey Section Skeleton */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          <div className="mb-12 text-center">
            <Skeleton className="mx-auto h-10 w-96 mb-4" />
            <Skeleton className="mx-auto h-5 w-80" />
          </div>
          <div className="flex gap-6 overflow-hidden">
            <Skeleton className="h-64 w-80 flex-shrink-0" />
            <Skeleton className="h-64 w-80 flex-shrink-0" />
            <Skeleton className="h-64 w-80 flex-shrink-0" />
            <Skeleton className="h-64 w-80 flex-shrink-0" />
          </div>
        </div>
      </section>

      {/* Features Grid Skeleton */}
      <section className="py-20 sm:py-28 bg-muted/50">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          <div className="mb-12 text-center">
            <Skeleton className="mx-auto h-10 w-80 mb-4" />
            <Skeleton className="mx-auto h-5 w-96" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Skeleton */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          <div className="mb-12 text-center">
            <Skeleton className="mx-auto h-10 w-64 mb-4" />
            <Skeleton className="mx-auto h-5 w-80" />
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="mx-auto h-16 w-16 rounded-full mb-4" />
                <Skeleton className="mx-auto h-6 w-32 mb-2" />
                <Skeleton className="mx-auto h-4 w-48" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section Skeleton */}
      <section className="bg-primary py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-8">
          <Skeleton className="mx-auto h-12 w-96 mb-4 bg-black/20" />
          <Skeleton className="mx-auto h-5 w-80 mb-8 bg-black/20" />
          <div className="flex justify-center gap-4">
            <Skeleton className="h-14 w-48 bg-black/20" />
            <Skeleton className="h-14 w-40 bg-black/20" />
          </div>
        </div>
      </section>
    </>
  );
}
