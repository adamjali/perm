/**
 * Structured Data (JSON-LD) generators for SEO
 *
 * Provides type-safe schema generators for:
 * - SoftwareApplication (main site schema)
 * - Organization (site publisher info)
 * - WebSite (site name for Google Search)
 * - FAQPage (FAQ rich results)
 */

/**
 * Single source for the schema.org `@id` fragments used to cross-link entities
 * in the root layout's `@graph`. Keep these in sync with the consumers in
 * src/app/layout.tsx — referencing this helper instead of inlining the
 * `${baseUrl}/#x` template literal everywhere prevents drift across files.
 */
export const SCHEMA_IDS = {
  software: (baseUrl: string) => `${baseUrl}/#software` as const,
  organization: (baseUrl: string) => `${baseUrl}/#organization` as const,
  website: (baseUrl: string) => `${baseUrl}/#website` as const,
} as const;

/**
 * Generate SoftwareApplication schema for PERM Tracker
 * Used in root layout for site-wide structured data
 */
export function getSoftwareApplicationSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication' as const,
    name: 'PERM Tracker',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Legal Software',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer' as const,
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Free PERM case tracking software for immigration attorneys. Track deadlines, manage labor certification cases, and never miss a filing date.',
    url: baseUrl,
    screenshot: `${baseUrl}/opengraph-image`,
    // Cross-reference the Organization @id (set in src/app/layout.tsx where
    // schemas are combined into @graph) instead of inlining a duplicate. Lets
    // Google understand this is the same entity as the Organization schema.
    creator: { '@id': SCHEMA_IDS.organization(baseUrl) },
    featureList: [
      'Automatic deadline calculation per DOL regulations',
      'Real-time PERM case validation',
      'Multi-case management dashboard',
      'Email and push notifications',
      'Progress tracking timeline',
      'Calendar view with deadlines',
    ],
    // aggregateRating is intentionally omitted from this root schema because
    // it lives in the root @graph that ships on every page. Google's
    // rich-results policy requires the rating to be rendered on the same page
    // as the structured data — and the rating widget (Senja) only renders on
    // the homepage. The homepage emits a separate partial via
    // getHomepageRatingPartialSchema() below; Google's @id-graph merge
    // attaches the rating to this SoftwareApplication on that page only.
  };
}

/**
 * Generate Organization schema
 * Used to describe the publisher/creator of the site
 */
export function getOrganizationSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization' as const,
    name: 'PERM Tracker',
    url: baseUrl,
    logo: `${baseUrl}/icon-512.png`,
    contactPoint: {
      '@type': 'ContactPoint' as const,
      email: 'support@permtracker.app',
      contactType: 'customer support',
    },
    // Real brand attestation (verified HTTP 200). One real sameAs URL is
    // strictly better than a bare placeholder for entity disambiguation.
    // Must stay a brand-owned URL: this is machine-readable and served on every
    // page, so anything personal here publishes that association to crawlers.
    sameAs: ['https://github.com/adamjali/perm'],
  };
}

/**
 * Generate WebSite schema for search features
 */
export function getWebSiteSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite' as const,
    name: 'PERM Tracker',
    // Single brand variant. Critically: do NOT include the URL form
    // ('permtracker.app') — Google uses alternateName as a candidate set for
    // the Site Name SERP feature, and listing the URL as a "name" is exactly
    // what was causing Google to display the URL as the site name.
    alternateName: ['PERMTracker'],
    url: baseUrl,
    description:
      'Free PERM case tracking software for immigration attorneys.',
    // Cross-reference Organization @id (set in src/app/layout.tsx @graph) so
    // Google understands WebSite is published by the Organization entity.
    publisher: { '@id': SCHEMA_IDS.organization(baseUrl) },
  };
}

/**
 * Generate FAQPage schema for rich results
 * Used on pages with FAQ content (homepage, /faq) to surface answers in search
 */
export function getFAQPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage' as const,
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question' as const,
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: faq.answer,
      },
    })),
  };
}

/**
 * Homepage-only aggregateRating partial.
 *
 * Why this is its own helper (and not part of `getSoftwareApplicationSchema`):
 * Google's rich-results policy requires aggregate ratings to be rendered
 * visibly on the SAME page as the structured data. The Senja review widget is
 * only mounted on the homepage (src/components/home/TestimonialsSection.tsx),
 * so the rating must only ship on `/`. The base SoftwareApplication schema
 * lives in the root layout's `@graph` and renders on every page; emitting
 * `aggregateRating` there would put a rating on /blog, /privacy, etc., where
 * no widget is visible — a policy violation that can suppress all rich
 * results for the domain.
 *
 * Pattern: emit a partial `SoftwareApplication` with the same `@id` as the
 * root entity. Google merges schemas sharing `@id` into the same entity, so
 * the rating attaches to the existing SoftwareApplication on the homepage
 * only.
 *
 * Counts and value must match what Senja renders on the page. Update both
 * the schema below and the widget config when review count changes.
 */
export function getHomepageRatingPartialSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication' as const,
    '@id': SCHEMA_IDS.software(baseUrl),
    aggregateRating: {
      '@type': 'AggregateRating' as const,
      ratingValue: '5',
      reviewCount: '2',
      bestRating: '5',
      worstRating: '1',
    },
  };
}

