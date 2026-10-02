"use client";

/**
 * ContentHero
 *
 * Hero banner for content section landing pages.
 * Neobrutalist: bold type, hard edges, decorative accents.
 * GSAP parallax grid; the text renders at rest, with no entrance animation.
 */

import * as React from "react";
import Image from "next/image";
import { motion } from "motion/react";
import type { ContentType } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";
import { stagger, fadeUp } from "@/lib/content/animations";
import { useParallax } from "@/hooks/useGSAP";

/** Hero background images per content type */
const HERO_IMAGES: Partial<Record<ContentType, string>> = {
  blog: "/images/content/blog-hero.png",
  guides: "/images/content/guides-hero.png",
};

interface ContentHeroProps {
  type: ContentType;
  /** Override the default title */
  title?: string;
  /** Override the default description */
  description?: string;
  /** Total post count to show */
  postCount?: number;
}

export default function ContentHero({
  type,
  title,
  description,
  postCount,
}: ContentHeroProps) {
  // No entrance animation, on any load (initial={false}). This sits above the
  // fold: on a hard load a fade hid server markup until hydration, and after
  // a client navigation it replayed over a page that had just replaced its
  // skeleton, so readers saw skeleton, blank, then a fade. The whileInView
  // reveals in this directory stay: hiding below-the-fold content until it
  // is scrolled to is what those are for.
  const config = CONTENT_TYPE_CONFIG[type];
  const gridRef = React.useRef<HTMLDivElement>(null);
  const heroImage = HERO_IMAGES[type];
  useParallax(gridRef, -0.15);

  return (
    <section className="relative overflow-hidden border-b-2 border-border bg-card">
      {/* Background hero image */}
      {heroImage && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Image
            src={heroImage}
            alt=""
            fill
            className="object-cover opacity-[0.08] dark:opacity-[0.06]"
            sizes="100vw"
            priority
          />
        </div>
      )}

      {/* Decorative grid background with parallax */}
      <div
        ref={gridRef}
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          willChange: "transform",
        }}
      />

      {/* Decorative accent shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute -right-16 -top-16 h-64 w-64 border-4 border-primary/10"
          initial={false}
          animate={{ opacity: 1, rotate: 12 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
        />
        <motion.div
          className="absolute -bottom-8 -left-8 h-32 w-32 bg-primary/5"
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
        />
      </div>{" "}

      <div className="relative mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <motion.div
          variants={stagger}
          initial={false}
          animate="show"
        >
          {/* Type badge */}
          <motion.span
            variants={fadeUp}
            className="mb-4 inline-block border-2 border-border bg-primary px-3 py-1 font-heading text-sm font-bold uppercase tracking-wider text-black"
          >
            {config.label}
          </motion.span>{" "}

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            className="mb-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            {title ?? config.plural}
          </motion.h1>{" "}

          {/* Description */}
          <motion.p
            variants={fadeUp}
            className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {description ?? config.description}
          </motion.p>

          {/* Post count */}
          {postCount !== undefined && (
            <motion.p
              variants={fadeUp}
              className="mt-4 font-mono text-sm text-muted-foreground"
            >
              {postCount} {postCount === 1 ? "article" : "articles"}
            </motion.p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
