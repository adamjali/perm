/**
 * The case list while its first page loads. ONE component, rendered by both
 * cases/loading.tsx and the page itself, because two different skeletons
 * would show one layout on a click, swap to another, then the real page.
 * Each block holds the real part's size (the card measured at 254px with its
 * dates fold), so nothing moves when the cases arrive.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { PageHeading } from "../../components/PageHeading";

function CaseCardSkeleton() {
  return (
    <div className="border border-border bg-card">
      <div className="space-y-3 p-5">
        <div className="flex min-h-11 items-center justify-between">
          <Skeleton variant="block" className="h-7 w-24" />
          <Skeleton variant="block" className="h-7 w-16" />
        </div>
        <Skeleton variant="line" className="h-6 w-3/4" />
        <Skeleton variant="line" className="h-4 w-1/2" />
        <Skeleton variant="line" className="h-5 w-full" />
        <Skeleton variant="block" className="h-7 w-40" />
      </div>
      <div className="flex min-h-11 items-center border-t border-border px-5">
        <Skeleton variant="line" className="h-4 w-20" />
      </div>
    </div>
  );
}

export function CasesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <PageHeading meta={<Skeleton variant="line" className="inline-block h-4 w-16 align-middle" />} title="Cases" />
          <Skeleton variant="block" className="h-11 w-[5.5rem]" />
        </div>
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0 md:flex md:flex-wrap md:items-center">
          <Skeleton variant="block" className="h-11 md:w-24" />
          <Skeleton variant="block" className="h-11 md:w-40" />
          <Skeleton variant="block" className="order-first col-span-2 h-12 md:order-none md:col-span-1 md:w-32" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2 sm:flex">
          <Skeleton variant="block" className="h-11 sm:w-20" />
          <Skeleton variant="block" className="h-11 sm:w-28" />
          <Skeleton variant="block" className="h-11 sm:w-20" />
          <Skeleton variant="block" className="h-11 sm:w-14" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton variant="block" className="h-11 min-w-0 flex-1 basis-64" />
          <Skeleton variant="block" className="h-11 w-24" />
          <Skeleton variant="block" className="h-11 w-56 max-sm:w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CaseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
