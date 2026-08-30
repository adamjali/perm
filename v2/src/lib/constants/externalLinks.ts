/**
 * External Links
 *
 * Single source of truth for every off-site URL the app renders: the source
 * repository, its issue entry points, and social profiles.
 *
 * These were previously hardcoded across Footer, the contact page, and the
 * settings Support section, and had drifted into placeholders that did not
 * resolve, a bare `https://github.com`, and `https://github.com/issues`,
 * which is not a real page. Centralizing them means the repo can move again
 * without hunting call sites, and `GITHUB_REPO_URL` is the only line to edit.
 *
 * The repo must stay brand-owned. This URL is rendered publicly and is also
 * emitted as the Organization `sameAs` in structured data (see
 * `src/lib/structuredData.ts`), so a personal account here republishes a
 * brand-to-person association to crawlers.
 */

/** Canonical source repository. Change this one line if the repo moves. */
export const GITHUB_REPO_URL = "https://github.com/adamjali/perm";

/** Issue list. */
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;

/**
 * Issue entry points, pinned to the templates in `.github/ISSUE_TEMPLATE/`.
 * Using `?template=` lands the reporter on the structured form (which applies
 * the `bug` / `enhancement` labels) rather than an empty issue body.
 */
export const GITHUB_BUG_REPORT_URL = `${GITHUB_ISSUES_URL}/new?template=bug_report.yml`;
export const GITHUB_FEATURE_REQUEST_URL = `${GITHUB_ISSUES_URL}/new?template=feature_request.yml`;

export interface SocialLink {
  href: string;
  label: string;
  icon: "github" | "twitter" | "linkedin";
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
  { href: GITHUB_REPO_URL, label: "GitHub", icon: "github" },
  // x.com rather than twitter.com: twitter.com only 301s here, and the footer
  // glyph is already the X mark. Label names the platform but keeps the old
  // name for recognition, since the icon alone is still ambiguous to many users.
  { href: "https://x.com/adamj3ali", label: "X (formerly Twitter)", icon: "twitter" },
  // A personal profile, not a company page, and the only entry here that points
  // at a named individual. She is already the public voice of the product's
  // email (every message signs off "Sabrina S. / PERM Tracker Team"), so this is
  // consistent with how the brand already presents itself. Swap it for a company
  // page if one is ever created.
  {
    href: "https://www.linkedin.com/in/sabrina-soltau-5b2682171",
    label: "LinkedIn",
    icon: "linkedin",
  },
] as const satisfies readonly SocialLink[];

/**
 * The byline on articles, and the profile that corroborates it.
 *
 * Approved by the site owner on 2026-08-29 before shipping, because publishing
 * a person's name is an identity decision rather than an SEO one.
 *
 * WHY A PERSON AT ALL. Articles credited `Organization: "PERM Tracker Team"`,
 * which asserts no expertise and names nobody accountable. This is immigration
 * guidance - the category where Google weighs experience and accountability
 * hardest - and the competitor outranking us credits a named individual with a
 * profile link. `sameAs` is what turns a name into a checkable identity rather
 * than a string.
 *
 * The profile is the project's own GitHub, which is a real, owned, verifiable
 * destination. It is a weaker authority signal than a professional profile
 * would be, and that is a known, accepted trade rather than an oversight.
 */
export const ARTICLE_AUTHOR = {
  name: "Adam J Ali",
  url: "https://github.com/adamjali",
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
