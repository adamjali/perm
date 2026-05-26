/**
 * Content SEO Utilities
 *
 * Generates structured data (JSON-LD) for content pages.
 */

import type { PostMeta, ContentType, PostSummary } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

/** Convert YYYY-MM-DD date string to ISO 8601 with timezone for schema.org */
export function toISO8601(dateStr: string): string {
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
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    image: meta.image ? `${BASE_URL}${meta.image}` : `${BASE_URL}/opengraph-image`,
    datePublished: toISO8601(meta.date),
    dateModified: toISO8601(meta.updated || meta.date),
    author: {
      "@type": "Organization",
      name: meta.author,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "PERM Tracker",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/${type}/${slug}`,
    },
    keywords: meta.tags.join(", "),
    speakable: {
      "@type": "SpeakableSpecification",
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
    "@type": "HowTo",
    name: meta.title,
    description: meta.description,
    image: meta.image ? `${BASE_URL}${meta.image}` : undefined,
    totalTime: meta.readingTime,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
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
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
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
    "@type": "VideoObject",
    name: alt,
    description: `${alt} — from ${meta.title}`,
    thumbnailUrl: meta.image ? `${BASE_URL}${meta.image}` : `${BASE_URL}/opengraph-image`,
    uploadDate: toISO8601(meta.date),
    contentUrl: `${BASE_URL}${src}`,
    publisher: {
      "@type": "Organization",
      name: "PERM Tracker",
      logo: {
        "@type": "ImageObject",
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
 * — `dateModified` falls back to `datePublished` when `meta.updated` is absent).
 */
export function generateItemListSchema(
  posts: PostSummary[],
  type: ContentType
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: posts.map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/${post.type}/${post.slug}`,
      name: post.meta.title,
      datePublished: toISO8601(post.meta.date),
      dateModified: toISO8601(post.meta.updated || post.meta.date),
    })),
    numberOfItems: posts.length,
    name: `PERM Tracker ${type.charAt(0).toUpperCase() + type.slice(1)}`,
  };
}
