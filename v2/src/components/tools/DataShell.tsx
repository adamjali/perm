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
    // WIDER THAN THE PAGES INSIDE IT, on Adam's note: "feel free to take all
    // the space width wise left and right we dont need to be contained." The
    // rail takes a fixed column and the content keeps whatever measure its own
    // page sets, so prose does not stretch to 1,600px just because the frame
    // could.
    // `lg:flex`, NOT `flex`. The row only exists where the rail does.
    //
    // This shipped as an unconditional `flex` and desktop looked perfect,
    // which is the whole reason both viewports get measured. Below `lg` the
    // desktop rail is hidden but the MOBILE disclosure is still a flex item,
    // so it took a column of its own and squeezed the article into what was
    // left: the h1 broke to one word per line at 390px. Measured, not
    // guessed - the nav element reported a height of 32,268px, stretched to
    // match a column of text it should never have been beside.
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:flex lg:gap-8">
      <DataRail />
      {/* `min-w-0` is the load-bearing class here. A flex item's default
          minimum is its content, so one wide table or a long unbroken case
          number would push the column past the viewport and take the whole
          page into horizontal scroll - with the rail dragged off screen. */}
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
