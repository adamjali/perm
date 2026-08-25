/**
 * The heading block every authenticated page opens with.
 *
 * WHY IT EXISTS. Seven pages had each written their own, and all seven had
 * drifted to the same weaker place: `font-heading text-3xl font-bold` over a
 * default-size `text-muted-foreground` line. The public surface opens every
 * page with a mono uppercase stamp, a black display heading at a negative
 * track, and a measured lede at the 16px floor. Same product, two type
 * systems. Two callers is enough to extract; there were eight.
 *
 * WHAT THE EYEBROW IS FOR. On the public pages it carries a FACT (the DOL
 * as-of stamp), not a label. So it is optional here, and it should never
 * simply restate the heading underneath it: "Cases" over "Cases" is
 * decoration. Use it for the count, or for the section a sub-page belongs to.
 *
 * The action slot is deliberately absent. Each page arranges its own controls
 * differently (the case list keeps its view toggle beside the title, the
 * calendar puts its toolbar below), and folding that into one component meant
 * either moving controls around or growing a prop per page.
 */

import type { ReactNode } from "react";

export interface PageHeadingProps {
  /** Mono uppercase stamp above the title. Omit rather than repeat the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One sentence under the title. Optional; omitted rather than padded. */
  lede?: ReactNode;
}

export function PageHeading({ eyebrow, title, lede }: PageHeadingProps) {
  return (
    <div className="min-w-0">
      {eyebrow ? (
        <>
          <p className="mb-2 font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {eyebrow}
          </p>{" "}
        </>
      ) : null}
      <h1 className="font-heading text-3xl font-black leading-[1.08] tracking-[-0.03em] sm:text-4xl">
        {title}
      </h1>{" "}
      {lede ? (
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-foreground/70">
          {lede}
        </p>
      ) : null}
    </div>
  );
}

export default PageHeading;
