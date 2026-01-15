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
export const AUTHENTICATED_NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/calendar", label: "Calendar" },
  { href: "/timeline", label: "Timeline" },
];

/**
 * Navigation links for public/auth pages (non-home)
 * Used in AuthHeader component on pages like /demo, /login, /signup
 */
export const AUTH_NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
];

/**
 * Section navigation for home page
 * Uses scroll-spy to highlight current section
 * Links to #section IDs within the home page
 */
export const HOME_SECTION_LINKS: NavLink[] = [
  { href: "#hero", label: "Home" },
  { href: "#journey", label: "Journey" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "Process" },
  { href: "#faq", label: "FAQ" },
];
