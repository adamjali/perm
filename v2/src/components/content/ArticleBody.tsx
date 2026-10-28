/**
 * ArticleBody
 *
 * The article's text at a reading width, the share row under it, and the
 * contents list beside it on a wide screen.
 */

import Link from "next/link";
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
          <div className="article-content prose-article max-w-none">{children}</div>

          {/* Who stands behind it, and where a mistake goes: on every article. */}
          <p className="mt-10 border-t border-border pt-6 text-base leading-relaxed text-soft">
            <Link href="/editorial-standards" className="link">
              How we write and check our guides
            </Link>
            . Spotted an error?{" "}
            <Link href="/contact" className="link">
              Tell us
            </Link>
            ; every fix is dated in the{" "}
            <Link href="/changelog/corrections" className="link">
              corrections log
            </Link>
            .
          </p>{" "}

          {/* Share buttons */}
          <div className="mt-6">
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
