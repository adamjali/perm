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

import { detailName } from "@/lib/breadcrumbNames";
import { SITE_URL } from "@/lib/constants/site";
import { OVERVIEW, PAGE_NAMES, isDataPath, sectionForPath } from "@/lib/siteMap";
import { MONTH_NAMES } from "@convex/lib/months";
import { HOME_NAME, TRANSLATED_PAGE_NAMES, translatedPage } from "@/lib/i18n/lang";

export interface Crumb {
  name: string;
  href: string;
}

const HOME: Crumb = { name: "Home", href: "/" };
const DATA: Crumb = { name: OVERVIEW.name, href: OVERVIEW.href };

/** A month segment ("2025-11") as a name, or null. */
function monthName(segment: string): string | null {
  const month = /^(\d{4})-(\d{2})$/.exec(segment);
  const name = month ? MONTH_NAMES[Number(month[2]) - 1] : undefined;
  return month && name ? `${name} ${month[1]}` : null;
}

/**
 * A segment the URL itself names: a month ("2025-11") anywhere, a day ("15") under a
 * month ("January 15"), or, last, a letter ("a").
 */
function segmentName(segment: string, parent: string | undefined, last: boolean): string | null {
  const month = monthName(segment);
  if (month) return month;
  const inMonth = parent ? monthName(parent) : null;
  if (inMonth && /^\d{2}$/.test(segment)) return `${inMonth.split(" ")[0]} ${Number(segment)}`;
  if (last && /^[a-z0-9]$/i.test(segment)) return segment.toUpperCase();
  return null;
}

function normalise(pathname: string): string {
  return pathname.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
}

/** The trail for a public path, Home first. Empty for the home page itself. */
export function breadcrumbTrail(pathname: string): Crumb[] {
  const path = normalise(pathname);
  if (path === "/") return [];

  // A translated page (/es/perm-case-status) is home and then the page, in its own language. Walking its URL
  // would name /es, which is the Spanish guide, not this page's parent.
  const translated = translatedPage(path);
  if (translated) {
    return [
      { name: HOME_NAME[translated.lang], href: "/" },
      { name: TRANSLATED_PAGE_NAMES[translated.page][translated.lang], href: path },
    ];
  }

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
      push(section.href, PAGE_NAMES.get(section.href) ?? section.name);
    }
  }

  // Every ancestor the site names, then the page itself.
  const segments = path.split("/").filter(Boolean);
  for (let i = 1; i <= segments.length; i++) {
    const prefix = `/${segments.slice(0, i).join("/")}`;
    const last = i === segments.length;
    const named = PAGE_NAMES.get(prefix) ?? segmentName(segments[i - 1]!, segments[i - 2], last);
    push(prefix, named ?? (last ? detailName(path) : null));
  }

  return trail.length > 1 ? trail : [];
}

/**
 * Whether the bar emits the BreadcrumbList for this page: its trail ends at the
 * page under a name the menus or the URL's own month or letter give. A detail
 * page named from its slug (a state, a bulletin line, a review stage) shows its
 * name in the bar too, but emits its own list with the name it renders, so a
 * page never carries two.
 */
export function trailNamesPage(pathname: string): boolean {
  const path = normalise(pathname);
  return breadcrumbTrail(path).at(-1)?.href === path && detailName(path) === null;
}

/** Whether the visible trail ends on the page itself. */
export function trailEndsAtPage(pathname: string): boolean {
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
