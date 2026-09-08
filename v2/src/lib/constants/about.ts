/**
 * Who is behind PERM Tracker, stated once.
 *
 * Read by the About page, the homepage's "About PERM Tracker" block, the
 * Organization schema and the article bylines, so none of them can disagree.
 * Every line here is a public factual claim approved by the site owner
 * (2026-09-07: one named person, Sabrina Soltau, on every surface); change it
 * here and nowhere else.
 *
 * Two claims are deliberately NOT made. The page never says she waited on a
 * PERM case of her own; it says what is true, that she files them. And no one
 * is credited with reviewing the deadline logic, because that review is not
 * something anyone has attested to.
 */

import {
  LINKEDIN_SABRINA_URL,
  MEDIUM_PROFILE_URL,
  PRODUCT_HUNT_URL,
} from "./externalLinks";

export interface AboutPerson {
  name: string;
  /** Plain-language role, used verbatim as the schema.org `jobTitle`. */
  jobTitle: string;
  /** Profiles the person owns; emitted as the Person node's `sameAs`. */
  sameAs: readonly string[];
}

export const SABRINA: AboutPerson = {
  name: "Sabrina Soltau",
  jobTitle: "Immigration attorney",
  sameAs: [LINKEDIN_SABRINA_URL],
};

/** Everyone the site names, in display order. One person, by decision. */
export const PEOPLE: readonly AboutPerson[] = [SABRINA];

/** Domain registered (RDAP, Squarespace Domains): 2025-11-25. */
export const FOUNDED = "2025-11";
/** First public capture of the live site (Wayback Machine): 2026-01-28. */
export const LIVE_SINCE = "2026-01";

/**
 * The brand's owned surfaces, emitted as the Organization `sameAs`.
 *
 * BRAND-OWNED ONLY: the Medium publication and the Product Hunt product page
 * both carry the brand's name and nothing else. A personal profile sits on
 * that person's node above and is linked from the footer, never asserted as
 * the organization itself. `structuredData.test.ts` pins the rule. The source
 * repository is no longer listed: its URL carries a personal handle, and the
 * site names one person only.
 */
export const ORGANIZATION_SAME_AS: readonly string[] = [
  MEDIUM_PROFILE_URL,
  PRODUCT_HUNT_URL,
];

/**
 * The one-sentence definition. The homepage block opens with it and the About
 * page's lede is it, so an engine lifting either gets the same sentence.
 */
export const ABOUT_ONE_LINER =
  "PERM Tracker is a free, independent website that follows the PERM labor certification process using the Department of Labor's own published data.";
