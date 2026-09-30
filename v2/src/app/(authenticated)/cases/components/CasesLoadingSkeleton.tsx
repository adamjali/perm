/**
 * The case list while its first page loads. ONE component, rendered by both
 * cases/loading.tsx and the page itself: they used to be two different
 * skeletons (a 72px filter bar then a 160px one, 180px cards then 256px), so
 * a click showed one layout, swapped to another, then the real page. No
 * entrance animations: staggered delays made each block appear, vanish and
 * fade back in (tw-animate's fill mode does not hold the first frame).
 */

import { Skeleton } from "@/components/ui/skeleton";
import { PageHeading } from "../../components/PageHeading";

function CaseCardSkeleton() {
  return (
    <div className="relative mt-8">
      {/* Folder Tab Skeleton */}
      <div className="absolute -top-4 left-6 w-28 h-5 z-10">
        <Skeleton variant="block" className="w-full h-full" />
      </div>

      {/* Folder Body: 288px plus the 32px tab offset is the real card's
          height in a row of ordinary cases (measured Sep 30 2026). */}
      <div className="border-2 border-border bg-manila shadow-hard p-6 pt-10 min-h-[288px]">
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
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Skeleton variant="block" className="flex-1 h-8" />
          <Skeleton variant="block" className="w-16 h-8" />
          <Skeleton variant="block" className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
}

export function CasesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* The page's own header row: the real title (only the count in the
          eyebrow waits), the view toggle, and the three buttons in the
          real grid (phone: Add first and full width, two tools under it). */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <PageHeading
            eyebrow={<Skeleton variant="line" className="inline-block h-4 w-16 align-middle" />}
            title="Cases"
          />
          <Skeleton variant="block" className="h-11 w-[5.5rem]" />
        </div>
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0 md:flex md:flex-wrap md:items-center">
          <Skeleton variant="block" className="h-11 md:h-10 md:w-28" />
          <Skeleton variant="block" className="h-11 md:h-10 md:w-40" />
          <Skeleton variant="block" className="order-first col-span-2 h-11 md:order-none md:col-span-1 md:h-10 md:w-32" />
        </div>
      </div>

      {/* The filter bar as it really is (measured on production, Sep 30
          2026): a bordered p-5 box with two rows of 36px controls, the
          status tabs over the search and its menus, 136px in all. The first
          version was one 76px row, so the cards jumped 60px on arrival. */}
      <div className="space-y-5 border-2 border-border bg-background p-5 shadow-hard">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Skeleton variant="block" className="h-9 sm:w-20" />
          <Skeleton variant="block" className="h-9 sm:w-28" />
          <Skeleton variant="block" className="h-9 sm:w-36" />
          <Skeleton variant="block" className="h-9 sm:w-14" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-row md:flex-wrap md:items-center">
          <Skeleton variant="block" className="col-span-2 h-9 md:w-[364px]" />
          <Skeleton variant="block" className="h-9 md:w-36" />
          <Skeleton variant="block" className="h-9 md:w-52" />
          <Skeleton variant="block" className="h-9 md:w-32" />
          <Skeleton variant="block" className="col-span-2 h-9 md:w-60" />
          <Skeleton variant="block" className="h-9 md:w-36" />
        </div>
      </div>

      {/* Case Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <CaseCardSkeleton key={i} />
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between py-4">
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
