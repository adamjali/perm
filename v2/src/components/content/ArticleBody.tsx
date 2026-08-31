"use client";

/**
 * ArticleBody
 *
 * Client component wrapping article content area + sidebar.
 * Handles FM fade-in for content and share buttons.
 */

import { motion } from "motion/react";
import TableOfContents from "./TableOfContents";
import ShareButtons from "./ShareButtons";
import { useHasHydratedOnce } from "@/hooks/useHasHydratedOnce";

interface ArticleBodyProps {
  title: string;
  url: string;
  children: React.ReactNode;
}

export default function ArticleBody({ title, url, children }: ArticleBodyProps) {
  // Entrance animations are skipped on the FIRST paint of the session, so the
  // server's markup is visible with no JavaScript and does not gate LCP. The
  // whileInView reveals in this directory are deliberately NOT guarded: hiding
  // below-the-fold content until it is scrolled to is what those are for.
  const hydrated = useHasHydratedOnce();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex gap-10">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <motion.div
            className="article-content prose-neobrutalist max-w-none"
            initial={hydrated ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {children}
          </motion.div>

          {/* Share buttons */}
          <motion.div
            className="mt-10 border-t-2 border-border pt-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <ShareButtons title={title} url={url} />
          </motion.div>
        </div>

        {/* Sidebar (desktop only) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24">
            <TableOfContents />
          </div>
        </aside>
      </div>
    </div>
  );
}
