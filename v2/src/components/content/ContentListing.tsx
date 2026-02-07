"use client";

/**
 * ContentListing
 *
 * Client-side content listing with search and tag filtering.
 * Used by all listing pages (blog, tutorials, guides, resources).
 */

import * as React from "react";
import type { PostSummary } from "@/lib/content/types";
import ContentGrid from "./ContentGrid";
import CategoryFilter from "./CategoryFilter";
import ContentSearch from "./ContentSearch";

interface ContentListingProps {
  posts: PostSummary[];
  tags: string[];
  showType?: boolean;
}

export default function ContentListing({
  posts,
  tags,
  showType,
}: ContentListingProps) {
  const [search, setSearch] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    let result = posts;

    if (activeTag) {
      result = result.filter((p) => p.meta.tags.includes(activeTag));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.meta.title.toLowerCase().includes(q) ||
          p.meta.description.toLowerCase().includes(q) ||
          p.meta.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [posts, activeTag, search]);

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CategoryFilter
          tags={tags}
          activeTag={activeTag}
          onTagChange={setActiveTag}
        />
        <div className="w-full sm:max-w-xs">
          <ContentSearch value={search} onChange={setSearch} />
        </div>
      </div>

      {/* Results */}
      <ContentGrid posts={filtered} showType={showType} />

      {/* Result count */}
      {(search || activeTag) && (
        <p className="text-center font-mono text-xs text-muted-foreground">
          Showing {filtered.length} of {posts.length} articles
          {activeTag && ` tagged "${activeTag}"`}
          {search && ` matching "${search}"`}
        </p>
      )}
    </div>
  );
}
