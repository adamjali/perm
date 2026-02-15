"use client";

/**
 * ContentCard
 *
 * Article card for content listings.
 * Neobrutalist design: hard shadow, 0 radius, bold typography.
 * Framer Motion whileHover lift + image zoom.
 */

import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, Clock, Loader2 } from "lucide-react";
import type { PostSummary } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";
import { NavLink, useNavigationContext } from "@/components/ui/nav-link";

interface ContentCardProps {
  post: PostSummary;
  /** Show content type badge (useful on mixed listings) */
  showType?: boolean;
}

export default function ContentCard({ post, showType }: ContentCardProps) {
  const { slug, type, meta } = post;
  const href = `/${type}/${slug}`;
  const config = CONTENT_TYPE_CONFIG[type];
  const context = useNavigationContext();
  const isNavigating = context?.activeNavigation === href;

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <NavLink href={href} className="group block" showLoading={false}>
        <div className="relative border-2 border-border bg-card shadow-hard transition-shadow duration-150 group-hover:shadow-hard-lg">
          {/* Loading overlay */}
          {isNavigating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {/* Image */}
          {meta.image && (
            <div className="relative aspect-[16/9] overflow-hidden border-b-2 border-border">
              <Image
                src={meta.image}
                alt={meta.imageAlt ?? meta.title}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              {/* Type badge overlay */}
              {showType && (
                <span className="absolute left-3 top-3 border-2 border-black bg-primary px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-black">
                  {config.label}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-4 sm:p-5">
            {/* Tags */}
            {meta.tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {meta.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h3 className="mb-2 font-heading text-lg font-bold leading-tight transition-colors duration-200 group-hover:text-primary sm:text-xl">
              {meta.title}
            </h3>

            {/* Description */}
            <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {meta.description}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(meta.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {meta.readingTime}
              </span>
            </div>
          </div>
        </div>
      </NavLink>
    </motion.article>
  );
}
