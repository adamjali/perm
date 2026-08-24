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
import { motion } from "motion/react";
import { Calendar, Tag } from "lucide-react";
import type { PostSummary } from "@/lib/content/types";
import { useScrollStagger } from "@/lib/hooks/useGSAP";

// Shared formatting for the entry's published/updated <time> elements. Module
// scope so the Intl.DateTimeFormatOptions object isn't reallocated each render.
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

      {posts.map((post) => (
        <div
          key={`${post.type}-${post.slug}`}
          id={post.slug}
          data-timeline-entry
          className="relative pl-10 sm:pl-16 scroll-mt-24"
        >
          {/* Dot on timeline */}
          <div
            className="absolute left-[11px] top-4 h-3 w-3 border-2 border-border bg-primary sm:left-[27px]"
            aria-hidden="true"
          />

          {/* Card */}
          <div className="border-2 border-border bg-card shadow-hard transition-shadow duration-200 hover:shadow-hard-lg">
            {/* Header with image */}
            {post.meta.image && (
              <div className="relative aspect-[21/9] overflow-hidden border-b-2 border-border">
                <Image
                  src={post.meta.image}
                  alt={post.meta.imageAlt ?? post.meta.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1400px) 100vw, 1200px"
                />
              </div>
            )}

            <div className="p-4 sm:p-5">
              {/* Dates: published + (optional) updated. Semantic <time> elements
                  give Google a clear date signal alongside the JSON-LD ItemList. */}
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <time dateTime={post.meta.date}>{fmtDate(post.meta.date)}</time>
                </span>{" "}
                {post.meta.updated && post.meta.updated !== post.meta.date && (
                  <span className="flex items-center gap-1.5">
                    <span className="font-heading text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Updated
                    </span>{" "}
                    <time dateTime={post.meta.updated}>{fmtDate(post.meta.updated)}</time>
                  </span>
                )}
              </div>{" "}

              {/* Title */}
              <h2 className="mb-2 font-heading text-lg font-bold sm:text-xl">
                {post.meta.title}
              </h2>{" "}

              {/* Description */}
              <p className="mb-4 leading-relaxed text-muted-foreground">
                {post.meta.description}
              </p>

              {/* Tags */}
              {post.meta.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {post.meta.tags.map((tag) => (
                    // Mapped siblings glue: "changelogupdatetimelineaiux".
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
      ))}
    </div>
  );
}
