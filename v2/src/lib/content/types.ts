/**
 * Content Types
 *
 * Type definitions for the MDX-based content system.
 * Used by content utility functions and route pages.
 */

export type ContentType =
  | "blog"
  | "tutorials"
  | "guides"
  | "changelog"
  | "resources";

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
  tutorials: {
    label: "Tutorial",
    plural: "Tutorials",
    description:
      "Step-by-step guides to get the most out of PERM Tracker.",
    icon: "GraduationCap",
  },
  guides: {
    label: "Guide",
    plural: "Guides",
    description:
      "Comprehensive references for the PERM process and best practices.",
    icon: "BookOpen",
  },
  changelog: {
    label: "Update",
    plural: "Changelog",
    description:
      "Product updates, new features, and improvements to PERM Tracker.",
    icon: "Sparkles",
  },
  resources: {
    label: "Resource",
    plural: "Resources",
    description:
      "Tools, checklists, comparisons, and reference materials for PERM practitioners.",
    icon: "Library",
  },
};
