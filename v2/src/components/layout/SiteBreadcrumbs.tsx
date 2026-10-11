"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { isDataPath } from "@/components/tools/dataSections";
import { WatchLink, showsWatchBanner } from "@/components/tools/WatchBanner";
import { breadcrumbSchema, breadcrumbTrail, trailNamesPage } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

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
 */
export function SiteBreadcrumbs() {
  const pathname = usePathname();
  const trail = breadcrumbTrail(pathname);
  if (trail.length === 0) return null;
  const endsAtPage = trailNamesPage(pathname);

  const watch = isDataPath(pathname) && showsWatchBanner(pathname);

  return (
    // One bar: the trail on the left and, on data pages, the free case alert
    // as a tab at the right end (WatchLink).
    <div
      className={cn(
        "flex items-stretch justify-between gap-4 border-b-2 border-border bg-background pl-4 sm:pl-6",
        watch ? "pr-0" : "pr-4 sm:pr-6",
        // The data menu's edge handle sits at the left on a phone.
        isDataPath(pathname) && "max-lg:pl-16",
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0">
        {endsAtPage ? <JsonLdScript schema={breadcrumbSchema(pathname)} /> : null}
        <ol className="flex flex-wrap items-center gap-x-1.5 text-sm">
          {trail.map((crumb, i) => {
            const current = endsAtPage && i === trail.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 ? <CaretRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground" /> : null}{" "}
                {current ? (
                  <span aria-current="page" className="inline-flex min-h-[44px] items-center font-semibold text-foreground">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="inline-flex min-h-[44px] items-center text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>{" "}
      {watch ? <WatchLink /> : null}
    </div>
  );
}
