/**
 * Content SEO Utilities
 *
 * Generates structured data (JSON-LD) for content pages.
 */

import { KNOWN_PERSON_AUTHORS } from "@/lib/constants/externalLinks";
import { SCHEMA_IDS } from "@/lib/structuredData";
import type { PostMeta, ContentType, PostSummary } from "./types";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

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
    // Articles carry a team byline (CONTENT_TYPE_CONFIG[type].byline), emitted
    // as an Organization that points at the site's own Organization node as
    // its parent and at the About page, where the people behind the site are
    // named. The byline's own name stays on this node: giving the shared
    // Organization's @id a second name would make one entity two things.
    //
    // A name registered in KNOWN_PERSON_AUTHORS becomes a Person with
    // `sameAs`, so a new name in a frontmatter file cannot quietly invent a
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
          url: `${BASE_URL}/about`,
          parentOrganization: { "@id": SCHEMA_IDS.organization(BASE_URL) },
        },
    publisher: PUBLISHER,
    mainEntityOfPage: {
      "@type": "WebPage" as const,
      "@id": `${BASE_URL}/${type}/${slug}`,
    },
    keywords: meta.tags.join(", "),
    // The summary and the body's first paragraph. "first h2 + p" matched
    // nothing on 8 of 77 articles (a table or list follows the heading there),
    // and "first h2" matched twice on one; these two match exactly once on all
    // 77 (measured Oct 7 2026; seo.test.ts holds the shape).
    speakable: {
      "@type": "SpeakableSpecification" as const,
      cssSelector: [".article-description", ".article-content > p:first-of-type"],
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
 * Each entry is Google's summary-page shape: a ListItem with its position,
 * the entry's URL and its title. Two earlier shapes were wrong: dates directly
 * on the ListItem (not ListItem properties in schema.org, so all five listing
 * pages carried a validation error), then an Article nested in `item` with
 * only a name and dates, a second, incomplete Article for a URL whose own page
 * carries the full one. Google shows no carousel for article lists in the US,
 * so the list says what's on the page and nothing more; the dates live in each
 * article's own markup.
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
        url,
        name: post.meta.title,
      };
    }),
    numberOfItems: posts.length,
    name: `PERM Tracker ${type.charAt(0).toUpperCase() + type.slice(1)}`,
  };
}
