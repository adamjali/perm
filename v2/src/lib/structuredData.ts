/**
 * Structured Data (JSON-LD) generators for SEO
 *
 * Provides type-safe schema generators for:
 * - SoftwareApplication (main site schema)
 * - Organization (site publisher info)
 * - WebSite (site name for Google Search)
 * - FAQPage (kept for non-Google engines; Google dropped FAQ rich results
 *   in May 2026, so this is no longer a rich-result lever there)
 *
 * THE DESCRIPTIONS HERE ARE WHAT ANSWER ENGINES QUOTE. LLM retrieval
 * tokenizes JSON-LD as text, so the description strings below are read
 * exactly like visible copy - and for months they said "for immigration
 * attorneys", which is precisely what AI overviews then said the whole
 * product was. Both sides of the product, in both descriptions, always.
 */

import { GITHUB_REPO_URL } from "@/lib/constants/externalLinks";

/**
 * Single source for the schema.org `@id` fragments used to cross-link entities
 * in the root layout's `@graph`. Keep these in sync with the consumers in
 * src/app/layout.tsx, referencing this helper instead of inlining the
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
    // WebApplication over BusinessApplication/'Legal Software': the old pair
    // encoded B2B-only, and half the product is a free consumer surface.
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web Browser',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer' as const,
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Free PERM tracking for green-card applicants and immigration attorneys. Check any PERM case number for its live DOL status and a decision estimate, follow the queue with live data, and compute every case deadline automatically.',
    disambiguatingDescription:
      'Two sides, both free: a public tracker for the person waiting (per-case DOL status, timelines for PWD, PERM, I-140 and I-485, and open datasets), and case-management software for attorneys and firms (deadlines computed per case, reminders, calendar sync).',
    audience: [
      {
        '@type': 'Audience' as const,
        audienceType: 'Green-card applicants and beneficiaries',
      },
      {
        '@type': 'Audience' as const,
        audienceType: 'Immigration attorneys, paralegals and HR teams',
      },
    ],
    url: baseUrl,
    screenshot: `${baseUrl}/opengraph-image`,
    // Cross-reference the Organization @id (set in src/app/layout.tsx where
    // schemas are combined into @graph) instead of inlining a duplicate. Lets
    // Google understand this is the same entity as the Organization schema.
    creator: { '@id': SCHEMA_IDS.organization(baseUrl) },
    featureList: [
      'Per-case PERM status lookup from DOL, with email alerts on changes',
      'Timelines and calculators for PWD, PERM, I-140 and I-485',
      'Live PERM queue data: backlog, pace, employers, law firms, wages',
      'Automatic deadline calculation per DOL regulations',
      'Multi-case management dashboard',
      'Email and push notifications',
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
    sameAs: [GITHUB_REPO_URL],
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
    // The lowercase domain is here DELIBERATELY, reversing an earlier decision
    // in this file that excluded it.
    //
    // That decision read the causation backwards: it assumed listing the URL
    // form was what made Google print the URL. Google's site-names doc says the
    // opposite, verbatim - "Provide your domain or subdomain name as a backup
    // option. To provide your domain or subdomain as a backup option, add your
    // domain or subdomain name as your alternative name" - and "Your domain or
    // subdomain needs to be in all lowercase ... for our system to detect this
    // as a site name preference." It is a documented fallback, not a cause.
    //
    // And the feared harm is already the status quo: Google prints
    // "permtracker.app" in the SERP today, with this list at ['PERMTracker'].
    // So the only thing this changes is WHY the domain shows - a detected
    // preference rather than a fallthrough - and it gives the system a legal
    // second choice for when it declines the primary name.
    //
    // It declines it for two documented reasons, neither fixable by markup:
    // "PERM Tracker" is generic (it IS the search query), and permtrack.app
    // declares the byte-identical string, while Google "generally won't use the
    // same site name for two different sites."
    alternateName: ['PERMTracker', 'permtracker.app'],
    url: baseUrl,
    description:
      'Free PERM tracking for green-card applicants and immigration attorneys: live DOL data, per-case status, and automatic deadlines.',
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
 * The app's review rating, defined ONCE.
 *
 * Three consumers must agree or Google's policy is violated from one side or
 * another: the JSON-LD below, the visible rating line in
 * TestimonialsSection, and the Senja widget config. The first two import
 * THIS. Update it when the Senja count changes.
 */
export const APP_RATING = {
  value: '5',
  count: '2',
  best: '5',
  worst: '1',
} as const;

/**
 * Below this, the aggregate score is not ADVERTISED - no big 5.0 on the page,
 * no aggregateRating in the JSON-LD. The testimonials themselves and the
 * review CTA stay; it is the scorekeeping that goes quiet.
 *
 * SET TO 2 ON ADAM'S CALL, 2026-08-28. It was 10, and the reason it was 10 is
 * worth keeping on the record rather than deleting: a practicing attorney
 * read the site as "trying too hard", and specifically that a centered
 * social-proof band declaring 5.0 over "from 2 attorney reviews" performs
 * beyond its evidence - a practitioner reads the 2 before the stars. That is
 * real user feedback from the audience this product sells to, and it argues
 * against the current value.
 *
 * Adam's decision is that the reviews are genuine and displayed, so they
 * should count. That is his to make, and it is defensible on the terms that
 * actually bind: Google prohibits self-serving review markup for
 * `LocalBusiness` and `Organization` types, ours is `SoftwareApplication`
 * which is on the eligible list, and the requirement that DOES apply - that
 * the marked-up rating be readily visible on the page - is satisfied, because
 * TestimonialsSection renders it from this same constant. The markup and the
 * visible text cannot disagree.
 *
 * Google may still decline a rich result off two reviews, which costs
 * nothing. Raising APP_RATING.count as reviews arrive needs no other change.
 */
export const MIN_REVIEWS_TO_ADVERTISE = 2;

export function shouldAdvertiseRating(): boolean {
  return Number(APP_RATING.count) >= MIN_REVIEWS_TO_ADVERTISE;
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
 * no widget is visible, a policy violation that can suppress all rich
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
    // A COMPLETE node, not a rating-only fragment. A parser that merges by
    // @id sees one entity either way; a parser that does NOT merge (and the
    // Rich Results Test evaluates items individually) previously saw an
    // orphan SoftwareApplication with a rating and no name, offers or
    // category - an item failing required-field validation. Duplicating the
    // identity fields costs bytes and removes the ambiguity entirely.
    name: 'PERM Tracker',
    // MUST match the @graph node's category. Both carry SCHEMA_IDS.software(),
    // so they are one entity by @id - and this one still said
    // 'BusinessApplication', left behind when the graph node deliberately moved
    // to 'WebApplication' (see the note at the top of this file). A merging
    // parser saw one entity asserting two different categories; a
    // non-merging one saw two SoftwareApplications with the same identity.
    // Neither is what the complete-node pattern below is trying to achieve.
    applicationCategory: 'WebApplication' as const,
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer' as const,
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating' as const,
      ratingValue: APP_RATING.value,
      reviewCount: APP_RATING.count,
      bestRating: APP_RATING.best,
      worstRating: APP_RATING.worst,
    },
  };
}


// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

/** The federal source every dataset on this site derives from. */
const DOL_SOURCE = 'https://www.dol.gov/agencies/eta/foreign-labor/performance';

export interface DatasetSchemaInput {
  /** Human name for this specific slice, e.g. "Microsoft Corporation PERM filings". */
  name: string;
  description: string;
  /** Absolute page URL this dataset is published at. */
  url: string;
  /**
   * ISO 8601 interval the underlying records span, e.g. "2023-10-01/2026-06-30".
   * MEASURED from the corpus, never written by hand - see the note below.
   */
  temporalCoverage?: string;
  /** ISO date the underlying data last changed (the source's as-of, not the build). */
  dateModified?: string;
  /** The columns this slice actually reports. */
  variableMeasured?: string[];
  keywords?: string[];
  /**
   * The federal page this slice derives from, when it is not the quarterly
   * disclosure files. `/perm-decision-activity` reads DOL's processing-times
   * publication instead, and pointing every dataset at one URL because the
   * builder happened to hardcode it would be a provenance claim we did not
   * check.
   */
  isBasedOn?: string;
}

/**
 * One Dataset node, built the same way everywhere.
 *
 * Ten pages hand-rolled this object with seven keys each, and every one of them
 * was missing the fields that make a dataset citable rather than merely
 * declared: `temporalCoverage`, `dateModified`, `license`, `variableMeasured`
 * and `spatialCoverage`. Those are what an answer engine needs to say WHEN a
 * figure was true and WHAT it covers, and they are exactly the difference
 * between a number a model will quote with a date and one it will quote bare.
 *
 * `temporalCoverage` and `dateModified` are PARAMETERS, deliberately. The
 * temptation is to bake in the current window, and a baked window is wrong the
 * day the next quarterly lands while still looking authoritative. Callers pass
 * what they measured; a caller with nothing to pass omits it rather than
 * guessing, because an absent field is honest and a stale one is not.
 *
 * `license` points at our terms rather than claiming public domain. The
 * underlying DOL records are a US Government work, but these pages publish
 * derived aggregates, and `isBasedOn` is where the provenance belongs.
 */
export function getDatasetSchema(baseUrl: string, input: DatasetSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset' as const,
    name: input.name,
    description: input.description,
    url: input.url,
    // @id-linked so the Dataset attaches to the same Organization entity the
    // WebSite and SoftwareApplication nodes publish under, instead of minting
    // a fourth anonymous "PERM Tracker" that no parser can reconcile.
    creator: { '@id': SCHEMA_IDS.organization(baseUrl) },
    isBasedOn: input.isBasedOn ?? DOL_SOURCE,
    license: `${baseUrl}/terms`,
    // Every record is a US filing. Constant, so it belongs here rather than in
    // ten call sites that could each spell it differently.
    spatialCoverage: { '@type': 'Place' as const, name: 'United States' },
    ...(input.temporalCoverage ? { temporalCoverage: input.temporalCoverage } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.variableMeasured ? { variableMeasured: input.variableMeasured } : {}),
    ...(input.keywords ? { keywords: input.keywords } : {}),
  };
}
