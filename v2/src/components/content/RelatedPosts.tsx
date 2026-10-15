/**
 * RelatedPosts
 *
 * Up to three related articles at the foot of an article page.
 */

import type { PostSummary } from "@/lib/content/types";
import ContentCard from "./ContentCard";

interface RelatedPostsProps {
  posts: PostSummary[];
}

export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t-2 border-border">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-12">
        <h2 className="mb-6 font-heading text-xl font-bold">Related articles</h2>{" "}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <ContentCard key={`${post.type}-${post.slug}`} post={post} showType />
          ))}
        </div>
      </div>
    </section>
  );
}
