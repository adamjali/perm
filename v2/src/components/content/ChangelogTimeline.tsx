"use client";

/**
 * ChangelogTimeline
 *
 * Timeline-style display for changelog/update entries.
 * Each entry is expanded inline (no separate detail pages).
 * GSAP scroll-triggered stagger for entries. FM for vertical line entrance.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarIcon, TagIcon } from "@phosphor-icons/react";
import type { PostSummary } from "@/lib/content/types";
import { useScrollStagger } from "@/hooks/useGSAP";

// Shared formatting for the entry's published/updated <time> elements. Module
// scope so the Intl.DateTimeFormatOptions object isn’t reallocated each render.
const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
};
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", DATE_FMT);

interface ChangelogTimelineProps {
  posts: PostSummary[];
}

/**
 * One timeline row.
 *
 * Every row is an ordinary changelog post, corrections included: they are one
 * entry (`content/changelog/corrections.mdx`, category "Correction") that
 * names each page, quotes what it said, states what was true and says what
 * changed, and `corrections-entry.test.ts` holds it to that.
 */
type Entry = { date: string; key: string; post: PostSummary };

export default function ChangelogTimeline({ posts }: ChangelogTimelineProps) {
  const timelineRef = React.useRef<HTMLDivElement>(null);

  // GSAP stagger for timeline entries
  useScrollStagger(timelineRef, "[data-timeline-entry]", {
    y: 40,
    stagger: 0.15,
    duration: 0.7,
    start: "top 90%",
  });

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-heading text-lg font-bold text-muted-foreground">
          No updates yet
        </p>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          Check back soon for product updates.
        </p>
      </div>
    );
  }

  // Newest first, the order the release notes already used.
  const entries: Entry[] = posts
    .map((post): Entry => ({ date: post.meta.date, key: post.slug, post }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div ref={timelineRef} className="relative space-y-6">
      {/* Vertical line */}
      {/* Drawn, not animated: an unguarded scaleY(0) shipped the line hidden
          in the server HTML and drew it in after hydration on every load. */}
      <div
        className="absolute left-4 top-0 bottom-0 w-[2px] bg-border sm:left-8"
        aria-hidden="true"
      />

      {entries.map((entry) => {
        return (
        <div
          key={entry.key}
          id={entry.post.slug}
          data-timeline-entry
          className="relative pl-10 sm:pl-16 scroll-mt-24"
        >
          {/* Dot on timeline. */}
          <div
            className="absolute left-[11px] top-4 h-3 w-3 border-2 border-border bg-primary sm:left-[27px]"
            aria-hidden="true"
          />

          <div className="border-2 border-border bg-card shadow-hard transition-shadow duration-200 hover:shadow-hard-lg">
            {entry.post.meta.image ? (
              <div className="relative aspect-[21/9] overflow-hidden border-b-2 border-border">
                <Image
                  src={entry.post.meta.image}
                  alt={entry.post.meta.imageAlt ?? entry.post.meta.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1400px) 100vw, 1200px"
                />
              </div>
            ) : null}

            <div className="p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <time dateTime={entry.date}>{fmtDate(entry.date)}</time>
                </span>{" "}
                {entry.post.meta.updated && entry.post.meta.updated !== entry.post.meta.date ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-heading text-sm font-semibold uppercase tracking-wider text-primary">
                      Updated
                    </span>{" "}
                    <time dateTime={entry.post.meta.updated}>{fmtDate(entry.post.meta.updated)}</time>
                  </span>
                ) : null}
              </div>{" "}

              <h2 className="mb-2 font-heading text-lg font-bold sm:text-xl">
                <Link href={`/changelog/${entry.post.slug}`} className="transition-colors hover:text-primary">
                  {entry.post.meta.title}
                </Link>
              </h2>{" "}

              <p className="mb-4 leading-relaxed text-muted-foreground">
                {entry.post.meta.description}
              </p>

              {entry.post.meta.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <TagIcon className="h-3 w-3 text-muted-foreground" />
                  {entry.post.meta.tags.map((tag) => (
                    <React.Fragment key={tag}>
                      {" "}
                      <span className="border border-border bg-muted px-1.5 py-0.5 font-mono text-sm uppercase tracking-wider text-muted-foreground">
                        {tag}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
