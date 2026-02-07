"use client";

/**
 * ContentGrid
 *
 * Responsive grid layout for ContentCard items.
 * 1-col mobile, 2-col tablet, 3-col desktop.
 * GSAP ScrollTrigger stagger animation on scroll.
 */

import { AnimatePresence, motion } from "framer-motion";
import type { PostSummary } from "@/lib/content/types";
import ContentCard from "./ContentCard";

interface ContentGridProps {
  posts: PostSummary[];
  showType?: boolean;
}

export default function ContentGrid({ posts, showType }: ContentGridProps) {
  if (posts.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <p className="font-heading text-lg font-bold text-muted-foreground">
          No content yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back soon for new articles.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {posts.map((post, i) => (
          <motion.div
            key={`${post.type}-${post.slug}`}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.35,
              delay: i * 0.06,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <ContentCard post={post} showType={showType} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
