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
    // FULL WIDTH, on Adam's note: "feel free to take all the space width wise
    // left and right we dont need to be contained." The rail takes a fixed
    // column and the content keeps whatever measure its own page sets, so
    // prose does not stretch to the monitor just because the frame could.
    // `lg:flex`, NOT `flex`. The row only exists where the rail does.
    //
    // This shipped as an unconditional `flex` and desktop looked perfect,
    // which is the whole reason both viewports get measured. Below `lg` the
    // desktop rail is hidden but the MOBILE disclosure is still a flex item,
    // so it took a column of its own and squeezed the article into what was
    // left: the h1 broke to one word per line at 390px. Measured, not
    // guessed - the nav element reported a height of 32,268px, stretched to
    // match a column of text it should never have been beside.
    // `max-lg:pt-3` buys the phone's edge handle its own space. The handle is
    // a 44px tap target - the craft floor, not negotiable - pinned flush under
    // a 71px header, so it runs to y=116 while the first line of a page used to
    // start at 112. Adam: "the arrow covers :/". Twelve pixels of top padding
    // below `lg` is the whole fix, and it is far cheaper than the alternative:
    // insetting the text column by the handle's 44px width would take a 390px
    // screen's measure down by a tenth for every reader, scrolled or not.
    // NO `mx-auto max-w-[1600px]` HERE, and that is the fix rather than an
    // omission. The rail cancels the shell's own padding with `-ml-4 sm:-ml-6`
    // so its current tab can run from the screen edge, which is the whole
    // shape of the design. A fixed negative margin cannot cancel a VARIABLE
    // auto margin, so as soon as the viewport passed 1600px the centring put
    // the rail back inside the page: measured at 1920px it sat 155px from the
    // left edge, and at 2560px it would be ~480px. Adam, on a wider screen:
    // "the side panel ... wasn't aligned snapped glued touching the left side
    // there was space".
    //
    // Dropping the cap is safe because every one of the 32 data pages already
    // sets its own measure (max-w-3xl through max-w-7xl), which is what the
    // note above always said. Below 1600px this changes nothing at all - the
    // shell was never wide enough to be centred - and above it the rail is
    // flush and the content lands within ~7px of where it used to.
    <div className="w-full px-4 max-lg:pt-3 sm:px-6 lg:flex lg:gap-8">
      <DataRail />
      {/* `min-w-0` is the load-bearing class here. A flex item's default
          minimum is its content, so one wide table or a long unbroken case
          number would push the column past the viewport and take the whole
          page into horizontal scroll - with the rail dragged off screen. */}
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
