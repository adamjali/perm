import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A main section of a page: a heavy ink rule (the original's border-t-4), a
 * lime tab where the rule meets the heading, the heading, a short line under
 * it, then the content. The rule is what separates one part of a page from
 * the next (round 2, Oct 15 2026: "no lines or dividers or compartments").
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
    <section id={id} aria-labelledby={headingId} className={cn("relative mt-10 border-t-4 border-border pt-6 sm:mt-14 sm:pt-7", className)}>
      <span aria-hidden="true" className="absolute -top-1 left-0 h-1 w-16 bg-primary" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={headingId} className="font-heading text-2xl font-bold sm:text-[1.75rem]">
          {title}
        </h2>{" "}
        {aside ?? null}
      </div>{" "}
      {lede ? <p className="mt-2 max-w-2xl text-base leading-relaxed text-soft">{lede}</p> : null}{" "}
      <div className="mt-5">{children}</div>
    </section>
  );
}
