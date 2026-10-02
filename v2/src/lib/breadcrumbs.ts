/**
 * Where a page sits in the site, as a breadcrumb trail, derived from the
 * names the site's menus already give its pages.
 *
 * One function for every public page, so a page added tomorrow gets a trail
 * by living at its URL, not by remembering to declare one. Search engines
 * read the matching BreadcrumbList (components/layout/SiteBreadcrumbs.tsx) to
 * understand the site's structure.
 *
 * The trail is the page's ancestors plus the page itself when it has a name.
 * A detail page whose name only the page knows (an employer, a firm) ends at
 * its parent; its H1 names it.
 */

import { OVERVIEW, SECTIONS, isDataPath, sectionForPath } from "@/components/tools/dataSections";
import { SITE_URL } from "@/lib/constants/site";
import {
  CONTENT_NAV_LINKS,
  FOOTER_COLUMNS,
  LEARN_NAV_LINKS,
  PUBLIC_NAV_LINKS,
  TOOL_NAV_LINKS,
} from "@/lib/constants/navigation";

export interface Crumb {
  name: string;
  href: string;
}

const HOME: Crumb = { name: "Home", href: "/" };
const DATA: Crumb = { name: "Data", href: OVERVIEW.href };

/**
 * Names for pages the menus don't list, and a few the menus word for a
 * different place: "Next bulletin" is right in the side menu, but as the
 * parent of a month's bulletin the page is the visa bulletin.
 */
const OWN_NAMES: Record<string, string> = {
  "/visa-bulletin": "Visa bulletin",
  "/perm-employers/browse": "Browse A to Z",
  "/perm-attorneys/browse": "Browse A to Z",
  "/perm-wages/browse": "Browse A to Z",
  "/es": "Español",
  "/zh": "中文",
  "/ko": "한국어",
  "/vi": "Tiếng Việt",
  "/pt-br": "Português",
};

/** Every page name the site gives, by path. The first source to name a path wins. */
const NAMES: ReadonlyMap<string, string> = (() => {
  const names = new Map<string, string>(Object.entries(OWN_NAMES));
  const add = (links: readonly { href: string; label: string }[]) => {
    for (const l of links) if (!names.has(l.href)) names.set(l.href, l.label);
  };
  add(SECTIONS);
  add(TOOL_NAV_LINKS);
  add(PUBLIC_NAV_LINKS);
  add(LEARN_NAV_LINKS);
  add(CONTENT_NAV_LINKS);
  for (const col of FOOTER_COLUMNS) add(col.links);
  return names;
})();

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A last segment the URL itself names: a month ("2025-11") or a letter ("a"). */
function segmentName(segment: string): string | null {
  const month = /^(\d{4})-(\d{2})$/.exec(segment);
  if (month) {
    const name = MONTHS[Number(month[2]) - 1];
    return name ? `${name} ${month[1]}` : null;
  }
  if (/^[a-z0-9]$/i.test(segment)) return segment.toUpperCase();
  return null;
}

function normalise(pathname: string): string {
  return pathname.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
}

/** The trail for a public path, Home first. Empty for the home page itself. */
export function breadcrumbTrail(pathname: string): Crumb[] {
  const path = normalise(pathname);
  if (path === "/") return [];

  const trail: Crumb[] = [HOME];
  const push = (href: string, name: string | null | undefined) => {
    if (name && !trail.some((c) => c.href === href)) trail.push({ name, href });
  };

  if (isDataPath(path)) {
    push(DATA.href, DATA.name);
    // A calculator under /tools/ is filed under Calculators, whose page isn't
    // one of its URL's ancestors; every other section is, and comes in order
    // below.
    const section = sectionForPath(path);
    if (section && !(path === section.href || path.startsWith(`${section.href}/`))) {
      push(section.href, NAMES.get(section.href) ?? section.label);
    }
  }

  // Every ancestor the site names, then the page itself.
  const segments = path.split("/").filter(Boolean);
  for (let i = 1; i <= segments.length; i++) {
    const prefix = `/${segments.slice(0, i).join("/")}`;
    const last = i === segments.length;
    push(prefix, NAMES.get(prefix) ?? (last ? segmentName(segments[i - 1]!) : null));
  }

  return trail.length > 1 ? trail : [];
}

/** Whether the trail for a path ends at the page itself (it has a name the menus give). */
export function trailNamesPage(pathname: string): boolean {
  return breadcrumbTrail(pathname).at(-1)?.href === normalise(pathname);
}

/**
 * schema.org BreadcrumbList for a page. `name` is the page's own name, for a
 * detail page the menus can't name (an employer, an article); the shared bar
 * emits the list for every page they can, so a page passes a name only when
 * `trailNamesPage` is false, and the two never both emit one.
 */
export function breadcrumbSchema(pathname: string, name?: string) {
  const trail = breadcrumbTrail(pathname);
  const path = normalise(pathname);
  const items = name && trail.at(-1)?.href !== path ? [...trail, { name, href: path }] : trail;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList" as const,
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.href === "/" ? "" : c.href}`,
    })),
  };
}
