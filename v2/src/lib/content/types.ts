/**
 * Content Types
 *
 * Type definitions for the MDX-based content system.
 * Used by content utility functions and route pages.
 */

/**
 * Three sections, down from five on 2026-08-24. Fourteen articles never
 * justified five listing pages, five nav slots and five OG routes — /resources
 * held ONE file. Tutorials and resources merged into guides (their old URLs
 * 301 there); changelog stays as a standalone update log linked from the
 * footer rather than the content nav.
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
  tags: string[];
  category?: string; // Sub-category within content type
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

/** Content type display configuration */
export const CONTENT_TYPE_CONFIG: Record<
  ContentType,
  { label: string; plural: string; description: string; icon: string }
> = {
  blog: {
    label: "Blog",
    plural: "Blog Posts",
    description:
      "Insights on PERM labor certification, immigration practice, and industry trends.",
    icon: "FileText",
  },
  guides: {
    label: "Guide",
    plural: "Guides",
    description:
      "How-tos, references, checklists and comparisons for the PERM process and for PERM Tracker itself.",
    icon: "BookOpen",
  },
  changelog: {
    label: "Update",
    plural: "Changelog",
    // Names the corrections log, which moved onto this page when
    // `/corrections` was retired. This string is the changelog's one line in
    // `llms.txt` and on the content hub, so leaving it out is how the record
    // becomes undiscoverable to anything that reads the site by machine.
    description:
      "Product updates and new features, plus the corrections log: every published claim this site got wrong, with what it said, what was true and what changed.",
    icon: "Sparkles",
  },
};
