/**
 * Content SEO Utilities
 *
 * Generates structured data (JSON-LD) for content pages.
 */

import type { PostMeta, ContentType } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

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
    datePublished: meta.date,
    dateModified: meta.updated ?? meta.date,
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
  };
}

/** Generate HowTo schema for tutorials */
export function generateHowToSchema(
  meta: PostMeta,
  slug: string,
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
