"use client";

import { usePathname } from "next/navigation";

import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import type { DateSources } from "@/lib/pageDates";
import { isDataPath } from "@/lib/siteMap";
import { CaseNextStep } from "./CaseNextStep";
import { DataRail } from "./DataRail";

/**
 * Lays a data page out beside the data rail, and stays out of the way
 * everywhere else.
 *
 * In the layout rather than on each page, so a page added tomorrow gets the
 * rail by living at a data URL. `children` is still a server component (it
 * arrives as a prop), and `usePathname` keeps the pages static where reading a
 * header would not.
 *
 * The rail is the original's (round 2, Oct 15 2026: the owner preferred it):
 * a column with a ruled edge, the current page's tab crossing it, groups as
 * headings. Every data page ends with the case box, except the pages that
 * already lead with it.
 */
/** Pages that carry their own case box, so the closing one would repeat it. */
const OWN_LOOKUP: readonly RegExp[] = [
  /^\/perm-case-status/,
  /^\/perm-case-alerts$/,
  /^\/case-search/,
  /^\/perm-employers\/(?!compare$|under-review$|browse$)[^/]+$/,
  /^\/perm-attorneys\/(?!browse$)[^/]+$/,
  /^\/perm-queue\/\d{4}-\d{2}/,
];

export function DataShell({ children, sources }: { children: React.ReactNode; sources?: DateSources }) {
  const pathname = usePathname();
  // Off the data pages the trail sits above the page; on them it sits in the
  // content column, so the rail runs from the header down in one piece. Above
  // the rail it left the rail's edge starting a line late, under a toggle
  // floating on its own (Oct 15 2026).
  if (!isDataPath(pathname)) {
    return (
      <>
        <SiteBreadcrumbs sources={sources} />
        {children}
      </>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:flex lg:gap-8">
      {/* `contents` keeps the wrapper out of the flex layout; it exists only so
          the rail can be left off a printed page. */}
      <div className="contents print:hidden">
        <DataRail />
      </div>
      {/* `min-w-0`: a flex item's minimum is its content, so one wide table
          would otherwise push the column past the viewport. Pages set their own
          measure with mx-auto; beside the rail every page starts at the same
          edge, only its width differs. */}
      <div data-shell-column className="min-w-0 pb-16 lg:flex-1 lg:[&>.mx-auto]:ml-0 lg:[&>*>.mx-auto]:ml-0">
        <SiteBreadcrumbs inColumn sources={sources} />
        {children}
        {OWN_LOOKUP.some((re) => re.test(pathname)) ? null : (
          <CaseNextStep question="Waiting on a PERM case?" source="data-page-end" className="mt-16 max-w-5xl" />
        )}
      </div>
    </div>
  );
}
