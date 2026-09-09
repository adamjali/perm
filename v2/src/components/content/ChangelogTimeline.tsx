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
import { motion } from "motion/react";
import { CalendarIcon, TagIcon } from "@phosphor-icons/react";
import type { PostSummary } from "@/lib/content/types";
import type { Correction } from "@/lib/corrections";
import { useScrollStagger } from "@/lib/hooks/useGSAP";

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
  /**
   * The corrections log, interleaved into this timeline by date.
   *
   * `/corrections` used to be its own route, then briefly its own block at the
   * bottom of this page. Adam on that block: "no corrections shouldn't be all
   * highlighted like that it looks bad, fold them INTO the change log". He is
   * right, and not only visually - fourteen bordered cards in a row read as a
   * wall of alarm, and a correction filed away in its own annexe is a
   * correction the reader of the release notes never meets. One dated history
   * of what this site did, whether that was shipping something or fixing
   * something it got wrong.
   */
  corrections?: Correction[];
}

/** One timeline row: either a release note or a correction. */
type Entry =
  | { kind: "update"; date: string; key: string; post: PostSummary }
  | { kind: "correction"; date: string; key: string; correction: Correction };

export default function ChangelogTimeline({ posts, corrections = [] }: ChangelogTimelineProps) {
  const timelineRef = React.useRef<HTMLDivElement>(null);

  // GSAP stagger for timeline entries
  useScrollStagger(timelineRef, "[data-timeline-entry]", {
    y: 40,
    stagger: 0.15,
    duration: 0.7,
    start: "top 90%",
  });

  if (posts.length === 0 && corrections.length === 0) {
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

  // Newest first, the order the release notes already used. A correction and
  // an update that land on the same day sit next to each other, which is
  // usually exactly the pair: the thing shipped, and the thing it fixed.
  const entries: Entry[] = [
    ...posts.map((post): Entry => ({ kind: "update", date: post.meta.date, key: `u-${post.slug}`, post })),
    ...corrections.map((c): Entry => ({ kind: "correction", date: c.date, key: `c-${c.date}-${c.where}`, correction: c })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div ref={timelineRef} className="relative space-y-6">
      {/* Vertical line */}
      <motion.div
        className="absolute left-4 top-0 bottom-0 w-[2px] origin-top bg-border sm:left-8"
        aria-hidden="true"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      />

      {entries.map((entry) => {
        const isCorrection = entry.kind === "correction";
        return (
        <div
          key={entry.key}
          id={entry.kind === "update" ? entry.post.slug : undefined}
          data-timeline-entry
          className="relative pl-10 sm:pl-16 scroll-mt-24"
        >
          {/* Dot on timeline. A correction gets the page background with a
              border instead of the filled lime: same shape, same line, read as
              a different KIND of event without shouting. */}
          <div
            className={
              "absolute left-[11px] top-4 h-3 w-3 border-2 border-border sm:left-[27px] " +
              (isCorrection ? "bg-background" : "bg-primary")
            }
            aria-hidden="true"
          />

          <div className="border-2 border-border bg-card shadow-hard transition-shadow duration-200 hover:shadow-hard-lg">
            {entry.kind === "update" && entry.post.meta.image ? (
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
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <time dateTime={entry.date}>{fmtDate(entry.date)}</time>
                </span>{" "}
                {isCorrection ? (
                  <span className="font-heading text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
                    Correction
                  </span>
                ) : null}{" "}
                {entry.kind === "update" && entry.post.meta.updated && entry.post.meta.updated !== entry.post.meta.date ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-heading text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Updated
                    </span>{" "}
                    <time dateTime={entry.post.meta.updated}>{fmtDate(entry.post.meta.updated)}</time>
                  </span>
                ) : null}
              </div>{" "}

              <h2 className="mb-2 font-heading text-lg font-bold sm:text-xl">
                {entry.kind === "update" ? (
                  <Link href={`/changelog/${entry.post.slug}`} className="transition-colors hover:text-primary">
                    {entry.post.meta.title}
                  </Link>
                ) : (
                  entry.correction.where
                )}
              </h2>{" "}

              {entry.kind === "update" ? (
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  {entry.post.meta.description}
                </p>
              ) : (
                /* Prose, not a bordered definition list. The three facts still
                   read in order - what it said, what was true, what changed -
                   without a second frame inside the card. */
                <div className="mb-4 space-y-2 leading-relaxed text-muted-foreground">
                  <p>
                    <span className="font-bold text-foreground/80">It said:</span> {entry.correction.said}
                  </p>{" "}
                  <p>
                    <span className="font-bold text-foreground/80">Actually:</span> {entry.correction.truth}
                  </p>{" "}
                  <p>
                    <span className="font-bold text-foreground/80">Changed:</span> {entry.correction.fix}
                    {entry.correction.href ? (
                      <>
                        {" "}
                        <Link href={entry.correction.href} className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                          See the page
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              )}

              {entry.kind === "update" && entry.post.meta.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <TagIcon className="h-3 w-3 text-muted-foreground" />
                  {entry.post.meta.tags.map((tag) => (
                    <React.Fragment key={tag}>
                      {" "}
                      <span className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
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
