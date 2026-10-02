/**
 * Who is behind PERM Tracker, stated once.
 *
 * Read by the About page, the homepage's "About PERM Tracker" block, the
 * Organization schema and the article bylines, so none of them can disagree.
 * Every line here is a public factual claim approved by the site owner, with
 * the same one person named on every surface; change it here and nowhere
 * else.
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
  /**
   * Site-relative path of the portrait shown on the About page and emitted
   * as the Person node's `image`: a 640x800 JPEG under `public/about/`.
   */
  image: string;
  /** Intrinsic size of that file, so the layout reserves the right box. */
  imageSize: readonly [number, number];
}

export const SABRINA: AboutPerson = {
  name: "Sabrina Soltau",
  jobTitle: "Immigration attorney",
  sameAs: [LINKEDIN_SABRINA_URL],
  image: "/about/sabrina-soltau.jpg",
  imageSize: [640, 800],
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
/**
 * The legal entity behind the site, a Florida LLC. The Terms bind this name,
 * so every surface that names the operator reads it from here.
 */
export const LEGAL_NAME = "PERM Tracker LLC";
export const LEGAL_FORM = "a Florida limited liability company";

/**
 * The LLC's postal address, printed in every email footer. It is the principal
 * and mailing address filed with Florida (Northwest Registered Agent's St.
 * Petersburg office), so it is already public and is nobody's home. CAN-SPAM
 * requires "a valid physical postal address of the sender" in commercial email
 * (15 U.S.C. 7704(a)(5)(A)(iii)); printing it on every email means no template
 * has to decide whether it is commercial.
 */
export const POSTAL_ADDRESS = "7901 4th St N, Ste 300, St. Petersburg, FL 33702";

/**
 * The line that tells every visitor this isn't a law firm. The LLC is managed
 * by an attorney, and the bar rule on "law-related services" (ABA Model Rule
 * 5.7, which DC adopts word for word; Virginia did not adopt it) applies to a
 * business a lawyer controls unless she takes "reasonable measures to assure
 * that a person obtaining the law-related services knows that the services are
 * not legal services and that the protections of the client-lawyer
 * relationship do not exist." DC's comment [6] asks for it before the person
 * uses the service, preferably in writing, so it sits in the footer of every
 * page and, shorter, beside the sign-up form.
 */
export const NOT_LEGAL_SERVICES =
  "PERM Tracker isn't a law firm and doesn't give legal advice. Using this site or its app doesn't make you anyone's client, and the protections of an attorney-client relationship don't apply.";

export const ABOUT_ONE_LINER =
  "PERM Tracker is a free, independent website that follows the PERM labor certification process using the Department of Labor's own published data.";

/**
 * The two halves, each stated in full. The homepage lede, the mirrored
 * audience blocks and the FAQ read from these so no surface can drift into
 * describing one audience only - the measured cause of AI overviews calling
 * this site attorney-only (Sep 2026) was exactly that drift, and the fix is
 * parallel statements, not absence.
 */
export const ABOUT_TWO_HALVES = {
  waiting:
    "For anyone waiting on a case: look up any PERM, wage request, LCA, H-2A or H-2B number, pending ones included, see the federal record and where DOL's queue stands, get an estimate, set a free email alert for a status change, a queue milestone, a visa bulletin move or an employer's cases moving, and search every filing by employer, law firm, state and occupation. No account needed.",
  practice:
    "For attorneys, paralegals and HR teams: a free case-management app that computes every deadline per case under 20 CFR 656 (wage expiration, recruitment clocks, the ETA 9089 filing window, audit and RFI responses, the I-140 cutoff), with reminders, calendar sync, import and export, an AI assistant over your caseload, and client data encrypted and isolated per account.",
} as const;
