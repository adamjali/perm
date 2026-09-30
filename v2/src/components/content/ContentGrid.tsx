"use client";

/**
 * ContentGrid
 *
 * Responsive grid layout for ContentCard items.
 * 1-col mobile, 2-col tablet, 3-col desktop.
 * Cards present at mount render at rest; filtered-in cards animate.
 */

import { AnimatePresence, motion } from "motion/react";
import type { PostSummary } from "@/lib/content/types";
import ContentCard from "./ContentCard";

interface ContentGridProps {
  posts: PostSummary[];
  showType?: boolean;
}

export default function ContentGrid({ posts, showType }: ContentGridProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-heading text-lg font-bold text-muted-foreground">
          No content yet
        </p>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          Check back soon for new articles.
        </p>
      </div>
    );
  }

  // `initial={false}` on AnimatePresence: the cards on screen when the grid
  // MOUNTS render at rest, on a hard load and after a client navigation
  // alike. Only cards a tag filter or search brings in animate. They used to
  // cascade in on every visit, 0.06 s apart, so the 53 guides took over three
  // seconds to appear and the ones below the fold sat blank meanwhile.
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {posts.map((post, i) => (
          <motion.div
            key={`${post.type}-${post.slug}`}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.25,
              // Capped, so a filter that brings in 40 cards finishes in
              // a quarter second rather than walking down the list.
              delay: Math.min(i, 6) * 0.03,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <ContentCard headingLevel={2} post={post} showType={showType} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
