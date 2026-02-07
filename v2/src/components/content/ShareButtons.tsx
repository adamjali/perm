"use client";

/**
 * ShareButtons
 *
 * Social share buttons for articles.
 * X (Twitter), LinkedIn, copy link.
 * Framer Motion hover + copy feedback animation.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Check } from "lucide-react";

interface ShareButtonsProps {
  title: string;
  url: string;
}

export default function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = React.useState(false);

  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${url}`
      : `https://permtracker.app${url}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`;

  const buttonClass =
    "flex h-10 w-10 items-center justify-center border-2 border-border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0 active:shadow-none";

  return (
    <div className="flex items-center gap-3">
      <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Share
      </span>

      <motion.a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Share on X (Twitter)"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </motion.a>

      <motion.a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        aria-label="Share on LinkedIn"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </motion.a>

      <motion.button
        type="button"
        onClick={handleCopy}
        className={buttonClass}
        aria-label="Copy link"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Check className="h-4 w-4 text-primary" />
            </motion.span>
          ) : (
            <motion.span
              key="link"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Link2 className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
