"use client";

import { IntentLink } from "@/components/ui/intent-link";
import { usePathname } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { isArticlePath } from "@/lib/breadcrumbNames";
import { breadcrumbSchema, breadcrumbTrail, trailEndsAtPage, trailNamesPage } from "@/lib/breadcrumbs";
import { isDataPath } from "@/lib/siteMap";
import { SITE_URL } from "@/lib/constants/site";
import { SCHEMA_IDS } from "@/lib/structuredData";
import { OWN_DATE, pageDate, routeOf, type DateSources } from "@/lib/pageDates";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";

/**
 * The breadcrumb bar under the header on every public page but the home page.
 *
 * Rendered once, by the public layout, from the page's URL (lib/breadcrumbs.ts),
 * so every page gets the same trail and the same look. `usePathname` keeps the
 * pages static; reading a header would make them dynamic.
 *
 * It also emits the BreadcrumbList for pages the menus name. A detail page
 * emits its own with its name through `breadcrumbSchema(path, name)`, so a
 * page never carries two.
 *
 * An article renders its own copy with `pageName` (its title), in the same
 * place: articles have no data rail, so the page's first element sits exactly
 * where the layout's bar would. The layout's copy steps aside on those paths.
 *
 * It also says when the page last changed: "Updated <day>" at the end of the
 * line, and the same day as the page's WebPage `dateModified`, both from
 * `pageDate` (lib/pageDates.ts), which the sitemap's lastmod reads too. The
 * layout passes the data days in `sources`. A page whose day only it can
 * work out (an employer, a bulletin month, the H-1B rankings) renders its own
 * copy with `date`, and the layout's copy steps aside there as on articles.
 */
export function SiteBreadcrumbs({
  pageName,
  inColumn = false,
  date,
  sources,
}: {
  pageName?: string;
  /** Inside the data shell's content column: no centring of its own, so the
   *  rail can run from the header down and the trail sits beside it. */
  inColumn?: boolean;
  /** The page's own day (YYYY-MM-DD), from a page that works it out itself. */
  date?: string;
  /** The data days, from the layout, for `pageDate`. */
  sources?: DateSources;
} = {}) {
  const pathname = usePathname();
  if (!pageName && isArticlePath(pathname)) return null;
  const route = routeOf(pathname);
  const ownCopy = Boolean(pageName) || date !== undefined;
  if (!ownCopy && route && OWN_DATE.has(route)) return null;
  const updated = date ?? (route && sources && !pageName ? pageDate(route, sources) : null);
  const page = updated ? <PageDateSchema path={pathname} date={updated} /> : null;
  const base = breadcrumbTrail(pathname);
  const trail = pageName && base.length > 0 ? [...base, { name: pageName, href: pathname }] : base;
  // The home page has no trail; it still says when it changed, to search.
  if (trail.length === 0) return page;
  const endsAtPage = Boolean(pageName) || trailEndsAtPage(pathname);
  const emitsList = !pageName && trailNamesPage(pathname);
  const day = updated ? longDate(updated) : null;
  // A page's own copy sits where the layout's would: in the content column
  // beside the rail on a data page.
  const column = inColumn || (date !== undefined && isDataPath(pathname));

  return (
    // One quiet line of text above the page, aligned with its content. It
    // doesn't stick and carries the trail and the day the page last changed.
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6",
        // Beside the rail, below lg, the trail starts past the rail's 44px
        // handle, which is fixed on the screen's left edge at this height.
        column ? "w-full pl-10 pr-4 pt-3 sm:pr-6 lg:pl-6" : "mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-6",
      )}
    >
      {page}
      <nav aria-label="Breadcrumb" className="min-w-0">
        {emitsList ? <JsonLdScript schema={breadcrumbSchema(pathname)} /> : null}
        <ol className="flex flex-wrap items-center gap-x-1 text-sm">
          {trail.map((crumb, i) => {
            const current = endsAtPage && i === trail.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 ? <CaretRightIcon aria-hidden="true" className="size-3 text-muted-foreground" /> : null}{" "}
                {current ? (
                  <span
                    aria-current="page"
                    className="inline-flex min-h-11 max-w-[min(60ch,70vw)] items-center text-soft"
                  >
                    <span className="truncate">{crumb.name}</span>
                  </span>
                ) : (
                  <IntentLink
                    href={crumb.href}
                    className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {crumb.name}
                  </IntentLink>
                )}
              </li>
            );
          })}
        </ol>
      </nav>{" "}
      {day ? (
        <p className="pb-1 text-sm text-muted-foreground sm:pb-0">
          Updated <time dateTime={updated!}>{day}</time>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The page as a WebPage with its `dateModified`, tied to the site's WebSite
 * and Organization nodes. Its address is the canonical one: the home page
 * without a trailing slash, as its canonical tag says.
 */
function PageDateSchema({ path, date }: { path: string; date: string }) {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  return (
    <JsonLdScript
      schema={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        dateModified: date,
        inLanguage: "en-US",
        isPartOf: { "@id": SCHEMA_IDS.website(SITE_URL) },
        publisher: { "@id": SCHEMA_IDS.organization(SITE_URL) },
      }}
    />
  );
}
