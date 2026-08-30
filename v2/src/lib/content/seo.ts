/**
 * Content SEO Utilities
 *
 * Generates structured data (JSON-LD) for content pages.
 */

import { KNOWN_PERSON_AUTHORS } from "@/lib/constants/externalLinks";
import type { PostMeta, ContentType, PostSummary } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

/** Emitted identically by Article and VideoObject; written once so it stays that way. */
const PUBLISHER = {
  "@type": "Organization" as const,
  name: "PERM Tracker",
  logo: {
    "@type": "ImageObject" as const,
    url: `${BASE_URL}/icon-512.png`,
  },
};

/** Absolute image URL for a post, falling back to the generated OG image. */
function imageUrl(meta: PostMeta): string {
  return meta.image ? `${BASE_URL}${meta.image}` : `${BASE_URL}/opengraph-image`;
}

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
    image: imageUrl(meta),
    datePublished: toISO8601(meta.date),
    dateModified: toISO8601(meta.updated || meta.date),
    // THE ARTICLE'S OWN BYLINE, resolved to the right schema type.
    //
    // Everything used to be an Organization called "PERM Tracker Team", which
    // asserts no expertise and names nobody accountable - the weakest possible
    // signal on immigration guidance, the category where Google weighs
    // experience hardest. The first fix overcorrected and hardcoded ONE person
    // across all 22 articles, which threw away the per-file frontmatter that
    // already existed and would have bylined the changelog to a human.
    //
    // A registered name becomes a Person with `sameAs`, which is what makes a
    // byline a checkable identity rather than a string. Anything else stays an
    // Organization, so a new name in a frontmatter file cannot quietly invent a
    // person who has no profile behind them.
    author: KNOWN_PERSON_AUTHORS[meta.author]
      ? {
          "@type": "Person" as const,
          name: meta.author,
          url: KNOWN_PERSON_AUTHORS[meta.author]!.url,
          sameAs: [KNOWN_PERSON_AUTHORS[meta.author]!.url],
        }
      : {
          "@type": "Organization" as const,
          name: meta.author,
          url: BASE_URL,
        },
    publisher: PUBLISHER,
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
    // Not imageUrl(): HowTo OMITS the key when there is no image rather than
    // falling back to the generic OG card, which is a different claim.
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
    thumbnailUrl: imageUrl(meta),
    uploadDate: toISO8601(meta.date),
    contentUrl: `${BASE_URL}${src}`,
    publisher: PUBLISHER,
  };
}

/**
 * Generate ItemList schema for content listing pages.
 *
 * Each entry nests its content in `item` as an Article, which is where the
 * date signal has to live. An earlier version put `datePublished` and
 * `dateModified` directly on the ListItem: neither is a ListItem property in
 * schema.org (ListItem defines only `item`, `nextItem`, `previousItem` and
 * `position` beyond what it inherits from Thing), so all five listing pages
 * carried a schema.org validation error. Nesting keeps the dates and makes the
 * markup valid, which is the shape Google documents for a list whose entries
 * are full entities rather than bare links.
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
    itemListElement: posts.map((post, i) => {
      const url = urlFor(post);
      return {
        "@type": "ListItem" as const,
        position: i + 1,
        item: {
          "@type": "Article" as const,
          "@id": url,
          url,
          name: post.meta.title,
          datePublished: toISO8601(post.meta.date),
          dateModified: toISO8601(post.meta.updated || post.meta.date),
        },
      };
    }),
    numberOfItems: posts.length,
    name: `PERM Tracker ${type.charAt(0).toUpperCase() + type.slice(1)}`,
  };
}
