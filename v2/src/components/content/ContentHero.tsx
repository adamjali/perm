/**
 * ContentHero
 *
 * The top of the guides, blog and changelog listings: the same heading, summary
 * and spacing as every other page's top, plus how many articles the list holds.
 *
 * It used to carry a type badge in capitals, a faded stock picture behind the
 * text, a parallax grid and two decorative squares, and a lighter heading than
 * the rest of the site. The listing below is the content; the top says what it is.
 */

import type { ContentType } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";

interface ContentHeroProps {
  type: ContentType;
  /** Override the default title */
  title?: string;
  /** Override the default description */
  description?: string;
  /** Total post count to show */
  postCount?: number;
}

export default function ContentHero({ type, title, description, postCount }: ContentHeroProps) {
  const config = CONTENT_TYPE_CONFIG[type];
  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{title ?? config.plural}</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">{description ?? config.description}</p>
        {postCount !== undefined ? (
          <p className="mt-3 text-base text-muted-foreground">
            {postCount} {postCount === 1 ? "article" : "articles"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
