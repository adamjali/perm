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
  // names, the public voice of the product's email (every message signs off
  // "Sabrina S. / PERM Tracker Team") and the byline on every article, so
  // this is consistent with how the brand presents itself everywhere else.
  // Swap it for a company page if one is ever created.
  {
    href: LINKEDIN_SABRINA_URL,
    label: "LinkedIn",
    icon: "linkedin",
  },
] as const satisfies readonly SocialLink[];

/**
 * The byline on articles, and the profile that corroborates it.
 *
 * Publishing a person's name is an identity decision rather than an SEO one,
 * so the site owner makes it, and one person is named everywhere: bylines,
 * the About page, the Organization schema and the footer.
 *
 * WHY A PERSON AT ALL. Articles credited `Organization: "PERM Tracker Team"`,
 * which asserts no expertise and names nobody accountable. This is immigration
 * guidance - the category where Google weighs experience and accountability
 * hardest - and a named individual with a profile link is the signal it
 * looks for. `sameAs` is what turns a name into a checkable identity rather
 * than a string. The profile is a professional one (an immigration attorney's
 * LinkedIn), which is the stronger form of that signal.
 */
export const ARTICLE_AUTHOR = {
  name: "Sabrina Soltau",
  url: LINKEDIN_SABRINA_URL,
} as const;

/**
 * Which bylines are PEOPLE, and where to find them.
 *
 * Authorship is per article, from each file's own frontmatter, and it is
 * deliberately NOT uniform. A changelog entry is the product speaking and
 * belongs to the site; a guide is advice and belongs to a person. A site where
 * every single page carries the same human byline reads as manufactured, and
 * one where nothing does asserts no accountability at all.
 *
 * Anything absent from this map is emitted as an Organization, so adding a new
 * byline to a file cannot silently invent a person - the name has to be
 * registered here, with a profile that corroborates it, before it is published
 * as one.
 */
export const KNOWN_PERSON_AUTHORS: Record<string, { url: string }> = {
  [ARTICLE_AUTHOR.name]: { url: ARTICLE_AUTHOR.url },
};
