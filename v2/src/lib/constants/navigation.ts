/**
 * Navigation Constants
 *
 * Defines navigation links for different page contexts.
 * Used by Header, AuthHeader, and navigation components.
 */

export interface NavLink {
  href: string;
  label: string;
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
  { href: "/demo", label: "Demo" },
  { href: "/tools", label: "Tools" },
] as const satisfies readonly NavLink[];

/**
 * The tools hub, as a single link.
 *
 * The homepage branch of AuthHeader renders its section anchors rather than
 * AUTH_NAV_LINKS, so the hub has to be placed explicitly there too. Keeping the
 * href and label here means the two branches cannot drift.
 */
export const TOOLS_NAV_LINK: NavLink = { href: "/tools", label: "Tools" };

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
  { href: "/tools/perm-deadline-calculator", label: "PERM deadlines" },
] as const satisfies readonly NavLink[];

/**
 * Content hub navigation links
 * Used in footer and content section headers
 */
export const CONTENT_NAV_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/tutorials", label: "Tutorials" },
  { href: "/guides", label: "Guides" },
  { href: "/changelog", label: "Changelog" },
  { href: "/resources", label: "Resources" },
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
