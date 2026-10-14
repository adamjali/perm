/**
 * ArticleBody
 *
 * The article's text at a reading width, the share row under it, and the
 * contents list beside it on a wide screen.
 */

import TableOfContents from "./TableOfContents";
import ShareButtons from "./ShareButtons";

interface ArticleBodyProps {
  title: string;
  url: string;
  children: React.ReactNode;
}

export default function ArticleBody({ title, url, children }: ArticleBodyProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex gap-10">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="article-content prose-neobrutalist max-w-none">{children}</div>

          {/* Share buttons */}
          <div className="mt-10 border-t border-border pt-6">
            <ShareButtons title={title} url={url} />
          </div>
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
