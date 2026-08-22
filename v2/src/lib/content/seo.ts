/**
 * Content SEO Utilities
 *
 * Generates structured data (JSON-LD) for content pages.
 */

import type { PostMeta, ContentType, PostSummary } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

/**
 * Convert a YYYY-MM-DD date string to ISO 8601 with explicit UTC offset for
 * schema.org `datePublished` / `dateModified` fields.
 *
 * Runtime-guarded: throws if the input doesn't match the expected shape. Catches
 * malformed MDX frontmatter dates at build time (where this is called) rather
 * than emitting silently-broken JSON-LD that Google rejects unattributed.
 */
export function toISO8601(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`toISO8601: expected YYYY-MM-DD, got ${JSON.stringify(dateStr)}`);
  }
  return `${dateStr}T00:00:00+00:00`;
}

/** Generate Article schema for blog posts */
export function generateArticleSchema(
  meta: PostMeta,
  slug: string,
  type: ContentType
) {
  return {
    "@context": "https://schema.org",
    "@type": "Article" as const,
    headline: meta.title,
    description: meta.description,
    image: meta.image ? `${BASE_URL}${meta.image}` : `${BASE_URL}/opengraph-image`,
    datePublished: toISO8601(meta.date),
    dateModified: toISO8601(meta.updated || meta.date),
    author: {
      "@type": "Organization" as const,
      name: meta.author,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization" as const,
      name: "PERM Tracker",
      logo: {
        "@type": "ImageObject" as const,
        url: `${BASE_URL}/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage" as const,
      "@id": `${BASE_URL}/${type}/${slug}`,
    },
    keywords: meta.tags.join(", "),
    speakable: {
      "@type": "SpeakableSpecification" as const,
      cssSelector: [".article-description", ".article-content h2:first-of-type", ".article-content h2:first-of-type + p"],
    },
  };
}

/** Generate HowTo schema for tutorials */
export function generateHowToSchema(
  meta: PostMeta,
  _slug: string,
  steps: { name: string; text: string }[] = []
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo" as const,
    name: meta.title,
    description: meta.description,
    image: meta.image ? `${BASE_URL}${meta.image}` : undefined,
    totalTime: meta.readingTime,
    step: steps.map((s, i) => ({
      "@type": "HowToStep" as const,
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

/** Generate BreadcrumbList schema */
export function generateBreadcrumbSchema(
  items: { name: string; href: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList" as const,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.href}`,
    })),
  };
}

/** Generate VideoObject schema for embedded videos */
export function generateVideoObjectSchema(
  src: string,
  alt: string,
  meta: PostMeta
) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject" as const,
    name: alt,
    description: `${alt}, from ${meta.title}`,
    thumbnailUrl: meta.image ? `${BASE_URL}${meta.image}` : `${BASE_URL}/opengraph-image`,
    uploadDate: toISO8601(meta.date),
    contentUrl: `${BASE_URL}${src}`,
    publisher: {
      "@type": "Organization" as const,
      name: "PERM Tracker",
      logo: {
        "@type": "ImageObject" as const,
        url: `${BASE_URL}/icon-512.png`,
      },
    },
  };
}

/**
 * Generate ItemList schema for content listing pages.
 *
 * Each item carries `datePublished` and `dateModified` so Google has a date
 * signal for the listing's items (matches the pattern in `generateArticleSchema`
 *, `dateModified` falls back to `datePublished` when `meta.updated` is absent).
 *
 * `urlFor` is an optional strategy for building each item's URL. Defaults to
 * `${BASE_URL}/${post.type}/${post.slug}` (the standard detail-route shape).
 * Pages without per-entry detail routes (like /changelog) supply a custom
 * builder pointing at on-page anchors (`/changelog#${slug}`).
 */
export function generateItemListSchema(
  posts: PostSummary[],
  type: ContentType,
  urlFor: (post: PostSummary) => string = (p) => `${BASE_URL}/${p.type}/${p.slug}`,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList" as const,
    itemListElement: posts.map((post, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      url: urlFor(post),
      name: post.meta.title,
      datePublished: toISO8601(post.meta.date),
      dateModified: toISO8601(post.meta.updated || post.meta.date),
    })),
    numberOfItems: posts.length,
    name: `PERM Tracker ${type.charAt(0).toUpperCase() + type.slice(1)}`,
  };
}
