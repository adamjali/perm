/**
 * ArticleLayout
 *
 * Shared layout for individual article/post pages.
 * Two-column: content + sidebar (TOC).
 * Delegates animated sections to client components (ArticleHeader, ArticleSidebar).
 * MDX content renders as server components passed through as children.
 */

import type { PostMeta, ContentType, PostSummary } from "@/lib/content/types";
import ArticleHeader from "./ArticleHeader";
import ArticleBody from "./ArticleBody";
import RelatedPosts from "./RelatedPosts";
import ContentCTA from "./ContentCTA";
import ReadingProgress from "./ReadingProgress";

interface ArticleLayoutProps {
  meta: PostMeta;
  type: ContentType;
  slug: string;
  related: PostSummary[];
  children: React.ReactNode;
}

export default function ArticleLayout({
  meta,
  type,
  slug,
  related,
  children,
}: ArticleLayoutProps) {
  const url = `/${type}/${slug}`;

  return (
    <article>
      <ReadingProgress />
      <ArticleHeader meta={meta} type={type} />

      <ArticleBody title={meta.title} url={url}>
        {children}
      </ArticleBody>

      <ContentCTA />
      {related.length > 0 && <RelatedPosts posts={related} />}
    </article>
  );
}
