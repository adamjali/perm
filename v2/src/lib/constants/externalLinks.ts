/**
 * External Links
 *
 * Single source of truth for every off-site URL the app renders: the brand's
 * owned pages, the one personal profile the site names, and where a bug
 * report or an idea goes.
 *
 * NO GITHUB HANDLE ANYWHERE ON THE PUBLIC SITE. No URL here points at the
 * source repository, so none can come back through a call site; the deploy
 * pipeline still targets the repository (`src/app/api/cron/dispatch/jobs.ts`),
 * it is simply not a public link. Bug reports and feature requests go to the
 * support mailbox. The X account is linked from the footer and the About
 * contact line only, never on the Organization node.
 */

/**
 * The brand's owned surfaces. Each one is a page Google can read and
 * corroborate the name against ("web references to the site" is the last
 * source in its site-names doc), and each is emitted as an Organization
 * `sameAs` in structured data. Both resolve and name PERM Tracker.
 */
export const MEDIUM_PROFILE_URL = "https://medium.com/@permtracker";
export const PRODUCT_HUNT_URL = "https://www.producthunt.com/products/perm-tracker";
/** A personal profile, declared on the Person node, never on the Organization. */
export const LINKEDIN_SABRINA_URL = "https://www.linkedin.com/in/sabrina-soltau-5b2682171";
/**
 * The X account the product posts from. A personal handle, so it is linked
 * (footer, About contact line) and never asserted as the Organization's
 * `sameAs`; `structuredData.test.ts` pins that.
 */
export const X_PROFILE_URL = "https://x.com/adamj3ali";

/** Where people leave a review of the site (Senja's hosted form). */
export const REVIEW_URL = "https://senja.io/p/perm-tracker/r/FXAjpr";

/** The one support address, also rendered on the contact page. */
export const SUPPORT_EMAIL_ADDRESS = "support@permtracker.app";

/**
 * Where a bug report or an idea goes: the support mailbox, with the subject
 * pre-filled so the two arrive sorted.
 */
export const BUG_REPORT_URL = `mailto:${SUPPORT_EMAIL_ADDRESS}?subject=Bug%20report`;
export const FEATURE_REQUEST_URL = `mailto:${SUPPORT_EMAIL_ADDRESS}?subject=Feature%20request`;

export interface SocialLink {
  href: string;
  label: string;
  icon: "twitter" | "linkedin";
}

/**
 * Social profiles rendered in the footer.
 *
 * Only list a profile here once it actually exists and resolves. The footer
 * renders this array as-is, so an entry that 404s ships a dead link on every
 * page. Omitting a network is strictly better than linking its bare homepage,
 * which is what these used to do.
 */
export const SOCIAL_LINKS = [
  // x.com rather than twitter.com: twitter.com only 301s here, and the footer
  // glyph is already the X mark. Label names the platform but keeps the old
  // name for recognition, since the icon alone is still ambiguous to many users.
  { href: X_PROFILE_URL, label: "X (formerly Twitter)", icon: "twitter" },
  // A personal profile, not a company page. She is the one person the site
  // names (the About page). Articles and emails are signed by the team. Swap it
  // for a company page if one is ever created.
  {
    href: LINKEDIN_SABRINA_URL,
    label: "LinkedIn",
    icon: "linkedin",
  },
] as const satisfies readonly SocialLink[];

/**
 * Which bylines are PEOPLE, and where to find them.
 *
 * Articles are credited to the site's team, not a named person: each MDX file
 * carries its type's byline (CONTENT_TYPE_CONFIG[type].byline in
 * src/lib/content/types.ts), and content-frontmatter.test.ts holds every file
 * to it. A team byline is emitted as an Organization tied to the site's own.
 *
 * This map is the gate a person's name has to pass before any byline could
 * publish it as a Person: a listed name becomes a Person with `sameAs`, its
 * profile being what turns a name into a checkable identity. Anything absent
 * stays an Organization, so a new name in a frontmatter file cannot silently
 * invent a person with no profile behind them.
 */
export const KNOWN_PERSON_AUTHORS: Record<string, { url: string }> = {
  "Sabrina Soltau": { url: LINKEDIN_SABRINA_URL },
};
