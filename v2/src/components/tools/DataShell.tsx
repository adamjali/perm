"use client";

import { usePathname } from "next/navigation";

import { sectionForPath, sectionPages } from "@/lib/siteMap";
import { CaseNextStep } from "./CaseNextStep";
import { AllSectionsList, SectionList } from "./SectionList";

/**
 * Lays a data page out beside the pages of its section, and stays out of the
 * way everywhere else.
 *
 * In the layout rather than on each page, so a page added tomorrow gets its
 * section list by living at a data URL. `children` is still a server
 * component (it arrives as a prop), and `usePathname` keeps the pages static
 * where reading a header would not.
 *
 * Desktop: the list in a narrow column beside the page. Phone: the list at the
 * end of the page, after the content. Nothing sticks but the header.
 */
/** Pages that carry their own case box, so the closing one would repeat it. */
const OWN_LOOKUP: readonly RegExp[] = [
  /^\/perm-case-status/,
  /^\/case-search/,
  /^\/perm-employers\/(?!compare$|under-review$|browse$)[^/]+$/,
  /^\/perm-attorneys\/(?!browse$)[^/]+$/,
  /^\/perm-queue\/\d{4}-\d{2}/,
];

export function DataShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionPages(pathname);
  if (!section) return <>{children}</>;
  const found = sectionForPath(pathname);
  const current = found?.href ?? pathname;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <AllSectionsList current={current} group={found?.group ?? section.title} className="hidden pt-8 lg:block" />
      {/* `min-w-0`: a grid item's minimum is its content, so one wide table
          would otherwise push the column past the viewport. */}
      <div className="min-w-0">
        {children}
        {/* Every data page ends where most visitors want to go: their own case
            (status, an estimated date, an email when it moves), or an estimate
            without the number. Pages that already lead with the box skip it. */}
        {OWN_LOOKUP.some((re) => re.test(pathname)) ? null : (
          <CaseNextStep
            question="Waiting on a PERM case?"
            source="data-page-end"
            extra={{ href: "/tools/perm-timeline-calculator", label: "No number? Estimate your date" }}
            className="mt-16"
          />
        )}
        <SectionList
          title={section.title}
          pages={section.pages}
          current={current}
          placement="end"
          className="mt-12 pb-4 lg:hidden"
        />
      </div>
    </div>
  );
}
