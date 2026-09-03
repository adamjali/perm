"use client";

/**
 * ContentSearch
 *
 * Client-side content search input.
 * Filters posts by title and description.
 * Focus border + shadow transition, clear button.
 */

import { motion, AnimatePresence } from "motion/react";
import { MagnifyingGlassIcon as Search, XIcon } from "@phosphor-icons/react";

interface ContentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function ContentSearch({
  value,
  onChange,
  placeholder = "Search articles...",
}: ContentSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 border-2 border-border bg-card py-2.5 pl-10 pr-12 font-mono text-sm transition-all duration-200 focus:border-primary focus:shadow-hard-sm focus:outline-none focus:ring-0"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            onClick={() => onChange("")}
            /* The tap target was the 16px icon itself. 44px is the floor, and
               a clear button that is hard to hit on a phone is a control that
               reads as broken rather than small. The glyph stays where it was;
               only the hit area around it grew, and the input's right padding
               went to `pr-12` so text cannot run underneath it. */
            className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Clear search"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <XIcon className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
