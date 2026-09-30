"use client";

/**
 * ArticleBody
 *
 * Client component wrapping article content area + sidebar.
 * The share row reveals on scroll; the article itself renders at rest.
 */

import { motion } from "motion/react";
import TableOfContents from "./TableOfContents";
import ShareButtons from "./ShareButtons";

interface ArticleBodyProps {
  title: string;
  url: string;
  children: React.ReactNode;
}

export default function ArticleBody({ title, url, children }: ArticleBodyProps) {
  // No entrance animation, on any load (initial={false}). This sits above the
  // fold: on a hard load a fade hid server markup until hydration, and after
  // a client navigation it replayed over a page that had just replaced its
  // skeleton, so readers saw skeleton, blank, then a fade. The whileInView
  // reveals in this directory stay: hiding below-the-fold content until it
  // is scrolled to is what those are for.
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex gap-10">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <motion.div
            className="article-content prose-neobrutalist max-w-none"
            initial={false}
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
