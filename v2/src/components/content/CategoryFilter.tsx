"use client";

/**
 * CategoryFilter
 *
 * Filterable tag pills for content listing pages.
 * Click to filter, click again to clear.
 * Framer Motion layout animation on active state change.
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export default function CategoryFilter({
  tags,
  activeTag,
  onTagChange,
}: CategoryFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onTagChange(null)}
        className={cn(
          "relative border-2 border-border px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide transition-colors duration-150",
          activeTag === null
            ? "bg-primary text-black"
            : "bg-card text-muted-foreground hover:bg-muted"
        )}
      >
        {activeTag === null && (
          <motion.div
            layoutId="activeFilter"
            className="absolute inset-0 border-2 border-black bg-primary"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onTagChange(activeTag === tag ? null : tag)}
          className={cn(
            "relative border-2 border-border px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors duration-150",
            activeTag === tag
              ? "bg-primary font-bold text-black"
              : "bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          {activeTag === tag && (
            <motion.div
              layoutId="activeFilter"
              className="absolute inset-0 border-2 border-black bg-primary"
              style={{ zIndex: -1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          {tag}
        </button>
      ))}
    </div>
  );
}
