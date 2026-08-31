"use client";

/**
 * ContentGrid
 *
 * Responsive grid layout for ContentCard items.
 * 1-col mobile, 2-col tablet, 3-col desktop.
 * GSAP ScrollTrigger stagger animation on scroll.
 */

import { AnimatePresence, motion } from "motion/react";
import type { PostSummary } from "@/lib/content/types";
import ContentCard from "./ContentCard";
import { useHasHydratedOnce } from "@/hooks/useHasHydratedOnce";

interface ContentGridProps {
  posts: PostSummary[];
  showType?: boolean;
}

export default function ContentGrid({ posts, showType }: ContentGridProps) {
  // Entrance animations are skipped on the FIRST paint of the session, so the
  // server's markup is visible with no JavaScript and does not gate LCP. The
  // whileInView reveals in this directory are deliberately NOT guarded: hiding
  // below-the-fold content until it is scrolled to is what those are for.
  const hydrated = useHasHydratedOnce();
  if (posts.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20 text-center"
        initial={hydrated ? { opacity: 0, scale: 0.95 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <p className="font-heading text-lg font-bold text-muted-foreground">
          No content yet
        </p>{" "}
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
            initial={hydrated ? { opacity: 0, y: 20 } : false}
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
