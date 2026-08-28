import { Skeleton } from "@/components/ui/skeleton";

/**
 * The one public segment that keeps a loading boundary, and the boundary is
 * segment-local ON PURPOSE.
 *
 * The (public) route group used to carry a shared loading.tsx, and that had
 * two costs. It was a HOME-page skeleton, so every data page flashed a
 * mismatched layout while loading. Worse, a loading boundary makes Next
 * stream a 200 before the page has decided anything, so notFound() on the
 * entity and queue-month routes could swap the UI but never the status -
 * measured live as junk slugs answering HTTP 200 (soft 404s). Removing the
 * group-level file is what lets those routes answer a real 404.
 *
 * This page is different: it renders per request (the case lookup is live
 * DOL-mirror work, ~0.7s), so a visitor deserves feedback - and a lookup
 * page has no miss state that needs a status code (an unknown case renders
 * its own explanation at 200).
 */
export default function CaseStatusLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-10 w-full max-w-xl" />
      <Skeleton className="mt-3 h-5 w-full max-w-md" />
      {/* The record card. */}
      <div className="mt-8 border-2 border-border p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-8 w-64" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
      <Skeleton className="mt-8 h-40 w-full" />
    </div>
  );
}
