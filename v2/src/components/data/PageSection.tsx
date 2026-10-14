import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A main section of a page: a heading, a short line under it, then the
 * content, set off from what came before by space and one thin line. No box:
 * a box goes only around a figure, a form or a table inside it.
 */
export function PageSection({
  title,
  lede,
  id,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  /** One sentence under the heading saying what the section shows. */
  lede?: ReactNode;
  id?: string;
  /** Beside the heading on wide screens: a headline figure or a link. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("mt-12 border-t border-border pt-8 sm:mt-16", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={headingId} className="font-heading text-2xl font-bold">
          {title}
        </h2>{" "}
        {aside ?? null}
      </div>{" "}
      {lede ? <p className="mt-2 max-w-2xl text-base leading-relaxed text-soft">{lede}</p> : null}{" "}
      <div className="mt-6">{children}</div>
    </section>
  );
}
