/**
 * The heading block every signed-in page opens with: the title, then one
 * muted line of fact under it (a count, a date), then an optional sentence.
 *
 * `meta` carries a fact, never a label: "7 cases" under "Cases", not "Cases"
 * again. The action slot is deliberately absent: each page arranges its own
 * controls (the case list keeps its view toggle beside the title).
 */

import type { ReactNode } from "react";

export interface PageHeadingProps {
  title: ReactNode;
  /** One muted line of fact under the title: a count, a date. */
  meta?: ReactNode;
  /** One sentence under the title. Omitted rather than padded. */
  lede?: ReactNode;
}

export function PageHeading({ title, meta, lede }: PageHeadingProps) {
  return (
    <div className="min-w-0">
      <h1 className="font-heading text-3xl font-bold leading-[1.08] sm:text-4xl">{title}</h1>{" "}
      {meta ? <p className="mt-2 text-base text-muted-foreground">{meta}</p> : null}{" "}
      {lede ? <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted-foreground">{lede}</p> : null}
    </div>
  );
}
