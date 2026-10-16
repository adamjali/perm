/**
 * Content Types
 *
 * Type definitions for the MDX-based content system.
 * Used by content utility functions and route pages.
 */

/**
 * Three sections. Tutorials and resources merged into guides (their old URLs
 * 301 there), because a few dozen articles cannot justify five listing pages,
 * five nav slots and five OG routes; the changelog is a standalone update log
 * linked from the footer rather than the content nav.
 */
export type ContentType = "blog" | "guides" | "changelog";

/** ISO date string in YYYY-MM-DD format */
export type ContentDateString = string & { readonly __brand?: "ContentDate" };

export interface PostMeta {
  title: string;
  description: string;
  date: ContentDateString;
  updated?: ContentDateString;
  author: string;
  image?: string; // Featured image path (relative to /public)
  imageAlt?: string;
  /**
   * Who made the picture and under what licence, printed under it: "Photo: U.S.
   * Department of State", "Photo: G. Edward Johnson / Wikimedia Commons, CC BY
   * 4.0". Required for any picture this site didn't make (topics.test.ts).
   */
  imageCredit?: string;
  /** The picture's own page (its Commons, Library of Congress or agency page). */
  imageSource?: string;
  /** CSS object-position for the crop, e.g. "50% 20%" to keep a form's title in frame. */
  imagePosition?: string;
  tags: string[];
  /** The topic (lib/content/topics.ts) for guides and blog; Release, Feature or Correction for the changelog. */
  category?: string;
  readingTime: string; // e.g. "5 min read"
  published: boolean;
  featured?: boolean; // Pin to top of listings
  seoTitle?: string; // Override for <title> tag
  seoDescription?: string; // Override for meta description
}

export interface Post {
  slug: string;
  type: ContentType;
  meta: PostMeta;
  content: string; // Raw MDX content (without frontmatter)
}

export interface PostSummary {
  slug: string;
  type: ContentType;
  meta: PostMeta;
}

/**
 * Content type display configuration.
 *
 * `byline` is the team name every article of the type carries. Articles are
 * credited to the site's team rather than a named person; guides are built
 * from the federal record, so they carry the data desk. Each MDX file states
 * its byline in frontmatter, and content-frontmatter.test.ts holds the file
 * to its type's byline.
 */
export const CONTENT_TYPE_CONFIG: Record<
  ContentType,
  { label: string; plural: string; description: string; icon: string; byline: string }
> = {
  blog: {
    label: "Blog",
    plural: "Blog posts",
    byline: "PERM Tracker team",
    description:
      "Data notes, explainers and practice notes on PERM, written from the Labor Department's own records.",
    icon: "FileText",
  },
  guides: {
    label: "Guide",
    plural: "Guides",
    byline: "PERM Tracker data desk",
    description:
      "Plain-English guides to a PERM case, from the case number to the green card, grouped by different stages.",
    icon: "BookOpen",
  },
  changelog: {
    label: "Update",
    plural: "Changelog",
    byline: "PERM Tracker team",
    // Names the corrections log, which moved onto this page when
    // `/corrections` was retired. This string is the changelog's one line in
    // `llms.txt` and on the content hub, so leaving it out is how the record
    // becomes undiscoverable to anything that reads the site by machine.
    description:
      "Product updates and new features, plus the corrections log: every published claim this site got wrong, with what it said, what was true and what changed.",
    icon: "Sparkles",
  },
};
