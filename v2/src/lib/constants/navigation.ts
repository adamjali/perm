/**
 * The signed-in app's navigation. The public site's pages, names and menus
 * live in `lib/siteMap.ts`.
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
