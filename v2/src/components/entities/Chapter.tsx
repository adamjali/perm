import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// The chapter bar sits right under the site header; a jump lands the chapter's rule just below it.
const SCROLL_MARGIN = "scroll-mt-[calc(var(--site-header-h,71px)+4rem)]";

/** One named part of the page: a heavy rule, its title, one line on what it holds. */
export function Chapter({
  id,
  title,
  dek,
  children,
  className,
}: {
  id: string;
  title: string;
  dek?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("mt-16", SCROLL_MARGIN, className)}>
      <div className="border-t-4 border-foreground pt-4">
        <h2 id={`${id}-title`} className="font-heading text-3xl font-black leading-tight sm:text-4xl">
          {title}
        </h2>{" "}
        {dek ? <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">{dek}</p> : null}
      </div>{" "}
      {children}
    </section>
  );
}
