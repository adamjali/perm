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
    // An ink band with a lime rule (round 3, Oct 15 2026: the listing's top
    // needed more flair, "make that section black or a soft green"). Dark
    // scoped, so every token inside reads as the dark theme in both themes.
    <section className="dark border-b-2 border-black bg-[#141414] text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-14">
        <span aria-hidden="true" className="block h-1.5 w-16 bg-primary" />
        <h1 className="mt-5 font-heading text-4xl font-bold leading-tight text-white sm:text-5xl">{title ?? config.plural}</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">{description ?? config.description}</p>
        {postCount !== undefined ? (
          <p className="mt-5">
            <span className="inline-flex items-center border-2 border-black bg-primary px-3 py-1 font-heading text-sm font-bold text-black shadow-[3px_3px_0_0_rgba(255,255,255,0.35)]">
              {postCount} {postCount === 1 ? "article" : "articles"}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
