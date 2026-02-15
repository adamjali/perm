/**
 * Structured Data (JSON-LD) generators for SEO
 *
 * Provides type-safe schema generators for:
 * - SoftwareApplication (main site schema)
 * - BreadcrumbList (for nested pages)
 * - Organization (site publisher info)
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
    alternateName: ['PERMTracker', 'PERM Tracker App', 'permtracker'],
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

/**
 * Breadcrumb item type
 */
export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Generate BreadcrumbList schema for nested pages
 *
 * @param items - Array of breadcrumb items (name + url)
 * @param baseUrl - Site base URL
 */
export function getBreadcrumbSchema(items: BreadcrumbItem[], baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * Combine multiple schemas into a single array for JSON-LD
 */
export function combineSchemas(...schemas: object[]) {
  return schemas;
}
