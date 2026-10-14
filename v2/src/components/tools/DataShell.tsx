"use client";

import { usePathname } from "next/navigation";

import { sectionForPath, sectionPages } from "@/lib/siteMap";
import { SectionList } from "./SectionList";

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
export function DataShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionPages(pathname);
  if (!section) return <>{children}</>;
  const current = sectionForPath(pathname)?.href ?? pathname;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      <SectionList
        title={section.title}
        pages={section.pages}
        current={current}
        placement="side"
        className="hidden pt-10 lg:block"
      />
      {/* `min-w-0`: a grid item's minimum is its content, so one wide table
          would otherwise push the column past the viewport. */}
      <div className="min-w-0">
        {children}
        <SectionList
          title={section.title}
          pages={section.pages}
          current={current}
          placement="end"
          className="mt-16 border-t border-border pt-8 pb-4 lg:hidden"
        />
      </div>
    </div>
  );
}
