"use client";

/**
 * RelatedPosts
 *
 * Displays a grid of related articles at the bottom of article pages.
 * GSAP scroll-triggered stagger on card entrance.
 */

import { motion } from "framer-motion";
import type { PostSummary } from "@/lib/content/types";
import ContentCard from "./ContentCard";

interface RelatedPostsProps {
  posts: PostSummary[];
}

export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t-2 border-border bg-muted/30">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <motion.h2
          className="mb-8 font-heading text-2xl font-bold"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          Related Articles
        </motion.h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <motion.div
              key={`${post.type}-${post.slug}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.4,
                delay: i * 0.1,
                ease: [0.4, 0, 0.2, 1] as const,
              }}
            >
              <ContentCard post={post} showType />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
