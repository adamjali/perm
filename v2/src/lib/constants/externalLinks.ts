/**
 * External Links
 *
 * Single source of truth for every off-site URL the app renders: the source
 * repository, its issue entry points, and social profiles.
 *
 * These were previously hardcoded across Footer, the contact page, and the
 * settings Support section, and had drifted into placeholders that did not
 * resolve — a bare `https://github.com`, and `https://github.com/issues`,
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
  // No LinkedIn entry: no brand profile exists yet. Linking linkedin.com bare,
  // as this footer used to, is a dead link on every page.
] as const satisfies readonly SocialLink[];
