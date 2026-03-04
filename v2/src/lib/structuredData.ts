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
    creator: {
      '@type': 'Organization',
      name: 'PERM Tracker',
      url: baseUrl,
    },
    featureList: [
      'Automatic deadline calculation per DOL regulations',
      'Real-time PERM case validation',
      'Multi-case management dashboard',
      'Email and push notifications',
      'Progress tracking timeline',
      'Calendar view with deadlines',
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      reviewCount: '2',
      bestRating: '5',
      worstRating: '1',
    },
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
    sameAs: ['https://github.com'],
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
    alternateName: ['PERMTracker', 'PERM Tracker App', 'permtracker', 'permtracker.app'],
    url: baseUrl,
    description:
      'Free PERM case tracking software for immigration attorneys.',
  };
}

/**
 * Generate FAQPage schema for rich results
 * Used on the homepage to surface FAQ answers in search
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

