"use client";

/**
 * ContentCard
 *
 * Article card for content listings: the picture, the topic, the title and
 * the date. Hover colours the title; nothing moves.
 */

import Image from "next/image";
import { CalendarIcon, CircleNotchIcon, ClockIcon } from "@phosphor-icons/react";
import type { PostSummary } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";
import { topicFor } from "@/lib/content/topics";
import { NavLink, useNavigationContext } from "@/components/ui/nav-link";
import { Badge } from "@/components/ui/badge";

interface ContentCardProps {
  post: PostSummary;
  /** Show content type badge (useful on mixed listings) */
  showType?: boolean;
  /**
   * Where this card's title sits in the page outline.
   *
   * IT GENUINELY DIFFERS BY CONTEXT, which is why it is a prop rather than a
   * constant. On `/blog` and `/guides` the grid IS the page, so each title is
   * a section directly under the <h1> and must be an <h2>; as an <h3> the
   * outline skipped a level on both index pages. Under "Related posts" on an
   * article, the cards sit beneath an <h2> and <h3> is correct.
   *
   * Default 3 so the related-posts strip keeps the level it already had.
   */
  headingLevel?: 2 | 3;
}

export default function ContentCard({
  post,
  showType,
  headingLevel = 3,
}: ContentCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const { slug, type, meta } = post;
  const href = `/${type}/${slug}`;
  const config = CONTENT_TYPE_CONFIG[type];
  const topic = topicFor(type, meta.category);
  const revised = Boolean(meta.updated && meta.updated > meta.date);
  const shown = revised ? meta.updated! : meta.date;
  const context = useNavigationContext();
  const isNavigating = context?.activeNavigation === href;

  return (
    <article>
      <NavLink href={href} className="group block" showLoading={false}>
        {/* ON A PHONE THE CARD LIES ON ITS SIDE: the picture a square at the
            left, the topic, title and date beside it, the excerpt left out.
            Stacked, each card ran about 430 px and the guides index 25,000. */}
        <div
          className={
            "relative border border-border bg-card" +
            (meta.image ? " max-sm:grid max-sm:grid-cols-[7rem_minmax(0,1fr)]" : "")
          }
        >
          {/* Loading overlay */}
          {/* Held back 150ms (fill-mode-both keeps it invisible through the
              delay), so a prefetched article that opens in a frame never
              flashes it; only a slow one shows it. */}
          {isNavigating && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 fill-mode-both duration-150 motion-reduce:animate-none"
              style={{ animationDelay: "150ms" }}
            >
              <CircleNotchIcon className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {/* Image */}
          {meta.image && (
            <div className="relative aspect-[16/9] overflow-hidden border-b border-border max-sm:aspect-auto max-sm:min-h-28 max-sm:border-b-0 max-sm:border-r">
              <Image
                src={meta.image}
                alt={meta.imageAlt ?? meta.title}
                fill
                className="object-cover"
                style={{ objectPosition: meta.imagePosition ?? "center" }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              {/* Type badge overlay */}
              {showType && (
                <Badge className="absolute left-3 top-3 bg-card max-sm:hidden">{config.label}</Badge>
              )}
            </div>
          )}{" "}

          {/* Content */}
          <div className="min-w-0 p-3 sm:p-5">
            {/* The topic it's filed under, in words (lib/content/topics.ts). */}
            {topic ? (
              <p className="mb-2 text-sm font-semibold text-primary-text">{topic.label}</p>
            ) : null}{" "}

            {/* Title */}
            <Heading className="mb-2 font-heading text-base font-bold leading-tight transition-colors duration-200 group-hover:text-primary-text sm:text-lg">
              {meta.title}
            </Heading>{" "}

            {/* Description */}
            <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground max-sm:hidden">
              {meta.description}
            </p>{" "}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {/* The newest date the article carries: a revision outranks the
                  publish date, said as "Updated" so the two can't be confused. */}
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {revised ? "Updated " : null}
                <time dateTime={shown}>
                  {new Date(shown).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </span>{" "}
              <span className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                {meta.readingTime}
              </span>
            </div>
          </div>
        </div>
      </NavLink>
    </article>
  );
}
