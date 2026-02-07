"use client";

/**
 * ArticleBody
 *
 * Client component wrapping article content area + sidebar.
 * Handles FM fade-in for content and share buttons.
 */

import { motion } from "framer-motion";
import TableOfContents from "./TableOfContents";
import ShareButtons from "./ShareButtons";

interface ArticleBodyProps {
  title: string;
  url: string;
  children: React.ReactNode;
}

export default function ArticleBody({ title, url, children }: ArticleBodyProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex gap-12">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <motion.div
            className="prose-neobrutalist max-w-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {children}
          </motion.div>

          {/* Share buttons */}
          <motion.div
            className="mt-12 border-t-2 border-border pt-8"
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
