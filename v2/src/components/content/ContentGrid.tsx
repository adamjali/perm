/**
 * ContentGrid
 *
 * Responsive grid layout for ContentCard items.
 * 1-col mobile, 2-col tablet, 3-col desktop. Nothing animates: a filter
 * shows its matches at once.
 */

import type { PostSummary } from "@/lib/content/types";
import ContentCard from "./ContentCard";

interface ContentGridProps {
  posts: PostSummary[];
  showType?: boolean;
  /** 3 under a topic heading on the sectioned listings, 2 where the grid is the page. */
  headingLevel?: 2 | 3;
  /** Paging: the slugs on the current page. Every post is rendered; the rest are hidden, so their links stay. */
  shown?: Set<string>;
}

export default function ContentGrid({ posts, showType, headingLevel = 2, shown }: ContentGridProps) {
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

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) =>
        shown ? (
          // Off the current page, a card stays in the HTML (every article keeps its link from the list) and is hidden.
          <div key={`${post.type}-${post.slug}`} className={shown.has(post.slug) ? "contents" : "hidden"}>
            <ContentCard headingLevel={headingLevel} post={post} showType={showType} />
          </div>
        ) : (
          <ContentCard key={`${post.type}-${post.slug}`} headingLevel={headingLevel} post={post} showType={showType} />
        ),
      )}
    </div>
  );
}
