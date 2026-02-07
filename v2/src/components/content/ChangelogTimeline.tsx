"use client";

/**
 * ChangelogTimeline
 *
 * Timeline-style display for changelog/update entries.
 * Each entry is expanded inline (no separate detail pages).
 * GSAP-powered stagger reveal on scroll.
 */

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, Tag } from "lucide-react";
import type { PostSummary } from "@/lib/content/types";
import { useScrollStagger } from "@/lib/hooks/useGSAP";

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
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back soon for product updates.
        </p>
      </div>
    );
  }

  return (
    <div ref={timelineRef} className="relative space-y-8">
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
          data-timeline-entry
          className="relative pl-10 sm:pl-16"
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

            <div className="p-5 sm:p-6">
              {/* Date */}
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(post.meta.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>

              {/* Title */}
              <h2 className="mb-2 font-heading text-xl font-bold sm:text-2xl">
                {post.meta.title}
              </h2>

              {/* Description */}
              <p className="mb-4 leading-relaxed text-muted-foreground">
                {post.meta.description}
              </p>

              {/* Tags */}
              {post.meta.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {post.meta.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {tag}
                    </span>
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
