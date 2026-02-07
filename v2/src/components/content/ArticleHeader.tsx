"use client";

/**
 * ArticleHeader
 *
 * Animated article header with breadcrumb, metadata, tags, and featured image.
 * Framer Motion staggered entrance animation.
 */

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import type { PostMeta, ContentType } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";
import { stagger, fadeUp } from "@/lib/content/animations";

interface ArticleHeaderProps {
  meta: PostMeta;
  type: ContentType;
}

export default function ArticleHeader({ meta, type }: ArticleHeaderProps) {
  const config = CONTENT_TYPE_CONFIG[type];

  return (
    <header className="border-b-2 border-border bg-card">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Breadcrumb */}
          <motion.nav
            variants={fadeUp}
            className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <NavLink
              href={`/${type}`}
              className="flex items-center gap-1 transition-colors hover:text-primary"
              spinnerClassName="text-muted-foreground"
              spinnerSize={12}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {config.plural}
            </NavLink>
          </motion.nav>

          {/* Type badge */}
          <motion.span
            variants={fadeUp}
            className="mb-3 inline-block border-2 border-border bg-primary px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-wider text-black"
          >
            {config.label}
          </motion.span>

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            className="mb-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            {meta.title}
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={fadeUp}
            className="mb-6 max-w-3xl text-lg leading-relaxed text-muted-foreground"
          >
            {meta.description}
          </motion.p>

          {/* Meta row */}
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {meta.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(meta.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {meta.readingTime}
            </span>
          </motion.div>

          {/* Tags */}
          {meta.tags.length > 0 && (
            <motion.div
              variants={fadeUp}
              className="mt-4 flex flex-wrap gap-1.5"
            >
              {meta.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Featured image */}
      {meta.image && (
        <div className="border-t-2 border-border">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
            <motion.div
              className="relative -mt-2 aspect-[21/9] overflow-hidden border-2 border-border shadow-hard-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] as const }}
            >
              <Image
                src={meta.image}
                alt={meta.imageAlt ?? meta.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1400px) 100vw, 1400px"
              />
            </motion.div>
          </div>
        </div>
      )}
    </header>
  );
}
