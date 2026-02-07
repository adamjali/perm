/**
 * Article Detail Loading Skeleton
 *
 * Matches the ArticleLayout structure: header, body+sidebar, CTA, related posts.
 * Shared across blog, tutorials, guides, and resources detail pages.
 */

import { Skeleton } from "@/components/ui";

export default function ArticleDetailLoading() {
  return (
    <article>
      {/* Reading progress bar placeholder */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-muted" />

      {/* ── ArticleHeader skeleton ── */}
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
          {/* Breadcrumb */}
          <Skeleton variant="line" className="mb-6 h-4 w-24" />

          {/* Type badge */}
          <Skeleton variant="line" className="mb-3 h-6 w-16" />

          {/* Title */}
          <Skeleton variant="line" className="mb-2 h-10 w-full max-w-2xl sm:h-12" />
          <Skeleton variant="line" className="mb-4 h-10 w-3/4 max-w-xl sm:h-12" />

          {/* Description */}
          <Skeleton variant="line" className="mb-2 h-5 w-full max-w-3xl" />
          <Skeleton variant="line" className="mb-6 h-5 w-2/3 max-w-2xl" />

          {/* Meta row: author, date, reading time */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton variant="line" className="h-4 w-28" />
            <Skeleton variant="line" className="h-4 w-32" />
            <Skeleton variant="line" className="h-4 w-20" />
          </div>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Skeleton variant="line" className="h-5 w-14" />
            <Skeleton variant="line" className="h-5 w-20" />
            <Skeleton variant="line" className="h-5 w-16" />
          </div>
        </div>

        {/* Featured image */}
        <div className="border-t-2 border-border">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
            <Skeleton
              variant="block"
              className="-mt-2 aspect-[21/9] w-full border-2 border-border shadow-hard-lg"
            />
          </div>
        </div>
      </header>

      {/* ── ArticleBody skeleton ── */}
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex gap-12">
          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Paragraph blocks mimicking prose content */}
            <div className="space-y-3">
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-5/6" />
            </div>

            {/* H2 heading */}
            <Skeleton variant="line" className="mt-8 h-8 w-64" />

            <div className="space-y-3">
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-4/5" />
              <Skeleton variant="line" className="h-5 w-full" />
            </div>

            {/* Inline image / callout placeholder */}
            <Skeleton variant="block" className="my-6 h-48 w-full border-2 border-border" />

            <div className="space-y-3">
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-3/4" />
            </div>

            {/* H2 heading */}
            <Skeleton variant="line" className="mt-8 h-8 w-48" />

            <div className="space-y-3">
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-2/3" />
            </div>

            {/* Code block placeholder */}
            <Skeleton variant="block" className="my-6 h-32 w-full border-2 border-border" />

            <div className="space-y-3">
              <Skeleton variant="line" className="h-5 w-full" />
              <Skeleton variant="line" className="h-5 w-5/6" />
            </div>

            {/* Share buttons skeleton */}
            <div className="mt-12 border-t-2 border-border pt-8">
              <Skeleton variant="line" className="mb-4 h-5 w-24" />
              <div className="flex gap-3">
                <Skeleton variant="block" className="h-9 w-9" />
                <Skeleton variant="block" className="h-9 w-9" />
                <Skeleton variant="block" className="h-9 w-9" />
                <Skeleton variant="block" className="h-9 w-24" />
              </div>
            </div>
          </div>

          {/* Sidebar TOC (desktop only) */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24 space-y-4">
              <Skeleton variant="line" className="h-5 w-32" />
              <div className="space-y-2.5 border-l-2 border-border pl-4">
                <Skeleton variant="line" className="h-4 w-44" />
                <Skeleton variant="line" className="h-4 w-36" />
                <Skeleton variant="line" className="h-4 w-48" />
                <Skeleton variant="line" className="h-4 w-32" />
                <Skeleton variant="line" className="h-4 w-40" />
                <Skeleton variant="line" className="h-4 w-28" />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── ContentCTA skeleton ── */}
      <div className="border-y-2 border-border bg-muted/50">
        <div className="mx-auto max-w-[1400px] px-4 py-12 text-center sm:px-8 sm:py-16">
          <Skeleton variant="line" className="mx-auto mb-3 h-8 w-72" />
          <Skeleton variant="line" className="mx-auto mb-6 h-5 w-96 max-w-full" />
          <Skeleton variant="block" className="mx-auto h-11 w-40" />
        </div>
      </div>

      {/* ── RelatedPosts skeleton ── */}
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <Skeleton variant="line" className="mb-6 h-7 w-40" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-2 border-border bg-card shadow-hard">
              <Skeleton variant="block" className="aspect-[16/9] w-full" />
              <div className="p-5">
                <Skeleton variant="line" className="mb-2 h-4 w-20" />
                <Skeleton variant="line" className="mb-2 h-6 w-full" />
                <Skeleton variant="line" className="mb-4 h-4 w-full" />
                <Skeleton variant="line" className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
