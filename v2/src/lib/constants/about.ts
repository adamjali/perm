/**
 * Who is behind PERM Tracker, stated once.
 *
 * Read by the About page, the homepage's "About PERM Tracker" block and the
 * Organization schema, so the three cannot disagree. Every line here is a
 * public factual claim approved by the site owner on 2026-09-07; change it
 * here and nowhere else.
 *
 * Two claims were deliberately NOT made. The builder has not been a PERM
 * beneficiary himself and the page does not say he was; it says what is true,
 * that he watched family, friends and colleagues wait and worked through the
 * process with them. And no one is credited with reviewing the deadline logic,
 * because that review is not something either person has attested to.
 */

import {
  GITHUB_REPO_URL,
  LINKEDIN_SABRINA_URL,
  MEDIUM_PROFILE_URL,
  PRODUCT_HUNT_URL,
  X_PROFILE_URL,
} from "./externalLinks";

export interface AboutPerson {
  name: string;
  /** Plain-language role, used verbatim as the schema.org `jobTitle`. */
  jobTitle: string;
  /** Profiles the person owns; emitted as the Person node's `sameAs`. */
  sameAs: readonly string[];
}

export const ADAM: AboutPerson = {
  name: "Adam J Ali",
  jobTitle: "Professor of anatomy and physiology",
  sameAs: ["https://github.com/adamjali", X_PROFILE_URL],
};

export const SABRINA: AboutPerson = {
  name: "Sabrina Soltau",
  jobTitle: "Immigration attorney",
  sameAs: [LINKEDIN_SABRINA_URL],
};

/** In display order: the builder first, then the attorney. */
export const PEOPLE: readonly AboutPerson[] = [ADAM, SABRINA];

/** Domain registered (RDAP, Squarespace Domains): 2025-11-25. */
export const FOUNDED = "2025-11";
/** First public capture of the live site (Wayback Machine): 2026-01-28. */
export const LIVE_SINCE = "2026-01";

/**
 * The brand's owned surfaces, emitted as the Organization `sameAs`.
 *
 * BRAND-OWNED ONLY: the repo, the Medium publication and the Product Hunt
 * product page all carry the brand's name and nothing else. The X account is
 * a person's handle, so it sits on that person's node above and is linked
 * from the footer, never asserted as the organization itself; the same holds
 * for the LinkedIn profile. `structuredData.test.ts` pins the rule.
 */
export const ORGANIZATION_SAME_AS: readonly string[] = [
  GITHUB_REPO_URL,
  MEDIUM_PROFILE_URL,
  PRODUCT_HUNT_URL,
];

/**
 * The one-sentence definition. The homepage block opens with it and the About
 * page's lede is it, so an engine lifting either gets the same sentence.
 */
export const ABOUT_ONE_LINER =
  "PERM Tracker is a free, independent website that follows the PERM labor certification process using the Department of Labor's own published data.";
