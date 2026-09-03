/**
 * Navigation Constants
 *
 * Defines navigation links for different page contexts.
 * Used by Header, AuthHeader, and navigation components.
 */

export interface NavLink {
  href: string;
  label: string;
  /**
   * Accessible name, when the visible label alone is ambiguous.
   *
   * Only needed where two links share a visible label but go to different
   * places - a screen reader user pulling up a list of links sees the name,
   * not the URL, so two identical entries are indistinguishable. Lighthouse
   * flags it as "Identical links have the same purpose".
   *
   * MUST CONTAIN THE VISIBLE LABEL AS A SUBSTRING (WCAG 2.5.3, Label in
   * Name). Speech-input users say what they can see, so an accessible name
   * that drops or rewords the visible text makes the control unspeakable.
   */
}

/**
 * Navigation links for authenticated pages
 * Used in the main Header component
 */
export const AUTHENTICATED_NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/calendar", label: "Calendar" },
  { href: "/timeline", label: "Timeline" },
] as const satisfies readonly NavLink[];

/**
 * Admin navigation link (conditionally shown based on user email)
 */
export const ADMIN_NAV_LINK: NavLink = {
  href: "/admin",
  label: "Admin",
};

/**
 * Navigation links for public/auth pages (non-home)
 * Used in AuthHeader component on pages like /demo, /login, /signup
 */
export const AUTH_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Data" },
] as const satisfies readonly NavLink[];

/**
 * The tools hub, as a single link.
 *
 * The homepage branch of AuthHeader renders its section anchors rather than
 * AUTH_NAV_LINKS, so the hub has to be placed explicitly there too. Keeping the
 * href and label here means the two branches cannot drift.
 */
export const TOOLS_NAV_LINK: NavLink = { href: "/tools", label: "Data" };

/**
 * The calculators, for the footer and any in-content listing.
 *
 * Ordered as the hub orders them: the overview first, then the individual
 * calculators. The suite was reachable from exactly one inbound link when it
 * shipped, which is the orphan-page defect: a page can return 200, sit in the
 * sitemap, and still be invisible because nothing indexable points at it.
 */
export const TOOL_NAV_LINKS = [
  { href: "/tools/green-card-timeline", label: "Green card timeline" },
  { href: "/tools/perm-timeline-calculator", label: "PERM processing time" },
  { href: "/tools/pwd-calculator", label: "Prevailing wage queue" },
  { href: "/tools/i140-calculator", label: "I-140 queue" },
  { href: "/tools/i485-queue-position", label: "I-485 queue position" },
  { href: "/tools/salary-explorer", label: "Salary explorer" },
  { href: "/tools/i140-trends", label: "I-140 trends" },
  { href: "/tools/priority-date-calculator", label: "Priority dates" },
  { href: "/tools/perm-deadline-calculator", label: "PERM deadlines" },
] as const satisfies readonly NavLink[];

/**
 * Content hub navigation links
 * Used in footer and content section headers
 */
export const CONTENT_NAV_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/guides", label: "Guides" },
  { href: "/changelog", label: "Changelog" },
] as const satisfies readonly NavLink[];

/**
 * Section navigation for home page
 * Uses scroll-spy to highlight current section
 * Links to #section IDs within the home page
 */
export const HOME_SECTION_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#how", label: "Process" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
] as const satisfies readonly NavLink[];

/**
 * The unified public top nav, one list for every public page including the
 * homepage.
 *
 * The homepage used to render section anchors (#how, #features) instead -
 * retired when those sections moved to /for-attorneys, and better retired
 * anyway: a nav that changes shape between pages makes the site feel like
 * two sites. Ordered by visitor priority: the person waiting first.
 */
export const PUBLIC_NAV_LINKS = [
  { href: "/perm-case-status", label: "Track my case" },
  // "Processing times", verbatim: the phrase carries ~6.7K quarterly Bing
  // impressions against zero for "timelines"/"predictor", so the nav says what
  // people search.
  //
  // It points at /perm-processing-times, the page that bears the name and
  // answers the question the phrase asks, with DOL's own published figure. It
  // used to point at /calculators, which was wrong twice: a nav label earns no
  // search impressions, so the SEO argument never applied to the TARGET; and
  // the footer already used this exact visible text for
  // /perm-processing-times, leaving two links with one name and two
  // destinations. Both agree now. The calculator hub keeps its links from the
  // homepage CTA and /tools, and this page links on to the timeline calculator.
  { href: "/perm-processing-times", label: "Processing times" },
  { href: "/tools", label: "Data" },
  { href: "/for-attorneys", label: "For attorneys" },
] as const satisfies readonly NavLink[];

/**
 * The Learn dropdown. Superset of CONTENT_NAV_LINKS on purpose: FAQ and
 * Methodology are reference pages a reader looks for under "learn", and
 * before this they were reachable only from the footer and the data strip.
 */
export const LEARN_NAV_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "FAQ" },
  { href: "/methodology", label: "Methodology" },
  { href: "/changelog", label: "Changelog" },
] as const satisfies readonly NavLink[];
