"use client";

/**
 * ContentSearch
 *
 * Client-side content search input.
 * Filters posts by title and description.
 * Focus ring animation + clear button.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";

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
        className="w-full border-2 border-border bg-card py-2.5 pl-10 pr-10 font-mono text-sm transition-all duration-200 focus:border-primary focus:shadow-hard-sm focus:outline-none focus:ring-0"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear search"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <X className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
