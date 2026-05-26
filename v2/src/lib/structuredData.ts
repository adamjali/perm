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
 * Generate SoftwareApplication schema for PERM Tracker
 * Used in root layout for site-wide structured data
 */
export function getSoftwareApplicationSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PERM Tracker',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Legal Software',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
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
    creator: { '@id': `${baseUrl}/#organization` },
    featureList: [
      'Automatic deadline calculation per DOL regulations',
      'Real-time PERM case validation',
      'Multi-case management dashboard',
      'Email and push notifications',
      'Progress tracking timeline',
      'Calendar view with deadlines',
    ],
    // aggregateRating intentionally omitted: Google's rich-results policy
    // requires the aggregate rating to be VISIBLY rendered on the same page
    // alongside the structured data, AND the review pool must be a good-faith
    // sample (typically ≥10 named reviews). Re-add once those are met.
  };
}

/**
 * Generate Organization schema
 * Used to describe the publisher/creator of the site
 */
export function getOrganizationSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PERM Tracker',
    url: baseUrl,
    logo: `${baseUrl}/icon-512.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@permtracker.app',
      contactType: 'customer support',
    },
    // Real brand attestation (verified HTTP 200). One real sameAs URL is
    // strictly better than a bare placeholder for entity disambiguation.
    sameAs: ['https://github.com/adamjali/perm'],
  };
}

/**
 * Generate WebSite schema for search features
 */
export function getWebSiteSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
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
    publisher: { '@id': `${baseUrl}/#organization` },
  };
}

/**
 * Generate FAQPage schema for rich results
 * Used on pages with FAQ content (homepage, /faq) to surface answers in search
 */
export function getFAQPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

