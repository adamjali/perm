"use client";

import { usePathname } from "next/navigation";

import { isDataPath } from "./dataSections";
import { DataRail } from "./DataRail";

/**
 * Puts the data rail beside the data pages, and stays out of the way anywhere
 * else.
 *
 * WHY THIS IS A WRAPPER IN THE LAYOUT AND NOT A COMPONENT ON 28 PAGES. The old
 * bar was rendered by each page, as a sibling at the top of its own container.
 * A sidebar cannot be a sibling - it has to be beside the content, which means
 * something has to own both - and the choice was between editing 28 pages to
 * wrap their bodies or putting the shell where the layout already is. The
 * layout wins: one file decides the arrangement, and a page added tomorrow
 * gets the rail by living at a data URL rather than by remembering to ask.
 *
 * `children` IS STILL A SERVER COMPONENT. It arrives as a prop, so marking
 * this file `"use client"` draws the boundary around the shell and not around
 * the pages inside it. Nothing in the data tree is pulled into the client
 * bundle by this.
 *
 * `usePathname` and not `headers()`: the hook is a client API and does not opt
 * the route out of static rendering, which reading a header would. The 25
 * public pages on a one-day ISR window stay exactly as they were, and that
 * matters more here than it looks - a cookie read in the root layout is what
 * made the whole site dynamic once already.
 */
export function DataShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isDataPath(pathname)) return <>{children}</>;

  return (
    // Full width: the rail takes a fixed column and each page sets its own
    // measure. `lg:flex`, not `flex`: below `lg` the row doesn't exist, and a
    // flex row there made the mobile disclosure a column of its own.
    // `max-lg:pt-3` keeps the phone's 44px edge handle off the first line.
    // No `mx-auto max-w-*`: the rail cancels the shell's padding with a fixed
    // negative margin to reach the screen edge, which can't cancel a variable
    // auto margin, so a centring cap would pull the rail off the edge on wide
    // screens.
    <div className="w-full px-4 max-lg:pt-3 sm:px-6 lg:flex lg:gap-8">
      {/* `contents` keeps the wrapper out of the flex layout; it exists only so
          the rail can be left off a printed page. */}
      <div className="contents print:hidden">
        <DataRail />
      </div>
      {/* `min-w-0` is the load-bearing class here. A flex item's default
          minimum is its content, so one wide table or a long unbroken case
          number would push the column past the viewport and take the whole
          page into horizontal scroll - with the rail dragged off screen. */}
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
